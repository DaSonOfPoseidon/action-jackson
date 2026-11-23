namespace ActionJackson.Core.Booking;

// One opening rule of a weekday: starts every SlotMinutes from Opens to Closes, both included. DayOfWeek is
// 0 (Sunday) to 6, like System.DayOfWeek. A weekday with no rule is closed.
public sealed record OpeningRule(int DayOfWeek, TimeOnly Opens, TimeOnly Closes, int SlotMinutes);

// An appointment that holds its time (a blocking status): its instants and kind.
public sealed record BookedSlot(DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Kind);

public enum SlotCheck
{
    Open,

    // The start is not after now (or the date is before today).
    Past,

    // The date is more than DaysAhead days after today.
    TooFarAhead,

    // No rule of that weekday has this time on its step, within its hours, at a definite local time; or the
    // kind starts only when the day opens (a whole-home install) and this is not that time.
    Closed,

    Blackout,

    // Overlaps a booking, or breaks the whole-home day rule.
    Conflict,
}

// The one implementation of "is this start time open": the availability list and the booking both ask it, so
// they cannot disagree. Pure: the caller loads the rules, the blackout dates and the blocking appointments
// (any that overlap the dates asked about, with a day of margin), and passes the clock. All dates are
// Chicago dates.
public sealed class BookingRules(
    IReadOnlyList<OpeningRule> rules,
    IReadOnlySet<DateOnly> blackouts,
    IReadOnlyList<BookedSlot> blocking,
    DateTimeOffset now,
    int daysAhead)
{
    private readonly DateOnly today = BusinessTime.LocalDate(now);

    // Why a start is or is not open. The checks run in the order of the enum's reading: date range, then the
    // schedule, then the bookings.
    public SlotCheck Check(DateOnly date, TimeOnly time, string kind, TimeSpan duration)
    {
        if (date < today)
        {
            return SlotCheck.Past;
        }

        if (date > today.AddDays(daysAhead))
        {
            return SlotCheck.TooFarAhead;
        }

        if (blackouts.Contains(date))
        {
            return SlotCheck.Blackout;
        }

        if (!OnTheGrid(date, time) || !BusinessTime.TryToInstant(date, time, out var start))
        {
            return SlotCheck.Closed;
        }

        if (BookingKinds.StartsAtOpening(kind) && time != Opening(date))
        {
            return SlotCheck.Closed;
        }

        if (start <= now)
        {
            return SlotCheck.Past;
        }

        return Conflicts(start, start + duration, kind, blocking) ? SlotCheck.Conflict : SlotCheck.Open;
    }

    // Every start of the date that is open for a booking of this kind and length, in order. Empty for a
    // closed, past or too-distant date.
    public IReadOnlyList<TimeOnly> OpenStarts(DateOnly date, string kind, TimeSpan duration)
    {
        if (date < today || date > today.AddDays(daysAhead) || blackouts.Contains(date))
        {
            return [];
        }

        return [.. Grid(date).Where(time => Check(date, time, kind, duration) == SlotCheck.Open)];
    }

    // Whether a booking of [start, end) and this kind clashes with the blocking appointments:
    // - it overlaps one (touching is fine);
    // - it takes the whole day and an appointment already starts that Chicago date;
    // - an appointment that takes the whole day already starts that Chicago date.
    public static bool Conflicts(DateTimeOffset start, DateTimeOffset end, string kind, IEnumerable<BookedSlot> blocking)
    {
        var date = BusinessTime.LocalDate(start);
        foreach (var booked in blocking)
        {
            if (start < booked.EndsAt && booked.StartsAt < end)
            {
                return true;
            }

            if (BusinessTime.LocalDate(booked.StartsAt) == date
                && (BookingKinds.BlocksTheDay(kind) || BookingKinds.BlocksTheDay(booked.Kind)))
            {
                return true;
            }
        }

        return false;
    }

    private bool OnTheGrid(DateOnly date, TimeOnly time) => Grid(date).Contains(time);

    // When the date opens: the earliest Opens of its weekday's rules, or null for a closed weekday.
    private TimeOnly? Opening(DateOnly date)
    {
        var day = (int)date.DayOfWeek;
        var opens = rules.Where(rule => rule.DayOfWeek == day && rule.SlotMinutes > 0).Select(rule => rule.Opens).ToList();
        return opens.Count == 0 ? null : opens.Min();
    }

    // The starts of the weekday's rules, ordered, without repeats. A time that does not exist or is
    // ambiguous that day is left out.
    private IEnumerable<TimeOnly> Grid(DateOnly date)
    {
        var day = (int)date.DayOfWeek;
        var starts = new SortedSet<TimeOnly>();
        foreach (var rule in rules.Where(rule => rule.DayOfWeek == day && rule.SlotMinutes > 0))
        {
            var step = TimeSpan.FromMinutes(rule.SlotMinutes);
            for (var at = rule.Opens.ToTimeSpan(); at <= rule.Closes.ToTimeSpan(); at += step)
            {
                var time = TimeOnly.FromTimeSpan(at);
                if (BusinessTime.TryToInstant(date, time, out _))
                {
                    starts.Add(time);
                }
            }
        }

        return starts;
    }
}
