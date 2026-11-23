using System.Net;
using System.Text.Json;
using ActionJackson.Core;
using ActionJackson.Core.Booking;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Tests;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

public class AvailabilityEndpointTests(TestDatabase database) : IClassFixture<TestDatabase>, IDisposable
{
    private static readonly string[] EveryHour =
        [.. Enumerable.Range(8, 11).Select(hour => $"{hour:00}:00")];

    private readonly FormsHost host = new(database);

    public void Dispose() => host.Dispose();

    private static string Url(string from, string to, string kind = "survey", string? extra = null) =>
        $"{Bookings.AvailabilityPath}?from={from}&to={to}&kind={kind}{extra}";

    private async Task<JsonElement> Days(string url)
    {
        using var response = await host.Get(url);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await FormsHost.Json(response);
    }

    private static Dictionary<string, string[]> StartsByDate(JsonElement body) =>
        body.GetProperty("days").EnumerateArray().ToDictionary(
            day => day.GetProperty("date").GetString()!,
            day => day.GetProperty("starts").EnumerateArray().Select(start => start.GetString()!).ToArray());

    [DbFact]
    public async Task A_range_lists_every_date_with_the_hourly_starts_and_the_time_zone()
    {
        var body = await Days(Url("2027-01-05", "2027-01-07"));

        Assert.Equal("America/Chicago", body.GetProperty("timeZone").GetString());
        var days = StartsByDate(body);
        Assert.Equal(["2027-01-05", "2027-01-06", "2027-01-07"], days.Keys);
        Assert.All(days.Values, starts => Assert.Equal(EveryHour, starts));
        Assert.Equal(2, body.EnumerateObject().Count());
        Assert.All(body.GetProperty("days").EnumerateArray(), day => Assert.Equal(2, day.EnumerateObject().Count()));
    }

    [DbFact]
    public async Task A_past_start_today_is_not_listed_and_a_range_before_today_is_empty()
    {
        // 10:30 in Chicago on Monday 2026-11-23.
        host.Time.Set(new DateTimeOffset(2026, 11, 23, 16, 30, 0, TimeSpan.Zero));

        var today = await Days(Url("2026-11-23", "2026-11-23"));
        var earlier = await Days(Url("2026-11-01", "2026-11-10"));
        var straddling = await Days(Url("2026-11-20", "2026-11-24"));

        Assert.Equal(["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"], StartsByDate(today)["2026-11-23"]);
        Assert.Empty(earlier.GetProperty("days").EnumerateArray());
        // `from` is clamped to today.
        Assert.Equal(["2026-11-23", "2026-11-24"], StartsByDate(straddling).Keys);
    }

    [DbFact]
    public async Task The_90_day_window_is_counted_from_the_chicago_date_of_now()
    {
        // 21:00 in Chicago on the 23rd is already the 24th in UTC.
        host.Time.Set(new DateTimeOffset(2026, 11, 24, 3, 0, 0, TimeSpan.Zero));

        var last = await Days(Url("2027-02-21", "2027-02-21"));
        using var beyond = await host.Get(Url("2027-02-21", "2027-02-22"));
        using var wayBeyond = await host.Get(Url("2027-02-22", "2027-02-22"));

        Assert.Equal(EveryHour, StartsByDate(last)["2027-02-21"]);
        Assert.True((await FormsHostErrors(beyond)).TryGetProperty("to", out _));
        Assert.True((await FormsHostErrors(wayBeyond)).TryGetProperty("from", out _));
    }

    [DbFact]
    public async Task A_range_of_31_days_is_fine_and_32_is_a_400()
    {
        var thirtyOne = await Days(Url("2027-01-04", "2027-02-03"));
        using var thirtyTwo = await host.Get(Url("2027-01-04", "2027-02-04"));

        Assert.Equal(31, thirtyOne.GetProperty("days").GetArrayLength());
        Assert.True((await FormsHostErrors(thirtyTwo)).TryGetProperty("to", out _));
    }

    [DbFact]
    public async Task The_starts_leave_out_what_a_booking_holds_and_what_it_would_run_into()
    {
        var date = Bookings.NextDay(database);
        await Bookings.Existing(database, date, 11, 2); // 11:00 to 13:00

        var survey = StartsByDate(await Days(Url(Bookings.Text(date), Bookings.Text(date))))[Bookings.Text(date)];
        var oneHour = StartsByDate(await Days(Url(Bookings.Text(date), Bookings.Text(date), "drops-only-install", "&durationMinutes=60")))[Bookings.Text(date)];
        var threeHours = StartsByDate(await Days(Url(Bookings.Text(date), Bookings.Text(date), "drops-only-install", "&durationMinutes=180")))[Bookings.Text(date)];

        // A two-hour survey cannot start at 10:00 (it would run to 12:00) or 11:00 or 12:00.
        Assert.Equal(["08:00", "09:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"], survey);
        Assert.Equal(["08:00", "09:00", "10:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"], oneHour);
        Assert.Equal(["08:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"], threeHours);
    }

