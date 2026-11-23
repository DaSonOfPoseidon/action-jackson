using System.Globalization;
using System.Text.Json;
using ActionJackson.Api.Email;
using ActionJackson.Api.Platform;
using ActionJackson.Api.Sites;
using ActionJackson.Core;
using ActionJackson.Core.Booking;
using ActionJackson.Core.Validation;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ActionJackson.Api.Business;

// Availability and appointment booking of a business site. Everything the client sends (the query, the
// body, the Idempotency-Key header) is untrusted: it is checked by the Core validator and the Core rules
// (BookingRules, the one implementation of "is this start open", shared by both endpoints) before anything
// is written.
//
// A booking is one transaction across the site's schema and core (the email outbox and the receipt). It
// takes up to three advisory locks, always in this order: the email's (the same key as the quote and
// consultation forms), the Idempotency-Key's when there is one, and the Chicago start date's. The receipt is
// decided under the email and key locks, the quote, the one-per-quote and 24-hour rules under the email lock,
// and whether the time is open under all of them, so two requests for the same email, key or day take turns
// and the second sees the first one's rows. A drops-only install that runs past
// midnight also overlaps the next date's instants, which no day lock covers; the database's exclusion
// constraint is the last line there, and its error is answered like the check's.
internal sealed class AppointmentBooking(
    IServiceProvider services,
    CoreDbContext core,
    EmailOutboxWriter outbox,
    TimeProvider clock)
{
    // The constraints of the appointments table (see BusinessSchemaSql and the Initial migration of lan).
    internal const string NoOverlapConstraint = "appointments_no_overlap";
    internal const string QuoteIndex = "ix_appointments_quote_id";

    private const string ExclusionViolation = "23P01";
    private const string DeadlockDetected = "40P01";
    private const string SerializationFailure = "40001";

    // A booking is decided again, this many attempts in all, when the database cancels it to end a deadlock.
    private const int MaxAttempts = 3;

    // Most days one availability request may cover.
    private const int MaxRangeDays = 31;

    private static readonly JsonSerializerOptions ResponseJson = new(JsonSerializerDefaults.Web);

    // Quote statuses a customer may still book against.
    private static readonly QuoteStatus[] Bookable = [QuoteStatus.Pending, QuoteStatus.Reviewed, QuoteStatus.Approved];

    public async Task<IResult> AvailabilityAsync(Site site, HttpRequest request, CancellationToken cancellationToken)
    {
        var options = SiteOptions.For(site);
        var now = clock.GetUtcNow();
        var today = BusinessTime.LocalDate(now);
        var lastDay = today.AddDays(options.Limits.Booking.DaysAhead);

        var errors = new ValidationErrors();
        var from = QueryDate(errors, request, "from");
        var to = QueryDate(errors, request, "to");
        var kind = Query(errors, request, "kind");
        if (kind is not null && !options.Booking.Kinds.Has(kind))
        {
            errors.Add("kind", "Select a valid kind.");
        }

        var duration = TimeSpan.Zero;
        if (kind is not null && options.Booking.Kinds.Has(kind))
        {
            duration = QueryDuration(errors, request, kind, options);
        }

        if (from is { } start && to is { } end)
        {
            if (end < start)
            {
                errors.Add("to", "The end date must not be before the start date.");
            }
            else if (end.DayNumber - start.DayNumber + 1 > MaxRangeDays)
            {
                errors.Add("to", $"Ask for at most {MaxRangeDays} days at a time.");
            }
        }

        if (from > lastDay)
        {
            errors.Add("from", $"Dates are available up to {options.Limits.Booking.DaysAhead} days ahead.");
        }

        if (to > lastDay)
        {
            errors.Add("to", $"Dates are available up to {options.Limits.Booking.DaysAhead} days ahead.");
        }

        if (!errors.IsValid)
        {
            return PublicForms.Invalid(errors);
        }

        // Dates before today are not offered: the range starts at today.
        var first = from!.Value < today ? today : from.Value;
        var last = to!.Value;
        var days = new List<AvailabilityDay>();
        if (first <= last)
        {
            var db = SiteDbContexts.For(services, site);
            var rules = await LoadRulesAsync(db, first, last, now, options.Limits.Booking.DaysAhead, cancellationToken);
            for (var date = first; date <= last; date = date.AddDays(1))
            {
                var starts = rules.OpenStarts(date, kind!, duration);
                days.Add(new AvailabilityDay(
                    date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    [.. starts.Select(time => time.ToString("HH:mm", CultureInfo.InvariantCulture))]));
            }
        }

        return TypedResults.Ok(new AvailabilityResponse(BusinessTime.ZoneId, days));
    }

    public async Task<IResult> CreateAsync(Site site, HttpContext http, CancellationToken cancellationToken)
    {
        var (key, keyFailure) = Idempotency.ReadKey(http.Request);
        if (keyFailure is not null)
        {
            return keyFailure;
        }

        var (body, bodyFailure) = await JsonBody.ReadBytesAsync(http.Request, cancellationToken);
        if (bodyFailure is not null)
        {
            return bodyFailure;
        }

        var endpoint = $"POST /api/{site.Schema()}/appointments";
        var hash = key is null ? string.Empty : Idempotency.Hash(endpoint, body.Span);

        // A retry gets the first answer before anything is checked, so the rules below (the 24 hours, the
        // quote that already has an appointment) cannot turn a replay into an error.
        if (key is not null && await Idempotency.FindAsync(core, key, cancellationToken) is { } stored)
        {
            return Idempotency.Answer(stored, site, endpoint, hash, http.Response);
        }

        var (input, parseFailure) = JsonBody.Parse<BookingInput>(body);
        if (parseFailure is not null)
        {
            return parseFailure;
        }

        var options = SiteOptions.For(site);
        var validation = BookingValidator.Validate(input, options);
        PublicForms.CheckRecipient(validation.Errors, input?.Email, "email");
        if (!validation.Errors.IsValid)
        {
            return PublicForms.Invalid(validation.Errors);
        }

        var request = validation.Request!;
        var sourceIp = http.GetClientIp().ToString();
        var userAgent = PublicForms.UserAgentOf(http);
        var db = SiteDbContexts.For(services, site);
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await BusinessTransaction.ExecuteAsync<IResult>(
                    db,
                    core,
                    token => BookAsync(db, site, options, request, key, endpoint, hash, sourceIp, userAgent, http.Response, token),
                    cancellationToken);
            }
            catch (Exception e) when (attempt < MaxAttempts && IsDeadlock(e))
            {
                // Two bookings that overlap in time but not by date wait for each other's insert, and the
                // database ends the deadlock by cancelling one. That one rolled back whole: decide it again,
                // under the locks, now that the other has committed (and is a conflict, or is gone).
            }
            catch (DbUpdateException e) when (key is not null && Idempotency.IsReceiptKeyViolation(e))
            {
                // Another request with this key committed its receipt first. Ours rolled back with
                // everything it wrote, so the winner's receipt decides: its answer, or a 422 when the
                // requests differ.
                db.ChangeTracker.Clear();
                core.ChangeTracker.Clear();
                var winner = await Idempotency.FindAsync(core, key, cancellationToken);
                if (winner is null)
                {
                    throw;
                }

                return Idempotency.Answer(winner, site, endpoint, hash, http.Response);
            }
            catch (DbUpdateException e) when (MapConstraintViolation(e) is { } conflict)
            {
                return conflict;
            }
        }
    }

    // True when the error is, or wraps, a Postgres deadlock or serialization failure. EF's default execution
    // strategy wraps these in an InvalidOperationException ("likely due to a transient failure").
    internal static bool IsDeadlock(Exception error)
    {
        for (var e = error; e is not null; e = e.InnerException)
        {
            if (e is PostgresException { SqlState: DeadlockDetected or SerializationFailure })
            {
                return true;
            }
        }

        return false;
    }

    // The 409 for a booking the database refused: an overlap with another appointment, or a second
    // appointment for a quote. Null for any other error. These happen only when the checks in BookAsync were
    // passed by two requests that no lock made take turns, and answer the same as the checks do.
    internal static IResult? MapConstraintViolation(Exception error)
    {
        var postgres = error as PostgresException ?? (error as DbUpdateException)?.InnerException as PostgresException;
        if (postgres is null)
        {
            return null;
        }

        if (postgres.SqlState == ExclusionViolation && postgres.ConstraintName == NoOverlapConstraint)
        {
            return TimeTaken();
        }

        if (UniqueNumber.IsUniqueViolation(error, QuoteIndex))
        {
            return QuoteBooked();
        }

        return null;
    }

    // Inside the transaction. Returns the answer; anything it returns other than the 201 has written nothing.
    private async Task<IResult> BookAsync(
        BusinessDbContext db,
        Site site,
        SiteOptions options,
        BookingRequest request,
        string? key,
        string endpoint,
        string hash,
        string sourceIp,
        string userAgent,
        HttpResponse response,
        CancellationToken cancellationToken)
    {
        // Entities from an earlier attempt must not leak in: the contexts are scoped to the request.
        db.ChangeTracker.Clear();
        core.ChangeTracker.Clear();

        await PublicForms.LockEmailAsync(db, site, request.Email, cancellationToken);
        if (key is not null)
        {
            // Requests that share a key but not an email take different email locks, so the key has a lock
            // of its own, second in the order (email, key, day): the second request waits for the first to
            // commit and then finds its receipt, instead of being decided on the rows the first one wrote.
            await LockKeyAsync(db, site, key, cancellationToken);
        }

        // The retry that waited for the locks finds the winner's receipt here.
        if (key is not null && await Idempotency.FindAsync(core, key, cancellationToken) is { } stored)
        {
            return Idempotency.Answer(stored, site, endpoint, hash, response);
        }

        var now = clock.GetUtcNow();
        var quote = await db.Quotes
            .AsNoTracking()
            .Where(q => q.QuoteNumber == request.QuoteNumber)
            .Select(q => new { q.Id, q.Kind, q.Status, q.CustomerId })
            .SingleOrDefaultAsync(cancellationToken);
        var customer = quote is null
            ? null
            : await db.Customers
                .AsNoTracking()
                .Where(c => c.Id == quote.CustomerId)
                .Select(c => new { c.Id, c.Name, c.Email })
                .SingleOrDefaultAsync(cancellationToken);

        // A missing quote and a wrong email are one answer: the endpoint cannot be used to find out which
        // numbers or emails exist.
        if (quote is null || customer is null || CustomerRules.NormalizeEmail(customer.Email) != request.Email)
        {
            return Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                detail: "No quote matches that number and email.");
        }

        var kindLabel = options.Booking.Kinds.LabelOf(request.Kind) ?? request.Kind;
        if (BookingKinds.QuoteKindFor(request.Kind) is { } needed && needed != quote.Kind)
        {
            var neededLabel = options.Quote.Kinds.LabelOf(needed) ?? needed;
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["kind"] = [$"{kindLabel} needs a {neededLabel} quote."],
            });
        }

        if (!Bookable.Contains(quote.Status))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                detail: "This quote can't be booked.");
        }

        AppointmentStatus[] blocking = [.. AppointmentStatuses.Blocking];
        if (await db.Appointments.AnyAsync(a => a.QuoteId == quote.Id && blocking.Contains(a.Status), cancellationToken))
        {
            return QuoteBooked();
        }

        var cutoff = now - TimeSpan.FromHours(24);
        var email = request.Email;
        if (await db.Appointments.AnyAsync(
            a => a.CreatedAt > cutoff && db.Customers.Any(c => c.Id == a.CustomerId && c.Email.ToLower() == email),
            cancellationToken))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status429TooManyRequests,
                detail: "You already booked an appointment in the last 24 hours.");
        }

        // The date is checked against the window before anything is built around it: the query window of
        // LoadRulesAsync adds days on both sides, which a date at the end of the calendar cannot take.
        switch (BookingRules.CheckWindow(request.Date, now, options.Limits.Booking.DaysAhead))
        {
            case SlotCheck.Past:
                return Invalid("date", "Choose a date and time that are still ahead.");
            case SlotCheck.TooFarAhead:
                return Invalid("date", $"Appointments can be booked up to {options.Limits.Booking.DaysAhead} days ahead.");
        }

        await LockDayAsync(db, site, request.Date, cancellationToken);

        var rules = await LoadRulesAsync(db, request.Date, request.Date, now, options.Limits.Booking.DaysAhead, cancellationToken);
        switch (rules.Check(request.Date, request.Time, request.Kind, request.Duration))
        {
            case SlotCheck.Past:
                return Invalid("date", "Choose a date and time that are still ahead.");
            case SlotCheck.TooFarAhead:
                return Invalid("date", $"Appointments can be booked up to {options.Limits.Booking.DaysAhead} days ahead.");
            case SlotCheck.Blackout:
                return Invalid("date", "We have no appointments on that date.");
            case SlotCheck.Closed:
                return Invalid("time", "We have no appointments at that time.");
            case SlotCheck.Conflict:
                return TimeTaken();
        }

        var appointment = new Appointment
        {
            CustomerId = customer.Id,
            QuoteId = quote.Id,
            Kind = request.Kind,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            Status = AppointmentStatus.Scheduled,
            Notes = request.Notes,
            Details = DetailsJson.Serialize(new AppointmentDetails(request.Phone)),
            SourceIp = sourceIp,
            UserAgent = userAgent,
            CreatedAt = now,
            UpdatedAt = now,
        };
        appointment.History.Add(new AppointmentHistoryEntry
        {
            At = now,
            Actor = "customer",
            FromStatus = null,
            ToStatus = AppointmentStatus.Scheduled,
            ToStartsAt = request.StartsAt,
        });
        db.Appointments.Add(appointment);

        var customerName = customer.Name;
        outbox.Queue(core, request.Email, EmailTemplates.Render(new BookingConfirmationModel(
            site,
            request.QuoteNumber,
            customerName,
            request.StartsAt,
            request.Phone,
            request.Notes)));
        outbox.QueueAdmin(core, EmailTemplates.Render(new BookingAdminModel(
            site,
            request.QuoteNumber,
            customerName,
            request.Email,
            request.Phone,
            request.StartsAt,
            request.Notes,
            $"{kindLabel} ({HoursText(request.Duration)})",
            sourceIp)));

        var booked = new AppointmentBooked(
            request.QuoteNumber,
            request.Kind,
            BusinessTime.ToLocal(request.StartsAt),
            BusinessTime.ToLocal(request.EndsAt));
        var json = JsonSerializer.Serialize(booked, ResponseJson);
        if (key is not null)
        {
            core.EdgeReceipts.Add(new EdgeReceipt
            {
                IdempotencyKey = key,
                Site = site,
                Endpoint = endpoint,
                RequestHash = hash,
                ResponseStatus = StatusCodes.Status201Created,
                ResponseBody = json,
                CreatedAt = now,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        await core.SaveChangesAsync(cancellationToken);

        return Results.Text(json, "application/json", System.Text.Encoding.UTF8, StatusCodes.Status201Created);
    }

    // The rules for the dates first..last: the weekday rules, the blackout dates among them, and the
    // blocking appointments that touch them. Appointments are at most 12 hours long, and a date's starts
    // may overlap the day before and after, so the window has a day of margin on each side.
    private static async Task<BookingRules> LoadRulesAsync(
        BusinessDbContext db,
        DateOnly first,
        DateOnly last,
        DateTimeOffset now,
        int daysAhead,
        CancellationToken cancellationToken)
    {
        var from = BusinessTime.StartOfDay(first).AddDays(-1);
        var until = BusinessTime.StartOfDay(last.AddDays(1)).AddDays(1);
        AppointmentStatus[] blocking = [.. AppointmentStatuses.Blocking];

        var openings = await db.AvailabilityRules
            .AsNoTracking()
            .Select(rule => new OpeningRule(rule.DayOfWeek, rule.Opens, rule.Closes, rule.SlotMinutes))
            .ToListAsync(cancellationToken);
        var blackouts = await db.BlackoutDates
            .AsNoTracking()
            .Where(blackout => blackout.Date >= first && blackout.Date <= last)
            .Select(blackout => blackout.Date)
            .ToListAsync(cancellationToken);
        var held = await db.Appointments
            .AsNoTracking()
            .Where(a => blocking.Contains(a.Status) && a.StartsAt < until && a.EndsAt > from)
            .Select(a => new BookedSlot(a.StartsAt, a.EndsAt, a.Kind))
            .ToListAsync(cancellationToken);
        return new BookingRules(openings, blackouts.ToHashSet(), held, now, daysAhead);
    }

    // Held until the transaction ends: two requests with one idempotency key take turns.
    private static Task LockKeyAsync(BusinessDbContext db, Site site, string key, CancellationToken cancellationToken)
    {
        var lockKey = $"{site.Schema()}:key:{key}";
        return db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))", cancellationToken);
    }

    // Held until the transaction ends: two bookings for one Chicago date take turns.
    private static Task LockDayAsync(BusinessDbContext db, Site site, DateOnly date, CancellationToken cancellationToken)
    {
        var key = $"{site.Schema()}:day:{date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}";
        return db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", cancellationToken);
    }

    private static IResult TimeTaken() =>
        Results.Problem(statusCode: StatusCodes.Status409Conflict, detail: "That time isn't available.");

    private static IResult QuoteBooked() =>
        Results.Problem(statusCode: StatusCodes.Status409Conflict, detail: "This quote already has an appointment.");

    private static IResult Invalid(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    // "2 hours", "1 hour": the lengths are whole hours.
    private static string HoursText(TimeSpan duration)
    {
        var hours = (int)duration.TotalHours;
        return hours == 1 ? "1 hour" : $"{hours.ToString(CultureInfo.InvariantCulture)} hours";
    }

    // The single value of a query parameter, or null with an error when it is missing, empty or repeated.
    private static string? Query(ValidationErrors errors, HttpRequest request, string name)
    {
        var values = request.Query[name];
        if (values.Count != 1 || string.IsNullOrWhiteSpace(values[0]))
        {
            errors.Add(name, values.Count > 1 ? $"Send {name} once." : $"{name} is required.");
            return null;
        }

        return values[0]!.Trim();
    }

    private static DateOnly? QueryDate(ValidationErrors errors, HttpRequest request, string name)
    {
        var text = Query(errors, request, name);
        if (text is null)
        {
            return null;
        }

        if (text.Length == 10
            && text.All(c => char.IsAsciiDigit(c) || c == '-')
            && DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            return date;
        }

        errors.Add(name, "Enter a date as YYYY-MM-DD.");
        return null;
    }

    // The length of the booking the list is for: a drops-only install's durationMinutes (rounded up to the
    // hour, two hours when missing), the fixed length of the other kinds, which take no durationMinutes.
    private static TimeSpan QueryDuration(ValidationErrors errors, HttpRequest request, string kind, SiteOptions options)
    {
        var values = request.Query["durationMinutes"];
        int? minutes = null;
        if (values.Count > 0)
        {
            var range = options.Limits.Booking.DurationMinutes;
            if (!BookingKinds.TakesDuration(kind))
            {
                errors.Add("durationMinutes", "Only a drops-only install takes a duration.");
            }
            else if (values.Count != 1
                || values[0] is not { Length: > 0 and <= 4 } text
                || !text.All(char.IsAsciiDigit)
                || !int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var parsed)
                || !range.Contains(parsed))
            {
                errors.Add("durationMinutes", $"Duration must be between {range.Min} and {range.Max} minutes.");
            }
            else
            {
                minutes = parsed;
            }
        }

        return BookingKinds.DurationOf(kind, minutes);
    }
}
