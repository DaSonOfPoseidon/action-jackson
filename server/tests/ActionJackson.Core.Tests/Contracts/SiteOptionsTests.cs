using System.Text.Json;
using ActionJackson.Core.Pricing;

namespace ActionJackson.Core.Tests.Contracts;

public class SiteOptionsTests
{
    private static readonly SiteOptions Lan = SiteOptions.For(Site.Lan);

    // The lists below are quoted from the legacy routes (routes/consultations.js:120-180 and
    // routes/quotes.js:290-400, models/Quote.js:60-90). The new contract must keep every value.
    [Fact]
    public void The_consultation_lists_keep_the_legacy_values()
    {
        Assert.Equal(
            ["Under 1,500", "1,500-2,500", "2,500-3,500", "3,500-5,000", "Over 5,000"],
            Values(Lan.Consultation.SquareFootage));
        Assert.Equal(
            [
                "Weak WiFi", "Dead zones", "Slow speeds", "Too many devices", "No wired connections",
                "Subscription cameras", "ISP router only", "Smart home issues",
            ],
            Values(Lan.Consultation.CurrentIssues));
        Assert.Equal(
            ["networking", "smart-home", "cameras", "structured-wiring"],
            Values(Lan.Consultation.InterestedServices));

        // The same six values as the legacy validator; the order is the form's (get-started/page.tsx).
        Assert.Equal(
            ["standalone", "unsure", "foundation", "backbone", "security", "performance"],
            Values(Lan.Consultation.InterestedPackage));
        Assert.Equivalent(
            new[] { "foundation", "backbone", "security", "performance", "standalone", "unsure" },
            Values(Lan.Consultation.InterestedPackage));
    }

    [Fact]
    public void The_quote_lists_keep_the_legacy_values()
    {
        Assert.Equal(["Pre-1960", "1960-1980", "1980-2000", "2000-2020", "2020+"], Values(Lan.Quote.HomeAge));
        Assert.Equal(
            ["Walk-in attic", "Crawl space", "Scuttle hole", "No attic access"],
            Values(Lan.Quote.AtticAccess));
        Assert.Equal(["Omada", "UniFi", "Ruckus", "No Preference"], Values(Lan.Quote.NetworkingBrand));
        Assert.Equal(["UniFi", "Reolink", "No Preference"], Values(Lan.Quote.SecurityBrand));
        Assert.Equal(["before-install", "day-of"], Values(Lan.Quote.SurveyPreference));
        Assert.Equal(["media-panel", "patch-panel", "loose-termination"], Values(Lan.Quote.Centralization));
        Assert.Equal(["cat6", "cat6a", "coax", "fiber"], Values(Lan.Quote.RunTypes));
    }

    [Fact]
    public void The_quote_kinds_constants_match_the_contract()
    {
        Assert.Equal(QuoteKinds.All, Values(Lan.Quote.Kinds));
        Assert.Equal(["drops-only", "whole-home"], QuoteKinds.All);
    }

    [Fact]
    public void The_limits_match_the_legacy_validators()
    {
        Assert.Equal(new IntRange(0, 50), Lan.Limits.RunsPerType);
        Assert.Equal(new IntRange(0, 20), Lan.Limits.ApMounts);
        Assert.Equal(new IntRange(0, 20), Lan.Limits.EthernetRelocations);
        Assert.Equal(new IntRange(1, 4), Lan.Limits.Stories);
        Assert.Equal(2000, Lan.Limits.WholeHomeTextLength);
    }

    [Fact]
    public void Every_option_has_a_value_and_a_label_and_none_repeats()
    {
        foreach (var list in All(Lan))
        {
            Assert.NotEmpty(list);
            Assert.All(list, option =>
            {
                Assert.False(string.IsNullOrWhiteSpace(option.Value));
                Assert.False(string.IsNullOrWhiteSpace(option.Label));
            });
            Assert.Equal(list.Count, list.Select(option => option.Value).Distinct(StringComparer.Ordinal).Count());
        }
    }

