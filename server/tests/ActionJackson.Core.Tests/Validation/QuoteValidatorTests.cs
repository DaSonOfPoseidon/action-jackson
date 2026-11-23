using ActionJackson.Core.Pricing;
using ActionJackson.Core.Tests.Pricing;
using ActionJackson.Core.Validation;

namespace ActionJackson.Core.Tests.Validation;

public class QuoteValidatorTests
{
    private static readonly SiteOptions Options = SiteOptions.For(Site.Lan);

    private static CustomerInput Customer => new("Jane Doe", "jane@example.com", "555-123-4567");

    private static HomeInfoInput Home => new(
        true,
        "1980-2000",
        2,
        "Walk-in attic",
        false,
        null,
        false,
        new AddressInput("12 Main St", "Springfield", "il", "62704"));

    internal static QuoteInput Drops() =>
        new(Customer, "drops-only", null, new RunsInput(2, null, 1, null), new ServicesInput(1, 2), "media-panel", Home, null);

    internal static QuoteInput Whole() =>
        new(
            Customer,
            "whole-home",
            null,
            null,
            null,
            null,
            Home,
            new WholeHomeInput(
                new ScopeInput(true, true, false),
                "1 Gbps",
                false,
                null,
                "UniFi",
                "Reolink",
                "day-of",
                "Three floors",
                "Four cameras",
                null,
                "Please call first"));

    private static ValidationErrors Check(QuoteInput? input, PriceBook? book = null) =>
        QuoteValidator.Validate(input, Options, book ?? PriceBooks.Seeded());

    [Fact]
    public void Valid_requests_of_both_kinds_have_no_errors()
    {
        Assert.True(Check(Drops()).IsValid);
        Assert.True(Check(Whole()).IsValid);
    }

