using System.Text.Json;
using ActionJackson.Core;

namespace ActionJackson.Data.Seed;

// The lan catalog as exported from the old Mongo (Seed/lan-catalog.json, embedded and never edited).
// Parse checks the whole file before anything is written, and fails loudly on a value it does not
// know: an unknown unit type must never fall back to a default (it would price an item wrong).
public sealed class LanCatalog
{
    private const string ResourceName = "ActionJackson.Data.Seed.lan-catalog.json";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
    };

    // The legacy spellings, mapped one by one.
    private static readonly Dictionary<string, CatalogUnitType> UnitTypes = new()
    {
        ["per-foot"] = CatalogUnitType.PerFoot,
        ["per-run"] = CatalogUnitType.PerRun,
        ["per-unit"] = CatalogUnitType.PerUnit,
        ["flat-fee"] = CatalogUnitType.FlatFee,
        ["threshold"] = CatalogUnitType.Threshold,
    };

    public decimal LaborRate { get; private init; }

    public IReadOnlyList<Item> Items { get; private init; } = [];

    // The embedded export.
    public static LanCatalog Load()
    {
        using var stream = typeof(LanCatalog).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource {ResourceName} is missing");
        using var reader = new StreamReader(stream);
        return Parse(reader.ReadToEnd());
    }

    public static LanCatalog Parse(string json)
    {
        var file = JsonSerializer.Deserialize<FileShape>(json, JsonOptions)
            ?? throw new InvalidOperationException("The lan catalog file is empty");
        if (file.LaborRate is not { } laborRate)
        {
            throw new InvalidOperationException("The lan catalog file has no laborRate");
        }

        RequireCents("laborRate", laborRate, 2);
        var items = (file.Items ?? throw new InvalidOperationException("The lan catalog file has no items"))
            .Select(ToItem)
            .ToList();

        var codes = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            if (!codes.Add(item.Code))
            {
                throw new InvalidOperationException($"Catalog code {item.Code} appears twice");
            }
        }

        foreach (var component in items.SelectMany(item => item.Components.Select(c => (Item: item, Component: c))))
        {
            if (!codes.Contains(component.Component.Code))
            {
                throw new InvalidOperationException(
                    $"Catalog item {component.Item.Code} lists component {component.Component.Code}, which is not in the catalog");
            }

            if (component.Component.Code == component.Item.Code)
            {
                throw new InvalidOperationException($"Catalog item {component.Item.Code} lists itself as a component");
            }
        }

        return new LanCatalog { LaborRate = laborRate, Items = items };
    }

    private static Item ToItem(ItemShape raw)
    {
        var code = Required(raw.Code, "code", "?");
        var item = new Item
        {
            Code = code,
            Name = Required(raw.Name, "name", code),
            Description = raw.Description ?? "",
            Category = Required(raw.Category, "category", code),
            UnitType = MapUnitType(raw.UnitType, code, optional: false)!.Value,
            UnitLabel = raw.UnitLabel ?? "",
            Price = RequireCents($"{code}.price", raw.Price ?? throw new InvalidOperationException($"{code} has no price"), 2),
            ThresholdAmount = Cents($"{code}.thresholdAmount", raw.ThresholdAmount),
            MaterialCost = Cents($"{code}.materialCost", raw.MaterialCost),
            CostUnitType = MapUnitType(raw.CostUnitType, code, optional: true),
            LaborHours = Cents($"{code}.laborHours", raw.LaborHours),
            PurchaseUrl = raw.PurchaseUrl,
            IsActive = raw.IsActive ?? true,
            SortOrder = raw.SortOrder ?? 0,
            Components = (raw.BillOfMaterials ?? [])
                .Select(line => new Component(
                    Required(line.Code, "billOfMaterials.code", code),
                    RequireCents($"{code}.billOfMaterials.quantity", line.Quantity ?? throw new InvalidOperationException($"{code} has a component with no quantity"), 2)))
                .ToList(),
        };

        if (item.Components.Select(c => c.Code).Distinct().Count() != item.Components.Count)
        {
            throw new InvalidOperationException($"Catalog item {code} lists a component twice");
        }

        return item;
    }

    private static CatalogUnitType? MapUnitType(string? value, string code, bool optional)
    {
        if (value is null)
        {
            return optional ? null : throw new InvalidOperationException($"Catalog item {code} has no unit type");
        }

        return UnitTypes.TryGetValue(value, out var type)
            ? type
            : throw new InvalidOperationException($"Catalog item {code} has the unknown unit type '{value}'");
    }

    private static string Required(string? value, string field, string code) =>
        string.IsNullOrWhiteSpace(value) ? throw new InvalidOperationException($"Catalog item {code} has no {field}") : value;

    private static decimal? Cents(string field, decimal? value) =>
        value is { } present ? RequireCents(field, present, 2) : null;

    // The columns hold two decimals. A value with more would be rounded silently by Postgres.
    private static decimal RequireCents(string field, decimal value, int scale)
    {
        if (value < 0 || decimal.Round(value, scale) != value)
        {
            throw new InvalidOperationException($"{field} = {value} is negative or has more than {scale} decimals");
        }

        return value;
    }

    public sealed class Item
    {
        public required string Code { get; init; }
        public required string Name { get; init; }
        public required string Description { get; init; }
        public required string Category { get; init; }
        public CatalogUnitType UnitType { get; init; }
        public required string UnitLabel { get; init; }
        public decimal Price { get; init; }
        public decimal? ThresholdAmount { get; init; }
        public decimal? MaterialCost { get; init; }
        public CatalogUnitType? CostUnitType { get; init; }
        public decimal? LaborHours { get; init; }
        public string? PurchaseUrl { get; init; }
        public bool IsActive { get; init; }
        public int SortOrder { get; init; }
        public required IReadOnlyList<Component> Components { get; init; }
    }

    public sealed record Component(string Code, decimal Quantity);

    private sealed class FileShape
    {
        public decimal? LaborRate { get; set; }
        public List<ItemShape>? Items { get; set; }
    }

    private sealed class ItemShape
    {
        public string? Code { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public string? UnitType { get; set; }
        public string? UnitLabel { get; set; }
        public decimal? Price { get; set; }
        public decimal? ThresholdAmount { get; set; }
        public decimal? MaterialCost { get; set; }
        public string? CostUnitType { get; set; }
        public decimal? LaborHours { get; set; }
        public string? PurchaseUrl { get; set; }
        public List<ComponentShape>? BillOfMaterials { get; set; }
        public bool? IsActive { get; set; }
        public int? SortOrder { get; set; }
    }

    private sealed class ComponentShape
    {
        public string? Code { get; set; }
        public decimal? Quantity { get; set; }
    }
}
