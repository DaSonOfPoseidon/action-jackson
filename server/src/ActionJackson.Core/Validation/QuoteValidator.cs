using System.Text.RegularExpressions;
using ActionJackson.Core.Pricing;

namespace ActionJackson.Core.Validation;

// Checks a quote request against the contract and the catalog. Pure: no I/O, no ASP.NET types. The price
// book is needed to refuse an option the catalog cannot price (missing or inactive) on that field.
public static partial class QuoteValidator
{
    private const int MaxStreetLength = 200;
    private const int MaxCityLength = 100;
    private const int MaxLocationLength = 200;
    private const int MaxSpeedLength = 200;

    public static ValidationErrors Validate(QuoteInput? input, SiteOptions options, PriceBook book)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(book);
        var errors = new ValidationErrors();

        CustomerRules.Validate(input?.Customer, errors);
        ValidateHome(errors, input?.HomeInfo, options);
        FieldRules.Honeypot(errors, input?.Honeypot);

        var kind = input?.Kind;
        if (!FieldRules.InList(errors, "kind", kind, options.Quote.Kinds, "kind"))
        {
            return errors;
        }

        if (kind == QuoteKinds.DropsOnly)
        {
            DropsOnlyRules.Validate(errors, input?.Runs, input?.Services, input?.Centralization, options, book);
        }
        else
        {
            ValidateWholeHome(errors, input?.WholeHome, options);
        }

        return errors;
    }

    private static void ValidateHome(ValidationErrors errors, HomeInfoInput? home, SiteOptions options)
    {
        if (home?.LiabilityAcknowledged != true)
        {
            errors.Add("homeInfo.liabilityAcknowledged", "The liability acknowledgment is required.");
        }

        FieldRules.InList(errors, "homeInfo.homeAge", home?.HomeAge, options.Quote.HomeAge, "home age");
        FieldRules.InList(errors, "homeInfo.atticAccess", home?.AtticAccess, options.Quote.AtticAccess, "attic access");
        if (home?.Stories is not { } stories || !options.Limits.Stories.Contains(stories))
        {
            errors.Add("homeInfo.stories", $"Stories must be between {options.Limits.Stories.Min} and {options.Limits.Stories.Max}.");
        }

        FieldRules.OptionalLine(errors, "homeInfo.mediaPanelLocation", home?.MediaPanelLocation, MaxLocationLength, "Media panel location");

        var address = home?.Address;
        FieldRules.RequiredLine(errors, "homeInfo.address.street", address?.Street, MaxStreetLength, "Street address");
        FieldRules.RequiredLine(errors, "homeInfo.address.city", address?.City, MaxCityLength, "City");
        if (address?.State?.Trim() is not { } state || !StateShape().IsMatch(state))
        {
            errors.Add("homeInfo.address.state", "State must be a 2-letter code.");
        }

        if (address?.Zip?.Trim() is not { } zip || !ZipShape().IsMatch(zip))
        {
            errors.Add("homeInfo.address.zip", "ZIP code must be in the format 12345 or 12345-6789.");
        }
    }

    private static void ValidateWholeHome(ValidationErrors errors, WholeHomeInput? whole, SiteOptions options)
    {
        var scope = whole?.Scope;
        if (scope?.Networking != true && scope?.Security != true && scope?.Voip != true)
        {
            errors.Add("wholeHome.scope", "Select at least one scope (networking, security or VoIP).");
        }

        // A customer with their own equipment states no brand preference.
        if (whole?.HasOwnEquipment != true)
        {
            FieldRules.OptionalInList(errors, "wholeHome.networkingBrand", whole?.NetworkingBrand, options.Quote.NetworkingBrand, "networking brand");
            FieldRules.OptionalInList(errors, "wholeHome.securityBrand", whole?.SecurityBrand, options.Quote.SecurityBrand, "security brand");
        }

        FieldRules.OptionalInList(errors, "wholeHome.surveyPreference", whole?.SurveyPreference, options.Quote.SurveyPreference, "survey preference");
        FieldRules.OptionalLine(errors, "wholeHome.internetSpeed", whole?.InternetSpeed, MaxSpeedLength, "Internet speed");

        var max = options.Limits.WholeHomeTextLength;
        FieldRules.OptionalText(errors, "wholeHome.equipmentDescription", whole?.EquipmentDescription, max, "Equipment description");
        FieldRules.OptionalText(errors, "wholeHome.networkingDetails", whole?.NetworkingDetails, max, "Networking details");
        FieldRules.OptionalText(errors, "wholeHome.securityDetails", whole?.SecurityDetails, max, "Security details");
        FieldRules.OptionalText(errors, "wholeHome.voipDetails", whole?.VoipDetails, max, "VoIP details");
        FieldRules.OptionalText(errors, "wholeHome.notes", whole?.Notes, max, "Notes");
    }

    [GeneratedRegex("^[A-Za-z]{2}$", RegexOptions.CultureInvariant)]
    private static partial Regex StateShape();

    [GeneratedRegex("^[0-9]{5}(-[0-9]{4})?$", RegexOptions.CultureInvariant)]
    private static partial Regex ZipShape();
}

// The drops-only part of a quote, checked the same way for a quote and for the calculate endpoint.
internal static class DropsOnlyRules
{
    public static void Validate(
        ValidationErrors errors,
        RunsInput? runs,
        ServicesInput? services,
        string? centralization,
        SiteOptions options,
        PriceBook book)
    {
        var limits = options.Limits;
        var any = false;

        foreach (var runType in options.Quote.RunTypes)
        {
            var count = runs?.Count(runType.Value);
            any |= count > 0;
            Selected(errors, $"runs.{runType.Value}", count, limits.RunsPerType, $"{runType.Label} runs", PriceCodes.RunCode(runType.Value), book);
        }

        any |= services?.ApMounts > 0 || services?.EthernetRelocations > 0;
        Selected(errors, "services.apMounts", services?.ApMounts, limits.ApMounts, "AP mounts", PriceCodes.ApMount, book);
        Selected(errors, "services.ethernetRelocations", services?.EthernetRelocations, limits.EthernetRelocations, "Ethernet relocations", PriceCodes.EthernetRelocation, book);

        if (!any)
        {
            errors.Add("runs", "At least one cable run or service must be selected.");
        }

        // Optional; a centralization alone is not enough to quote.
        if (centralization is not null
            && FieldRules.InList(errors, "centralization", centralization, options.Quote.Centralization, "centralization")
            && !book.Has(PriceCodes.CentralizationCode(centralization)))
        {
            errors.Add("centralization", "This option isn't available right now.");
        }
    }

    // A count in range, and priced when it is above zero.
    private static void Selected(
        ValidationErrors errors,
        string path,
        int? count,
        IntRange range,
        string label,
        string code,
        PriceBook book)
    {
        FieldRules.Count(errors, path, count, range, label);
        if (count is > 0 && range.Contains(count.Value) && !book.Has(code))
        {
            errors.Add(path, "This option isn't available right now.");
        }
    }
}

// The calculate endpoint's request: the drops-only part of a quote.
public static class CalculateValidator
{
    public static ValidationErrors Validate(CalculateInput? input, SiteOptions options, PriceBook book)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(book);
        var errors = new ValidationErrors();
        DropsOnlyRules.Validate(errors, input?.Runs, input?.Services, input?.Centralization, options, book);
        return errors;
    }
}
