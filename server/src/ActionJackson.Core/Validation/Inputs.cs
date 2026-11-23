namespace ActionJackson.Core.Validation;

// The request bodies of the public lan forms. Every member is nullable: a missing or null value is a
// validation error, never an exception. Property names are the JSON names (camelCase), which are also the
// keys of the error dictionary ("customer.email", "runs.cat6").

public sealed record CustomerInput(string? Name, string? Email, string? Phone);

public sealed record PropertyInput(string? SquareFootage, string? Isp, List<string?>? CurrentIssues);

public sealed record ConsultationInput(
    CustomerInput? Customer,
    PropertyInput? Property,
    List<string?>? InterestedServices,
    string? InterestedPackage,
    string? Honeypot);

// One member per run type of the contract.
public sealed record RunsInput(int? Cat6, int? Cat6a, int? Coax, int? Fiber)
{
    // The count for a run type of the contract ("cat6"), or null when the request has none.
    public int? Count(string runType) => runType switch
    {
        "cat6" => Cat6,
        "cat6a" => Cat6a,
        "coax" => Coax,
        "fiber" => Fiber,
        _ => throw new ArgumentException($"'{runType}' is not a run type", nameof(runType)),
    };
}

public sealed record ServicesInput(int? ApMounts, int? EthernetRelocations);

public sealed record AddressInput(string? Street, string? City, string? State, string? Zip);

public sealed record HomeInfoInput(
    bool? LiabilityAcknowledged,
    string? HomeAge,
    int? Stories,
    string? AtticAccess,
    bool? HasMediaPanel,
    string? MediaPanelLocation,
    bool? HasCrawlspaceOrBasement,
    AddressInput? Address);

public sealed record ScopeInput(bool? Networking, bool? Security, bool? Voip);

public sealed record WholeHomeInput(
    ScopeInput? Scope,
    string? InternetSpeed,
    bool? HasOwnEquipment,
    string? EquipmentDescription,
    string? NetworkingBrand,
    string? SecurityBrand,
    string? SurveyPreference,
    string? NetworkingDetails,
    string? SecurityDetails,
    string? VoipDetails,
    string? Notes);

public sealed record QuoteInput(
    CustomerInput? Customer,
    string? Kind,
    string? Honeypot,
    RunsInput? Runs,
    ServicesInput? Services,
    string? Centralization,
    HomeInfoInput? HomeInfo,
    WholeHomeInput? WholeHome);

// The drops-only part of a quote, for the calculate endpoint. It writes nothing.
public sealed record CalculateInput(
    RunsInput? Runs,
    ServicesInput? Services,
    string? Centralization,
    bool? HasExistingPanel);
