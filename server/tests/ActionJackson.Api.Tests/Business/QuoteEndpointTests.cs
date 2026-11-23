using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using ActionJackson.Core;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Tests;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

public class QuoteEndpointTests(TestDatabase database) : IClassFixture<TestDatabase>, IDisposable
{
    private const string Path = "/api/lan/quotes";

    private readonly FormsHost host = new(database);

    public void Dispose() => host.Dispose();

    [DbFact]
    public async Task A_drops_only_quote_is_priced_by_the_calculator_and_saved_with_its_customer_and_lines()
    {
        var email = Forms.NewEmail().ToUpperInvariant();
        var client = FormsHost.NewClient();

        using var response = await host.Post(Path, Forms.DropsOnly(email), client, userAgent: "TestAgent/1.0");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        var body = JsonSerializer.Deserialize<JsonElement>(raw);
        var number = body.GetProperty("quoteNumber").GetString()!;
        Assert.Matches("^[0-9]{8}$", number);
        Assert.Equal("drops-only", body.GetProperty("kind").GetString());
        Assert.Equal(700m, body.GetProperty("subtotal").GetDecimal());
        Assert.Equal(700m, body.GetProperty("total").GetDecimal());
        Assert.Equal(20m, body.GetProperty("deposit").GetDecimal());
        Assert.Equal(5, body.EnumerateObject().Count());
        Assert.DoesNotContain("\"id\"", raw, StringComparison.OrdinalIgnoreCase);

        await using var lan = database.Lan();
        var quote = await lan.Quotes.Include(q => q.Lines).SingleAsync(q => q.QuoteNumber == number);
        Assert.Equal(QuoteStatus.Pending, quote.Status);
        Assert.Equal(QuoteKinds.DropsOnly, quote.Kind);
        Assert.Equal(0m, quote.DiscountPercent);
        Assert.Equal((700m, 700m, 20m), (quote.Subtotal, quote.Total, quote.Deposit));
        Assert.Equal(host.Time.GetUtcNow(), quote.CreatedAt);

        Assert.Equal(6, quote.Lines.Count);
        var lines = quote.Lines.OrderBy(l => l.SortOrder).ToList();
        Assert.Equal(new[] { 0, 1, 2, 3, 4, 5 }, lines.Select(l => l.SortOrder));
        Assert.Equal(new[] { 2m, 1m, 1m, 1m, 2m, 1m }, lines.Select(l => l.Quantity));
        Assert.Equal(new[] { 100m, 150m, 150m, 50m, 25m, 100m }, lines.Select(l => l.UnitPrice));
        Assert.Equal(new[] { 200m, 150m, 150m, 50m, 50m, 100m }, lines.Select(l => l.LineTotal));
        Assert.All(lines, line =>
        {
            Assert.NotNull(line.CatalogItemId);
            Assert.False(line.IsLabor);
        });
        var cat6 = await lan.CatalogItems.SingleAsync(i => i.Code == "CAT6-RUN");
        Assert.Equal(cat6.Id, lines[0].CatalogItemId);
        Assert.Equal(cat6.Name, lines[0].Description);

        var customer = await lan.Customers.SingleAsync(c => c.Id == quote.CustomerId);
        Assert.Equal(email.ToLowerInvariant(), customer.Email);
        Assert.Equal("Jane O'Neil", customer.Name);
        Assert.Equal("(555) 123-4567", customer.Phone);
        Assert.Equal("12 Main St", customer.AddressLine1);
        Assert.Equal("Springfield", customer.City);
        Assert.Equal("IL", customer.State);
        Assert.Equal("62704", customer.PostalCode);

        var details = JsonNode.Parse(quote.Details)!;
        Assert.Equal("media-panel", (string?)details["centralization"]);
        Assert.Equal("1980-2000", (string?)details["homeInfo"]!["homeAge"]);
        Assert.Equal(2, (int?)details["homeInfo"]!["stories"]);
        Assert.Equal("Walk-in attic", (string?)details["homeInfo"]!["atticAccess"]);
        Assert.Equal("Garage", (string?)details["homeInfo"]!["mediaPanelLocation"]);
        Assert.Equal("IL", (string?)details["address"]!["state"]);
        Assert.Equal(client, (string?)details["sourceIp"]);
        Assert.Equal("TestAgent/1.0", (string?)details["userAgent"]);
        Assert.Null(details["wholeHome"]);
    }

    [DbFact]
    public async Task Only_the_admin_is_emailed_about_a_quote()
    {
        var email = Forms.NewEmail();

        using var response = await host.Post(Path, Forms.DropsOnly(email));
        var number = (await FormsHost.Json(response)).GetProperty("quoteNumber").GetString()!;

        await using var core = database.Core();
        var rows = await core.EmailOutbox.Where(m => m.Subject.Contains(number)).ToListAsync();
        var row = Assert.Single(rows);
        Assert.Equal("quote-admin", row.Template);
        Assert.Equal(FormsHost.AdminAddress, row.ToAddress);
        Assert.Contains("$700.00", row.TextBody);
        Assert.Contains("$20.00", row.TextBody);
        Assert.False(await core.EmailOutbox.AnyAsync(m => m.ToAddress == email));
    }

