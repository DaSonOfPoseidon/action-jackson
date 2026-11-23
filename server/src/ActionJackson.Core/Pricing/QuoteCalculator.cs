namespace ActionJackson.Core.Pricing;

// What a customer picked for a drops-only quote. Runs maps a run type of the contract ("cat6") to a count.
public sealed record DropsOnlySelection(
    IReadOnlyDictionary<string, int> Runs,
    int ApMounts,
    int EthernetRelocations,
    string? Centralization,
    bool HasExistingPanel)
{
    // From the request's own shape: a missing count is 0. The input is expected to be checked already.
    public static DropsOnlySelection From(
        Validation.RunsInput? runs,
        Validation.ServicesInput? services,
        string? centralization,
        bool? hasExistingPanel) =>
        new(
            PriceCodes.RunTypes.ToDictionary(runType => runType, runType => runs?.Count(runType) ?? 0, StringComparer.Ordinal),
            services?.ApMounts ?? 0,
            services?.EthernetRelocations ?? 0,
            centralization,
            hasExistingPanel ?? false);
}

public sealed record CalculatedLine(
    string Code,
    Guid CatalogItemId,
    string Description,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal);

public sealed record QuoteCalculation(IReadOnlyList<CalculatedLine> Lines, decimal Subtotal, decimal Total, decimal Deposit);

// The only price calculation in the repo. The public quote endpoints and the admin (a later unit) both call
// it; a second implementation is how the legacy API's two calculators drifted apart.
//
// Money is decimal, and a line is quantity x price, exact because prices are cents and quantities are whole.
// The total is rounded once, to cents, away from zero.
public static class QuoteCalculator
{
    // Drops-only: a line for each selected option, the subtotal as their sum, the total after the discount,
    // and the deposit when the total is over the threshold (a total exactly at it owes none).
    // discountPercent is 0 to 100. The public API always passes 0; the admin may pass more.
    // Throws PricingUnavailableException for an option or deposit the catalog cannot price.
    public static QuoteCalculation Calculate(PriceBook book, DropsOnlySelection selection, decimal discountPercent = 0m)
    {
        ArgumentNullException.ThrowIfNull(book);
        ArgumentNullException.ThrowIfNull(selection);
        if (discountPercent is < 0m or > 100m)
        {
            throw new ArgumentOutOfRangeException(nameof(discountPercent), discountPercent, "The discount is 0 to 100 percent.");
        }

        foreach (var runType in selection.Runs.Keys)
        {
            PriceCodes.RunCode(runType);
        }

        var lines = new List<CalculatedLine>();
        foreach (var runType in PriceCodes.RunTypes)
        {
            AddLine(lines, book, PriceCodes.RunCode(runType), selection.Runs.GetValueOrDefault(runType), existing: false);
        }

        AddLine(lines, book, PriceCodes.ApMount, selection.ApMounts, existing: false);
        AddLine(lines, book, PriceCodes.EthernetRelocation, selection.EthernetRelocations, existing: false);

        // A media panel the customer already has is still listed, at no charge.
        if (selection.Centralization is { } centralization)
        {
            var code = PriceCodes.CentralizationCode(centralization);
            AddLine(lines, book, code, 1, existing: code == PriceCodes.MediaPanel && selection.HasExistingPanel);
        }

        var deposit = book.DropsDeposit ?? throw new PricingUnavailableException(PriceCodes.DepositDrops);
        var subtotal = lines.Sum(line => line.LineTotal);
        var total = Math.Round(subtotal * (100m - discountPercent) / 100m, 2, MidpointRounding.AwayFromZero);
        return new QuoteCalculation(lines, subtotal, total, total > deposit.Threshold ? deposit.Amount : 0m);
    }

    // Whole-home: no lines, and a total of zero ON PURPOSE. The scope is priced by hand after a survey, and
    // the admin adds the lines later; the customer owes only the whole-home deposit. A caller must not read
    // the zero as "free". Throws PricingUnavailableException without the deposit item: it never defaults to 0.
    public static QuoteCalculation CalculateWholeHome(PriceBook book)
    {
        ArgumentNullException.ThrowIfNull(book);
        var deposit = book.WholeHomeDeposit ?? throw new PricingUnavailableException(PriceCodes.DepositWhole);
        return new QuoteCalculation([], 0m, 0m, deposit.Price);
    }

    private static void AddLine(List<CalculatedLine> lines, PriceBook book, string code, int quantity, bool existing)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(quantity);
        if (quantity == 0)
        {
            return;
        }

        var item = book.Require(code);
        var unitPrice = existing ? 0m : item.Price;
        var description = existing ? $"{item.Name} (existing panel)" : item.Name;
        lines.Add(new CalculatedLine(code, item.Id, description, quantity, unitPrice, quantity * unitPrice));
    }
}