    [DbFact]
    public async Task A_duration_is_rounded_up_like_a_booking_does()
    {
        var date = Bookings.NextDay(database);
        await Bookings.Existing(database, date, 10, 1); // 10:00 to 11:00

        var starts = StartsByDate(await Days(Url(Bookings.Text(date), Bookings.Text(date), "drops-only-install", "&durationMinutes=61")))[Bookings.Text(date)];

        // 61 minutes is two hours: 08:00 fits, 09:00 runs into the booking.
        Assert.Contains("08:00", starts);
        Assert.DoesNotContain("09:00", starts);
        Assert.Contains("11:00", starts);
    }

    [DbFact]
    public async Task A_day_with_a_whole_home_install_is_empty_and_a_whole_home_request_needs_an_empty_day()
    {
        var date = Bookings.NextDay(database, 2);
        var wholeDay = Bookings.NextDay(database);
        await Bookings.Existing(database, date, 8, 12, BookingKinds.WholeHomeInstall);
        await Bookings.Existing(database, wholeDay, 16, 1);

        var survey = StartsByDate(await Days(Url(Bookings.Text(date), Bookings.Text(date.AddDays(1)))));
        var whole = StartsByDate(await Days(Url(Bookings.Text(wholeDay), Bookings.Text(wholeDay), "whole-home-install")));

        Assert.Empty(survey[Bookings.Text(date)]);
        Assert.Equal(EveryHour, survey[Bookings.Text(date.AddDays(1))]);
        Assert.Empty(whole[Bookings.Text(wholeDay)]);
    }

    [DbFact]
    public async Task A_cancelled_appointment_holds_nothing()
    {
        var date = Bookings.NextDay(database);
        await Bookings.Existing(database, date, 8, 12, BookingKinds.WholeHomeInstall, AppointmentStatus.Cancelled);

        var starts = StartsByDate(await Days(Url(Bookings.Text(date), Bookings.Text(date), "whole-home-install")));

        Assert.Equal(["08:00"], starts[Bookings.Text(date)]);
    }

    [DbFact]
    public async Task A_whole_home_install_lists_only_the_opening_time_of_each_free_day()
    {
        var date = Bookings.NextDay(database, 2);
        await Bookings.Existing(database, date, 15, 1);

        var days = StartsByDate(await Days(Url(Bookings.Text(date), Bookings.Text(date.AddDays(1)), "whole-home-install")));

        Assert.Empty(days[Bookings.Text(date)]);
        Assert.Equal(["08:00"], days[Bookings.Text(date.AddDays(1))]);
    }

    [DbFact]
    public async Task A_whole_home_install_lists_the_hour_a_day_opens_at()
    {
        await using var owned = await OwnDatabase.Create();
        var own = owned.Database;
        await using (var lan = own.Lan())
        {
            // Tuesday opens at 10:00, Wednesday keeps 08:00.
            var tuesday = await lan.AvailabilityRules.SingleAsync(rule => rule.DayOfWeek == 2);
            tuesday.Opens = new TimeOnly(10, 0);
            await lan.SaveChangesAsync();
        }

        using var ownHost = new FormsHost(own);
        using var response = await ownHost.Get(Url("2026-11-24", "2026-11-25", "whole-home-install"));
        var days = StartsByDate(await FormsHost.Json(response));

        Assert.Equal(["10:00"], days["2026-11-24"]);
        Assert.Equal(["08:00"], days["2026-11-25"]);
    }

    [DbFact]
    public async Task A_blackout_date_is_listed_with_no_starts()
    {
        var date = Bookings.NextDay(database);
        await using (var lan = database.Lan())
        {
            lan.BlackoutDates.Add(new BlackoutDate { Date = date, Reason = "Holiday" });
            await lan.SaveChangesAsync();
        }

        var days = StartsByDate(await Days(Url(Bookings.Text(date), Bookings.Text(date.AddDays(1)))));

        Assert.Empty(days[Bookings.Text(date)]);
        Assert.NotEmpty(days[Bookings.Text(date.AddDays(1))]);
    }

