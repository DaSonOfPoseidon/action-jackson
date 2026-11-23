using ActionJackson.Core.Booking;
using ActionJackson.Core.Validation;

namespace ActionJackson.Core.Tests.Validation;

public class BookingValidatorTests
{
    private static readonly SiteOptions Options = SiteOptions.For(Site.Lan);

    private static BookingInput Valid() =>
        new("20260001", "Jane@Example.com", BookingKinds.Survey, "2026-11-24", "09:00", null, "(555) 123-4567", "Side gate is open", null);

    private static BookingValidation Check(BookingInput? input) => BookingValidator.Validate(input, Options);

    [Fact]
    public void A_valid_request_has_no_errors_and_gives_the_checked_values()
    {
        var result = Check(Valid());

        Assert.True(result.Errors.IsValid);
        var request = result.Request!;
        Assert.Equal("20260001", request.QuoteNumber);
        Assert.Equal("jane@example.com", request.Email);
        Assert.Equal(BookingKinds.Survey, request.Kind);
        Assert.Equal(new DateOnly(2026, 11, 24), request.Date);
        Assert.Equal(new TimeOnly(9, 0), request.Time);
        Assert.Equal(TimeSpan.FromHours(2), request.Duration);
        Assert.Equal(new DateTimeOffset(2026, 11, 24, 15, 0, 0, TimeSpan.Zero), request.StartsAt);
        Assert.Equal(new DateTimeOffset(2026, 11, 24, 17, 0, 0, TimeSpan.Zero), request.EndsAt);
        Assert.Equal("(555) 123-4567", request.Phone);
        Assert.Equal("Side gate is open", request.Notes);
    }

    [Fact]
    public void The_minimum_request_is_valid()
    {
        var result = Check(new BookingInput("20260001", "jo@example.com", BookingKinds.WholeHomeInstall, "2026-11-24", "08:00", null, null, null, null));

        Assert.True(result.Errors.IsValid);
        Assert.Null(result.Request!.Phone);
        Assert.Null(result.Request.Notes);
        Assert.Equal(TimeSpan.FromHours(12), result.Request.Duration);
    }

