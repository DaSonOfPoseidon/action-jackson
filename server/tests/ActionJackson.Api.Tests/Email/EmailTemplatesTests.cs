using ActionJackson.Api.Email;
using ActionJackson.Core;

namespace ActionJackson.Api.Tests.Email;

public class EmailTemplatesTests
{
    private static readonly DateTimeOffset At = new(2026, 3, 1, 15, 4, 5, TimeSpan.Zero);

    private static ConsultationAdminModel Consultation(string name = "Pat Lee", string? phone = "573-555-0100") => new(
        Site.Lan,
        "20260001",
        name,
        "pat@example.com",
        phone,
        "2400",
        "Spectrum",
        ["Slow wifi", "Dead zones"],
        ["Networking", "Cameras"],
        "Foundation Network ($799-$1,499)",
        "203.0.113.9",
        At);

    [Fact]
    public void Consultation_admin_keeps_the_legacy_wording()
    {
        var email = EmailTemplates.Render(Consultation());

        Assert.Equal("consultation-admin", email.Template);
        Assert.Equal("[lan] New Consultation Request #20260001", email.Subject);
        Assert.Contains("New Consultation Request - #20260001", email.TextBody);
        Assert.Contains("Name: Pat Lee", email.TextBody);
        Assert.Contains("Email: pat@example.com", email.TextBody);
        Assert.Contains("Phone: 573-555-0100", email.TextBody);
        Assert.Contains("Square Footage: 2400", email.TextBody);
        Assert.Contains("ISP: Spectrum", email.TextBody);
        Assert.Contains("Current Issues: Slow wifi, Dead zones", email.TextBody);
        Assert.Contains("Interested Services: Networking, Cameras", email.TextBody);
        Assert.Contains("Package Interest: Foundation Network ($799-$1,499)", email.TextBody);
        Assert.Contains("IP Address: 203.0.113.9", email.TextBody);
        Assert.Contains("Timestamp: 2026-03-01T15:04:05.000Z", email.TextBody);
        Assert.Contains("Pat Lee", email.HtmlBody);
        Assert.Contains("203.0.113.9", email.HtmlBody);
    }

    [Fact]
    public void Consultation_admin_without_a_phone_has_no_phone_line()
    {
        var email = EmailTemplates.Render(Consultation(phone: null));

        Assert.DoesNotContain("Phone:", email.TextBody);
        Assert.DoesNotContain("Phone:", email.HtmlBody);
    }

    [Fact]
    public void Consultation_admin_without_a_package_says_not_specified()
    {
        var email = EmailTemplates.Render(Consultation() with { PackageInterest = null });

        Assert.Contains("Package Interest: Not specified", email.TextBody);
    }

    [Fact]
    public void Consultation_ack_promises_only_what_the_business_does()
    {
        var email = EmailTemplates.Render(new ConsultationAckModel(Site.Car, "20260001", "Pat Lee"));

        Assert.Equal("consultation-ack", email.Template);
        Assert.Equal("We received your consultation request #20260001 - Action Jackson Installs", email.Subject);
        Assert.Contains("We received your request #20260001 and will contact you.", email.TextBody);
        Assert.Contains("We'll review your request and contact you to schedule your consultation.", email.TextBody);
        Assert.Contains("review your request and contact you to schedule your consultation.", email.HtmlBody);

        // Nothing sends a booking link, and the ack names no time limit.
        Assert.DoesNotContain("booking link", email.TextBody);
        Assert.DoesNotContain("24 hours", email.TextBody);
        Assert.Contains("Hello Pat,", email.TextBody);
        Assert.Contains("We received your request #20260001 and will contact you.", email.HtmlBody);
        Assert.DoesNotContain("203.0.113.9", email.TextBody);
    }

    [Fact]
    public void Quote_admin_renders_pricing_and_scope()
    {
        var email = EmailTemplates.Render(new QuoteAdminModel(
            Site.Lan,
            "20260002",
            "Drops Only",
            "Pat Lee",
            "pat@example.com",
            null,
            [new("Coax runs", "2"), new("Cat6 runs", "6")],
            1234.5m,
            250m,
            [new("Age", "10 years"), new("Stories", "2")],
            "203.0.113.9",
            At));

        Assert.Equal("quote-admin", email.Template);
        Assert.Equal("[lan] New Quote #20260002 - Drops Only", email.Subject);
        Assert.Contains("New Quote Submission - #20260002", email.TextBody);
        Assert.Contains("Service Type: Drops Only", email.TextBody);
        Assert.Contains("Cat6 runs: 6", email.TextBody);
        Assert.Contains("Total Cost: $1,234.50", email.TextBody);
        Assert.Contains("Deposit Required: $250.00", email.TextBody);
        Assert.Contains("Stories: 2", email.TextBody);
        Assert.DoesNotContain("Phone:", email.TextBody);
        Assert.Contains("$1,234.50", email.HtmlBody);
    }

