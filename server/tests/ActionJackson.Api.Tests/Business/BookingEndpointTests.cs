using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using ActionJackson.Core;
using ActionJackson.Core.Booking;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Tests;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

public class BookingEndpointTests(TestDatabase database) : IClassFixture<TestDatabase>, IDisposable
{
    private readonly FormsHost host = new(database);

    public void Dispose() => host.Dispose();

    private static async Task<JsonElement> ErrorsOf(HttpResponseMessage response) =>
        (await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest)).GetProperty("errors");

    [DbFact]
    public async Task A_booking_is_saved_with_its_history_and_both_emails_and_answers_with_four_fields()
    {
        var quote = await Bookings.NewQuote(database);
        var date = Bookings.NextDay(database);
        var client = FormsHost.NewClient();
        var body = Bookings.Body(quote, date, "09:00");
        body["phone"] = "(555) 123-4567";
        body["notes"] = "Side gate is open";

        using var response = await host.Post(Bookings.Path, body, client, userAgent: new string('u', 300));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(raw);
        Assert.Equal(quote.Number, json.GetProperty("reference").GetString());
        Assert.Equal("survey", json.GetProperty("kind").GetString());
        Assert.Equal(DateTimeOffset.Parse($"{date:yyyy-MM-dd}T09:00:00-06:00"), json.GetProperty("startsAt").GetDateTimeOffset());
        Assert.Equal(DateTimeOffset.Parse($"{date:yyyy-MM-dd}T11:00:00-06:00"), json.GetProperty("endsAt").GetDateTimeOffset());
        Assert.Contains("-06:00", json.GetProperty("startsAt").GetString());
        Assert.Equal(4, json.EnumerateObject().Count());
        Assert.DoesNotContain("\"id\"", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(quote.Email, raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Jane", raw);

        await using var lan = database.Lan();
        var appointment = await lan.Appointments.Include(a => a.History).SingleAsync(a => a.QuoteId == quote.QuoteId);
        Assert.Equal(quote.CustomerId, appointment.CustomerId);
        Assert.Equal(AppointmentStatus.Scheduled, appointment.Status);
        Assert.Equal(BookingKinds.Survey, appointment.Kind);
        Assert.Equal(BusinessTime.ToInstant(date, new TimeOnly(9, 0)), appointment.StartsAt);
        Assert.Equal(BusinessTime.ToInstant(date, new TimeOnly(11, 0)), appointment.EndsAt);
        Assert.Equal("Side gate is open", appointment.Notes);
        Assert.Equal(client, appointment.SourceIp);
        Assert.Equal(200, appointment.UserAgent!.Length);
        Assert.Equal(host.Time.GetUtcNow(), appointment.CreatedAt);
        Assert.Equal("(555) 123-4567", (string?)JsonNode.Parse(appointment.Details)!["phone"]);

        var entry = Assert.Single(appointment.History);
        Assert.Equal("customer", entry.Actor);
        Assert.Null(entry.FromStatus);
        Assert.Equal(AppointmentStatus.Scheduled, entry.ToStatus);
        Assert.Equal(appointment.StartsAt, entry.ToStartsAt);
        Assert.Equal(host.Time.GetUtcNow(), entry.At);

        // The customer is never updated by a public request.
        var customer = await lan.Customers.SingleAsync(c => c.Id == quote.CustomerId);
        Assert.Equal("Jane O'Neil", customer.Name);
        Assert.Equal("(555) 000-0000", customer.Phone);

        await using var core = database.Core();
        var rows = await core.EmailOutbox.Where(m => m.Subject.Contains(quote.Number)
            || m.ToAddress == quote.Email).ToListAsync();
        var confirmation = Assert.Single(rows, m => m.Template == "booking-confirmation");
        var admin = Assert.Single(rows, m => m.Template == "booking-admin");
        Assert.Equal(quote.Email, confirmation.ToAddress);
        Assert.Equal(FormsHost.AdminAddress, admin.ToAddress);
        Assert.Contains("Hello Jane,", confirmation.TextBody);
        Assert.Contains($"Quote Number: #{quote.Number}", confirmation.TextBody);
        Assert.Contains(date.ToString("dddd, MMMM d, yyyy", System.Globalization.CultureInfo.InvariantCulture), confirmation.TextBody);
        Assert.Contains("9:00 AM CST", confirmation.TextBody);
        Assert.Contains("Phone: (555) 123-4567", confirmation.TextBody);
        Assert.Contains("Notes: Side gate is open", confirmation.TextBody);
        Assert.Contains("We'll contact you before the appointment to confirm.", confirmation.TextBody);
        Assert.DoesNotContain("24 hours", confirmation.TextBody);
        Assert.Contains("Appointment: Site Survey (2 hours)", admin.TextBody);
        Assert.Contains("Customer: Jane O'Neil", admin.TextBody);
        Assert.Contains(client, admin.TextBody);
        Assert.All(rows, m => Assert.Equal(EmailStatus.Pending, m.Status));
    }

    [DbFact]
    public async Task A_booking_writes_nothing_to_the_car_schema_and_car_has_no_booking_routes()
    {
        var quote = await Bookings.NewQuote(database);
        await using var car = database.Car();
        var before = await car.Appointments.CountAsync();

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, Bookings.NextDay(database)));
        using var carPost = await host.Post("/api/car/appointments", Bookings.Body(quote, Bookings.NextDay(database)));
        using var carGet = await host.Get("/api/car/availability?from=2026-11-24&to=2026-11-25&kind=survey");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await FormsHost.AssertProblem(carPost, HttpStatusCode.NotFound);
        await FormsHost.AssertProblem(carGet, HttpStatusCode.NotFound);
        Assert.Equal(before, await car.Appointments.CountAsync());
    }

    [DbTheory]
    [InlineData("08:00", true)]
    [InlineData("18:00", true)]
    [InlineData("12:00", true)]
    [InlineData("07:00", false)]
    [InlineData("18:30", false)]
    [InlineData("19:00", false)]
    [InlineData("08:30", false)]
    [InlineData("00:00", false)]
    public async Task Only_a_start_on_the_hour_from_eight_to_six_is_booked(string time, bool booked)
    {
        var quote = await Bookings.NewQuote(database);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, Bookings.NextDay(database), time));

        if (booked)
        {
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }
        else
        {
            Assert.True((await ErrorsOf(response)).TryGetProperty("time", out _));
            await using var lan = database.Lan();
            Assert.False(await lan.Appointments.AnyAsync(a => a.QuoteId == quote.QuoteId));
        }
    }

    [DbFact]
    public async Task A_start_of_18_00_is_the_next_day_in_utc_and_still_books_on_the_chicago_date()
    {
        var quote = await Bookings.NewQuote(database);
        var date = Bookings.NextDay(database);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, date, "18:00"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await using var lan = database.Lan();
        var appointment = await lan.Appointments.SingleAsync(a => a.QuoteId == quote.QuoteId);
        Assert.Equal(date.AddDays(1), DateOnly.FromDateTime(appointment.StartsAt.UtcDateTime));
        Assert.Equal(date, BusinessTime.LocalDate(appointment.StartsAt));
    }

    [DbFact]
    public async Task A_past_date_or_an_hour_already_passed_today_is_a_400()
    {
        // 06:00 in Chicago on Monday 2026-11-23: 08:00 today is ahead, and so is the next day.
        var today = new DateOnly(2026, 11, 23);
        host.Time.Set(new DateTimeOffset(2026, 11, 23, 16, 30, 0, TimeSpan.Zero)); // 10:30 in Chicago
        var yesterday = await Bookings.NewQuote(database);
        var passed = await Bookings.NewQuote(database);
        var later = await Bookings.NewQuote(database);

        using var past = await host.Post(Bookings.Path, Bookings.Body(yesterday, today.AddDays(-1), "09:00"));
        using var tooEarly = await host.Post(Bookings.Path, Bookings.Body(passed, today, "10:00"));
        using var open = await host.Post(Bookings.Path, Bookings.Body(later, today, "11:00"));

        Assert.True((await ErrorsOf(past)).TryGetProperty("date", out _));
        Assert.True((await ErrorsOf(tooEarly)).TryGetProperty("date", out _));
        Assert.Equal(HttpStatusCode.Created, open.StatusCode);
    }

    [DbFact]
    public async Task Today_plus_90_days_books_and_plus_91_is_a_400()
    {
        var today = new DateOnly(2026, 11, 23);
        var near = await Bookings.NewQuote(database);
        var far = await Bookings.NewQuote(database);

        using var ninety = await host.Post(Bookings.Path, Bookings.Body(near, today.AddDays(90)));
        using var ninetyOne = await host.Post(Bookings.Path, Bookings.Body(far, today.AddDays(91)));

        Assert.Equal(HttpStatusCode.Created, ninety.StatusCode);
        Assert.True((await ErrorsOf(ninetyOne)).TryGetProperty("date", out _));
    }

    // The ends of the calendar are answered like any other date outside the window (a 400 on date), not a 500
    // from the arithmetic that builds the query window around the date.
    [DbTheory]
    [InlineData("0001-01-01")]
    [InlineData("0001-01-02")]
    [InlineData("9999-12-30")]
    [InlineData("9999-12-31")]
    public async Task A_date_at_the_ends_of_the_calendar_is_a_400_on_date(string date)
    {
        var quote = await Bookings.NewQuote(database);
        var body = Bookings.Body(quote, new DateOnly(2026, 11, 24));
        body["date"] = date;

        using var response = await host.Post(Bookings.Path, body);

        Assert.True((await ErrorsOf(response)).TryGetProperty("date", out _));
    }

    [DbFact]
    public async Task A_blackout_date_is_a_400()
    {
        var quote = await Bookings.NewQuote(database);
        var date = Bookings.NextDay(database);
        await using (var lan = database.Lan())
        {
            lan.BlackoutDates.Add(new BlackoutDate { Date = date, Reason = "Holiday" });
            await lan.SaveChangesAsync();
        }

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, date));

        Assert.True((await ErrorsOf(response)).TryGetProperty("date", out _));
    }

    [DbTheory]
    [InlineData(null, 120)]
    [InlineData(60, 60)]
    [InlineData(61, 120)]
    [InlineData(180, 180)]
    [InlineData(720, 720)]
    public async Task A_drops_only_install_is_as_long_as_asked_rounded_up_to_the_hour(int? minutes, int expected)
    {
        var quote = await Bookings.NewQuote(database);
        var date = Bookings.NextDay(database);
        var body = Bookings.Body(quote, date, "08:00", BookingKinds.DropsOnlyInstall);
        if (minutes is not null)
        {
            body["durationMinutes"] = minutes;
        }

        using var response = await host.Post(Bookings.Path, body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await using var lan = database.Lan();
        var appointment = await lan.Appointments.SingleAsync(a => a.QuoteId == quote.QuoteId);
        Assert.Equal(TimeSpan.FromMinutes(expected), appointment.EndsAt - appointment.StartsAt);
        Assert.Equal(BookingKinds.DropsOnlyInstall, appointment.Kind);
    }

    [DbTheory]
    [InlineData(59)]
    [InlineData(721)]
    [InlineData(0)]
    public async Task A_drops_only_duration_out_of_range_is_a_400(int minutes)
    {
        var quote = await Bookings.NewQuote(database);
        var body = Bookings.Body(quote, Bookings.NextDay(database), "08:00", BookingKinds.DropsOnlyInstall);
        body["durationMinutes"] = minutes;

        using var response = await host.Post(Bookings.Path, body);

        Assert.True((await ErrorsOf(response)).TryGetProperty("durationMinutes", out _));
    }

    [DbFact]
    public async Task A_duration_on_a_survey_is_a_400_and_a_survey_is_two_hours()
    {
        var quote = await Bookings.NewQuote(database);
        var body = Bookings.Body(quote, Bookings.NextDay(database), "08:00");
        body["durationMinutes"] = 60;

        using var response = await host.Post(Bookings.Path, body);

        Assert.True((await ErrorsOf(response)).TryGetProperty("durationMinutes", out _));
    }

    [DbFact]
    public async Task A_whole_home_install_is_twelve_hours()
    {
        var quote = await Bookings.NewQuote(database, QuoteKinds.WholeHome);
        var date = Bookings.NextDay(database);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, date, "08:00", BookingKinds.WholeHomeInstall));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await FormsHost.Json(response);
        Assert.Equal(TimeSpan.FromHours(12), json.GetProperty("endsAt").GetDateTimeOffset() - json.GetProperty("startsAt").GetDateTimeOffset());
    }

    [DbFact]
    public async Task Touching_bookings_both_succeed_and_an_overlapping_one_is_a_409()
    {
        var date = Bookings.NextDay(database);
        var first = await Bookings.NewQuote(database);
        var touching = await Bookings.NewQuote(database);
        var overlapping = await Bookings.NewQuote(database);

        // 10:00 to 11:00, then 11:00 to 12:00, then 10:00 again.
        using var a = await host.Post(Bookings.Path, Bookings.Body(first, date, "10:00", BookingKinds.DropsOnlyInstall).With("durationMinutes", 60));
        using var b = await host.Post(Bookings.Path, Bookings.Body(touching, date, "11:00", BookingKinds.DropsOnlyInstall).With("durationMinutes", 60));
        using var c = await host.Post(Bookings.Path, Bookings.Body(overlapping, date, "10:00", BookingKinds.DropsOnlyInstall).With("durationMinutes", 60));

        Assert.Equal(HttpStatusCode.Created, a.StatusCode);
        Assert.Equal(HttpStatusCode.Created, b.StatusCode);
        var problem = await FormsHost.AssertProblem(c, HttpStatusCode.Conflict);
        Assert.Equal("That time isn't available.", problem.GetProperty("detail").GetString());
        await using var lan = database.Lan();
        Assert.False(await lan.Appointments.AnyAsync(x => x.QuoteId == overlapping.QuoteId));
    }

    [DbFact]
    public async Task A_survey_that_runs_into_a_booking_is_a_409_and_one_that_ends_where_it_starts_is_fine()
    {
        var date = Bookings.NextDay(database);
        await Bookings.Existing(database, date, 10, 1);
        var running = await Bookings.NewQuote(database);
        var ending = await Bookings.NewQuote(database);

        using var into = await host.Post(Bookings.Path, Bookings.Body(running, date, "09:00"));
        using var upTo = await host.Post(Bookings.Path, Bookings.Body(ending, date, "08:00"));

        await FormsHost.AssertProblem(into, HttpStatusCode.Conflict);
        Assert.Equal(HttpStatusCode.Created, upTo.StatusCode);
    }

    [DbFact]
    public async Task A_whole_home_install_on_a_day_with_a_booking_is_a_409_even_when_the_booking_is_late()
    {
        var date = Bookings.NextDay(database);
        await Bookings.Existing(database, date, 18, 1);
        var quote = await Bookings.NewQuote(database, QuoteKinds.WholeHome);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, date, "08:00", BookingKinds.WholeHomeInstall));

        await FormsHost.AssertProblem(response, HttpStatusCode.Conflict);
    }

    [DbTheory]
    [InlineData("09:00")]
    [InlineData("12:00")]
    [InlineData("18:00")]
    [InlineData("07:00")]
    public async Task A_whole_home_install_that_does_not_start_at_opening_time_is_a_400_on_time(string time)
    {
        var quote = await Bookings.NewQuote(database, QuoteKinds.WholeHome);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, Bookings.NextDay(database), time, BookingKinds.WholeHomeInstall));

        Assert.True((await ErrorsOf(response)).TryGetProperty("time", out _));
        await using var lan = database.Lan();
        Assert.False(await lan.Appointments.AnyAsync(a => a.QuoteId == quote.QuoteId));
    }

    [DbFact]
    public async Task A_whole_home_install_starts_at_the_opening_time_the_days_rule_gives()
    {
        await using var owned = await OwnDatabase.Create();
        var own = owned.Database;
        await using (var lan = own.Lan())
        {
            await lan.AvailabilityRules.ExecuteDeleteAsync();
            for (short day = 0; day <= 6; day++)
            {
                lan.AvailabilityRules.Add(new AvailabilityRule { DayOfWeek = day, Opens = new TimeOnly(10, 0), Closes = new TimeOnly(16, 0), SlotMinutes = 60 });
            }

            await lan.SaveChangesAsync();
        }

        using var ownHost = new FormsHost(own);
        var early = await Bookings.NewQuote(own, QuoteKinds.WholeHome);
        var opening = await Bookings.NewQuote(own, QuoteKinds.WholeHome);

        using var eight = await ownHost.Post(Bookings.Path, Bookings.Body(early, Bookings.First, "08:00", BookingKinds.WholeHomeInstall));
        using var ten = await ownHost.Post(Bookings.Path, Bookings.Body(opening, Bookings.First, "10:00", BookingKinds.WholeHomeInstall));

        Assert.True((await ErrorsOf(eight)).TryGetProperty("time", out _));
        Assert.Equal(HttpStatusCode.Created, ten.StatusCode);
    }

    [DbFact]
    public async Task Any_booking_on_a_day_with_a_whole_home_install_is_a_409_and_the_next_day_is_free()
    {
        var date = Bookings.NextDay(database, 2);
        await Bookings.Existing(database, date, 8, 12, BookingKinds.WholeHomeInstall);
        var onTheDay = await Bookings.NewQuote(database);
        var nextDay = await Bookings.NewQuote(database);

        using var late = await host.Post(Bookings.Path, Bookings.Body(onTheDay, date, "18:00"));
        using var after = await host.Post(Bookings.Path, Bookings.Body(nextDay, date.AddDays(1), "08:00"));

        await FormsHost.AssertProblem(late, HttpStatusCode.Conflict);
        Assert.Equal(HttpStatusCode.Created, after.StatusCode);
    }

    [DbFact]
    public async Task A_whole_home_day_is_the_chicago_date_so_an_18_00_start_does_not_block_the_next_morning()
    {
        var date = Bookings.NextDay(database, 2);
        // A whole-home install an admin put at 18:00 (the API itself starts them at opening time).
        await Bookings.Existing(database, date, 18, 12, BookingKinds.WholeHomeInstall);
        var nextMorning = await Bookings.NewQuote(database);
        var sameDay = await Bookings.NewQuote(database);

        using var next = await host.Post(Bookings.Path, Bookings.Body(nextMorning, date.AddDays(1), "08:00"));
        using var same = await host.Post(Bookings.Path, Bookings.Body(sameDay, date, "09:00"));

        Assert.Equal(HttpStatusCode.Created, next.StatusCode);
        await FormsHost.AssertProblem(same, HttpStatusCode.Conflict);
    }

    [DbFact]
    public async Task A_cancelled_or_no_show_appointment_holds_nothing()
    {
        var date = Bookings.NextDay(database);
        await Bookings.Existing(database, date, 9, 2, status: AppointmentStatus.Cancelled);
        await Bookings.Existing(database, date, 12, 1, status: AppointmentStatus.NoShow);
        await Bookings.Existing(database, date, 14, 12, BookingKinds.WholeHomeInstall, AppointmentStatus.Cancelled);
        var quote = await Bookings.NewQuote(database, QuoteKinds.WholeHome);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, date, "08:00", BookingKinds.WholeHomeInstall));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [DbFact]
    public async Task An_unknown_quote_and_a_wrong_email_get_the_same_404()
    {
        var quote = await Bookings.NewQuote(database);
        var date = Bookings.NextDay(database);
        var unknown = Bookings.Body(quote, date);
        unknown["quoteNumber"] = "00000000";
        var wrongEmail = Bookings.Body(quote, date);
        wrongEmail["email"] = Forms.NewEmail();

        using var missing = await host.Post(Bookings.Path, unknown);
        using var mismatch = await host.Post(Bookings.Path, wrongEmail);

        var first = await FormsHost.AssertProblem(missing, HttpStatusCode.NotFound);
        var second = await FormsHost.AssertProblem(mismatch, HttpStatusCode.NotFound);
        Assert.Equal("No quote matches that number and email.", first.GetProperty("detail").GetString());
        Assert.Equal(first.GetProperty("detail").GetString(), second.GetProperty("detail").GetString());
        Assert.Equal(first.GetProperty("title").GetString(), second.GetProperty("title").GetString());
        Assert.Equal(
            first.EnumerateObject().Select(p => p.Name).Order(),
            second.EnumerateObject().Select(p => p.Name).Order());
        await using var lan = database.Lan();
        Assert.False(await lan.Appointments.AnyAsync(a => a.QuoteId == quote.QuoteId));
    }

    [DbFact]
    public async Task The_email_matches_whatever_its_case_or_spacing()
    {
        var quote = await Bookings.NewQuote(database);
        var body = Bookings.Body(quote, Bookings.NextDay(database));
        body["email"] = $"  {quote.Email.ToUpperInvariant()}  ";

        using var response = await host.Post(Bookings.Path, body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [DbTheory]
    [InlineData(QuoteStatus.Pending)]
    [InlineData(QuoteStatus.Reviewed)]
    [InlineData(QuoteStatus.Approved)]
    public async Task A_pending_reviewed_or_approved_quote_can_be_booked(QuoteStatus status)
    {
        var quote = await Bookings.NewQuote(database, status: status);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, Bookings.NextDay(database)));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [DbTheory]
    [InlineData(QuoteStatus.Rejected)]
    [InlineData(QuoteStatus.Completed)]
    public async Task A_rejected_or_completed_quote_is_a_409(QuoteStatus status)
    {
        var quote = await Bookings.NewQuote(database, status: status);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, Bookings.NextDay(database)));

        await FormsHost.AssertProblem(response, HttpStatusCode.Conflict);
        await using var lan = database.Lan();
        Assert.False(await lan.Appointments.AnyAsync(a => a.QuoteId == quote.QuoteId));
    }

    [DbTheory]
    [InlineData(BookingKinds.DropsOnlyInstall, QuoteKinds.WholeHome, false)]
    [InlineData(BookingKinds.WholeHomeInstall, QuoteKinds.DropsOnly, false)]
    [InlineData(BookingKinds.DropsOnlyInstall, QuoteKinds.DropsOnly, true)]
    [InlineData(BookingKinds.WholeHomeInstall, QuoteKinds.WholeHome, true)]
    [InlineData(BookingKinds.Survey, QuoteKinds.DropsOnly, true)]
    [InlineData(BookingKinds.Survey, QuoteKinds.WholeHome, true)]
    public async Task An_install_needs_a_quote_of_its_kind_and_a_survey_takes_either(string kind, string quoteKind, bool allowed)
    {
        var quote = await Bookings.NewQuote(database, quoteKind);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, Bookings.NextDay(database), "08:00", kind));

        if (allowed)
        {
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }
        else
        {
            Assert.True((await ErrorsOf(response)).TryGetProperty("kind", out _));
        }
    }

    [DbFact]
    public async Task A_quote_that_already_has_an_appointment_is_a_409_until_it_is_cancelled()
    {
        var quote = await Bookings.NewQuote(database);
        var date = Bookings.NextDay(database, 2);
        using var first = await host.Post(Bookings.Path, Bookings.Body(quote, date));
        using var second = await host.Post(Bookings.Path, Bookings.Body(quote, date.AddDays(1)));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var problem = await FormsHost.AssertProblem(second, HttpStatusCode.Conflict);
        Assert.Equal("This quote already has an appointment.", problem.GetProperty("detail").GetString());

        await using (var lan = database.Lan())
        {
            await Bookings.SetStatus(database, (await lan.Appointments.SingleAsync(a => a.QuoteId == quote.QuoteId)).Id, AppointmentStatus.Cancelled);
        }

        // The same email may book again after the 24 hours.
        host.Time.Advance(TimeSpan.FromHours(24) + TimeSpan.FromSeconds(1));
        using var third = await host.Post(Bookings.Path, Bookings.Body(quote, date.AddDays(1)));

        Assert.Equal(HttpStatusCode.Created, third.StatusCode);
        await using var read = database.Lan();
        Assert.Equal(1, await read.Appointments.CountAsync(a => a.QuoteId == quote.QuoteId && a.Status == AppointmentStatus.Scheduled));
        Assert.Equal(2, await read.Appointments.CountAsync(a => a.QuoteId == quote.QuoteId));
    }

    [DbFact]
    public async Task One_email_may_book_once_in_24_hours_by_the_injected_clock()
    {
        var email = Forms.NewEmail();
        var first = await Bookings.NewQuote(database, email: email);
        var second = await Bookings.NewQuote(database, email: email);
        var date = Bookings.NextDay(database);
        var other = Bookings.NextDay(database);

        using var booked = await host.Post(Bookings.Path, Bookings.Body(first, date));
        host.Time.Advance(TimeSpan.FromHours(23) + TimeSpan.FromMinutes(59));
        using var tooSoon = await host.Post(Bookings.Path, Bookings.Body(second, other));
        host.Time.Advance(TimeSpan.FromMinutes(1) + TimeSpan.FromSeconds(1));
        using var allowed = await host.Post(Bookings.Path, Bookings.Body(second, other));

        Assert.Equal(HttpStatusCode.Created, booked.StatusCode);
        var problem = await FormsHost.AssertProblem(tooSoon, HttpStatusCode.TooManyRequests);
        Assert.Equal("You already booked an appointment in the last 24 hours.", problem.GetProperty("detail").GetString());
        Assert.Equal(HttpStatusCode.Created, allowed.StatusCode);
    }

    [DbFact]
    public async Task Another_email_is_not_held_up_by_the_24_hour_rule()
    {
        var first = await Bookings.NewQuote(database);
        var second = await Bookings.NewQuote(database);
        var date = Bookings.NextDay(database);

        using var a = await host.Post(Bookings.Path, Bookings.Body(first, date, "08:00"));
        using var b = await host.Post(Bookings.Path, Bookings.Body(second, date, "13:00"));

        Assert.Equal(HttpStatusCode.Created, a.StatusCode);
        Assert.Equal(HttpStatusCode.Created, b.StatusCode);
    }

    [DbFact]
    public async Task A_filled_honeypot_a_bad_email_or_a_bad_phone_is_a_400_and_saves_nothing()
    {
        var quote = await Bookings.NewQuote(database);
        var date = Bookings.NextDay(database);
        var bot = Bookings.Body(quote, date);
        bot["honeypot"] = "gotcha";
        var badEmail = Bookings.Body(quote, date);
        badEmail["email"] = "not an email";
        var badPhone = Bookings.Body(quote, date);
        badPhone["phone"] = "12";
        var longNotes = Bookings.Body(quote, date);
        longNotes["notes"] = new string('n', 501);

        using var a = await host.Post(Bookings.Path, bot);
        using var b = await host.Post(Bookings.Path, badEmail);
        using var c = await host.Post(Bookings.Path, badPhone);
        using var d = await host.Post(Bookings.Path, longNotes);

        Assert.True((await ErrorsOf(a)).TryGetProperty("honeypot", out _));
        Assert.True((await ErrorsOf(b)).TryGetProperty("email", out _));
        Assert.True((await ErrorsOf(c)).TryGetProperty("phone", out _));
        Assert.True((await ErrorsOf(d)).TryGetProperty("notes", out _));
        await using var lan = database.Lan();
        Assert.False(await lan.Appointments.AnyAsync(x => x.QuoteId == quote.QuoteId));
    }

    [DbFact]
    public async Task Every_error_is_reported_keyed_by_its_field()
    {
        var body = new JsonObject { ["quoteNumber"] = "1", ["email"] = "x", ["kind"] = "haircut", ["date"] = "tomorrow", ["time"] = "9am" };

        using var response = await host.Post(Bookings.Path, body);

        var errors = await ErrorsOf(response);
        foreach (var key in new[] { "quoteNumber", "email", "kind", "date", "time" })
        {
            Assert.True(errors.TryGetProperty(key, out _), key);
        }
    }

    [DbFact]
    public async Task A_body_that_is_not_json_or_has_a_wrong_type_is_a_4xx_problem()
    {
        using var notJson = await host.PostText(Bookings.Path, "{nope");
        using var wrongType = await host.PostText(Bookings.Path, """{"quoteNumber":"20260001","durationMinutes":"60"}""");
        using var wrongContentType = await host.PostText(Bookings.Path, "{}", contentType: "text/plain");
        using var huge = await host.PostText(Bookings.Path, new string(' ', 40 * 1024));

        await FormsHost.AssertProblem(notJson, HttpStatusCode.BadRequest);
        await FormsHost.AssertProblem(wrongType, HttpStatusCode.BadRequest);
        await FormsHost.AssertProblem(wrongContentType, HttpStatusCode.UnsupportedMediaType);
        await FormsHost.AssertProblem(huge, HttpStatusCode.RequestEntityTooLarge);
    }

    [DbFact]
    public async Task The_sixth_booking_from_one_address_in_fifteen_minutes_is_a_429()
    {
        var client = FormsHost.NewClient();
        var unknown = new JsonObject { ["quoteNumber"] = "00000000", ["email"] = "a@example.com", ["kind"] = "survey", ["date"] = "2026-11-24", ["time"] = "09:00" };
        for (var i = 0; i < 5; i++)
        {
            using var counted = await host.Post(Bookings.Path, unknown, client);
            Assert.Equal(HttpStatusCode.NotFound, counted.StatusCode);
        }

        using var refused = await host.Post(Bookings.Path, unknown, client);

        var problem = await FormsHost.AssertProblem(refused, HttpStatusCode.TooManyRequests);
        Assert.Contains("Too many scheduling requests", problem.GetProperty("detail").GetString());
    }

    [DbFact]
    public async Task A_booking_on_a_day_the_clocks_go_forward_stores_the_central_daylight_instant()
    {
        host.Time.Set(new DateTimeOffset(2027, 2, 1, 12, 0, 0, TimeSpan.Zero));
        var quote = await Bookings.NewQuote(database);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, new DateOnly(2027, 3, 14), "09:00"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await FormsHost.Json(response);
        Assert.StartsWith("2027-03-14T09:00:00-05:00", json.GetProperty("startsAt").GetString());
        await using var lan = database.Lan();
        var appointment = await lan.Appointments.SingleAsync(a => a.QuoteId == quote.QuoteId);
        Assert.Equal(new DateTimeOffset(2027, 3, 14, 14, 0, 0, TimeSpan.Zero), appointment.StartsAt);
    }

    [DbFact]
    public async Task A_booking_on_a_day_the_clocks_go_back_stores_the_central_standard_instant()
    {
        host.Time.Set(new DateTimeOffset(2026, 10, 15, 12, 0, 0, TimeSpan.Zero));
        var quote = await Bookings.NewQuote(database);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, new DateOnly(2026, 11, 1), "09:00"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await FormsHost.Json(response);
        Assert.StartsWith("2026-11-01T09:00:00-06:00", json.GetProperty("startsAt").GetString());
        await using var lan = database.Lan();
        var appointment = await lan.Appointments.SingleAsync(a => a.QuoteId == quote.QuoteId);
        Assert.Equal(new DateTimeOffset(2026, 11, 1, 15, 0, 0, TimeSpan.Zero), appointment.StartsAt);
    }

    [DbFact]
    public async Task A_local_time_in_the_skipped_hour_is_a_400()
    {
        host.Time.Set(new DateTimeOffset(2027, 2, 1, 12, 0, 0, TimeSpan.Zero));
        var quote = await Bookings.NewQuote(database);

        using var response = await host.Post(Bookings.Path, Bookings.Body(quote, new DateOnly(2027, 3, 14), "02:30"));

        Assert.True((await ErrorsOf(response)).TryGetProperty("time", out _));
    }

    [DbFact]
    public async Task Six_parallel_bookings_of_one_slot_make_one_appointment_and_five_409s()
    {
        var date = Bookings.NextDay(database);
        var quotes = new List<Quoted>();
        for (var i = 0; i < 6; i++)
        {
            quotes.Add(await Bookings.NewQuote(database));
        }

        var responses = await Task.WhenAll(quotes.Select(q => host.Post(Bookings.Path, Bookings.Body(q, date, "10:00"))));

        var statuses = responses.Select(r => r.StatusCode).ToList();
        Assert.Equal(1, statuses.Count(s => s == HttpStatusCode.Created));
        Assert.Equal(5, statuses.Count(s => s == HttpStatusCode.Conflict));
        var start = BusinessTime.ToInstant(date, new TimeOnly(10, 0));
        await using var lan = database.Lan();
        Assert.Equal(1, await lan.Appointments.CountAsync(a => a.StartsAt == start));
        await using var core = database.Core();
        var admins = await core.EmailOutbox.Where(m => m.Template == "booking-admin").Select(m => m.Subject).ToListAsync();
        Assert.Equal(1, admins.Count(subject => quotes.Any(q => subject.Contains(q.Number))));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [DbFact]
    public async Task A_parallel_whole_home_and_survey_on_one_day_make_one_appointment()
    {
        var date = Bookings.NextDay(database);
        var whole = await Bookings.NewQuote(database, QuoteKinds.WholeHome);
        var survey = await Bookings.NewQuote(database);

        var responses = await Task.WhenAll(
            host.Post(Bookings.Path, Bookings.Body(whole, date, "08:00", BookingKinds.WholeHomeInstall)),
            host.Post(Bookings.Path, Bookings.Body(survey, date, "16:00")));

        var statuses = responses.Select(r => r.StatusCode).ToList();
        Assert.Equal(1, statuses.Count(s => s == HttpStatusCode.Created));
        Assert.Equal(1, statuses.Count(s => s == HttpStatusCode.Conflict));
        await using var lan = database.Lan();
        Assert.Equal(1, await lan.Appointments.CountAsync(a => a.QuoteId == whole.QuoteId || a.QuoteId == survey.QuoteId));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [DbFact]
    public async Task Parallel_bookings_of_one_quote_for_three_slots_make_one_appointment()
    {
        var date = Bookings.NextDay(database, 2);
        var quote = await Bookings.NewQuote(database);

        var responses = await Task.WhenAll(
            host.Post(Bookings.Path, Bookings.Body(quote, date, "08:00")),
            host.Post(Bookings.Path, Bookings.Body(quote, date, "14:00")),
            host.Post(Bookings.Path, Bookings.Body(quote, date.AddDays(1), "09:00")));

        var statuses = responses.Select(r => r.StatusCode).ToList();
        Assert.Equal(1, statuses.Count(s => s == HttpStatusCode.Created));
        Assert.All(statuses.Where(s => s != HttpStatusCode.Created), s => Assert.Equal(HttpStatusCode.Conflict, s));
        await using var lan = database.Lan();
        Assert.Equal(1, await lan.Appointments.CountAsync(a => a.QuoteId == quote.QuoteId));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [DbFact]
    public async Task Two_parallel_bookings_one_hour_apart_for_the_same_day_both_succeed()
    {
        var date = Bookings.NextDay(database);
        var first = await Bookings.NewQuote(database);
        var second = await Bookings.NewQuote(database);

        var responses = await Task.WhenAll(
            host.Post(Bookings.Path, Bookings.Body(first, date, "08:00")),
            host.Post(Bookings.Path, Bookings.Body(second, date, "10:00")));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }
}

internal static class JsonObjectExtensions
{
    // A copy with one member set, for a request that differs from another in one field.
    public static JsonObject With(this JsonObject source, string name, JsonNode? value)
    {
        var copy = (JsonObject)source.DeepClone();
        copy[name] = value;
        return copy;
    }
}
