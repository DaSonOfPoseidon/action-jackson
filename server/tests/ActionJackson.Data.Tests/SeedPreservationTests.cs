using System.Text.Json;
using ActionJackson.Core;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Tests;

// Its own class, so its own database: these tests change seeded rows.
public class SeedPreservationTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task A_reseed_keeps_what_an_admin_changed()
    {
        await using (var lan = database.Lan())
        {
            var run = await lan.CatalogItems.SingleAsync(i => i.Code == "COAX-RUN");
            run.Price = 175.25m;
            run.IsActive = false;
            run.Name = "Coax (renamed)";
            var removed = await lan.CatalogItemComponents.FirstAsync(c => c.ParentId == run.Id);
            lan.CatalogItemComponents.Remove(removed);
            await lan.SaveChangesAsync();
        }

        await using (var core = database.Core())
        {
            var setting = await core.Settings.SingleAsync(s => s.Site == Site.Lan);
            setting.Data = """{"laborRate": 65}""";
            await core.SaveChangesAsync();
        }

        await database.MigrateAndSeedAsync();

        await using var read = database.Lan();
        var after = await read.CatalogItems.SingleAsync(i => i.Code == "COAX-RUN");
        Assert.Equal(175.25m, after.Price);
        Assert.False(after.IsActive);
        Assert.Equal("Coax (renamed)", after.Name);
        Assert.Equal(1, await read.CatalogItemComponents.CountAsync(c => c.ParentId == after.Id));
        Assert.Equal(21, await read.CatalogItems.CountAsync());

        await using var readCore = database.Core();
        var lanSetting = await readCore.Settings.SingleAsync(s => s.Site == Site.Lan);
        using var json = JsonDocument.Parse(lanSetting.Data);
        Assert.Equal(65m, json.RootElement.GetProperty("laborRate").GetDecimal());
    }
}
