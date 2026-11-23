using ActionJackson.Core.Pricing;

namespace ActionJackson.Core.Tests.Pricing;

public class QuoteCalculatorTests
{
    private static DropsOnlySelection Selection(
        int cat6 = 0,
        int cat6a = 0,
        int coax = 0,
        int fiber = 0,
        int ap = 0,
        int ethernet = 0,
        string? centralization = null,
        bool existingPanel = false) =>
        new(
            new Dictionary<string, int>
            {
                ["cat6"] = cat6,
                ["cat6a"] = cat6a,
                ["coax"] = coax,
                ["fiber"] = fiber,
            },
            ap,
            ethernet,
            centralization,
            existingPanel);

    [Fact]
    public void Matches_the_legacy_formula_with_the_seeded_prices()
    {
        // routes/quotes.js:187-215 with the seeded prices: 2 cat6 (200) + 1 coax (150) + 1 fiber (150)
        // + 1 AP mount (50) + 2 ethernet relocations (50) + a new media panel (100) = 700.
        var result = QuoteCalculator.Calculate(
            PriceBooks.Seeded(),
            Selection(cat6: 2, coax: 1, fiber: 1, ap: 1, ethernet: 2, centralization: "media-panel"));

        Assert.Equal(700m, result.Subtotal);
        Assert.Equal(700m, result.Total);
        Assert.Equal(20m, result.Deposit);
        Assert.Equal(
            [
                ("CAT6-RUN", 2, 100m, 200m),
                ("COAX-RUN", 1, 150m, 150m),
                ("FIBER-RUN", 1, 150m, 150m),
                ("AP-INSTALL", 1, 50m, 50m),
                ("ETH-RELOCATION", 2, 25m, 50m),
                ("INSTALL-MPANEL", 1, 100m, 100m),
            ],
            result.Lines.Select(line => (line.Code, line.Quantity, line.UnitPrice, line.LineTotal)));
    }

    [Fact]
    public void Lines_carry_the_catalog_item_and_its_name()
    {
        var book = PriceBooks.Seeded();

        var result = QuoteCalculator.Calculate(book, Selection(cat6a: 3));

        var line = Assert.Single(result.Lines);
        Assert.Equal(book.Find(PriceCodes.Cat6a)!.Id, line.CatalogItemId);
        Assert.Equal("CAT6A-RUN item", line.Description);
        Assert.Equal(450m, result.Total);
    }

    [Fact]
    public void A_total_exactly_at_the_threshold_has_no_deposit_and_one_cent_over_has()
    {
        var atThreshold = QuoteCalculator.Calculate(PriceBooks.Seeded(), Selection(cat6: 1));
        var over = QuoteCalculator.Calculate(
            PriceBooks.Seeded(prices => prices[PriceCodes.Cat6] = 100.01m),
            Selection(cat6: 1));

        Assert.Equal(100m, atThreshold.Total);
        Assert.Equal(0m, atThreshold.Deposit);
        Assert.Equal(100.01m, over.Total);
        Assert.Equal(20m, over.Deposit);
    }

    [Fact]
    public void The_total_is_rounded_once_away_from_zero()
    {
        // 10.05 at 50% is 5.025: away from zero gives 5.03 (banker's rounding would give 5.02).
        var book = PriceBooks.Seeded(prices => prices[PriceCodes.Cat6] = 10.05m);

        var result = QuoteCalculator.Calculate(book, Selection(cat6: 1), discountPercent: 50m);

        Assert.Equal(10.05m, result.Subtotal);
        Assert.Equal(5.03m, result.Total);
        Assert.Equal(0m, result.Deposit);
    }

    [Fact]
    public void Lines_are_not_rounded_so_the_subtotal_is_their_sum()
    {
        var book = PriceBooks.Seeded(prices => prices[PriceCodes.Cat6] = 33.33m);

        var result = QuoteCalculator.Calculate(book, Selection(cat6: 3, coax: 1));

        Assert.Equal(99.99m, result.Lines[0].LineTotal);
        Assert.Equal(249.99m, result.Subtotal);
        Assert.Equal(249.99m, result.Total);
    }

    [Fact]
    public void A_deposit_follows_the_discounted_total_not_the_subtotal()
    {
        // 150 is over the threshold; at 50% off it is 75, which is not.
        var full = QuoteCalculator.Calculate(PriceBooks.Seeded(), Selection(coax: 1));
        var half = QuoteCalculator.Calculate(PriceBooks.Seeded(), Selection(coax: 1), discountPercent: 50m);

        Assert.Equal(20m, full.Deposit);
        Assert.Equal(75m, half.Total);
        Assert.Equal(150m, half.Subtotal);
        Assert.Equal(0m, half.Deposit);
    }

    [Theory]
    [InlineData(0, 700)]
    [InlineData(100, 0)]
    public void The_discount_bounds_are_accepted(int discount, int expectedTotal)
    {
        var result = QuoteCalculator.Calculate(
            PriceBooks.Seeded(),
            Selection(cat6: 2, coax: 1, fiber: 1, ap: 1, ethernet: 2, centralization: "media-panel"),
            discount);

        Assert.Equal(expectedTotal, result.Total);
    }

