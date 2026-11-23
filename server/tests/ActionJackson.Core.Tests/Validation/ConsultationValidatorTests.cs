using ActionJackson.Core.Validation;

namespace ActionJackson.Core.Tests.Validation;

public class ConsultationValidatorTests
{
    private static readonly SiteOptions Options = SiteOptions.For(Site.Lan);

    internal static ConsultationInput Valid() =>
        new(
            new CustomerInput("Jane O'Neil-Smith", "jane@example.com", "(555) 123-4567"),
            new PropertyInput("1,500-2,500", "Cox", ["Weak WiFi", "Dead zones"]),
            ["networking", "cameras"],
            "foundation",
            null);

    private static ValidationErrors Check(ConsultationInput? input) => ConsultationValidator.Validate(input, Options);

    [Fact]
    public void A_valid_request_has_no_errors()
    {
        Assert.True(Check(Valid()).IsValid);
    }

    [Fact]
    public void The_minimum_request_is_valid()
    {
        var input = new ConsultationInput(
            new CustomerInput("Jo", "jo@example.com", null),
            new PropertyInput("Over 5,000", null, null),
            ["networking"],
            null,
            null);

        Assert.True(Check(input).IsValid);
    }

    [Fact]
    public void A_missing_body_reports_every_required_field()
    {
        var errors = Check(null);

        Assert.Contains("customer.name", errors.Keys);
        Assert.Contains("customer.email", errors.Keys);
        Assert.Contains("property.squareFootage", errors.Keys);
        Assert.Contains("interestedServices", errors.Keys);
    }

    [Fact]
    public void Missing_objects_and_nulls_are_errors_not_exceptions()
    {
        var errors = Check(new ConsultationInput(null, null, null, null, null));

        Assert.Contains("customer.name", errors.Keys);
        Assert.Contains("customer.email", errors.Keys);
        Assert.Contains("property.squareFootage", errors.Keys);
        Assert.Contains("interestedServices", errors.Keys);
    }