    [Fact]
    public void It_is_loaded_once()
    {
        Assert.Same(SiteOptions.For(Site.Lan), SiteOptions.For(Site.Lan));
    }

    [Theory]
    [InlineData(Site.Car)]
    [InlineData(Site.Main)]
    [InlineData(Site.Dev)]
    public void A_site_without_options_throws(Site site)
    {
        Assert.Throws<InvalidOperationException>(() => SiteOptions.For(site));
    }

    [Fact]
    public void Lookups_are_exact_and_ordinal()
    {
        Assert.True(Lan.Quote.HomeAge.Has("Pre-1960"));
        Assert.False(Lan.Quote.HomeAge.Has("pre-1960"));
        Assert.False(Lan.Quote.HomeAge.Has(null));
        Assert.Equal("Walk-in attic", Lan.Quote.AtticAccess.LabelOf("Walk-in attic"));
        Assert.Equal("Drops Only", Lan.Quote.Kinds.LabelOf("drops-only"));
        Assert.Null(Lan.Quote.Kinds.LabelOf("Drops Only"));
    }

    [Fact]
    public void A_file_with_an_unknown_member_or_a_repeated_value_is_refused()
    {
        var good = JsonSerializer.Deserialize<JsonElement>(
            SiteOptions.ReadEmbedded(Site.Lan));
        Assert.Equal(JsonValueKind.Object, good.ValueKind);

        var extra = SiteOptions.ReadEmbedded(Site.Lan).Replace("\"limits\"", "\"surprise\": 1, \"limits\"", StringComparison.Ordinal);
        Assert.ThrowsAny<Exception>(() => SiteOptions.Parse(extra));

        var repeated = SiteOptions.ReadEmbedded(Site.Lan).Replace("\"day-of\"", "\"before-install\"", StringComparison.Ordinal);
        Assert.Throws<InvalidOperationException>(() => SiteOptions.Parse(repeated));
    }

    [Theory]
    [InlineData("\"daysAhead\": 90", "\"daysAhead\": 0")]
    [InlineData("\"notesLength\": 500", "\"notesLength\": 0")]
    [InlineData("\"min\": 60, \"max\": 720", "\"min\": 60, \"max\": 59")]
    [InlineData("\"min\": 60, \"max\": 720", "\"min\": 0, \"max\": 720")]
    public void Booking_limits_that_cannot_work_are_refused(string from, string to)
    {
        var json = SiteOptions.ReadEmbedded(Site.Lan).Replace(from, to, StringComparison.Ordinal);

        Assert.NotEqual(SiteOptions.ReadEmbedded(Site.Lan), json);
        Assert.Throws<InvalidOperationException>(() => SiteOptions.Parse(json));
    }

    [Fact]
    public void A_file_without_the_booking_section_is_refused()
    {
        var json = SiteOptions.ReadEmbedded(Site.Lan).Replace("\"booking\": {\n    \"kinds\"", "\"bookingGone\": {\n    \"kinds\"", StringComparison.Ordinal);

        Assert.ThrowsAny<Exception>(() => SiteOptions.Parse(json));
    }

    private static string[] Values(IReadOnlyList<Option> list) => [.. list.Select(option => option.Value)];

    private static IEnumerable<IReadOnlyList<Option>> All(SiteOptions options)
    {
        yield return options.Consultation.SquareFootage;
        yield return options.Consultation.CurrentIssues;
        yield return options.Consultation.InterestedServices;
        yield return options.Consultation.InterestedPackage;
        yield return options.Quote.Kinds;
        yield return options.Quote.RunTypes;
        yield return options.Quote.Centralization;
        yield return options.Quote.HomeAge;
        yield return options.Quote.AtticAccess;
        yield return options.Quote.NetworkingBrand;
        yield return options.Quote.SecurityBrand;
        yield return options.Quote.SurveyPreference;
        yield return options.Booking.Kinds;
    }
}
