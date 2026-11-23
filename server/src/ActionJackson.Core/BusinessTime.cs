namespace ActionJackson.Core;

// The business's time zone. Customers pick a local date and time; appointments are stored as instants; every
// "which day is this" question (the 90-day window, a whole-home day, the slots of a date) uses the Chicago
// date, never the UTC date (an 18:00 Chicago start is already the next UTC day).
//
// The runtime has no ICU (InvariantGlobalization), but time zones come from tzdata, which the images have.
public static class BusinessTime
{
    public const string ZoneId = "America/Chicago";

    public static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById(ZoneId);

    // The instant (offset 0) of a local date and time. False for a time that does not exist (the hour the
    // clocks skip) or happens twice (the hour they repeat): it is refused, never guessed.
    public static bool TryToInstant(DateOnly date, TimeOnly time, out DateTimeOffset instant)
    {
        var local = date.ToDateTime(time, DateTimeKind.Unspecified);
        if (Zone.IsInvalidTime(local) || Zone.IsAmbiguousTime(local))
        {
            instant = default;
            return false;
        }

        instant = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(local, Zone), TimeSpan.Zero);
        return true;
    }

    // As TryToInstant, but throws ArgumentException for a local time that does not exist or is ambiguous.
    public static DateTimeOffset ToInstant(DateOnly date, TimeOnly time) =>
        TryToInstant(date, time, out var instant)
            ? instant
            : throw new ArgumentException($"{date:yyyy-MM-dd} {time:HH:mm} is not one definite time in {ZoneId}.");

    // The Chicago calendar date of an instant.
    public static DateOnly LocalDate(DateTimeOffset instant) => DateOnly.FromDateTime(ToLocal(instant).DateTime);

    // The same instant with the Chicago offset, for showing to people and for ISO 8601 text.
    public static DateTimeOffset ToLocal(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, Zone);

    // Midnight at the start of a Chicago date, as an instant. Midnight is never skipped or repeated here.
    public static DateTimeOffset StartOfDay(DateOnly date) =>
        new(TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), Zone), TimeSpan.Zero);
}