    [Fact]
    public void Quote_admin_without_a_total_leaves_the_total_line_out()
    {
        var email = EmailTemplates.Render(new QuoteAdminModel(
            Site.Car, "20260002", "Whole Home", "Pat", "p@example.com", "555", [], null, 99.995m, [], "203.0.113.9", At));

        Assert.DoesNotContain("Total Cost", email.TextBody);
        Assert.Contains("Deposit Required: $100.00", email.TextBody);
    }

    [Fact]
    public void Booking_confirmation_renders_the_appointment_in_chicago_time()
    {
        // The US switch to daylight time is 2026-03-08 at 02:00 local, so 08:30 UTC is 03:30 CDT (UTC-5).
        var email = EmailTemplates.Render(new BookingConfirmationModel(
            Site.Lan, "20260002", "Pat Lee", new DateTimeOffset(2026, 3, 8, 8, 30, 0, TimeSpan.Zero), "555-0100", "Dog in the yard"));

        Assert.Equal("booking-confirmation", email.Template);
        Assert.Equal("Appointment Confirmation - Action Jackson Installs", email.Subject);
        Assert.Contains("Sunday, March 8, 2026", email.TextBody);
        Assert.Contains("3:30 AM", email.TextBody);
        Assert.Contains("Appointment Confirmed!", email.HtmlBody);
        Assert.Contains("Hello Pat,", email.TextBody);
        Assert.Contains("Quote Number: #20260002", email.TextBody);
        Assert.Contains("Phone: 555-0100", email.TextBody);
        Assert.Contains("Notes: Dog in the yard", email.TextBody);
        Assert.Contains("We'll contact you before the appointment to confirm.", email.TextBody);
        Assert.Contains("If you need to reschedule, please contact us as soon as possible and reference your quote number #20260002.", email.TextBody);
        Assert.Contains("Thank you for choosing Action Jackson Installs!", email.TextBody);
    }

    [Fact]
    public void Booking_confirmation_before_the_switch_is_in_standard_time()
    {
        // 2026-03-08 06:30 UTC is 00:30 CST (UTC-6).
        var email = EmailTemplates.Render(new BookingConfirmationModel(
            Site.Lan, "20260002", "Pat", new DateTimeOffset(2026, 3, 8, 6, 30, 0, TimeSpan.Zero), null, null));

        Assert.Contains("12:30 AM", email.TextBody);
    }

    [Fact]
    public void Booking_confirmation_without_phone_or_notes_leaves_those_lines_out()
    {
        var email = EmailTemplates.Render(new BookingConfirmationModel(Site.Lan, "20260002", "Pat", At, null, null));

        Assert.DoesNotContain("Phone:", email.TextBody);
        Assert.DoesNotContain("Notes:", email.TextBody);
        Assert.DoesNotContain("Phone:", email.HtmlBody);
        Assert.DoesNotContain("Notes:", email.HtmlBody);
    }

    [Fact]
    public void Booking_admin_renders_the_legacy_fields_and_fallbacks()
    {
        var email = EmailTemplates.Render(new BookingAdminModel(
            Site.Car, "20260002", "Pat Lee", "pat@example.com", null, At, null, "Site Survey (2 hours)", "203.0.113.9"));

        Assert.Equal("booking-admin", email.Template);
        Assert.Equal("[car] \U0001F4C5 New Appointment for Quote #20260002", email.Subject);
        Assert.Contains("Customer: Pat Lee", email.TextBody);
        Assert.Contains("Phone: Not provided", email.TextBody);
        Assert.Contains("Notes: None", email.TextBody);
        Assert.Contains("Appointment: Site Survey (2 hours)", email.TextBody);
        Assert.Contains("IP: 203.0.113.9", email.TextBody);
        Assert.Contains("Date: 3/1/2026", email.TextBody);
        Assert.Contains("Time: 9:04 AM CST", email.TextBody);
    }