    [DbFact]
    public async Task A_whole_home_quote_has_no_lines_a_zero_total_and_the_whole_home_deposit()
    {
        using var response = await host.Post(Path, Forms.WholeHome());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await FormsHost.Json(response);
        Assert.Equal("whole-home", body.GetProperty("kind").GetString());
        Assert.Equal(0m, body.GetProperty("subtotal").GetDecimal());
        Assert.Equal(0m, body.GetProperty("total").GetDecimal());
        Assert.Equal(200m, body.GetProperty("deposit").GetDecimal());

        await using var lan = database.Lan();
        var number = body.GetProperty("quoteNumber").GetString()!;
        var quote = await lan.Quotes.Include(q => q.Lines).SingleAsync(q => q.QuoteNumber == number);
        Assert.Empty(quote.Lines);
        Assert.Equal(200m, quote.Deposit);
        var details = JsonNode.Parse(quote.Details)!;
        var whole = details["wholeHome"]!;
        Assert.True((bool?)whole["scope"]!["networking"]);
        Assert.False((bool?)whole["scope"]!["voip"]);
        Assert.Equal("UniFi", (string?)whole["networkingBrand"]);
        Assert.Equal("Reolink", (string?)whole["securityBrand"]);
        Assert.Equal("day-of", (string?)whole["surveyPreference"]);
        Assert.Equal("Call first", (string?)whole["notes"]);

        await using var core = database.Core();
        var admin = await core.EmailOutbox.SingleAsync(m => m.Subject.Contains(number));
        Assert.Contains("Deposit Required: $200.00", admin.TextBody);
        Assert.DoesNotContain("Total Cost", admin.TextBody);
    }

    [DbFact]
    public async Task A_customer_who_already_exists_is_reused_and_never_changed_by_a_public_request()
    {
        var email = Forms.NewEmail();
        Guid existing;
        await using (var lan = database.Lan())
        {
            var customer = new Customer { Name = "Original Name", Email = email, Phone = "5550001111", City = "Original City" };
            lan.Customers.Add(customer);
            await lan.SaveChangesAsync();
            existing = customer.Id;
        }

        var request = Forms.DropsOnly(email.ToUpperInvariant());
        request["customer"]!["name"] = "Someone Else";
        request["customer"]!["phone"] = "(555) 999-9999";
        using var response = await host.Post(Path, request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var number = (await FormsHost.Json(response)).GetProperty("quoteNumber").GetString()!;
        await using var check = database.Lan();
        var quote = await check.Quotes.SingleAsync(q => q.QuoteNumber == number);
        Assert.Equal(existing, quote.CustomerId);
        var customers = await check.Customers.Where(c => c.Email.ToLower() == email).ToListAsync();
        var kept = Assert.Single(customers);
        Assert.Equal("Original Name", kept.Name);
        Assert.Equal("5550001111", kept.Phone);
        Assert.Equal("Original City", kept.City);
        Assert.Null(kept.AddressLine1);

        // What the visitor typed is kept with the quote.
        var details = JsonNode.Parse(quote.Details)!;
        Assert.Equal("Someone Else", (string?)details["customer"]!["name"]);
        Assert.Equal("(555) 999-9999", (string?)details["customer"]!["phone"]);
    }

    [DbFact]
    public async Task The_client_cannot_choose_a_discount_status_or_number()
    {
        var request = Forms.DropsOnly();
        request["discount"] = 100;
        request["discountPercent"] = 100;
        request["status"] = "Approved";
        request["quoteNumber"] = "00000001";
        request["subtotal"] = 1;
        request["total"] = 1;
        request["deposit"] = 0;

        using var response = await host.Post(Path, request);

        var body = await FormsHost.Json(response);
        Assert.Equal(700m, body.GetProperty("total").GetDecimal());
        Assert.NotEqual("00000001", body.GetProperty("quoteNumber").GetString());
        await using var lan = database.Lan();
        var quote = await lan.Quotes.SingleAsync(q => q.QuoteNumber == body.GetProperty("quoteNumber").GetString());
        Assert.Equal(QuoteStatus.Pending, quote.Status);
        Assert.Equal(0m, quote.DiscountPercent);
    }

    [DbFact]
    public async Task A_second_quote_for_the_same_email_within_ten_minutes_is_a_429_and_after_ten_it_is_accepted()
    {
        var email = Forms.NewEmail();
        using var first = await host.Post(Path, Forms.DropsOnly(email));
        host.Time.Advance(TimeSpan.FromMinutes(9) + TimeSpan.FromSeconds(59));

        using var second = await host.Post(Path, Forms.WholeHome(email.ToUpperInvariant()));
        var problem = await FormsHost.AssertProblem(second, HttpStatusCode.TooManyRequests);
        Assert.Equal("Please wait 10 minutes between requests.", problem.GetProperty("detail").GetString());

        host.Time.Advance(TimeSpan.FromSeconds(2));
        using var third = await host.Post(Path, Forms.WholeHome(email));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, third.StatusCode);
        await using var lan = database.Lan();
        var customer = await lan.Customers.SingleAsync(c => c.Email == email);
        Assert.Equal(2, await lan.Quotes.CountAsync(q => q.CustomerId == customer.Id));
    }