    [Fact]
    public void A_missing_body_reports_every_required_field_and_gives_no_request()
    {
        var result = Check(null);

        Assert.Null(result.Request);
        foreach (var key in new[] { "quoteNumber", "email", "kind", "date", "time" })
        {
            Assert.Contains(key, result.Errors.Keys);
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1234567")]
    [InlineData("123456789")]
    [InlineData("1234567a")]
    [InlineData("1234 5678")]
    [InlineData("１２３４５６７８")]
    public void A_quote_number_is_exactly_eight_ascii_digits(string? number)
    {
        var result = Check(Valid() with { QuoteNumber = number });

        Assert.Contains("quoteNumber", result.Errors.Keys);
        Assert.Null(result.Request);
    }

    [Fact]
    public void A_quote_number_with_spaces_around_it_is_trimmed()
    {
        Assert.Equal("20260001", Check(Valid() with { QuoteNumber = " 20260001 " }).Request!.QuoteNumber);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("a@b")]
    [InlineData("Jane <jane@example.com>")]
    [InlineData("jane@example.com, joe@example.com")]
    public void A_bad_email_is_refused(string? email)
    {
        Assert.Contains("email", Check(Valid() with { Email = email }).Errors.Keys);
    }

    [Fact]
    public void Email_spacing_and_case_are_normalised()
    {
        Assert.Equal("jane@example.com", Check(Valid() with { Email = "  JANE@Example.COM " }).Request!.Email);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Survey")]
    [InlineData("haircut")]
    [InlineData("drops-only")]
    public void The_kind_must_be_one_of_the_contract(string? kind)
    {
        Assert.Contains("kind", Check(Valid() with { Kind = kind }).Errors.Keys);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("2026-13-01")]
    [InlineData("2026-02-30")]
    [InlineData("2026-2-1")]
    [InlineData("26-11-24")]
    [InlineData("2026/11/24")]
    [InlineData("2026-11-24T09:00")]
    [InlineData("2026-11-24 ")]
    [InlineData("tomorrow")]
    public void The_date_is_a_calendar_date_in_iso_form(string? date)
    {
        Assert.Contains("date", Check(Valid() with { Date = date }).Errors.Keys);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("9:00")]
    [InlineData("09:00:00")]
    [InlineData("24:00")]
    [InlineData("09:60")]
    [InlineData("9am")]
    [InlineData("09-00")]
    public void The_time_is_hours_and_minutes(string? time)
    {
        Assert.Contains("time", Check(Valid() with { Time = time }).Errors.Keys);
    }

    [Theory]
    [InlineData("2027-03-14", "02:30")]
    [InlineData("2026-11-01", "01:30")]
    public void A_local_time_that_is_missing_or_ambiguous_is_refused(string date, string time)
    {
        var result = Check(Valid() with { Date = date, Time = time });

        Assert.Contains("time", result.Errors.Keys);
        Assert.Null(result.Request);
    }

    [Theory]
    [InlineData(60, 60)]
    [InlineData(61, 120)]
    [InlineData(720, 720)]
    [InlineData(null, 120)]
    public void A_drops_only_install_takes_a_duration_from_60_to_720_rounded_up_to_the_hour(int? requested, int expectedMinutes)
    {
        var result = Check(Valid() with { Kind = BookingKinds.DropsOnlyInstall, DurationMinutes = requested });

        Assert.True(result.Errors.IsValid);
        Assert.Equal(TimeSpan.FromMinutes(expectedMinutes), result.Request!.Duration);
        Assert.Equal(result.Request.StartsAt + TimeSpan.FromMinutes(expectedMinutes), result.Request.EndsAt);
    }

    [Theory]
    [InlineData(59)]
    [InlineData(721)]
    [InlineData(0)]
    [InlineData(-60)]
    public void A_drops_only_duration_out_of_range_is_refused(int minutes)
    {
        Assert.Contains(
            "durationMinutes",
            Check(Valid() with { Kind = BookingKinds.DropsOnlyInstall, DurationMinutes = minutes }).Errors.Keys);
    }

    [Theory]
    [InlineData(BookingKinds.Survey)]
    [InlineData(BookingKinds.WholeHomeInstall)]
    public void A_duration_for_another_kind_is_refused(string kind)
    {
        var result = Check(Valid() with { Kind = kind, DurationMinutes = 120 });

        Assert.Contains("durationMinutes", result.Errors.Keys);
        Assert.Null(result.Request);
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("phone")]
    [InlineData("(555) 123-4567 ext 9")]
    public void A_bad_phone_is_refused_and_a_blank_one_is_not_a_phone(string phone)
    {
        Assert.Contains("phone", Check(Valid() with { Phone = phone }).Errors.Keys);
    }

    [Fact]
    public void A_blank_phone_and_blank_notes_are_none()
    {
        var result = Check(Valid() with { Phone = "  ", Notes = "  " });

        Assert.True(result.Errors.IsValid);
        Assert.Null(result.Request!.Phone);
        Assert.Null(result.Request.Notes);
    }

    [Fact]
    public void Notes_are_at_most_500_characters_without_control_characters()
    {
        Assert.True(Check(Valid() with { Notes = new string('a', 500) }).Errors.IsValid);
        Assert.Contains("notes", Check(Valid() with { Notes = new string('a', 501) }).Errors.Keys);
        Assert.Contains("notes", Check(Valid() with { Notes = "a\u0000b" }).Errors.Keys);
        Assert.Contains("notes", Check(Valid() with { Notes = "lone \uD800 surrogate" }).Errors.Keys);
        Assert.True(Check(Valid() with { Notes = "line one\nline two\tend" }).Errors.IsValid);
    }

    [Fact]
    public void A_filled_honeypot_is_refused()
    {
        Assert.Contains("honeypot", Check(Valid() with { Honeypot = "bot" }).Errors.Keys);
    }

    [Fact]
    public void The_messages_never_repeat_the_clients_input()
    {
        var input = new BookingInput("<script>", "<b>x</b>", "<i>", "<u>", "<s>", null, "<p>", new string('<', 501), "<h1>");

        var messages = Check(input).Errors.ToDictionary().Values.SelectMany(list => list);

        Assert.All(messages, message => Assert.DoesNotContain("<", message));
    }
}
