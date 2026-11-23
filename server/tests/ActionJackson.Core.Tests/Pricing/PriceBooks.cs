using ActionJackson.Core.Pricing;

namespace ActionJackson.Core.Tests.Pricing;

// Price books for the tests. Seeded() has the prices of server/src/ActionJackson.Data/Seed/lan-catalog.json.
internal static class PriceBooks
{
    public static readonly IReadOnlyDictionary<string, decimal> SeededPrices = new Dictionary<string, decimal>
    {
        [PriceCodes.Cat6] = 100m,
        [PriceCodes.Cat6a] = 150m,
        [PriceCodes.Coax] = 150m,
        [PriceCodes.Fiber] = 150m,
        [PriceCodes.ApMount] = 50m,
        [PriceCodes.EthernetRelocation] = 25m,
        [PriceCodes.MediaPanel] = 100m,
        [PriceCodes.PatchPanel] = 25m,
        [PriceCodes.LooseTermination] = 0m,
        [PriceCodes.DepositDrops] = 20m,
        [PriceCodes.DepositWhole] = 200m,
    };

    public static PriceBook Seeded(Action<Dictionary<string, decimal>>? change = null, params string[] without)
    {
        var prices = new Dictionary<string, decimal>(SeededPrices);
        change?.Invoke(prices);
        return Build(prices, without);
    }

    public static PriceBook Build(IReadOnlyDictionary<string, decimal> prices, params string[] without) =>
        new(prices
            .Where(price => !without.Contains(price.Key))
            .Select(price => Entry(price.Key, price.Value)));

    public static CatalogEntry Entry(string code, decimal price, bool isActive = true) =>
        new(
            Guid.NewGuid(),
            code,
            $"{code} item",
            price,
            code == PriceCodes.DepositDrops ? 100m : null,
            isActive);
}
