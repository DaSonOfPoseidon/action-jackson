using ActionJackson.Core.Booking;

namespace ActionJackson.Core.Tests.Booking;

public class BookingKindsTests
{
    [Fact]
    public void The_kinds_constants_match_the_contract()
    {
        var values = SiteOptions.For(Site.Lan).Booking.Kinds.Select(option => option.Value).ToList();

        Assert.Equal(BookingKinds.All, values);
        Assert.Equal(["survey", "drops-only-install", "whole-home-install"], BookingKinds.All);
    }

    [Fact]
    public void The_contract_labels_the_kinds()
    {
        var kinds = SiteOptions.For(Site.Lan).Booking.Kinds;

        Assert.Equal("Site Survey", kinds.LabelOf(BookingKinds.Survey));
        Assert.Equal("Drops-Only Install", kinds.LabelOf(BookingKinds.DropsOnlyInstall));
        Assert.Equal("Whole-Home Install", kinds.LabelOf(BookingKinds.WholeHomeInstall));
    }

    [Fact]
    public void The_booking_limits_come_from_the_contract()
    {
        var limits = SiteOptions.For(Site.Lan).Limits.Booking;

        Assert.Equal(new IntRange(60, 720), limits.DurationMinutes);
        Assert.Equal(90, limits.DaysAhead);
        Assert.Equal(500, limits.NotesLength);
    }

    [Theory]
    [InlineData(BookingKinds.Survey, null, 120)]
    [InlineData(BookingKinds.WholeHomeInstall, null, 720)]
    [InlineData(BookingKinds.DropsOnlyInstall, null, 120)]
    [InlineData(BookingKinds.DropsOnlyInstall, 60, 60)]
    [InlineData(BookingKinds.DropsOnlyInstall, 61, 120)]
    [InlineData(BookingKinds.DropsOnlyInstall, 120, 120)]
    [InlineData(BookingKinds.DropsOnlyInstall, 121, 180)]
    [InlineData(BookingKinds.DropsOnlyInstall, 719, 720)]
    [InlineData(BookingKinds.DropsOnlyInstall, 720, 720)]
    public void The_duration_comes_from_the_kind_and_a_drops_only_request_rounds_up_to_the_hour(
        string kind, int? requested, int expectedMinutes)
    {
        Assert.Equal(TimeSpan.FromMinutes(expectedMinutes), BookingKinds.DurationOf(kind, requested));
    }

    [Fact]
    public void Only_a_drops_only_install_takes_a_requested_duration()
    {
        Assert.True(BookingKinds.TakesDuration(BookingKinds.DropsOnlyInstall));
        Assert.False(BookingKinds.TakesDuration(BookingKinds.Survey));
        Assert.False(BookingKinds.TakesDuration(BookingKinds.WholeHomeInstall));
    }

    [Fact]
    public void A_requested_duration_for_another_kind_is_ignored_by_the_calculation()
    {
        Assert.Equal(TimeSpan.FromHours(2), BookingKinds.DurationOf(BookingKinds.Survey, 600));
        Assert.Equal(TimeSpan.FromHours(12), BookingKinds.DurationOf(BookingKinds.WholeHomeInstall, 60));
    }

    [Fact]
    public void An_unknown_kind_is_a_bug_of_the_caller()
    {
        Assert.Throws<ArgumentException>(() => BookingKinds.DurationOf("haircut", null));
    }

    [Fact]
    public void The_quote_kind_each_install_needs()
    {
        Assert.Null(BookingKinds.QuoteKindFor(BookingKinds.Survey));
        Assert.Equal(QuoteKinds.DropsOnly, BookingKinds.QuoteKindFor(BookingKinds.DropsOnlyInstall));
        Assert.Equal(QuoteKinds.WholeHome, BookingKinds.QuoteKindFor(BookingKinds.WholeHomeInstall));
    }

    [Fact]
    public void Only_the_whole_home_install_blocks_the_day()
    {
        Assert.True(BookingKinds.BlocksTheDay(BookingKinds.WholeHomeInstall));
        Assert.False(BookingKinds.BlocksTheDay(BookingKinds.Survey));
        Assert.False(BookingKinds.BlocksTheDay(BookingKinds.DropsOnlyInstall));
    }
}
