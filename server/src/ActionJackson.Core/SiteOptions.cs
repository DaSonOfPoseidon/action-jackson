using System.Text.Json;
using System.Text.Json.Serialization;

namespace ActionJackson.Core;

// One choice of a form field: the value the API stores and the label the form shows.
public sealed record Option(string Value, string Label);

public sealed record IntRange(int Min, int Max)
{
    public bool Contains(int value) => value >= Min && value <= Max;
}

public sealed record ConsultationOptions(
    IReadOnlyList<Option> SquareFootage,
    IReadOnlyList<Option> CurrentIssues,
    IReadOnlyList<Option> InterestedServices,
    IReadOnlyList<Option> InterestedPackage);

public sealed record QuoteOptions(
    IReadOnlyList<Option> Kinds,
    IReadOnlyList<Option> RunTypes,
    IReadOnlyList<Option> Centralization,
    IReadOnlyList<Option> HomeAge,
    IReadOnlyList<Option> AtticAccess,
    IReadOnlyList<Option> NetworkingBrand,
    IReadOnlyList<Option> SecurityBrand,
    IReadOnlyList<Option> SurveyPreference);

public sealed record BookingOptions(IReadOnlyList<Option> Kinds);

// The limits of the booking form: the drops-only install's length, how far ahead a date may be (Chicago
// dates, counted from today) and the longest note.
public sealed record BookingLimits(IntRange DurationMinutes, int DaysAhead, int NotesLength);

public sealed record OptionLimits(
    IntRange RunsPerType,
    IntRange ApMounts,
    IntRange EthernetRelocations,
    IntRange Stories,
    int WholeHomeTextLength,
    BookingLimits Booking);

// Every option list of one site's forms and the limits on their numbers. They live once, in
// contracts/<site>-options.json, which is embedded in this assembly and later imported by Angular, so the
// API and the forms cannot disagree about a value.
public sealed record SiteOptions(ConsultationOptions Consultation, QuoteOptions Quote, BookingOptions Booking, OptionLimits Limits)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    };

    private static readonly Lazy<SiteOptions> Lan = new(() => Parse(ReadEmbedded(Site.Lan)));

    // Parsed once. Throws for a site that has no options file yet (car arrives with its own unit).
    public static SiteOptions For(Site site) => site switch
    {
        Site.Lan => Lan.Value,
        _ => throw new InvalidOperationException($"The {site.Schema()} site has no option lists."),
    };

    // The embedded file of a site, as text.
    public static string ReadEmbedded(Site site)
    {
        var name = $"ActionJackson.Core.{site.Schema()}-options.json";
        using var stream = typeof(SiteOptions).Assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Embedded resource {name} is missing");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    // Fails loudly on a missing list, an unknown member, an empty or repeated value: a wrong contract
    // must stop startup, not shape what the API accepts.
    public static SiteOptions Parse(string json)
    {
        var options = JsonSerializer.Deserialize<SiteOptions>(json, JsonOptions)
            ?? throw new InvalidOperationException("The options file is empty");
        if (options.Consultation is null || options.Quote is null || options.Booking is null || options.Limits is null)
        {
            throw new InvalidOperationException("The options file needs consultation, quote, booking and limits");
        }

        foreach (var (name, list) in options.Lists())
        {
            if (list is null || list.Count == 0)
            {
                throw new InvalidOperationException($"The option list {name} is missing or empty");
            }

            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var option in list)
            {
                if (option is null || string.IsNullOrWhiteSpace(option.Value) || string.IsNullOrWhiteSpace(option.Label))
                {
                    throw new InvalidOperationException($"The option list {name} has an entry without a value or label");
                }

                if (!seen.Add(option.Value))
                {
                    throw new InvalidOperationException($"The option list {name} repeats the value '{option.Value}'");
                }
            }
        }

        var limits = options.Limits;
        if (limits.RunsPerType is null || limits.ApMounts is null || limits.EthernetRelocations is null
            || limits.Stories is null || limits.WholeHomeTextLength < 1 || limits.Booking is null)
        {
            throw new InvalidOperationException("The options file has incomplete limits");
        }

        var booking = limits.Booking;
        if (booking.DurationMinutes is not { Min: >= 1 } duration || duration.Max < duration.Min
            || booking.DaysAhead < 1 || booking.NotesLength < 1)
        {
            throw new InvalidOperationException("The options file has incomplete booking limits");
        }

        return options;
    }

    private IEnumerable<(string Name, IReadOnlyList<Option> List)> Lists()
    {
        yield return ("consultation.squareFootage", Consultation.SquareFootage);
        yield return ("consultation.currentIssues", Consultation.CurrentIssues);
        yield return ("consultation.interestedServices", Consultation.InterestedServices);
        yield return ("consultation.interestedPackage", Consultation.InterestedPackage);
        yield return ("quote.kinds", Quote.Kinds);
        yield return ("quote.runTypes", Quote.RunTypes);
        yield return ("quote.centralization", Quote.Centralization);
        yield return ("quote.homeAge", Quote.HomeAge);
        yield return ("quote.atticAccess", Quote.AtticAccess);
        yield return ("quote.networkingBrand", Quote.NetworkingBrand);
        yield return ("quote.securityBrand", Quote.SecurityBrand);
        yield return ("quote.surveyPreference", Quote.SurveyPreference);
        yield return ("booking.kinds", Booking.Kinds);
    }
}

public static class OptionLists
{
    // Exact, case-sensitive: the stored value is the contract's spelling.
    public static bool Has(this IReadOnlyList<Option> list, string? value) =>
        value is not null && list.Any(option => string.Equals(option.Value, value, StringComparison.Ordinal));

    public static string? LabelOf(this IReadOnlyList<Option> list, string value) =>
        list.FirstOrDefault(option => string.Equals(option.Value, value, StringComparison.Ordinal))?.Label;
}

// The two quote kinds the lan site takes. A test checks them against the contracts file.
public static class QuoteKinds
{
    public const string DropsOnly = "drops-only";
    public const string WholeHome = "whole-home";

    public static readonly IReadOnlyList<string> All = [DropsOnly, WholeHome];
}
