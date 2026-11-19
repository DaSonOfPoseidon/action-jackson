using System.Text.Json;
using ActionJackson.Core;
using ActionJackson.Data.Seed;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Tests;

public class SeedTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task Seeds_the_21_lan_items_and_nothing_into_car()
    {
        await using var lan = database.Lan();
        await using var car = database.Car();

        Assert.Equal(21, await lan.CatalogItems.CountAsync());
        Assert.Equal(0, await car.CatalogItems.CountAsync());
        Assert.Equal(0, await car.CatalogItemComponents.CountAsync());
    }

    [DbFact]
    public async Task Four_items_have_a_bill_of_materials_and_cat6_run_has_three_components()
    {
        await using var lan = database.Lan();

        var withBom = await lan.CatalogItemComponents.Select(c => c.ParentId).Distinct().CountAsync();
        var cat6 = await lan.CatalogItems.SingleAsync(i => i.Code == "CAT6-RUN");
        var components = await (
            from link in lan.CatalogItemComponents
            join part in lan.CatalogItems on link.ComponentId equals part.Id
            where link.ParentId == cat6.Id
            select new { part.Code, link.Quantity }).ToListAsync();

        Assert.Equal(4, withBom);
        Assert.Equal(["1P-PLATE", "CAT6-KEYSTONE", "LV-BRACKET"], components.Select(c => c.Code).Order());
        Assert.All(components, c => Assert.Equal(1m, c.Quantity));
    }

    [DbFact]
    public async Task Legacy_spellings_are_mapped_and_the_display_category_is_kept()
    {
        await using var lan = database.Lan();

        var run = await lan.CatalogItems.SingleAsync(i => i.Code == "CAT6-RUN");
        var deposit = await lan.CatalogItems.SingleAsync(i => i.Code == "DEPOSIT-DROPS");
        var loose = await lan.CatalogItems.SingleAsync(i => i.Code == "LOOSE-TERM");

        Assert.Equal("Cable Runs", run.Category);
        Assert.Equal(CatalogUnitType.PerRun, run.UnitType);
        Assert.Equal(CatalogUnitType.PerFoot, run.CostUnitType);
        Assert.Equal(100m, run.Price);
        Assert.Equal(0.2m, run.MaterialCost);
        Assert.Equal(CatalogUnitType.Threshold, deposit.UnitType);
        Assert.Equal(100m, deposit.ThresholdAmount);
        Assert.Equal(20m, deposit.Price);
        Assert.Equal(CatalogUnitType.FlatFee, loose.UnitType);
        Assert.Equal(0m, loose.Price);
    }

    [DbFact]
    public async Task Both_business_sites_get_a_labor_rate_of_50()
    {
        await using var core = database.Core();

        var settings = await core.Settings.ToListAsync();

        Assert.Equal([Site.Lan, Site.Car], settings.Select(s => s.Site).Order());
        Assert.All(settings, s =>
        {
            using var json = JsonDocument.Parse(s.Data);
            Assert.Equal(50m, json.RootElement.GetProperty("laborRate").GetDecimal());
        });
    }

    [DbFact]
    public async Task Seeding_again_adds_nothing()
    {
        await database.MigrateAndSeedAsync();

        await using var lan = database.Lan();
        await using var core = database.Core();
        Assert.Equal(21, await lan.CatalogItems.CountAsync());
        Assert.Equal(9, await lan.CatalogItemComponents.CountAsync());
        Assert.Equal(2, await core.Settings.CountAsync());
    }

    [Fact]
    public void The_embedded_file_has_21_items_and_a_labor_rate_of_50()
    {
        var catalog = LanCatalog.Load();

        Assert.Equal(21, catalog.Items.Count);
        Assert.Equal(50m, catalog.LaborRate);
        Assert.Equal(4, catalog.Items.Count(i => i.Components.Count > 0));
        Assert.Equal(21, catalog.Items.Select(i => i.Code).Distinct().Count());
    }

    [Theory]
    [InlineData("per-mile")]
    [InlineData("PER-RUN")]
    [InlineData("")]
    public void An_unknown_unit_type_fails_loudly(string unitType)
    {
        var json = Catalog($$"""{"code": "A", "name": "A", "category": "C", "unitType": "{{unitType}}", "price": 1}""");

        var error = Assert.Throws<InvalidOperationException>(() => LanCatalog.Parse(json));

        Assert.Contains("unknown unit type", error.Message);
        Assert.Contains("A", error.Message);
    }

    [Fact]
    public void An_unknown_cost_unit_type_fails_loudly()
    {
        var json = Catalog("""{"code": "A", "name": "A", "category": "C", "unitType": "per-run", "costUnitType": "per-yard", "price": 1}""");

        Assert.Throws<InvalidOperationException>(() => LanCatalog.Parse(json));
    }

    [Fact]
    public void A_missing_unit_type_does_not_default()
    {
        var json = Catalog("""{"code": "A", "name": "A", "category": "C", "price": 1}""");

        Assert.Throws<InvalidOperationException>(() => LanCatalog.Parse(json));
    }

    [Fact]
    public void A_component_that_is_not_in_the_catalog_fails_loudly()
    {
        var json = Catalog("""{"code": "A", "name": "A", "category": "C", "unitType": "per-run", "price": 1, "billOfMaterials": [{"code": "GHOST", "quantity": 1}]}""");

        var error = Assert.Throws<InvalidOperationException>(() => LanCatalog.Parse(json));

        Assert.Contains("GHOST", error.Message);
    }

    [Fact]
    public void A_duplicate_code_fails_loudly()
    {
        var item = """{"code": "A", "name": "A", "category": "C", "unitType": "per-run", "price": 1}""";

        Assert.Throws<InvalidOperationException>(() => LanCatalog.Parse(Catalog(item, item)));
    }

    [Fact]
    public void A_price_with_more_than_cents_fails_loudly()
    {
        var json = Catalog("""{"code": "A", "name": "A", "category": "C", "unitType": "per-run", "price": 1.005}""");

        Assert.Throws<InvalidOperationException>(() => LanCatalog.Parse(json));
    }

    [Fact]
    public void A_field_the_seed_does_not_know_fails_loudly()
    {
        var json = Catalog("""{"code": "A", "name": "A", "category": "C", "unitType": "per-run", "price": 1, "surprise": true}""");

        Assert.Throws<JsonException>(() => LanCatalog.Parse(json));
    }

    [Fact]
    public void A_missing_labor_rate_fails_loudly()
    {
        Assert.Throws<InvalidOperationException>(() => LanCatalog.Parse("""{"items": []}"""));
    }

    private static string Catalog(params string[] items) =>
        $$"""{"laborRate": 50, "items": [{{string.Join(",", items)}}]}""";
}
