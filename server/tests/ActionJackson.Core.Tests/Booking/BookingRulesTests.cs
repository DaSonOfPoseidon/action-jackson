using ActionJackson.Core.Booking;

namespace ActionJackson.Core.Tests.Booking;

public class BookingRulesTests
{
    // Monday 2026-11-23 06:00 in Chicago (CST).
    private static readonly DateTimeOffset Now = new(2026, 11, 23, 12, 0, 0, TimeSpan.Zero);

    private static readonly DateOnly Today = new(2026, 11, 23);
    private static readonly DateOnly Tuesday = new(2026, 11, 24);

    private static readonly TimeSpan Hour = TimeSpan.FromHours(1);

    // The seeded rules: every day, 08:00 to 18:00, on the hour.
    private static IReadOnlyList<OpeningRule> EveryDay() =>
        [.. Enumerable.Range(0, 7).Select(day => new OpeningRule(day, new TimeOnly(8, 0), new TimeOnly(18, 0), 60))];

    private static BookingRules Rules(
        IEnumerable<OpeningRule>? rules = null,
        IEnumerable<DateOnly>? blackouts = null,
        IEnumerable<BookedSlot>? booked = null,
        DateTimeOffset? now = null) =>
        new(rules?.ToList() ?? EveryDay(), (blackouts ?? []).ToHashSet(), booked?.ToList() ?? [], now ?? Now, 90);

    // An appointment on a Chicago date, from a local time and a length.
    private static BookedSlot Booked(DateOnly date, int hour, int hours, string kind = BookingKinds.Survey)
    {
        var start = BusinessTime.ToInstant(date, new TimeOnly(hour, 0));
        return new BookedSlot(start, start.AddHours(hours), kind);
    }

    private static SlotCheck Check(BookingRules rules, DateOnly date, string time, string kind = BookingKinds.Survey, TimeSpan? duration = null) =>
        rules.Check(date, TimeOnly.Parse(time), kind, duration ?? BookingKinds.DurationOf(kind, null));

    [Theory]
    [InlineData("08:00", SlotCheck.Open)]
    [InlineData("12:00", SlotCheck.Open)]
    [InlineData("18:00", SlotCheck.Open)]
    [InlineData("07:00", SlotCheck.Closed)]
    [InlineData("18:30", SlotCheck.Closed)]
    [InlineData("19:00", SlotCheck.Closed)]
    [InlineData("08:30", SlotCheck.Closed)]
    [InlineData("00:00", SlotCheck.Closed)]
    public void A_start_is_open_inside_the_hours_and_on_the_step(string time, SlotCheck expected)
    {
        Assert.Equal(expected, Check(Rules(), Tuesday, time, BookingKinds.DropsOnlyInstall, Hour));
    }

    [Fact]
    public void A_day_lists_the_hourly_starts_from_open_to_close_inclusive()
    {
        var starts = Rules().OpenStarts(Tuesday, BookingKinds.DropsOnlyInstall, Hour);

        Assert.Equal(
            Enumerable.Range(8, 11).Select(hour => new TimeOnly(hour, 0)),
            starts);
    }

    [Fact]
    public void A_weekday_without_a_rule_is_closed()
    {
        // Tuesday has no rule.
        var rules = Rules(EveryDay().Where(rule => rule.DayOfWeek != (int)DayOfWeek.Tuesday));

        Assert.Equal(SlotCheck.Closed, Check(rules, Tuesday, "09:00"));
        Assert.Empty(rules.OpenStarts(Tuesday, BookingKinds.Survey, Hour));
        Assert.NotEmpty(rules.OpenStarts(Tuesday.AddDays(1), BookingKinds.Survey, Hour));
    }

    [Fact]
    public void The_rule_of_the_weekday_applies_and_the_step_starts_at_opening()
    {
        var rules = Rules([new OpeningRule((int)DayOfWeek.Tuesday, new TimeOnly(9, 15), new TimeOnly(11, 15), 30)]);

        Assert.Equal(
            [new TimeOnly(9, 15), new TimeOnly(9, 45), new TimeOnly(10, 15), new TimeOnly(10, 45), new TimeOnly(11, 15)],
            rules.OpenStarts(Tuesday, BookingKinds.Survey, Hour));
        Assert.Equal(SlotCheck.Closed, Check(rules, Tuesday, "09:00"));
    }

