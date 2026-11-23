namespace ActionJackson.Core.Pricing;

// The catalog codes the quote calculator prices, and which option of the contract each one is. These are
// the seeded codes. There are no fallback prices: an option whose item is missing or inactive cannot be
// priced, and asking for it fails (the legacy API fell back to hardcoded numbers and silently drifted).
public static class PriceCodes
{
    public const string Cat6 = "CAT6-RUN";
    public const string Cat6a = "CAT6A-RUN";
    public const string Coax = "COAX-RUN";
    public const string Fiber = "FIBER-RUN";
    public const string ApMount = "AP-INSTALL";
    public const string EthernetRelocation = "ETH-RELOCATION";
    public const string MediaPanel = "INSTALL-MPANEL";
    public const string PatchPanel = "INSTALL-PPANEL";
    public const string LooseTermination = "LOOSE-TERM";

    // Price is the deposit; ThresholdAmount is the total a drops-only quote must exceed to owe it.
    public const string DepositDrops = "DEPOSIT-DROPS";

    // Price is the deposit.
    public const string DepositWhole = "DEPOSIT-WHOLE";

    // The run types in the order their lines appear on a quote.
    public static readonly IReadOnlyList<string> RunTypes = ["cat6", "cat6a", "coax", "fiber"];

    public static readonly IReadOnlyList<string> All =
    [
        Cat6, Cat6a, Coax, Fiber, ApMount, EthernetRelocation, MediaPanel, PatchPanel, LooseTermination, DepositDrops, DepositWhole,
    ];

    // The item for a run type of the contract ("cat6"), or ArgumentException for any other text.
    public static string RunCode(string runType) => runType switch
    {
        "cat6" => Cat6,
        "cat6a" => Cat6a,
        "coax" => Coax,
        "fiber" => Fiber,
        _ => throw new ArgumentException($"'{runType}' is not a run type", nameof(runType)),
    };

    // The item for a centralization option of the contract ("media-panel").
    public static string CentralizationCode(string centralization) => centralization switch
    {
        "media-panel" => MediaPanel,
        "patch-panel" => PatchPanel,
        "loose-termination" => LooseTermination,
        _ => throw new ArgumentException($"'{centralization}' is not a centralization option", nameof(centralization)),
    };
}

// One catalog row, as far as pricing needs it. Core cannot see the Data entities, so the caller copies
// the rows it read.
public sealed record CatalogEntry(Guid Id, string Code, string Name, decimal Price, decimal? ThresholdAmount, bool IsActive);

public sealed record DropsDeposit(CatalogEntry Item, decimal Threshold, decimal Amount);

// Thrown when a price that is needed is not in the catalog (missing or inactive). Never answered with a
// default: a silent zero deposit or a made-up price is worse than an error.
public sealed class PricingUnavailableException(string code)
    : Exception($"The catalog has no active item {code}.")
{
    public string Code { get; } = code;
}

// The unit prices the calculator may use: the active catalog items whose codes are in PriceCodes.
public sealed class PriceBook
{
    private readonly Dictionary<string, CatalogEntry> items = new(StringComparer.Ordinal);

    public PriceBook(IEnumerable<CatalogEntry> entries)
    {
        ArgumentNullException.ThrowIfNull(entries);
        foreach (var entry in entries)
        {
            if (entry.IsActive && PriceCodes.All.Contains(entry.Code, StringComparer.Ordinal))
            {
                items[entry.Code] = entry;
            }
        }
    }

    public CatalogEntry? Find(string code) => items.GetValueOrDefault(code);

    public bool Has(string code) => items.ContainsKey(code);

    // The item, or PricingUnavailableException.
    public CatalogEntry Require(string code) => Find(code) ?? throw new PricingUnavailableException(code);

    // Null when the item is missing or has no threshold: a deposit that cannot be compared with a total
    // cannot be applied.
    public DropsDeposit? DropsDeposit =>
        Find(PriceCodes.DepositDrops) is { ThresholdAmount: { } threshold } item
            ? new DropsDeposit(item, threshold, item.Price)
            : null;

    public CatalogEntry? WholeHomeDeposit => Find(PriceCodes.DepositWhole);
}
