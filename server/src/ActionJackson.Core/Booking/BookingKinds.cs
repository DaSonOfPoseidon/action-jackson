namespace ActionJackson.Core.Booking;

// What a customer can book, and how long each takes. The values are the contract's (booking.kinds in
// contracts/lan-options.json): a test checks them against it. The lengths are business rules, so they live
// here once, for availability and booking alike.
public static class BookingKinds
{
    public const string Survey = "survey";
    public const string DropsOnlyInstall = "drops-only-install";
    public const string WholeHomeInstall = "whole-home-install";

    public static readonly IReadOnlyList<string> All = [Survey, DropsOnlyInstall, WholeHomeInstall];

    private static readonly TimeSpan SurveyLength = TimeSpan.FromHours(2);
    private static readonly TimeSpan DropsOnlyDefaultLength = TimeSpan.FromHours(2);
    private static readonly TimeSpan WholeHomeLength = TimeSpan.FromHours(12);

    // The length of a booking. A drops-only install takes the requested minutes rounded up to the hour (two
    // hours when none is requested); the other kinds have a fixed length and ignore the request. The caller
    // checks the requested minutes against the contract's range first.
    public static TimeSpan DurationOf(string kind, int? requestedMinutes) => kind switch
    {
        Survey => SurveyLength,
        WholeHomeInstall => WholeHomeLength,
        DropsOnlyInstall => requestedMinutes is { } minutes
            ? TimeSpan.FromHours(Math.Ceiling(minutes / 60.0))
            : DropsOnlyDefaultLength,
        _ => throw new ArgumentException($"'{kind}' is not a booking kind", nameof(kind)),
    };

    // Only a drops-only install has a length the customer picks.
    public static bool TakesDuration(string kind) => kind == DropsOnlyInstall;

    // The quote kind an install needs; null when any quote will do (a survey).
    public static string? QuoteKindFor(string kind) => kind switch
    {
        DropsOnlyInstall => QuoteKinds.DropsOnly,
        WholeHomeInstall => QuoteKinds.WholeHome,
        _ => null,
    };

    // A whole-home install takes the whole day: nothing else starts that Chicago date.
    public static bool BlocksTheDay(string kind) => kind == WholeHomeInstall;

    // A whole-home install starts only when its day opens (the earliest Opens of the weekday's rules), so
    // it has the whole day to run. Every other kind may start on any step of the day.
    public static bool StartsAtOpening(string kind) => kind == WholeHomeInstall;
}
