using System.Text.Json;
using ActionJackson.Core;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Seed;

// Fills a fresh database with what the business needs to start: the lan catalog and the labor rate.
// It only ever inserts. A row that exists is left alone, so an admin's edits survive every restart.
public static class DatabaseSeed
{
    // Held for the length of a seed transaction, so two API instances starting at once take turns.
    private const long AdvisoryLockKey = 0x41_4A_53_45_45_44; // "AJSEED"

    public static async Task SeedAsync(CoreDbContext core, LanDbContext lan, CancellationToken cancellationToken = default) =>
        await SeedAsync(core, lan, LanCatalog.Load(), cancellationToken);

    public static async Task SeedAsync(
        CoreDbContext core,
        LanDbContext lan,
        LanCatalog catalog,
        CancellationToken cancellationToken = default)
    {
        await SeedCatalogAsync(lan, catalog, cancellationToken);
        await SeedSettingsAsync(core, catalog, cancellationToken);
    }

    // Each catalog item is inserted only if its code is missing. The bill of materials is added only
    // for the items inserted now, so a component an admin removed from an existing item stays removed.
    private static async Task SeedCatalogAsync(LanDbContext lan, LanCatalog catalog, CancellationToken cancellationToken)
    {
        await using var transaction = await lan.Database.BeginTransactionAsync(cancellationToken);
        await lan.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({AdvisoryLockKey})", cancellationToken);

        var existing = await lan.CatalogItems.Select(item => item.Code).ToListAsync(cancellationToken);
        var known = existing.ToHashSet(StringComparer.Ordinal);
        var added = new List<(LanCatalog.Item Source, CatalogItem Row)>();
        foreach (var source in catalog.Items.Where(item => !known.Contains(item.Code)))
        {
            var row = new CatalogItem
            {
                Code = source.Code,
                Name = source.Name,
                Description = source.Description,
                Category = source.Category,
                UnitType = source.UnitType,
                UnitLabel = source.UnitLabel,
                Price = source.Price,
                ThresholdAmount = source.ThresholdAmount,
                MaterialCost = source.MaterialCost,
                CostUnitType = source.CostUnitType,
                LaborHours = source.LaborHours,
                PurchaseUrl = source.PurchaseUrl,
                IsActive = source.IsActive,
                SortOrder = source.SortOrder,
            };
            lan.CatalogItems.Add(row);
            added.Add((source, row));
        }

        if (added.Count > 0)
        {
            await lan.SaveChangesAsync(cancellationToken);

            var ids = await lan.CatalogItems.ToDictionaryAsync(item => item.Code, item => item.Id, cancellationToken);
            foreach (var (source, row) in added)
            {
                foreach (var component in source.Components)
                {
                    lan.CatalogItemComponents.Add(new CatalogItemComponent
                    {
                        ParentId = row.Id,
                        ComponentId = ids[component.Code],
                        Quantity = component.Quantity,
                    });
                }
            }

            await lan.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    // A settings row for each business site, with the labor rate, only if it has none.
    private static async Task SeedSettingsAsync(CoreDbContext core, LanCatalog catalog, CancellationToken cancellationToken)
    {
        await using var transaction = await core.Database.BeginTransactionAsync(cancellationToken);
        await core.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({AdvisoryLockKey})", cancellationToken);

        var data = JsonSerializer.Serialize(new Dictionary<string, decimal> { ["laborRate"] = catalog.LaborRate });
        var have = await core.Settings.Select(setting => setting.Site).ToListAsync(cancellationToken);
        foreach (var site in BusinessSites.All.Where(site => !have.Contains(site)))
        {
            core.Settings.Add(new Setting { Site = site, Data = data });
        }

        await core.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