    [Theory]
    [InlineData(-0.01)]
    [InlineData(100.01)]
    public void A_discount_outside_0_to_100_throws(double discount)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            QuoteCalculator.Calculate(PriceBooks.Seeded(), Selection(cat6: 1), (decimal)discount));
    }

    [Fact]
    public void A_media_panel_the_customer_already_has_is_listed_at_zero()
    {
        var result = QuoteCalculator.Calculate(
            PriceBooks.Seeded(),
            Selection(cat6: 1, centralization: "media-panel", existingPanel: true));

        var panel = result.Lines.Single(line => line.Code == PriceCodes.MediaPanel);
        Assert.Equal(0m, panel.UnitPrice);
        Assert.Equal(0m, panel.LineTotal);
        Assert.Equal(1, panel.Quantity);
        Assert.Equal(100m, result.Total);
    }

    [Fact]
    public void A_patch_panel_costs_its_price_and_loose_termination_is_listed_at_zero()
    {
        var patch = QuoteCalculator.Calculate(PriceBooks.Seeded(), Selection(cat6: 1, centralization: "patch-panel"));
        var loose = QuoteCalculator.Calculate(PriceBooks.Seeded(), Selection(cat6: 1, centralization: "loose-termination"));

        Assert.Equal(125m, patch.Total);
        Assert.Equal("INSTALL-PPANEL", patch.Lines[^1].Code);
        Assert.Equal(100m, loose.Total);
        var line = loose.Lines[^1];
        Assert.Equal("LOOSE-TERM", line.Code);
        Assert.Equal(0m, line.LineTotal);
    }

    [Fact]
    public void Whole_home_has_no_lines_and_a_zero_total_with_the_whole_home_deposit()
    {
        var result = QuoteCalculator.CalculateWholeHome(PriceBooks.Seeded());

        Assert.Empty(result.Lines);
        Assert.Equal(0m, result.Subtotal);
        Assert.Equal(0m, result.Total);
        Assert.Equal(200m, result.Deposit);
    }

    [Fact]
    public void Whole_home_without_its_deposit_item_throws_and_never_defaults_to_zero()
    {
        var book = PriceBooks.Seeded(change: null, PriceCodes.DepositWhole);

        var error = Assert.Throws<PricingUnavailableException>(() => QuoteCalculator.CalculateWholeHome(book));

        Assert.Equal(PriceCodes.DepositWhole, error.Code);
    }

    [Fact]
    public void Drops_only_without_its_deposit_item_throws()
    {
        var book = PriceBooks.Seeded(change: null, PriceCodes.DepositDrops);

        var error = Assert.Throws<PricingUnavailableException>(() => QuoteCalculator.Calculate(book, Selection(cat6: 1)));

        Assert.Equal(PriceCodes.DepositDrops, error.Code);
    }

    [Fact]
    public void A_drops_deposit_without_a_threshold_is_unavailable()
    {
        var book = new PriceBook(
            PriceBooks.SeededPrices
                .Where(price => price.Key != PriceCodes.DepositDrops)
                .Select(price => PriceBooks.Entry(price.Key, price.Value))
                .Append(new CatalogEntry(Guid.NewGuid(), PriceCodes.DepositDrops, "Deposit", 20m, null, true)));

        Assert.Null(book.DropsDeposit);
        Assert.Throws<PricingUnavailableException>(() => QuoteCalculator.Calculate(book, Selection(cat6: 1)));
    }

    [Fact]
    public void A_selected_option_with_no_catalog_item_throws_and_has_no_hardcoded_fallback()
    {
        var book = PriceBooks.Seeded(change: null, PriceCodes.ApMount);

        var error = Assert.Throws<PricingUnavailableException>(() => QuoteCalculator.Calculate(book, Selection(ap: 1)));

        Assert.Equal(PriceCodes.ApMount, error.Code);
    }

    [Fact]
    public void An_inactive_item_is_not_in_the_price_book()
    {
        var entries = PriceBooks.SeededPrices
            .Select(price => PriceBooks.Entry(price.Key, price.Value, isActive: price.Key != PriceCodes.Fiber));
        var book = new PriceBook(entries);

        Assert.False(book.Has(PriceCodes.Fiber));
        Assert.True(book.Has(PriceCodes.Coax));
        Assert.Throws<PricingUnavailableException>(() => QuoteCalculator.Calculate(book, Selection(fiber: 1)));
    }

    [Fact]
    public void Items_outside_the_code_map_are_ignored()
    {
        var book = new PriceBook([PriceBooks.Entry("CAMERA-INSTALL", 50m)]);

        Assert.False(book.Has("CAMERA-INSTALL"));
    }

    [Fact]
    public void An_empty_selection_prices_to_nothing()
    {
        var result = QuoteCalculator.Calculate(PriceBooks.Seeded(), Selection());

        Assert.Empty(result.Lines);
        Assert.Equal(0m, result.Total);
        Assert.Equal(0m, result.Deposit);
    }

    [Fact]
    public void An_unknown_centralization_is_rejected()
    {
        Assert.Throws<ArgumentException>(() =>
            QuoteCalculator.Calculate(PriceBooks.Seeded(), Selection(cat6: 1, centralization: "closet")));
    }

    [Fact]
    public void Every_run_type_in_the_options_has_a_catalog_code()
    {
        foreach (var runType in SiteOptions.For(Site.Lan).Quote.RunTypes)
        {
            Assert.NotNull(PriceCodes.RunCode(runType.Value));
        }

        foreach (var option in SiteOptions.For(Site.Lan).Quote.Centralization)
        {
            Assert.NotNull(PriceCodes.CentralizationCode(option.Value));
        }
    }
}