    [Fact]
    public void A_missing_body_reports_the_required_fields()
    {
        var keys = Check(null).Keys;

        Assert.Contains("customer.name", keys);
        Assert.Contains("kind", keys);
        Assert.Contains("homeInfo.liabilityAcknowledged", keys);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Drops Only")]
    [InlineData("DROPS-ONLY")]
    [InlineData("custom")]
    public void The_kind_must_be_one_of_the_contract(string? kind)
    {
        var errors = Check(Drops() with { Kind = kind });

        Assert.Contains("kind", errors.Keys);
    }

    [Fact]
    public void The_customer_follows_the_consultation_rules()
    {
        var errors = Check(Drops() with { Customer = new CustomerInput("J", "a@mailinator.com", "12") });

        Assert.Contains("customer.name", errors.Keys);
        Assert.Contains("customer.email", errors.Keys);
        Assert.Contains("customer.phone", errors.Keys);
    }

    [Fact]
    public void The_liability_acknowledgement_must_be_true()
    {
        Assert.Contains("homeInfo.liabilityAcknowledged", Check(Drops() with { HomeInfo = Home with { LiabilityAcknowledged = false } }).Keys);
        Assert.Contains("homeInfo.liabilityAcknowledged", Check(Drops() with { HomeInfo = Home with { LiabilityAcknowledged = null } }).Keys);
        Assert.Contains("homeInfo.liabilityAcknowledged", Check(Drops() with { HomeInfo = null }).Keys);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(4, true)]
    [InlineData(5, false)]
    [InlineData(-1, false)]
    public void Stories_run_from_one_to_four(int stories, bool valid)
    {
        var errors = Check(Drops() with { HomeInfo = Home with { Stories = stories } });

        Assert.Equal(valid, !errors.Keys.Contains("homeInfo.stories"));
    }

    [Fact]
    public void Stories_are_required()
    {
        Assert.Contains("homeInfo.stories", Check(Drops() with { HomeInfo = Home with { Stories = null } }).Keys);
    }

    [Fact]
    public void The_home_age_and_attic_access_must_be_in_their_lists()
    {
        var errors = Check(Drops() with { HomeInfo = Home with { HomeAge = "old", AtticAccess = "none" } });

        Assert.Contains("homeInfo.homeAge", errors.Keys);
        Assert.Contains("homeInfo.atticAccess", errors.Keys);
        Assert.Contains("homeInfo.homeAge", Check(Drops() with { HomeInfo = Home with { HomeAge = null } }).Keys);
    }

    [Theory]
    [InlineData("street", "")]
    [InlineData("street", "   ")]
    [InlineData("street", null)]
    [InlineData("city", "")]
    [InlineData("state", "I")]
    [InlineData("state", "ILL")]
    [InlineData("state", "1L")]
    [InlineData("state", "É1")]
    [InlineData("zip", "6270")]
    [InlineData("zip", "627044")]
    [InlineData("zip", "62704-12")]
    [InlineData("zip", "62704-12345")]
    [InlineData("zip", "abcde")]
    [InlineData("zip", "٦٢٧٠٤")]
    public void A_bad_address_part_is_rejected(string part, string? value)
    {
        var address = part switch
        {
            "street" => new AddressInput(value, "Springfield", "IL", "62704"),
            "city" => new AddressInput("12 Main St", value, "IL", "62704"),
            "state" => new AddressInput("12 Main St", "Springfield", value, "62704"),
            _ => new AddressInput("12 Main St", "Springfield", "IL", value),
        };

        var errors = Check(Drops() with { HomeInfo = Home with { Address = address } });

        Assert.Contains($"homeInfo.address.{part}", errors.Keys);
    }

    [Theory]
    [InlineData("62704")]
    [InlineData("62704-1234")]
    public void A_zip_is_five_digits_with_an_optional_four(string zip)
    {
        var address = new AddressInput("12 Main St", "Springfield", "IL", zip);

        Assert.True(Check(Drops() with { HomeInfo = Home with { Address = address } }).IsValid);
    }

    [Fact]
    public void The_address_is_required_and_its_parts_have_length_limits()
    {
        Assert.Contains("homeInfo.address.street", Check(Drops() with { HomeInfo = Home with { Address = null } }).Keys);

        var longest = new AddressInput(new string('s', 200), new string('c', 100), "IL", "62704");
        var tooLong = new AddressInput(new string('s', 201), new string('c', 101), "IL", "62704");
        Assert.True(Check(Drops() with { HomeInfo = Home with { Address = longest } }).IsValid);
        var errors = Check(Drops() with { HomeInfo = Home with { Address = tooLong } });
        Assert.Contains("homeInfo.address.street", errors.Keys);
        Assert.Contains("homeInfo.address.city", errors.Keys);
    }

    [Fact]
    public void Control_characters_are_rejected_in_single_line_fields()
    {
        var address = new AddressInput("12 Main\nSt", "Spring\tfield", "IL", "62704");
        var errors = Check(Drops() with { HomeInfo = Home with { Address = address, MediaPanelLocation = "ga\r\nrage" } });

        Assert.Contains("homeInfo.address.street", errors.Keys);
        Assert.Contains("homeInfo.address.city", errors.Keys);
        Assert.Contains("homeInfo.mediaPanelLocation", errors.Keys);
    }

    [Fact]
    public void The_media_panel_location_is_optional_and_at_most_200_characters()
    {
        Assert.True(Check(Drops() with { HomeInfo = Home with { MediaPanelLocation = new string('x', 200) } }).IsValid);
        Assert.Contains("homeInfo.mediaPanelLocation", Check(Drops() with { HomeInfo = Home with { MediaPanelLocation = new string('x', 201) } }).Keys);
    }

    [Fact]
    public void Any_text_in_the_honeypot_is_an_error()
    {
        Assert.Contains("honeypot", Check(Drops() with { Honeypot = "bot" }).Keys);
        Assert.True(Check(Drops() with { Honeypot = "" }).IsValid);
    }

    [Theory]
    [InlineData(50, true)]
    [InlineData(51, false)]
    [InlineData(-1, false)]
    public void A_run_count_runs_from_zero_to_fifty(int count, bool valid)
    {
        var errors = Check(Drops() with { Runs = new RunsInput(count, null, null, null) });

        Assert.Equal(valid, !errors.Keys.Contains("runs.cat6"));
    }

    [Theory]
    [InlineData(20, true)]
    [InlineData(21, false)]
    [InlineData(-1, false)]
    public void Ap_mounts_and_ethernet_relocations_run_from_zero_to_twenty(int count, bool valid)
    {
        var ap = Check(Drops() with { Services = new ServicesInput(count, null) });
        var ethernet = Check(Drops() with { Services = new ServicesInput(null, count) });

        Assert.Equal(valid, !ap.Keys.Contains("services.apMounts"));
        Assert.Equal(valid, !ethernet.Keys.Contains("services.ethernetRelocations"));
    }

    [Fact]
    public void Every_run_type_is_checked()
    {
        var errors = Check(Drops() with { Runs = new RunsInput(51, 51, 51, 51) });

        Assert.Equal(
            new[] { "runs.cat6", "runs.cat6a", "runs.coax", "runs.fiber" },
            errors.Keys.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void At_least_one_run_or_service_is_required_and_a_centralization_alone_does_not_count()
    {
        var none = Drops() with { Runs = null, Services = null };
        var zeros = Drops() with { Runs = new RunsInput(0, 0, 0, 0), Services = new ServicesInput(0, 0) };

        Assert.Contains("runs", Check(none).Keys);
        Assert.Contains("runs", Check(zeros).Keys);
        Assert.True(Check(Drops() with { Runs = null, Services = new ServicesInput(1, null) }).IsValid);
    }

    [Fact]
    public void The_centralization_is_optional_but_must_be_in_the_list()
    {
        Assert.True(Check(Drops() with { Centralization = null }).IsValid);
        Assert.Contains("centralization", Check(Drops() with { Centralization = "Media Panel" }).Keys);
        Assert.Contains("centralization", Check(Drops() with { Centralization = "" }).Keys);
    }

    [Fact]
    public void A_selected_option_whose_catalog_item_is_missing_is_an_error_on_that_field()
    {
        var book = PriceBooks.Seeded(change: null, PriceCodes.Cat6, PriceCodes.MediaPanel, PriceCodes.EthernetRelocation);

        var errors = Check(Drops(), book);

        Assert.Contains("runs.cat6", errors.Keys);
        Assert.Contains("centralization", errors.Keys);
        Assert.Contains("services.ethernetRelocations", errors.Keys);
        Assert.DoesNotContain("runs.coax", errors.Keys);
        Assert.DoesNotContain("services.apMounts", errors.Keys);
    }

    [Fact]
    public void An_option_that_is_not_selected_may_be_missing_from_the_catalog()
    {
        var book = PriceBooks.Seeded(change: null, PriceCodes.Fiber, PriceCodes.Cat6a);

        Assert.True(Check(Drops(), book).IsValid);
    }

    [Fact]
    public void The_drops_only_fields_are_not_checked_for_a_whole_home_quote()
    {
        var input = Whole() with { Runs = new RunsInput(999, null, null, null), Centralization = "nonsense" };

        Assert.True(Check(input).IsValid);
    }

    [Fact]
    public void A_whole_home_quote_needs_a_wholeHome_section_and_at_least_one_scope()
    {
        Assert.Contains("wholeHome.scope", Check(Whole() with { WholeHome = null }).Keys);

        var none = Whole().WholeHome! with { Scope = new ScopeInput(false, null, false) };
        Assert.Contains("wholeHome.scope", Check(Whole() with { WholeHome = none }).Keys);

        var voip = Whole().WholeHome! with { Scope = new ScopeInput(null, null, true), NetworkingBrand = null, SecurityBrand = null };
        Assert.True(Check(Whole() with { WholeHome = voip }).IsValid);
    }

    [Fact]
    public void Brand_preferences_must_be_in_their_lists_unless_the_customer_has_their_own_equipment()
    {
        var wrong = Whole().WholeHome! with { NetworkingBrand = "Cisco", SecurityBrand = "Ring" };
        var errors = Check(Whole() with { WholeHome = wrong });
        Assert.Contains("wholeHome.networkingBrand", errors.Keys);
        Assert.Contains("wholeHome.securityBrand", errors.Keys);

        // Reolink is a security brand, not a networking one.
        Assert.Contains(
            "wholeHome.networkingBrand",
            Check(Whole() with { WholeHome = Whole().WholeHome! with { NetworkingBrand = "Reolink" } }).Keys);

        var own = wrong with { HasOwnEquipment = true, EquipmentDescription = "Our own gear" };
        Assert.True(Check(Whole() with { WholeHome = own }).IsValid);
    }

    [Fact]
    public void The_survey_preference_is_optional_but_must_be_in_its_list()
    {
        Assert.Contains("wholeHome.surveyPreference", Check(Whole() with { WholeHome = Whole().WholeHome! with { SurveyPreference = "never" } }).Keys);
        Assert.True(Check(Whole() with { WholeHome = Whole().WholeHome! with { SurveyPreference = null } }).IsValid);
    }

    [Fact]
    public void The_whole_home_text_fields_are_at_most_2000_characters()
    {
        var longest = new string('x', 2000);
        var ok = Whole().WholeHome! with
        {
            EquipmentDescription = longest,
            NetworkingDetails = longest,
            SecurityDetails = longest,
            VoipDetails = longest,
            Notes = longest,
        };
        Assert.True(Check(Whole() with { WholeHome = ok }).IsValid);

        var over = longest + "x";
        var bad = Whole().WholeHome! with
        {
            EquipmentDescription = over,
            NetworkingDetails = over,
            SecurityDetails = over,
            VoipDetails = over,
            Notes = over,
            InternetSpeed = new string('x', 201),
        };
        var keys = Check(Whole() with { WholeHome = bad }).Keys.Order(StringComparer.Ordinal);

        Assert.Equal(
            new[]
            {
                "wholeHome.equipmentDescription",
                "wholeHome.internetSpeed",
                "wholeHome.networkingDetails",
                "wholeHome.notes",
                "wholeHome.securityDetails",
                "wholeHome.voipDetails",
            },
            keys);
    }

    [Fact]
    public void Multi_line_text_may_have_line_breaks_but_no_other_control_characters()
    {
        var notes = Whole().WholeHome! with { Notes = "line one\r\nline two\tindented" };
        Assert.True(Check(Whole() with { WholeHome = notes }).IsValid);

        var bad = Whole().WholeHome! with { Notes = "bell\a" };
        Assert.Contains("wholeHome.notes", Check(Whole() with { WholeHome = bad }).Keys);
    }

    [Fact]
    public void Half_a_surrogate_pair_is_rejected_in_text_the_database_would_refuse()
    {
        var notes = Whole().WholeHome! with { Notes = "bad \ud83d" };
        var speed = Whole().WholeHome! with { InternetSpeed = "\ude00 fast" };
        var emoji = Whole().WholeHome! with { Notes = "fine \ud83d\ude00" };

        Assert.Contains("wholeHome.notes", Check(Whole() with { WholeHome = notes }).Keys);
        Assert.Contains("wholeHome.internetSpeed", Check(Whole() with { WholeHome = speed }).Keys);
        Assert.True(Check(Whole() with { WholeHome = emoji }).IsValid);
        Assert.Contains(
            "customer.email",
            Check(Drops() with { Customer = Customer with { Email = "a\ud83d@example.com" } }).Keys);
    }

    [Fact]
    public void The_internet_speed_is_a_single_line()
    {
        var bad = Whole().WholeHome! with { InternetSpeed = "1 Gbps\nBcc: x" };

        Assert.Contains("wholeHome.internetSpeed", Check(Whole() with { WholeHome = bad }).Keys);
    }

    // The calculate endpoint takes the drops-only part of a quote.
    [Fact]
    public void The_calculate_request_is_checked_like_the_drops_only_part_of_a_quote()
    {
        var ok = new CalculateInput(new RunsInput(1, null, null, null), null, "patch-panel", true);
        Assert.True(CalculateValidator.Validate(ok, Options, PriceBooks.Seeded()).IsValid);

        Assert.Contains("runs", CalculateValidator.Validate(new CalculateInput(null, null, null, null), Options, PriceBooks.Seeded()).Keys);
        Assert.Contains("runs", CalculateValidator.Validate(null, Options, PriceBooks.Seeded()).Keys);

        var bad = new CalculateInput(new RunsInput(51, null, null, null), new ServicesInput(21, -1), "closet", null);
        var errors = CalculateValidator.Validate(bad, Options, PriceBooks.Seeded());
        Assert.Contains("runs.cat6", errors.Keys);
        Assert.Contains("services.apMounts", errors.Keys);
        Assert.Contains("services.ethernetRelocations", errors.Keys);
        Assert.Contains("centralization", errors.Keys);
    }

    [Fact]
    public void A_selection_is_built_from_the_checked_input()
    {
        var selection = DropsOnlySelection.From(new RunsInput(2, null, 1, null), new ServicesInput(null, 3), "media-panel", true);

        Assert.Equal(2, selection.Runs["cat6"]);
        Assert.Equal(0, selection.Runs["cat6a"]);
        Assert.Equal(1, selection.Runs["coax"]);
        Assert.Equal(0, selection.ApMounts);
        Assert.Equal(3, selection.EthernetRelocations);
        Assert.Equal("media-panel", selection.Centralization);
        Assert.True(selection.HasExistingPanel);
    }
}