    [Fact]
    public void Html_encodes_untrusted_values_and_the_text_body_keeps_them_raw()
    {
        const string name = "<script>alert(1)</script>";
        const string notes = "\"><img src=x>";

        var email = EmailTemplates.Render(new BookingConfirmationModel(Site.Lan, "20260002", name, At, null, notes));

        Assert.DoesNotContain("<script>", email.HtmlBody);
        Assert.DoesNotContain("<img", email.HtmlBody);
        Assert.Contains("&lt;script&gt;alert(1)&lt;/script&gt;", email.HtmlBody);
        Assert.Contains("&quot;&gt;&lt;img src=x&gt;", email.HtmlBody);
        Assert.Contains(notes, email.TextBody);
    }

    [Fact]
    public void Html_encodes_every_field_of_every_email()
    {
        const string evil = "<b onmouseover=\"x\">&'";
        var rendered = new[]
        {
            EmailTemplates.Render(new ConsultationAdminModel(Site.Lan, evil, evil, evil, evil, evil, evil, [evil], [evil], evil, evil, At)),
            EmailTemplates.Render(new ConsultationAckModel(Site.Lan, evil, evil)),
            EmailTemplates.Render(new QuoteAdminModel(Site.Lan, evil, evil, evil, evil, evil, [new(evil, evil)], 1m, 1m, [new(evil, evil)], evil, At)),
            EmailTemplates.Render(new BookingConfirmationModel(Site.Lan, evil, evil, At, evil, evil)),
            EmailTemplates.Render(new BookingAdminModel(Site.Lan, evil, evil, evil, evil, At, evil, evil, evil)),
        };

        foreach (var email in rendered)
        {
            Assert.DoesNotContain("<b ", email.HtmlBody);
            Assert.DoesNotContain("\"x\"", email.HtmlBody);
            Assert.Contains("&lt;b", email.HtmlBody);
        }
    }

    [Fact]
    public void A_line_break_in_a_value_cannot_add_a_header_to_the_subject()
    {
        var customer = EmailTemplates.Render(new ConsultationAckModel(Site.Lan, "1\r\nBcc: x@y.z", "Pat"));
        var admin = EmailTemplates.Render(Consultation() with { RequestNumber = "1\r\nBcc: x@y.z\u0000\u0085" });

        foreach (var subject in new[] { customer.Subject, admin.Subject })
        {
            Assert.DoesNotContain('\r', subject);
            Assert.DoesNotContain('\n', subject);
            Assert.DoesNotContain(subject, char.IsControl);
            Assert.Contains("Bcc: x@y.z", subject);
        }
    }

    [Fact]
    public void A_500_character_value_caps_the_subject_at_200_characters()
    {
        var ack = EmailTemplates.Render(new ConsultationAckModel(Site.Lan, new string('9', 500), "Pat"));
        var quote = EmailTemplates.Render(new QuoteAdminModel(
            Site.Lan, "1", new string('x', 500), "Pat", "p@example.com", null, [], null, 1m, [], "203.0.113.9", At));

        Assert.Equal(200, ack.Subject.Length);
        Assert.Equal(200, quote.Subject.Length);
    }

    [Fact]
    public void The_cap_never_splits_a_surrogate_pair()
    {
        var subject = EmailTemplates.CapSubject(new string('a', 199) + "\U0001F600");

        Assert.Equal(199, subject.Length);
        Assert.False(char.IsHighSurrogate(subject[^1]));
    }

    [Fact]
    public void A_line_break_in_a_single_line_value_cannot_start_a_fake_line_in_the_text_body()
    {
        var email = EmailTemplates.Render(Consultation(name: "Pat\nPhone: 555-EVIL"));

        Assert.DoesNotContain("\nPhone: 555-EVIL", email.TextBody);
    }

    [Fact]
    public void Money_is_formatted_in_en_us_without_a_culture_or_a_double()
    {
        Assert.Equal("$1,234.50", EmailTemplates.Money(1234.5m));
        Assert.Equal("$0.01", EmailTemplates.Money(0.005m));
        Assert.Equal("$0.00", EmailTemplates.Money(0m));
        Assert.Equal("$12,345,678.90", EmailTemplates.Money(12345678.9m));
    }
}