    [Fact]
    public void Two_rules_on_a_weekday_both_apply()
    {
        var rules = Rules(
        [
            new OpeningRule((int)DayOfWeek.Tuesday, new TimeOnly(8, 0), new TimeOnly(9, 0), 60),
            new OpeningRule((int)DayOfWeek.Tuesday, new TimeOnly(13, 0), new TimeOnly(14, 0), 60),
        ]);

        Assert.Equal(
            [new TimeOnly(8, 0), new TimeOnly(9, 0), new TimeOnly(13, 0), new TimeOnly(14, 0)],
            rules.OpenStarts(Tuesday, BookingKinds.Survey, Hour));
    }

    [Fact]
    public void A_blackout_date_is_closed()
    {
        var rules = Rules(blackouts: [Tuesday]);

        Assert.Equal(SlotCheck.Blackout, Check(rules, Tuesday, "09:00"));
        Assert.Empty(rules.OpenStarts(Tuesday, BookingKinds.Survey, Hour));
        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday.AddDays(1), "09:00"));
    }

    [Fact]
    public void Today_is_open_only_for_hours_after_now()
    {
        // 10:30 in Chicago on the 23rd.
        var rules = Rules(now: new DateTimeOffset(2026, 11, 23, 16, 30, 0, TimeSpan.Zero));

        Assert.Equal(SlotCheck.Past, Check(rules, Today, "08:00"));
        Assert.Equal(SlotCheck.Past, Check(rules, Today, "10:00"));
        Assert.Equal(SlotCheck.Open, Check(rules, Today, "11:00"));
        Assert.Equal(
            Enumerable.Range(11, 8).Select(hour => new TimeOnly(hour, 0)),
            rules.OpenStarts(Today, BookingKinds.DropsOnlyInstall, Hour));
    }

    [Fact]
    public void A_start_exactly_at_now_is_not_after_now()
    {
        // 10:00 in Chicago on the 23rd.
        var rules = Rules(now: new DateTimeOffset(2026, 11, 23, 16, 0, 0, TimeSpan.Zero));

        Assert.Equal(SlotCheck.Past, Check(rules, Today, "10:00"));
        Assert.Equal(SlotCheck.Open, Check(rules, Today, "11:00"));
    }

    [Fact]
    public void An_earlier_date_is_past_and_lists_nothing()
    {
        var rules = Rules();

        Assert.Equal(SlotCheck.Past, Check(rules, Today.AddDays(-1), "09:00"));
        Assert.Empty(rules.OpenStarts(Today.AddDays(-1), BookingKinds.Survey, Hour));
    }

    [Fact]
    public void Today_plus_90_days_is_open_and_plus_91_is_too_far()
    {
        var rules = Rules();

        Assert.Equal(SlotCheck.Open, Check(rules, Today.AddDays(90), "09:00"));
        Assert.Equal(SlotCheck.TooFarAhead, Check(rules, Today.AddDays(91), "09:00"));
        Assert.NotEmpty(rules.OpenStarts(Today.AddDays(90), BookingKinds.Survey, Hour));
        Assert.Empty(rules.OpenStarts(Today.AddDays(91), BookingKinds.Survey, Hour));
    }

    [Fact]
    public void Today_is_the_chicago_date_even_when_it_is_already_tomorrow_in_utc()
    {
        // 21:00 in Chicago on the 23rd is 03:00 UTC on the 24th.
        var rules = Rules(now: new DateTimeOffset(2026, 11, 24, 3, 0, 0, TimeSpan.Zero));

        Assert.Equal(SlotCheck.Open, Check(rules, Today.AddDays(90), "09:00"));
        Assert.Equal(SlotCheck.TooFarAhead, Check(rules, Today.AddDays(91), "09:00"));
        Assert.Equal(SlotCheck.Past, Check(rules, Today, "18:00"));
        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday, "08:00"));
    }

    [Theory]
    [InlineData("2027-03-14", "2027-02-01T12:00:00Z")]
    [InlineData("2026-11-01", "2026-10-01T12:00:00Z")]
    public void The_days_the_clocks_change_still_list_eight_to_six(string date, string now)
    {
        var rules = Rules(now: DateTimeOffset.Parse(now));

        var starts = rules.OpenStarts(DateOnly.Parse(date), BookingKinds.Survey, Hour);

        Assert.Equal(Enumerable.Range(8, 11).Select(hour => new TimeOnly(hour, 0)), starts);
    }

    [Fact]
    public void A_start_that_does_not_exist_or_repeats_is_never_open()
    {
        // 02:30 on the spring-forward day does not exist; 01:30 on the fall-back day happens twice.
        OpeningRule[] sunday = [new OpeningRule((int)DayOfWeek.Sunday, new TimeOnly(1, 0), new TimeOnly(4, 0), 30)];
        var spring = Rules(sunday, now: new DateTimeOffset(2027, 2, 1, 12, 0, 0, TimeSpan.Zero));
        var fall = Rules(sunday, now: new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero));

        Assert.DoesNotContain(new TimeOnly(2, 30), spring.OpenStarts(new DateOnly(2027, 3, 14), BookingKinds.Survey, Hour));
        Assert.Equal(SlotCheck.Closed, Check(spring, new DateOnly(2027, 3, 14), "02:30"));
        Assert.Contains(new TimeOnly(3, 0), spring.OpenStarts(new DateOnly(2027, 3, 14), BookingKinds.Survey, Hour));
        Assert.Equal(SlotCheck.Closed, Check(fall, new DateOnly(2026, 11, 1), "01:30"));
        Assert.DoesNotContain(new TimeOnly(1, 30), fall.OpenStarts(new DateOnly(2026, 11, 1), BookingKinds.Survey, Hour));
        Assert.Contains(new TimeOnly(2, 0), fall.OpenStarts(new DateOnly(2026, 11, 1), BookingKinds.Survey, Hour));
    }

    [Fact]
    public void Touching_bookings_are_both_fine_and_overlapping_ones_conflict()
    {
        // 10:00 to 11:00.
        var rules = Rules(booked: [Booked(Tuesday, 10, 1, BookingKinds.DropsOnlyInstall)]);

        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday, "11:00", BookingKinds.DropsOnlyInstall, Hour));
        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday, "09:00", BookingKinds.DropsOnlyInstall, Hour));
        Assert.Equal(SlotCheck.Conflict, Check(rules, Tuesday, "10:00", BookingKinds.DropsOnlyInstall, Hour));
        // A two-hour survey from 09:00 runs into the booking; from 08:00 it ends where the booking starts.
        Assert.Equal(SlotCheck.Conflict, Check(rules, Tuesday, "09:00"));
        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday, "08:00"));
    }

    [Fact]
    public void The_duration_is_part_of_the_fit_so_a_long_install_loses_the_starts_before_a_booking()
    {
        // A three-hour install may not start from 08:00 to 10:00 if something starts at 11:00.
        var rules = Rules(booked: [Booked(Tuesday, 11, 1)]);

        var starts = rules.OpenStarts(Tuesday, BookingKinds.DropsOnlyInstall, TimeSpan.FromHours(3));

        Assert.Equal(new TimeOnly(8, 0), starts[0]);
        Assert.DoesNotContain(new TimeOnly(9, 0), starts);
        Assert.DoesNotContain(new TimeOnly(11, 0), starts);
        Assert.Contains(new TimeOnly(12, 0), starts);
    }

    [Fact]
    public void A_booking_that_runs_past_midnight_blocks_the_next_days_early_instants()
    {
        // 18:00 for twelve hours runs to 06:00 the next day: the next day's 08:00 is clear.
        var rules = Rules(booked: [Booked(Tuesday, 18, 12, BookingKinds.DropsOnlyInstall)]);

        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday.AddDays(1), "08:00"));
        // With an earlier opening, an overlap on the next date is found by the instants.
        var early = Rules(
            [new OpeningRule((int)DayOfWeek.Wednesday, new TimeOnly(4, 0), new TimeOnly(18, 0), 60)],
            booked: [Booked(Tuesday, 18, 12, BookingKinds.DropsOnlyInstall)]);
        Assert.Equal(SlotCheck.Conflict, Check(early, Tuesday.AddDays(1), "04:00", BookingKinds.Survey));
        Assert.Equal(SlotCheck.Open, Check(early, Tuesday.AddDays(1), "06:00", BookingKinds.Survey));
    }

    [Theory]
    [InlineData(8)]
    [InlineData(12)]
    [InlineData(18)]
    public void A_whole_home_install_conflicts_with_any_booking_that_starts_that_chicago_date(int bookedHour)
    {
        var rules = Rules(booked: [Booked(Tuesday, bookedHour, 1)]);

        Assert.Equal(SlotCheck.Conflict, Check(rules, Tuesday, "08:00", BookingKinds.WholeHomeInstall));
    }

    [Fact]
    public void A_whole_home_install_starts_only_at_the_opening_time()
    {
        var rules = Rules();

        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday, "08:00", BookingKinds.WholeHomeInstall));
        Assert.Equal(SlotCheck.Closed, Check(rules, Tuesday, "09:00", BookingKinds.WholeHomeInstall));
        Assert.Equal(SlotCheck.Closed, Check(rules, Tuesday, "12:00", BookingKinds.WholeHomeInstall));
        Assert.Equal(SlotCheck.Closed, Check(rules, Tuesday, "18:00", BookingKinds.WholeHomeInstall));
        Assert.Equal(SlotCheck.Closed, Check(rules, Tuesday, "07:00", BookingKinds.WholeHomeInstall));
        Assert.Equal([new TimeOnly(8, 0)], rules.OpenStarts(Tuesday, BookingKinds.WholeHomeInstall, BookingKinds.DurationOf(BookingKinds.WholeHomeInstall, null)));
    }

    [Fact]
    public void On_a_day_that_opens_at_another_hour_that_hour_is_the_only_whole_home_start()
    {
        var rules = Rules(
        [
            new OpeningRule((int)DayOfWeek.Tuesday, new TimeOnly(10, 0), new TimeOnly(16, 0), 60),
            new OpeningRule((int)DayOfWeek.Wednesday, new TimeOnly(8, 0), new TimeOnly(18, 0), 60),
        ]);
        var duration = BookingKinds.DurationOf(BookingKinds.WholeHomeInstall, null);

        Assert.Equal([new TimeOnly(10, 0)], rules.OpenStarts(Tuesday, BookingKinds.WholeHomeInstall, duration));
        Assert.Equal(SlotCheck.Closed, Check(rules, Tuesday, "08:00", BookingKinds.WholeHomeInstall));
        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday, "10:00", BookingKinds.WholeHomeInstall));
        Assert.Equal(SlotCheck.Closed, Check(rules, Tuesday, "11:00", BookingKinds.WholeHomeInstall));
        Assert.Equal([new TimeOnly(8, 0)], rules.OpenStarts(Tuesday.AddDays(1), BookingKinds.WholeHomeInstall, duration));
    }

    [Fact]
    public void With_two_rules_on_a_weekday_the_earliest_opening_is_the_whole_home_start()
    {
        var rules = Rules(
        [
            new OpeningRule((int)DayOfWeek.Tuesday, new TimeOnly(13, 0), new TimeOnly(15, 0), 60),
            new OpeningRule((int)DayOfWeek.Tuesday, new TimeOnly(9, 0), new TimeOnly(10, 0), 60),
        ]);

        Assert.Equal(
            [new TimeOnly(9, 0)],
            rules.OpenStarts(Tuesday, BookingKinds.WholeHomeInstall, BookingKinds.DurationOf(BookingKinds.WholeHomeInstall, null)));
    }

    [Fact]
    public void A_whole_home_start_that_is_not_free_or_not_ahead_is_not_listed()
    {
        var duration = BookingKinds.DurationOf(BookingKinds.WholeHomeInstall, null);

        // Someone holds 08:00 that day.
        var taken = Rules(booked: [Booked(Tuesday, 8, 1)]);
        // 08:00 today has passed.
        var passed = Rules(now: new DateTimeOffset(2026, 11, 23, 16, 0, 0, TimeSpan.Zero));

        Assert.Empty(taken.OpenStarts(Tuesday, BookingKinds.WholeHomeInstall, duration));
        Assert.Empty(passed.OpenStarts(Today, BookingKinds.WholeHomeInstall, duration));
        Assert.Equal([new TimeOnly(8, 0)], passed.OpenStarts(Tuesday, BookingKinds.WholeHomeInstall, duration));
    }

    [Theory]
    [InlineData("08:00")]
    [InlineData("12:00")]
    [InlineData("18:00")]
    public void Nothing_can_be_booked_on_a_day_that_has_a_whole_home_install(string time)
    {
        var rules = Rules(booked: [Booked(Tuesday, 8, 12, BookingKinds.WholeHomeInstall)]);

        Assert.Equal(SlotCheck.Conflict, Check(rules, Tuesday, time, BookingKinds.Survey));
        Assert.Equal(SlotCheck.Conflict, Check(rules, Tuesday, time, BookingKinds.DropsOnlyInstall, Hour));
        Assert.Empty(rules.OpenStarts(Tuesday, BookingKinds.Survey, BookingKinds.DurationOf(BookingKinds.Survey, null)));
        Assert.NotEmpty(rules.OpenStarts(Tuesday.AddDays(1), BookingKinds.Survey, Hour));
    }

    [Fact]
    public void A_whole_home_day_is_the_chicago_date_of_its_start()
    {
        // 18:00 Chicago on Tuesday is already Wednesday in UTC. It is Tuesday's whole-home day.
        var rules = Rules(booked: [Booked(Tuesday, 18, 12, BookingKinds.WholeHomeInstall)]);

        Assert.Equal(SlotCheck.Conflict, Check(rules, Tuesday, "08:00", BookingKinds.Survey, Hour));
        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday.AddDays(1), "08:00", BookingKinds.Survey, Hour));
    }

    [Fact]
    public void A_whole_home_install_the_day_after_a_late_booking_is_fine()
    {
        // A survey at 18:00 Tuesday Chicago time is 00:00 UTC Wednesday: it does not occupy Wednesday.
        var rules = Rules(booked: [Booked(Tuesday, 18, 1)]);

        Assert.Equal(SlotCheck.Open, Check(rules, Tuesday.AddDays(1), "08:00", BookingKinds.WholeHomeInstall));
        Assert.Equal(SlotCheck.Conflict, Check(rules, Tuesday, "08:00", BookingKinds.WholeHomeInstall));
    }

    [Fact]
    public void Conflicts_is_the_one_rule_for_overlap_and_whole_home_days()
    {
        var existing = new[] { Booked(Tuesday, 10, 2) };

        Assert.True(BookingRules.Conflicts(
            BusinessTime.ToInstant(Tuesday, new TimeOnly(11, 0)), BusinessTime.ToInstant(Tuesday, new TimeOnly(12, 0)),
            BookingKinds.DropsOnlyInstall, existing));
        Assert.False(BookingRules.Conflicts(
            BusinessTime.ToInstant(Tuesday, new TimeOnly(12, 0)), BusinessTime.ToInstant(Tuesday, new TimeOnly(13, 0)),
            BookingKinds.DropsOnlyInstall, existing));
        Assert.True(BookingRules.Conflicts(
            BusinessTime.ToInstant(Tuesday, new TimeOnly(18, 0)), BusinessTime.ToInstant(Tuesday.AddDays(1), new TimeOnly(6, 0)),
            BookingKinds.WholeHomeInstall, existing));
    }
}
