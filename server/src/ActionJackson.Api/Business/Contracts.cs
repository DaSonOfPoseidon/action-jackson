using System.Text.Json;
using System.Text.Json.Serialization;
using ActionJackson.Core;
using ActionJackson.Core.Pricing;

namespace ActionJackson.Api.Business;

// What the public endpoints answer. No internal id leaves the API: a line has the catalog code, never
// the catalog row's id.

internal sealed record ConsultationCreated(string RequestNumber);

internal sealed record QuoteCreated(string QuoteNumber, string Kind, decimal Subtotal, decimal Total, decimal Deposit);

internal sealed record CalculatedLineResponse(string Code, string Description, int Quantity, decimal UnitPrice, decimal LineTotal);

internal sealed record CalculationResponse(
    IReadOnlyList<CalculatedLineResponse> Lines,
    decimal Subtotal,
    decimal Total,
    decimal Deposit)
{
    public static CalculationResponse From(QuoteCalculation calculation) =>
        new(
            [.. calculation.Lines.Select(line => new CalculatedLineResponse(line.Code, line.Description, line.Quantity, line.UnitPrice, line.LineTotal))],
            calculation.Subtotal,
            calculation.Total,
            calculation.Deposit);
}

internal sealed record DropsOnlyDeposit(decimal DepositThreshold, decimal DepositAmount);

internal sealed record WholeHomeDeposit(decimal DepositAmount);

// The unit prices of the active catalog items the calculator uses, and the limits of the form's fields.
// An option whose item is missing or inactive is left out, so the form cannot offer what cannot be priced.
internal sealed record PricingResponse(
    IReadOnlyDictionary<string, decimal> Runs,
    IReadOnlyDictionary<string, decimal> Services,
    IReadOnlyDictionary<string, decimal> Centralization,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DropsOnlyDeposit? DropsOnly,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] WholeHomeDeposit? WholeHome,
    OptionLimits Limits)
{
    public static PricingResponse From(PriceBook book, SiteOptions options)
    {
        var runs = new Dictionary<string, decimal>();
        foreach (var runType in options.Quote.RunTypes)
        {
            if (book.Find(PriceCodes.RunCode(runType.Value)) is { } item)
            {
                runs[runType.Value] = item.Price;
            }
        }

        var services = new Dictionary<string, decimal>();
        if (book.Find(PriceCodes.ApMount) is { } apMount)
        {
            services["apMounts"] = apMount.Price;
        }

        if (book.Find(PriceCodes.EthernetRelocation) is { } relocation)
        {
            services["ethernetRelocations"] = relocation.Price;
        }

        var centralization = new Dictionary<string, decimal>();
        foreach (var option in options.Quote.Centralization)
        {
            if (book.Find(PriceCodes.CentralizationCode(option.Value)) is { } item)
            {
                centralization[option.Value] = item.Price;
            }
        }

        return new PricingResponse(
            runs,
            services,
            centralization,
            book.DropsDeposit is { } drops ? new DropsOnlyDeposit(drops.Threshold, drops.Amount) : null,
            book.WholeHomeDeposit is { } whole ? new WholeHomeDeposit(whole.Price) : null,
            options.Limits);
    }
}

// What is stored in the jsonb details column of a row, serialized by us from the checked request: client
// JSON is never stored as it came.

internal sealed record ConsultationDetails(
    string SquareFootage,
    string? Isp,
    IReadOnlyList<string> CurrentIssues,
    IReadOnlyList<string> InterestedServices,
    string? InterestedPackage);

internal sealed record QuoteCustomerDetails(string Name, string? Phone);

internal sealed record QuoteAddressDetails(string Street, string City, string State, string Zip);

internal sealed record QuoteHomeDetails(
    string HomeAge,
    int Stories,
    string AtticAccess,
    bool HasMediaPanel,
    string? MediaPanelLocation,
    bool HasCrawlspaceOrBasement);

internal sealed record WholeHomeScopeDetails(bool Networking, bool Security, bool Voip);

internal sealed record WholeHomeDetails(
    WholeHomeScopeDetails Scope,
    string? InternetSpeed,
    bool HasOwnEquipment,
    string? EquipmentDescription,
    string? NetworkingBrand,
    string? SecurityBrand,
    string? SurveyPreference,
    string? NetworkingDetails,
    string? SecurityDetails,
    string? VoipDetails,
    string? Notes);

internal sealed record QuoteDetails(
    QuoteCustomerDetails Customer,
    QuoteAddressDetails Address,
    QuoteHomeDetails HomeInfo,
    string? Centralization,
    WholeHomeDetails? WholeHome,
    string SourceIp,
    string UserAgent);

internal static class DetailsJson
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static string Serialize<T>(T details) => JsonSerializer.Serialize(details, Options);
}