    [Theory]
    [InlineData("J")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Jane  Doe")]
    [InlineData("Jane Doe3")]
    [InlineData("Jane <b>")]
    [InlineData("Jane\nDoe")]
    [InlineData("-")]
    public void A_bad_name_is_rejected(string name)
    {
        var input = Valid() with { Customer = Valid().Customer! with { Name = name } };

        Assert.Contains("customer.name", Check(input).Keys);
    }

    [Fact]
    public void A_name_of_100_characters_is_valid_and_101_is_not()
    {
        var ok = Valid() with { Customer = Valid().Customer! with { Name = new string('a', 100) } };
        var tooLong = Valid() with { Customer = Valid().Customer! with { Name = new string('a', 101) } };

        Assert.True(Check(ok).IsValid);
        Assert.Contains("customer.name", Check(tooLong).Keys);
    }

    [Theory]
    [InlineData("  Jane Doe  ")]
    [InlineData("Zoë Müller")]
    [InlineData("José Ñandú")]
    [InlineData("Anne-Marie O'Brien")]
    [InlineData("李雷")]
    public void Names_are_trimmed_and_may_use_any_letters(string name)
    {
        var input = Valid() with { Customer = Valid().Customer! with { Name = name } };

        Assert.True(Check(input).IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("plain")]
    [InlineData("a@b")]
    [InlineData("a@b.")]
    [InlineData("a@.b")]
    [InlineData("Jane <jane@example.com>")]
    [InlineData("jane@example.com, joe@example.com")]
    [InlineData("jane@example.com\nBcc: x@y.com")]
    [InlineData("\"jane doe\"@example.com")]
    [InlineData("jane doe@example.com")]
    [InlineData("jane@exa mple.com")]
    [InlineData("jane@localhost")]
    [InlineData("(comment)jane@example.com")]
    public void A_bad_email_is_rejected(string email)
    {
        var input = Valid() with { Customer = Valid().Customer! with { Email = email } };

        Assert.Contains("customer.email", Check(input).Keys);
    }

    [Fact]
    public void An_email_is_trimmed_and_at_most_254_characters()
    {
        var local = new string('a', 64);
        var longest = $"{local}@{new string('b', 63)}.{new string('c', 63)}.{new string('d', 57)}.com";
        Assert.Equal(254, longest.Length);
        var tooLong = "a" + longest;

        Assert.True(Check(Valid() with { Customer = Valid().Customer! with { Email = "  jane@example.com  " } }).IsValid);
        Assert.True(Check(Valid() with { Customer = Valid().Customer! with { Email = longest } }).IsValid);
        Assert.Contains("customer.email", Check(Valid() with { Customer = Valid().Customer! with { Email = tooLong } }).Keys);
    }

    [Theory]
    [InlineData("a@mailinator.com")]
    [InlineData("a@MAILINATOR.COM")]
    [InlineData("a@10minutemail.com")]
    [InlineData("a@guerrillamail.com")]
    [InlineData("a@tempmail.org")]
    [InlineData("a@temp-mail.org")]
    [InlineData("a@0-mail.com")]
    [InlineData("a@sub.mailinator.com")]
    [InlineData("a@Deep.Sub.Temp-Mail.ORG")]
    public void A_disposable_domain_or_a_subdomain_of_one_is_rejected(string email)
    {
        var input = Valid() with { Customer = Valid().Customer! with { Email = email } };

        Assert.Contains("customer.email", Check(input).Keys);
    }

    [Theory]
    [InlineData("a@notmailinator.com")]
    [InlineData("a@mailinator.com.au")]
    [InlineData("a@xtempmail.org")]
    public void A_domain_that_only_ends_like_a_disposable_one_is_allowed(string email)
    {
        var input = Valid() with { Customer = Valid().Customer! with { Email = email } };

        Assert.True(Check(input).IsValid);
    }

    [Theory]
    [InlineData("5551234")]
    [InlineData("+1 (555) 123-4567")]
    [InlineData("12345678901234567890")]
    public void A_phone_in_the_legacy_format_is_valid(string phone)
    {
        var input = Valid() with { Customer = Valid().Customer! with { Phone = phone } };

        Assert.True(Check(input).IsValid);
    }

    [Theory]
    [InlineData("123456")]
    [InlineData("123456789012345678901")]
    [InlineData("555-CALL-NOW")]
    [InlineData("555 123 4567 ext 2")]
    [InlineData("٥٥٥١٢٣٤٥٦٧")]
    public void A_bad_phone_is_rejected(string phone)
    {
        var input = Valid() with { Customer = Valid().Customer! with { Phone = phone } };

        Assert.Contains("customer.phone", Check(input).Keys);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void A_blank_phone_means_no_phone(string? phone)
    {
        var input = Valid() with { Customer = Valid().Customer! with { Phone = phone } };

        Assert.True(Check(input).IsValid);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("1500")]
    [InlineData("under 1,500")]
    public void The_square_footage_must_be_one_of_the_list(string? value)
    {
        var input = Valid() with { Property = Valid().Property! with { SquareFootage = value } };

        Assert.Contains("property.squareFootage", Check(input).Keys);
    }

    [Fact]
    public void The_isp_is_optional_single_line_and_at_most_200_characters()
    {
        Assert.True(Check(Valid() with { Property = Valid().Property! with { Isp = new string('x', 200) } }).IsValid);
        Assert.Contains("property.isp", Check(Valid() with { Property = Valid().Property! with { Isp = new string('x', 201) } }).Keys);
        Assert.Contains("property.isp", Check(Valid() with { Property = Valid().Property! with { Isp = "Cox\r\nBcc: x" } }).Keys);
    }

    [Fact]
    public void Eight_current_issues_are_valid_and_nine_are_not()
    {
        var eight = Options.Consultation.CurrentIssues.Select(option => (string?)option.Value).ToList();
        Assert.Equal(8, eight.Count);

        Assert.True(Check(Valid() with { Property = Valid().Property! with { CurrentIssues = eight } }).IsValid);

        List<string?> nine = [.. eight, "Weak WiFi"];
        Assert.Contains("property.currentIssues", Check(Valid() with { Property = Valid().Property! with { CurrentIssues = nine } }).Keys);
    }

    [Fact]
    public void A_current_issue_must_be_in_the_list_and_appear_once()
    {
        var unknown = Valid() with { Property = Valid().Property! with { CurrentIssues = ["Weak WiFi", "Haunted"] } };
        var nullItem = Valid() with { Property = Valid().Property! with { CurrentIssues = ["Weak WiFi", null] } };
        var repeated = Valid() with { Property = Valid().Property! with { CurrentIssues = ["Weak WiFi", "Weak WiFi"] } };

        Assert.Contains("property.currentIssues[1]", Check(unknown).Keys);
        Assert.Contains("property.currentIssues[1]", Check(nullItem).Keys);
        Assert.Contains("property.currentIssues[1]", Check(repeated).Keys);
    }

    [Fact]
    public void Between_one_and_four_services_are_required()
    {
        Assert.Contains("interestedServices", Check(Valid() with { InterestedServices = [] }).Keys);
        Assert.Contains("interestedServices", Check(Valid() with { InterestedServices = null }).Keys);
        Assert.True(Check(Valid() with { InterestedServices = ["networking", "smart-home", "cameras", "structured-wiring"] }).IsValid);
        Assert.Contains(
            "interestedServices",
            Check(Valid() with { InterestedServices = ["networking", "smart-home", "cameras", "structured-wiring", "networking"] }).Keys);
    }

    [Fact]
    public void A_service_must_be_in_the_list_and_appear_once()
    {
        Assert.Contains("interestedServices[1]", Check(Valid() with { InterestedServices = ["networking", "plumbing"] }).Keys);
        Assert.Contains("interestedServices[0]", Check(Valid() with { InterestedServices = [null] }).Keys);
        Assert.Contains("interestedServices[1]", Check(Valid() with { InterestedServices = ["networking", "networking"] }).Keys);
    }

    [Fact]
    public void The_package_is_optional_but_must_be_in_the_list()
    {
        Assert.True(Check(Valid() with { InterestedPackage = null }).IsValid);
        Assert.True(Check(Valid() with { InterestedPackage = "unsure" }).IsValid);
        Assert.Contains("interestedPackage", Check(Valid() with { InterestedPackage = "platinum" }).Keys);
        Assert.Contains("interestedPackage", Check(Valid() with { InterestedPackage = "" }).Keys);
    }

    [Fact]
    public void Any_text_in_the_honeypot_is_an_error()
    {
        Assert.True(Check(Valid() with { Honeypot = null }).IsValid);
        Assert.True(Check(Valid() with { Honeypot = "" }).IsValid);
        Assert.Contains("honeypot", Check(Valid() with { Honeypot = "x" }).Keys);
        Assert.Contains("honeypot", Check(Valid() with { Honeypot = " " }).Keys);
    }

    [Fact]
    public void Every_error_is_reported_at_once()
    {
        var input = new ConsultationInput(
            new CustomerInput("J", "nope", "1"),
            new PropertyInput("big", null, null),
            [],
            "x",
            "bot");

        var keys = Check(input).Keys;

        Assert.Equal(
            new[] { "customer.email", "customer.name", "customer.phone", "honeypot", "interestedPackage", "interestedServices", "property.squareFootage" },
            keys.Order(StringComparer.Ordinal));
    }
}
