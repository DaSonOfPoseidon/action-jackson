namespace ActionJackson.Core.Tests;

public class BusinessTimeTests
{
    [Fact]
    public void The_zone_is_america_chicago()
    {
        Assert.Equal("America/Chicago", BusinessTime.ZoneId);
        Assert.Equal(BusinessTime.ZoneId, BusinessTime.Zone.Id);
    }

    [Theory]
    [InlineData("2026-11-24", "09:00", "2026-11-24T15:00:00Z")] // CST, UTC-6
    [InlineData("2026-07-01", "09:00", "2026-07-01T14:00:00Z")] // CDT, UTC-5
    [InlineData("2027-03-14", "09:00", "2027-03-14T14:00:00Z")] // the day the clocks go forward: 09:00 is already CDT
    [InlineData("2026-11-01", "09:00", "2026-11-01T15:00:00Z")] // the day they go back: 09:00 is CST
    [InlineData("2027-03-14", "08:00", "2027-03-14T13:00:00Z")]
    [InlineData("2026-11-01", "18:00", "2026-11-02T00:00:00Z")] // a Chicago evening is the next UTC day
    public void A_local_date_and_time_becomes_the_right_instant(string date, string time, string expected)
    {
        var instant = BusinessTime.ToInstant(DateOnly.Parse(date), TimeOnly.Parse(time));

        Assert.Equal(DateTimeOffset.Parse(expected), instant);
        Assert.Equal(TimeSpan.Zero, instant.Offset);
    }

    [Fact]
    public void A_time_in_the_spring_forward_gap_is_refused()
    {
        // 2027-03-14 02:00 to 03:00 does not exist.
        Assert.False(BusinessTime.TryToInstant(new DateOnly(2027, 3, 14), new TimeOnly(2, 30), out _));
        Assert.Throws<ArgumentException>(() => BusinessTime.ToInstant(new DateOnly(2027, 3, 14), new TimeOnly(2, 30)));
    }

    [Fact]
    public void A_time_that_happens_twice_in_the_fall_back_hour_is_refused()
    {
        // 2026-11-01 01:00 to 02:00 happens twice.
        Assert.False(BusinessTime.TryToInstant(new DateOnly(2026, 11, 1), new TimeOnly(1, 30), out _));
        Assert.Throws<ArgumentException>(() => BusinessTime.ToInstant(new DateOnly(2026, 11, 1), new TimeOnly(1, 30)));
    }

    [Fact]
    public void The_local_date_is_the_chicago_date_not_the_utc_date()
    {
        // 2026-11-24 01:00 UTC is still the evening of the 23rd in Chicago.
        Assert.Equal(new DateOnly(2026, 11, 23), BusinessTime.LocalDate(new DateTimeOffset(2026, 11, 24, 1, 0, 0, TimeSpan.Zero)));
        Assert.Equal(new DateOnly(2026, 11, 24), BusinessTime.LocalDate(new DateTimeOffset(2026, 11, 24, 6, 0, 0, TimeSpan.Zero)));
        Assert.Equal(new DateOnly(2026, 11, 23), BusinessTime.LocalDate(new DateTimeOffset(2026, 11, 24, 5, 59, 59, TimeSpan.Zero)));
    }

    [Fact]
    public void A_local_date_starts_at_midnight_chicago_time()
    {
        Assert.Equal(new DateTimeOffset(2026, 11, 24, 6, 0, 0, TimeSpan.Zero), BusinessTime.StartOfDay(new DateOnly(2026, 11, 24)));
        // 2027-03-14 starts at 06:00 UTC and has 23 hours.
        Assert.Equal(new DateTimeOffset(2027, 3, 14, 6, 0, 0, TimeSpan.Zero), BusinessTime.StartOfDay(new DateOnly(2027, 3, 14)));
        Assert.Equal(new DateTimeOffset(2027, 3, 15, 5, 0, 0, TimeSpan.Zero), BusinessTime.StartOfDay(new DateOnly(2027, 3, 15)));
    }

    [Fact]
    public void An_instant_is_shown_with_the_chicago_offset()
    {
        var local = BusinessTime.ToLocal(new DateTimeOffset(2026, 11, 24, 15, 0, 0, TimeSpan.Zero));

        Assert.Equal(TimeSpan.FromHours(-6), local.Offset);
        Assert.Equal(9, local.Hour);
        Assert.Equal(TimeSpan.FromHours(-5), BusinessTime.ToLocal(new DateTimeOffset(2026, 7, 1, 14, 0, 0, TimeSpan.Zero)).Offset);
    }
}