    [DbFact]
    public async Task A_request_for_another_email_is_not_held_up_by_the_cooldown()
    {
        using var first = await host.Post(Path, Forms.DropsOnly());
        using var other = await host.Post(Path, Forms.DropsOnly());

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, other.StatusCode);
    }

    [DbFact]
    public async Task Two_parallel_quotes_for_one_new_email_make_one_customer()
    {
        var email = Forms.NewEmail();

        var responses = await Task.WhenAll(
            Enumerable.Range(0, 4).Select(_ => host.Post(Path, Forms.DropsOnly(email))));

        var statuses = responses.Select(r => r.StatusCode).Order().ToList();
        Assert.Equal(HttpStatusCode.Created, statuses[0]);
        Assert.All(statuses.Skip(1), status => Assert.Equal(HttpStatusCode.TooManyRequests, status));
        await using var lan = database.Lan();
        Assert.Equal(1, await lan.Customers.CountAsync(c => c.Email == email));
        Assert.Equal(1, await lan.Quotes.CountAsync(q => lan.Customers.Any(c => c.Id == q.CustomerId && c.Email == email)));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [DbFact]
    public async Task A_taken_quote_number_is_retried_and_leaves_one_quote_one_customer_and_one_email()
    {
        host.Numbers.Enqueue("50000001", "50000001", "50000002");
        using var first = await host.Post(Path, Forms.DropsOnly());
        var email = Forms.NewEmail();

        using var second = await host.Post(Path, Forms.DropsOnly(email));

        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal("50000002", (await FormsHost.Json(second)).GetProperty("quoteNumber").GetString());
        await using var lan = database.Lan();
        Assert.Equal(1, await lan.Customers.CountAsync(c => c.Email == email));
        Assert.Equal(1, await lan.Quotes.CountAsync(q => q.QuoteNumber == "50000002"));
        await using var core = database.Core();
        Assert.Equal(1, await core.EmailOutbox.CountAsync(m => m.Subject.Contains("50000001")));
        Assert.Equal(1, await core.EmailOutbox.CountAsync(m => m.Subject.Contains("50000002")));
    }

    [DbFact]
    public async Task The_honeypot_gives_a_400_and_saves_nothing()
    {
        var email = Forms.NewEmail();
        var request = Forms.DropsOnly(email);
        request["honeypot"] = "x";

        using var response = await host.Post(Path, request);

        await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
        await using var lan = database.Lan();
        Assert.False(await lan.Customers.AnyAsync(c => c.Email == email));
    }

    [DbFact]
    public async Task Validation_errors_are_keyed_by_path_and_nothing_is_saved()
    {
        var email = Forms.NewEmail();
        var request = Forms.DropsOnly(email);
        request["runs"] = new JsonObject { ["cat6"] = 51, ["coax"] = -1 };
        request["homeInfo"]!["liabilityAcknowledged"] = false;
        request["homeInfo"]!["address"]!["zip"] = "123";

        using var response = await host.Post(Path, request);

        var errors = (await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("runs.cat6", out _));
        Assert.True(errors.TryGetProperty("runs.coax", out _));
        Assert.True(errors.TryGetProperty("homeInfo.liabilityAcknowledged", out _));
        Assert.True(errors.TryGetProperty("homeInfo.address.zip", out _));
        await using var lan = database.Lan();
        Assert.False(await lan.Customers.AnyAsync(c => c.Email == email));
    }

    [DbFact]
    public async Task An_unknown_kind_is_a_400()
    {
        var request = Forms.DropsOnly();
        request["kind"] = "Drops Only";

        using var response = await host.Post(Path, request);

        var errors = (await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("kind", out _));
    }

    [DbFact]
    public async Task The_fourth_quote_from_one_address_in_fifteen_minutes_is_a_429()
    {
        var client = FormsHost.NewClient();
        for (var i = 0; i < 3; i++)
        {
            using var accepted = await host.Post(Path, Forms.DropsOnly(), client);
            Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
        }

        using var refused = await host.Post(Path, Forms.DropsOnly(), client);

        var problem = await FormsHost.AssertProblem(refused, HttpStatusCode.TooManyRequests);
        Assert.Contains("Too many quote requests", problem.GetProperty("detail").GetString());
    }
}