    [DbFact]
    public async Task A_weekday_with_no_rule_is_closed_and_the_rules_are_the_ones_in_the_database()
    {
        await using var owned = await OwnDatabase.Create();
        var own = owned.Database;
        await using (var lan = own.Lan())
        {
            // Tuesday closed; Wednesday 10:00 to 12:00 every half hour.
            await lan.AvailabilityRules.Where(rule => rule.DayOfWeek == 2 || rule.DayOfWeek == 3).ExecuteDeleteAsync();
            lan.AvailabilityRules.Add(new AvailabilityRule { DayOfWeek = 3, Opens = new TimeOnly(10, 0), Closes = new TimeOnly(12, 0), SlotMinutes = 30 });
            await lan.SaveChangesAsync();
        }

        using var ownHost = new FormsHost(own);
        using var response = await ownHost.Get(Url("2026-11-24", "2026-11-25"));
        var days = StartsByDate(await FormsHost.Json(response));

        // 2026-11-24 is a Tuesday and 2026-11-25 a Wednesday.
        Assert.Empty(days["2026-11-24"]);
        Assert.Equal(["10:00", "10:30", "11:00", "11:30", "12:00"], days["2026-11-25"]);
    }

    [DbTheory]
    [InlineData("2027-03-14", "2027-02-01T12:00:00Z")]
    [InlineData("2026-11-01", "2026-10-15T12:00:00Z")]
    public async Task The_days_the_clocks_change_still_list_eight_to_six(string date, string now)
    {
        host.Time.Set(DateTimeOffset.Parse(now));

        var days = StartsByDate(await Days(Url(date, date)));

        Assert.Equal(EveryHour, days[date]);
    }

    [DbFact]
    public async Task The_answer_has_no_customer_data()
    {
        var date = Bookings.NextDay(database);
        var quote = await Bookings.NewQuote(database);
        using var booked = await host.Post(Bookings.Path, Bookings.Body(quote, date, "09:00"));
        Assert.Equal(HttpStatusCode.Created, booked.StatusCode);

        using var response = await host.Get(Url(Bookings.Text(date), Bookings.Text(date)));
        var raw = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain("Jane", raw);
        Assert.DoesNotContain("O'Neil", raw);
        Assert.DoesNotContain(quote.Email, raw);
        Assert.DoesNotContain(quote.Number, raw);
        Assert.DoesNotContain("name", raw, StringComparison.OrdinalIgnoreCase);
    }

    [DbTheory]
    [InlineData("from=2026-11-24&to=2026-11-25", "kind")]
    [InlineData("from=2026-11-24&to=2026-11-25&kind=haircut", "kind")]
    [InlineData("from=2026-11-24&to=2026-11-25&kind=Survey", "kind")]
    [InlineData("to=2026-11-25&kind=survey", "from")]
    [InlineData("from=2026-11-24&kind=survey", "to")]
    [InlineData("from=2026-11-25&to=2026-11-24&kind=survey", "to")]
    [InlineData("from=2026-13-01&to=2026-11-24&kind=survey", "from")]
    [InlineData("from=2026-11-24&to=tomorrow&kind=survey", "to")]
    [InlineData("from=2026-11-24&to=2026-11-24&kind=drops-only-install&durationMinutes=59", "durationMinutes")]
    [InlineData("from=2026-11-24&to=2026-11-24&kind=drops-only-install&durationMinutes=721", "durationMinutes")]
    [InlineData("from=2026-11-24&to=2026-11-24&kind=drops-only-install&durationMinutes=abc", "durationMinutes")]
    [InlineData("from=2026-11-24&to=2026-11-24&kind=drops-only-install&durationMinutes=", "durationMinutes")]
    [InlineData("from=2026-11-24&to=2026-11-24&kind=survey&durationMinutes=120", "durationMinutes")]
    [InlineData("from=2026-11-24&from=2026-11-25&to=2026-11-25&kind=survey", "from")]
    public async Task A_bad_query_is_a_400_problem_not_a_500(string query, string key)
    {
        using var response = await host.Get($"{Bookings.AvailabilityPath}?{query}");

        Assert.True((await FormsHostErrors(response)).TryGetProperty(key, out _), query);
    }

    [DbFact]
    public async Task A_request_with_no_query_at_all_is_a_400_listing_the_required_values()
    {
        using var response = await host.Get(Bookings.AvailabilityPath);

        var errors = await FormsHostErrors(response);
        foreach (var key in new[] { "from", "to", "kind" })
        {
            Assert.True(errors.TryGetProperty(key, out _), key);
        }
    }

    [DbFact]
    public async Task The_31st_read_in_a_minute_from_one_address_is_a_429()
    {
        var client = FormsHost.NewClient();
        for (var i = 0; i < 30; i++)
        {
            using var read = await host.Get(Url("2026-11-24", "2026-11-24"), client);
            Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        }

        using var refused = await host.Get(Url("2026-11-24", "2026-11-24"), client);

        await FormsHost.AssertProblem(refused, HttpStatusCode.TooManyRequests);
    }

    private static async Task<JsonElement> FormsHostErrors(HttpResponseMessage response) =>
        (await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest)).GetProperty("errors");
}
