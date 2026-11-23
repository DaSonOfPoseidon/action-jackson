using ActionJackson.Api.Email;
using ActionJackson.Api.Platform;
using ActionJackson.Api.Sites;
using ActionJackson.Core;
using ActionJackson.Core.Pricing;
using ActionJackson.Core.Validation;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Business;

// The public forms of a business site: the consultation request and the quote, with the price list and the
// calculator behind them. Everything the client sends is untrusted: it is read with a size limit, checked by
// the Core validators and priced by the Core calculator before anything is written.
//
// A write is one transaction across the site's schema and core (the email outbox), and it takes an advisory
// lock per site and email first, so the cooldown check and the customer lookup of two requests for the same
// email cannot interleave. A taken number aborts that transaction, so each attempt is a new one.
internal sealed class PublicForms(
    IServiceProvider services,
    CoreDbContext core,
    EmailOutboxWriter outbox,
    TimeProvider clock,
    IDocumentNumbers numbers,
    ILogger<PublicForms> logger)
{
    // The same email may submit again after this long.
    internal static readonly TimeSpan Cooldown = TimeSpan.FromMinutes(10);

    // The unique indexes of the numbers (see the Initial migration of the business schemas).
    internal const string ConsultationNumberIndex = "ix_consultation_requests_request_number";
    internal const string QuoteNumberIndex = "ix_quotes_quote_number";

    private const int MaxUserAgentLength = 200;

    public async Task<IResult> PricingAsync(Site site, CancellationToken cancellationToken)
    {
        var book = await LoadPriceBookAsync(SiteDbContexts.For(services, site), cancellationToken);
        return TypedResults.Ok(PricingResponse.From(book, SiteOptions.For(site)));
    }

    public async Task<IResult> CalculateAsync(Site site, HttpRequest request, CancellationToken cancellationToken)
    {
        var (input, failure) = await JsonBody.ReadAsync<CalculateInput>(request, cancellationToken);
        if (failure is not null)
        {
            return failure;
        }

        var book = await LoadPriceBookAsync(SiteDbContexts.For(services, site), cancellationToken);
        var errors = CalculateValidator.Validate(input, SiteOptions.For(site), book);
        if (!errors.IsValid)
        {
            return Invalid(errors);
        }

        try
        {
            // The public API never sends a discount: the calculator's default is 0.
            var selection = DropsOnlySelection.From(input!.Runs, input.Services, input.Centralization, input.HasExistingPanel);
            return TypedResults.Ok(CalculationResponse.From(QuoteCalculator.Calculate(book, selection)));
        }
        catch (PricingUnavailableException e)
        {
            return Unavailable(e);
        }
    }

    public async Task<IResult> CreateConsultationAsync(Site site, HttpContext http, CancellationToken cancellationToken)
    {
        var (input, failure) = await JsonBody.ReadAsync<ConsultationInput>(http.Request, cancellationToken);
        if (failure is not null)
        {
            return failure;
        }

        var options = SiteOptions.For(site);
        var errors = ConsultationValidator.Validate(input, options);
        CheckRecipient(errors, input?.Customer?.Email);
        if (!errors.IsValid)
        {
            return Invalid(errors);
        }

        // Valid: every member the validator requires is present.
        var customer = input!.Customer!;
        var property = input.Property!;
        var email = CustomerRules.NormalizeEmail(customer.Email!);
        var name = customer.Name!.Trim();
        var phone = Clean(customer.Phone);
        var isp = Clean(property.Isp);
        var squareFootage = property.SquareFootage!;
        var issues = (property.CurrentIssues ?? []).Select(issue => issue!).ToList();
        var interested = input.InterestedServices!.Select(service => service!).ToList();
        var package = input.InterestedPackage;
        var sourceIp = http.GetClientIp().ToString();
        var userAgent = UserAgentOf(http);
        var details = DetailsJson.Serialize(new ConsultationDetails(squareFootage, isp, issues, interested, package));

        var db = SiteDbContexts.For(services, site);
        try
        {
            var number = await InsertNumberedAsync(db, ConsultationNumberIndex, async (assigned, token) =>
            {
                await LockEmailAsync(db, site, email, token);
                var now = clock.GetUtcNow();
                var cutoff = now - Cooldown;
                if (await db.ConsultationRequests.AnyAsync(row => row.Email.ToLower() == email && row.CreatedAt > cutoff, token))
                {
                    throw new CooldownException();
                }

                db.ConsultationRequests.Add(new ConsultationRequest
                {
                    RequestNumber = assigned,
                    Name = name,
                    Email = email,
                    Phone = phone,
                    Status = ConsultationStatus.New,
                    Details = details,
                    SourceIp = sourceIp,
                    UserAgent = userAgent,
                    CreatedAt = now,
                    UpdatedAt = now,
                });

                outbox.QueueAdmin(core, EmailTemplates.Render(new ConsultationAdminModel(
                    site,
                    assigned,
                    name,
                    email,
                    phone,
                    options.Consultation.SquareFootage.LabelOf(squareFootage) ?? squareFootage,
                    isp,
                    issues,
                    [.. interested.Select(service => options.Consultation.InterestedServices.LabelOf(service) ?? service)],
                    package is null ? null : options.Consultation.InterestedPackage.LabelOf(package) ?? package,
                    sourceIp,
                    now)));
                outbox.Queue(core, email, EmailTemplates.Render(new ConsultationAckModel(site, assigned, name)));

                await db.SaveChangesAsync(token);
                await core.SaveChangesAsync(token);
            }, cancellationToken);

            return Results.Json(new ConsultationCreated(number), statusCode: StatusCodes.Status201Created);
        }
        catch (CooldownException)
        {
            return TooSoon();
        }
    }

    public async Task<IResult> CreateQuoteAsync(Site site, HttpContext http, CancellationToken cancellationToken)
    {
        var (input, failure) = await JsonBody.ReadAsync<QuoteInput>(http.Request, cancellationToken);
        if (failure is not null)
        {
            return failure;
        }

        var options = SiteOptions.For(site);
        var db = SiteDbContexts.For(services, site);
        var book = await LoadPriceBookAsync(db, cancellationToken);
        var errors = QuoteValidator.Validate(input, options, book);
        CheckRecipient(errors, input?.Customer?.Email);
        if (!errors.IsValid)
        {
            return Invalid(errors);
        }

        // Valid: every member the validator requires is present.
        var quoteInput = input!;
        var kind = quoteInput.Kind!;
        var home = quoteInput.HomeInfo!;
        var address = home.Address!;

        QuoteCalculation calculation;
        DropsOnlySelection? selection = null;
        try
        {
            // The price comes from the calculator and the catalog, never from the request, and the public
            // API never gives a discount.
            if (kind == QuoteKinds.DropsOnly)
            {
                selection = DropsOnlySelection.From(quoteInput.Runs, quoteInput.Services, quoteInput.Centralization, home.HasMediaPanel);
                calculation = QuoteCalculator.Calculate(book, selection);
            }
            else
            {
                calculation = QuoteCalculator.CalculateWholeHome(book);
            }
        }
        catch (PricingUnavailableException e)
        {
            return Unavailable(e);
        }

        var customerInput = quoteInput.Customer!;
        var email = CustomerRules.NormalizeEmail(customerInput.Email!);
        var name = customerInput.Name!.Trim();
        var phone = Clean(customerInput.Phone);
        var street = address.Street!.Trim();
        var city = address.City!.Trim();
        var state = address.State!.Trim().ToUpperInvariant();
        var zip = address.Zip!.Trim();
        var sourceIp = http.GetClientIp().ToString();
        var userAgent = UserAgentOf(http);
        var whole = kind == QuoteKinds.WholeHome ? WholeHomeOf(quoteInput.WholeHome!) : null;
        var details = DetailsJson.Serialize(new QuoteDetails(
            new QuoteCustomerDetails(name, phone),
            new QuoteAddressDetails(street, city, state, zip),
            new QuoteHomeDetails(
                home.HomeAge!,
                home.Stories!.Value,
                home.AtticAccess!,
                home.HasMediaPanel ?? false,
                Clean(home.MediaPanelLocation),
                home.HasCrawlspaceOrBasement ?? false),
            kind == QuoteKinds.DropsOnly ? quoteInput.Centralization : null,
            whole,
            sourceIp,
            userAgent));

        try
        {
            var number = await InsertNumberedAsync(db, QuoteNumberIndex, async (assigned, token) =>
            {
                await LockEmailAsync(db, site, email, token);
                var now = clock.GetUtcNow();
                var cutoff = now - Cooldown;
                var recent = await db.Quotes.AnyAsync(
                    existing => existing.CreatedAt > cutoff
                        && db.Customers.Any(customer => customer.Id == existing.CustomerId && customer.Email.ToLower() == email),
                    token);
                if (recent)
                {
                    throw new CooldownException();
                }

                // An existing customer is reused as it is: anyone can type someone else's email, so a
                // public request never changes a customer row. What the visitor typed stays in the details.
                var customerId = await db.Customers
                    .Where(customer => customer.Email.ToLower() == email)
                    .OrderBy(customer => customer.CreatedAt)
                    .ThenBy(customer => customer.Id)
                    .Select(customer => (Guid?)customer.Id)
                    .FirstOrDefaultAsync(token);
                if (customerId is null)
                {
                    var created = new Customer
                    {
                        Name = name,
                        Email = email,
                        Phone = phone,
                        AddressLine1 = street,
                        City = city,
                        State = state,
                        PostalCode = zip,
                        CreatedAt = now,
                        UpdatedAt = now,
                    };
                    db.Customers.Add(created);
                    customerId = created.Id;
                }

                var quote = new Quote
                {
                    QuoteNumber = assigned,
                    CustomerId = customerId.Value,
                    Status = QuoteStatus.Pending,
                    Kind = kind,
                    DiscountPercent = 0m,
                    Subtotal = calculation.Subtotal,
                    Total = calculation.Total,
                    Deposit = calculation.Deposit,
                    Details = details,
                    CreatedAt = now,
                    UpdatedAt = now,
                };
                for (var i = 0; i < calculation.Lines.Count; i++)
                {
                    var line = calculation.Lines[i];
                    quote.Lines.Add(new QuoteLine
                    {
                        CatalogItemId = line.CatalogItemId,
                        Description = line.Description,
                        Quantity = line.Quantity,
                        UnitPrice = line.UnitPrice,
                        LineTotal = line.LineTotal,
                        IsLabor = false,
                        SortOrder = i,
                    });
                }

                db.Quotes.Add(quote);

                // Only the admin is told: there is no customer quote email, and none is promised.
                outbox.QueueAdmin(core, EmailTemplates.Render(new QuoteAdminModel(
                    site,
                    assigned,
                    options.Quote.Kinds.LabelOf(kind) ?? kind,
                    name,
                    email,
                    phone,
                    ScopeLines(options, selection, whole),
                    kind == QuoteKinds.WholeHome ? null : calculation.Total,
                    calculation.Deposit,
                    HomeLines(home, street, city, state, zip),
                    sourceIp,
                    now)));

                await db.SaveChangesAsync(token);
                await core.SaveChangesAsync(token);
            }, cancellationToken);

            return Results.Json(
                new QuoteCreated(number, kind, calculation.Subtotal, calculation.Total, calculation.Deposit),
                statusCode: StatusCodes.Status201Created);
        }
        catch (CooldownException)
        {
            return TooSoon();
        }
    }

    // The active catalog items the calculator knows. Read once per request, so the validator and the
    // calculator see the same prices.
    private static async Task<PriceBook> LoadPriceBookAsync(BusinessDbContext db, CancellationToken cancellationToken)
    {
        string[] codes = [.. PriceCodes.All];
        var rows = await db.CatalogItems
            .AsNoTracking()
            .Where(item => codes.Contains(item.Code))
            .Select(item => new { item.Id, item.Code, item.Name, item.Price, item.ThresholdAmount, item.IsActive })
            .ToListAsync(cancellationToken);
        return new PriceBook(rows.Select(row =>
            new CatalogEntry(row.Id, row.Code, row.Name, row.Price, row.ThresholdAmount, row.IsActive)));
    }

    // Each attempt is a transaction of its own: a taken number is a unique violation, which aborts the
    // Postgres transaction, so the next number needs a new one, and a clean change tracker.
    private Task<string> InsertNumberedAsync(
        BusinessDbContext db,
        string constraint,
        Func<string, CancellationToken, Task> work,
        CancellationToken cancellationToken) =>
        UniqueNumber.InsertWithRetryAsync(
            async (assigned, token) =>
            {
                db.ChangeTracker.Clear();
                core.ChangeTracker.Clear();
                await BusinessTransaction.ExecuteAsync(db, core, attempt => work(assigned, attempt), token);
            },
            constraint,
            numbers.Next,
            cancellationToken);

    // Held until the transaction ends. Two requests for the same site and email take turns, so the
    // second sees the first one's rows.
    internal static Task LockEmailAsync(BusinessDbContext db, Site site, string email, CancellationToken cancellationToken)
    {
        var key = $"{site.Schema()}:{email}";
        return db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", cancellationToken);
    }

    // The mail library is stricter than the validator about a few addresses: refuse them as a 400 now
    // rather than fail the queueing after the work is done.
    internal static void CheckRecipient(ValidationErrors errors, string? email, string path = "customer.email")
    {
        if (email is not null
            && !errors.Keys.Contains(path)
            && !EmailOutboxWriter.TryParseRecipient(CustomerRules.NormalizeEmail(email), out _))
        {
            errors.Add(path, "Enter a valid email address.");
        }
    }

    internal static IResult Invalid(ValidationErrors errors) => Results.ValidationProblem(errors.ToDictionary());

    private static IResult TooSoon() =>
        Results.Problem(
            statusCode: StatusCodes.Status429TooManyRequests,
            detail: "Please wait 10 minutes between requests.");

    // The catalog cannot price the request (a deposit item is missing or inactive). It is a fault of ours,
    // not the client's: say so, log it, and save nothing. A zero deposit is never guessed.
    private IResult Unavailable(PricingUnavailableException error)
    {
        logger.LogError(
            "Pricing is not available: the active catalog item {Code} is missing, so a request was refused.",
            error.Code);
        return Results.Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            detail: "Pricing isn't available right now. Please try again later.");
    }

    // Trimmed text, or null when there is none.
    internal static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    // The User-Agent header: no control characters, at most 200 characters, never half a surrogate pair.
    internal static string UserAgentOf(HttpContext http)
    {
        var clean = new string([.. http.Request.Headers.UserAgent.ToString().Where(c => !char.IsControl(c))]).Trim();
        if (clean.Length == 0)
        {
            return "Unknown";
        }

        var length = Math.Min(clean.Length, MaxUserAgentLength);
        if (length < clean.Length && char.IsHighSurrogate(clean[length - 1]))
        {
            length--;
        }

        return clean[..length];
    }

    private static WholeHomeDetails WholeHomeOf(WholeHomeInput whole)
    {
        // A customer with their own equipment states no brand; one without describes no equipment.
        var own = whole.HasOwnEquipment == true;
        return new WholeHomeDetails(
            new WholeHomeScopeDetails(
                whole.Scope?.Networking == true,
                whole.Scope?.Security == true,
                whole.Scope?.Voip == true),
            Clean(whole.InternetSpeed),
            own,
            own ? Clean(whole.EquipmentDescription) : null,
            own ? null : whole.NetworkingBrand,
            own ? null : whole.SecurityBrand,
            whole.SurveyPreference,
            Clean(whole.NetworkingDetails),
            Clean(whole.SecurityDetails),
            Clean(whole.VoipDetails),
            Clean(whole.Notes));
    }

    private static List<EmailLine> ScopeLines(SiteOptions options, DropsOnlySelection? selection, WholeHomeDetails? whole)
    {
        var lines = new List<EmailLine>();
        if (selection is not null)
        {
            foreach (var runType in options.Quote.RunTypes)
            {
                if (selection.Runs.GetValueOrDefault(runType.Value) is > 0 and var count)
                {
                    lines.Add(new EmailLine($"{runType.Label} Runs", count.ToString(System.Globalization.CultureInfo.InvariantCulture)));
                }
            }

            AddCount(lines, "AP Mounts", selection.ApMounts);
            AddCount(lines, "Ethernet Relocations", selection.EthernetRelocations);
            if (selection.Centralization is { } centralization)
            {
                var label = options.Quote.Centralization.LabelOf(centralization) ?? centralization;
                lines.Add(new EmailLine("Centralization", selection.HasExistingPanel && PriceCodes.CentralizationCode(centralization) == PriceCodes.MediaPanel ? $"{label} (existing panel)" : label));
            }
        }

        if (whole is not null)
        {
            var scope = new List<string>();
            if (whole.Scope.Networking)
            {
                scope.Add("Networking");
            }

            if (whole.Scope.Security)
            {
                scope.Add("Security");
            }

            if (whole.Scope.Voip)
            {
                scope.Add("VoIP");
            }

            lines.Add(new EmailLine("Scope", string.Join(", ", scope)));
            AddText(lines, "Internet Speed", whole.InternetSpeed);
            lines.Add(new EmailLine("Own Equipment", whole.HasOwnEquipment ? "Yes" : "No"));
            AddText(lines, "Equipment", whole.EquipmentDescription);
            AddText(lines, "Networking Brand", whole.NetworkingBrand);
            AddText(lines, "Security Brand", whole.SecurityBrand);
            AddText(lines, "Survey Preference", whole.SurveyPreference is null ? null : options.Quote.SurveyPreference.LabelOf(whole.SurveyPreference));
            AddText(lines, "Networking Details", whole.NetworkingDetails);
            AddText(lines, "Security Details", whole.SecurityDetails);
            AddText(lines, "VoIP Details", whole.VoipDetails);
            AddText(lines, "Notes", whole.Notes);
        }

        return lines;
    }

    private static List<EmailLine> HomeLines(HomeInfoInput home, string street, string city, string state, string zip)
    {
        var lines = new List<EmailLine>
        {
            new("Home Age", home.HomeAge!),
            new("Stories", home.Stories!.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)),
            new("Attic Access", home.AtticAccess!),
            new("Existing Media Panel", home.HasMediaPanel == true ? "Yes" : "No"),
        };
        AddText(lines, "Media Panel Location", Clean(home.MediaPanelLocation));
        lines.Add(new EmailLine("Crawlspace or Basement", home.HasCrawlspaceOrBasement == true ? "Yes" : "No"));
        lines.Add(new EmailLine("Address", $"{street}, {city}, {state} {zip}"));
        return lines;
    }

    private static void AddCount(List<EmailLine> lines, string label, int count)
    {
        if (count > 0)
        {
            lines.Add(new EmailLine(label, count.ToString(System.Globalization.CultureInfo.InvariantCulture)));
        }
    }

    private static void AddText(List<EmailLine> lines, string label, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            lines.Add(new EmailLine(label, value));
        }
    }

    // A second request for the same email inside the cooldown: thrown inside the transaction, so the
    // transaction rolls back and nothing is saved.
    private sealed class CooldownException : Exception;
}
