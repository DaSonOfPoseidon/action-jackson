using System.Globalization;
using System.Text.RegularExpressions;
using ActionJackson.Core.Booking;

namespace ActionJackson.Core.Validation;

// A booking request that passed the checks: the values the handler uses, already trimmed, normalised and
// converted (the email lower-cased, the local date and time turned into instants).
public sealed record BookingRequest(
    string QuoteNumber,
    string Email,
    string Kind,
    DateOnly Date,
    TimeOnly Time,
    TimeSpan Duration,
    DateTimeOffset StartsAt,
    string? Phone,
    string? Notes)
{
    public DateTimeOffset EndsAt => StartsAt + Duration;
}

// The errors of a booking request and, when there are none, the checked request.
public sealed record BookingValidation(ValidationErrors Errors, BookingRequest? Request);

// Checks the shape of a booking request against the contract. Pure: no clock, no I/O. Whether the time is
// open (hours, blackouts, today, 90 days, other bookings) is BookingRules' question, answered with the data.
public static partial class BookingValidator
{
    public static BookingValidation Validate(BookingInput? input, SiteOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var errors = new ValidationErrors();

        var quoteNumber = input?.QuoteNumber?.Trim();
        if (quoteNumber is null || !QuoteNumberShape().IsMatch(quoteNumber))
        {
            errors.Add("quoteNumber", "Quote number must be exactly 8 digits.");
        }

        CustomerRules.ValidateEmail(errors, "email", input?.Email);
        CustomerRules.ValidatePhone(errors, "phone", input?.Phone);
        var notes = FieldRules.OptionalText(errors, "notes", input?.Notes, options.Limits.Booking.NotesLength, "Notes");
        FieldRules.Honeypot(errors, input?.Honeypot);

        var kind = input?.Kind;
        var kindOk = FieldRules.InList(errors, "kind", kind, options.Booking.Kinds, "kind");
        var duration = TimeSpan.Zero;
        if (kindOk)
        {
            var requested = input?.DurationMinutes;
            if (!BookingKinds.TakesDuration(kind!))
            {
                if (requested is not null)
                {
                    errors.Add("durationMinutes", "Only a drops-only install takes a duration.");
                }
            }
            else if (requested is { } minutes && !options.Limits.Booking.DurationMinutes.Contains(minutes))
            {
                var range = options.Limits.Booking.DurationMinutes;
                errors.Add("durationMinutes", $"Duration must be between {range.Min} and {range.Max} minutes.");
            }

            duration = BookingKinds.DurationOf(kind!, requested);
        }

        var date = default(DateOnly);
        var dateOk = input?.Date is { } dateText
            && DateShape().IsMatch(dateText)
            && DateOnly.TryParseExact(dateText, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
        if (!dateOk)
        {
            errors.Add("date", "Enter a date as YYYY-MM-DD.");
        }

        var time = default(TimeOnly);
        var timeOk = input?.Time is { } timeText
            && TimeShape().IsMatch(timeText)
            && TimeOnly.TryParseExact(timeText, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
        if (!timeOk)
        {
            errors.Add("time", "Enter a time as HH:mm.");
        }

        var startsAt = default(DateTimeOffset);
        if (dateOk && timeOk && !BusinessTime.TryToInstant(date, time, out startsAt))
        {
            errors.Add("time", "That local time does not exist or happens twice that day.");
        }

        if (!errors.IsValid)
        {
            return new BookingValidation(errors, null);
        }

        return new BookingValidation(
            errors,
            new BookingRequest(
                quoteNumber!,
                CustomerRules.NormalizeEmail(input!.Email!),
                kind!,
                date,
                time,
                duration,
                startsAt,
                string.IsNullOrWhiteSpace(input.Phone) ? null : input.Phone.Trim(),
                notes));
    }

    [GeneratedRegex("^[0-9]{8}$", RegexOptions.CultureInvariant)]
    private static partial Regex QuoteNumberShape();

    [GeneratedRegex("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", RegexOptions.CultureInvariant)]
    private static partial Regex DateShape();

    [GeneratedRegex("^[0-9]{2}:[0-9]{2}$", RegexOptions.CultureInvariant)]
    private static partial Regex TimeShape();
}
