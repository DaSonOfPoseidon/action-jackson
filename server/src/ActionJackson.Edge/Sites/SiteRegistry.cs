using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ActionJackson.Edge.Sites;

internal sealed record SiteDefinition(string Key, IReadOnlyList<string> Hosts, bool Spa);

internal sealed record HostRedirect(string From, string To);

internal sealed record PathRedirect(string Site, IReadOnlyList<string> Prefixes, string To);

// Thrown when contracts/sites.json is unusable. The edge refuses to start on it.
internal sealed class SiteRegistryException(string message) : InvalidOperationException(message);

// The sites the edge serves, read from contracts/sites.json (embedded; the Angular apps import the same
// file). Everything here is validated once at startup, so request handling can trust it.
internal sealed partial class SiteRegistry
{
    // The production domain. A redirect's target host is picked by this suffix, never by position.
    public const string ProductionDomain = "actionjacksoninstalls.com";

    private const string ResourceName = "ActionJackson.Edge.sites.json";

    private readonly Dictionary<string, SiteDefinition> byKey;
    private readonly Dictionary<string, SiteDefinition> byHost;

    private SiteRegistry(
        SiteDefinition fallback,
        IReadOnlyList<SiteDefinition> sites,
        IReadOnlyList<HostRedirect> hostRedirects,
        IReadOnlyList<PathRedirect> pathRedirects)
    {
        Fallback = fallback;
        Sites = sites;
        HostRedirects = hostRedirects;
        PathRedirects = pathRedirects;
        byKey = sites.ToDictionary(s => s.Key, StringComparer.Ordinal);
        byHost = sites.SelectMany(s => s.Hosts.Select(h => (Host: h, Site: s))).ToDictionary(x => x.Host, x => x.Site, StringComparer.Ordinal);
    }

    public SiteDefinition Fallback { get; }

    public IReadOnlyList<SiteDefinition> Sites { get; }

    public IReadOnlyList<HostRedirect> HostRedirects { get; }

    public IReadOnlyList<PathRedirect> PathRedirects { get; }

    public SiteDefinition Get(string key) => byKey[key];

    // The site whose host list holds this exact (already normalised) host, or null. No wildcard or suffix match.
    public SiteDefinition? FindByHost(string host) => byHost.GetValueOrDefault(host);

    // True for localhost and *.localhost: the development family of hosts.
    public static bool IsLocalFamily(string host) =>
        host == "localhost" || host.EndsWith(".localhost", StringComparison.Ordinal);

    public static bool IsProductionFamily(string host) =>
        host == ProductionDomain || host.EndsWith("." + ProductionDomain, StringComparison.Ordinal);

    public static SiteRegistry LoadEmbedded()
    {
        using var stream = typeof(SiteRegistry).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new SiteRegistryException($"The embedded {ResourceName} is missing from the assembly.");
        using var reader = new StreamReader(stream);
        return Parse(reader.ReadToEnd());
    }

    public static SiteRegistry Parse(string json)
    {
        RegistryFile? file;
        try
        {
            file = JsonSerializer.Deserialize<RegistryFile>(json, Options);
        }
        catch (JsonException error)
        {
            throw new SiteRegistryException("sites.json is not valid JSON for the registry: " + error.Message);
        }

        if (file is null)
        {
            throw new SiteRegistryException("sites.json is not valid JSON for the registry: it is null.");
        }

        var problems = new List<string>();
        var sites = BuildSites(file, problems);
        var hostRedirects = BuildHostRedirects(file, sites, problems);
        var pathRedirects = BuildPathRedirects(file, sites, problems);

        var fallback = file.Fallback is not null ? sites.FirstOrDefault(s => s.Key == file.Fallback) : null;
        if (fallback is null)
        {
            problems.Add(file.Fallback is null
                ? "fallback is missing"
                : $"fallback \"{file.Fallback}\" names no site");
        }

        if (problems.Count > 0 || fallback is null)
        {
            throw new SiteRegistryException("sites.json is invalid: " + string.Join("; ", problems) + ".");
        }

        return new SiteRegistry(fallback, sites, hostRedirects, pathRedirects);
    }

    private static List<SiteDefinition> BuildSites(RegistryFile file, List<string> problems)
    {
        var sites = new List<SiteDefinition>();
        var seenHosts = new HashSet<string>(StringComparer.Ordinal);
        foreach (var raw in file.Sites ?? [])
        {
            var key = raw.Key ?? "";
            if (!SiteKey().IsMatch(key))
            {
                problems.Add($"site key \"{key}\" must be lower-case letters, digits and hyphens");
                continue;
            }

            if (sites.Any(s => s.Key == key))
            {
                problems.Add($"duplicate site key \"{key}\"");
                continue;
            }

            var hosts = raw.Hosts ?? [];
            if (hosts.Count == 0)
            {
                problems.Add($"site \"{key}\" has no hosts");
            }

            foreach (var host in hosts)
            {
                CheckHost(host, problems);
                if (!seenHosts.Add(host ?? ""))
                {
                    problems.Add($"duplicate host \"{host}\"");
                }
            }

            sites.Add(new SiteDefinition(key, [.. hosts.OfType<string>()], raw.Spa ?? false));
        }

        if (sites.Count == 0)
        {
            problems.Add("there are no sites");
        }

        return sites;
    }

    private static List<HostRedirect> BuildHostRedirects(RegistryFile file, List<SiteDefinition> sites, List<string> problems)
    {
        var siteHosts = sites.SelectMany(s => s.Hosts).ToHashSet(StringComparer.Ordinal);
        var result = new List<HostRedirect>();
        var seenFrom = new HashSet<string>(StringComparer.Ordinal);
        foreach (var raw in file.HostRedirects ?? [])
        {
            var from = raw.From ?? "";
            var to = raw.To ?? "";
            CheckHost(from, problems);
            if (siteHosts.Contains(from))
            {
                problems.Add($"host redirect from \"{from}\" is also a site host");
            }

            if (!seenFrom.Add(from))
            {
                problems.Add($"host redirect from \"{from}\" is listed twice");
            }

            if (!siteHosts.Contains(to))
            {
                problems.Add($"host redirect to \"{to}\" is not a site host");
            }

            result.Add(new HostRedirect(from, to));
        }

        return result;
    }

    private static List<PathRedirect> BuildPathRedirects(RegistryFile file, List<SiteDefinition> sites, List<string> problems)
    {
        var result = new List<PathRedirect>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var raw in file.PathRedirects ?? [])
        {
            var site = raw.Site ?? "";
            var to = raw.To ?? "";
            var prefixes = raw.Prefixes ?? [];
            var source = sites.FirstOrDefault(s => s.Key == site);
            var target = sites.FirstOrDefault(s => s.Key == to);
            if (source is null)
            {
                problems.Add($"path redirect site \"{site}\" names no site");
            }

            if (target is null)
            {
                problems.Add($"path redirect to \"{to}\" names no site");
            }
            else
            {
                // A redirect keeps the request's family (production or .localhost), so the target needs a host in each.
                if (!target.Hosts.Any(IsProductionFamily))
                {
                    problems.Add($"site \"{to}\" is a redirect target and has no {ProductionDomain} host");
                }

                if (!target.Hosts.Any(IsLocalFamily))
                {
                    problems.Add($"site \"{to}\" is a redirect target and has no .localhost host");
                }
            }

            if (site == to && source is not null)
            {
                problems.Add($"path redirect of site \"{site}\" redirects to itself");
            }

            if (prefixes.Count == 0)
            {
                problems.Add($"path redirect of site \"{site}\" has no prefixes");
            }

            foreach (var prefix in prefixes)
            {
                CheckPrefix(prefix, problems);
                if (!seen.Add(site + " " + prefix))
                {
                    problems.Add($"prefix \"{prefix}\" of site \"{site}\" is listed twice");
                }
            }

            result.Add(new PathRedirect(site, [.. prefixes.OfType<string>()], to));
        }

        return result;
    }

    // A site host is a lower-case plain host name: letters, digits, dots and hyphens, with no port and no trailing dot.
    private static void CheckHost(string? host, List<string> problems)
    {
        if (string.IsNullOrEmpty(host))
        {
            problems.Add("a host is empty");
            return;
        }

        if (host.Any(c => c is >= 'A' and <= 'Z'))
        {
            problems.Add($"host \"{host}\" is not lower-case");
        }
        else if (!PlainHost().IsMatch(host))
        {
            problems.Add($"host \"{host}\" is not a plain host name (no port, no trailing dot, no other characters)");
        }
    }

    private static void CheckPrefix(string? prefix, List<string> problems)
    {
        if (string.IsNullOrEmpty(prefix) || prefix[0] != '/')
        {
            problems.Add($"prefix \"{prefix}\" must start with /");
            return;
        }

        if (prefix[^1] == '/')
        {
            problems.Add($"prefix \"{prefix}\" must not end with /");
            return;
        }

        if (!PlainPath().IsMatch(prefix))
        {
            problems.Add($"prefix \"{prefix}\" is not a plain path (no spaces, query, fragment or percent escapes)");
            return;
        }

        if (prefix == "/healthz" || prefix == "/api" || prefix.StartsWith("/api/", StringComparison.Ordinal))
        {
            problems.Add($"prefix \"{prefix}\" is not allowed: /api and /healthz are never redirected");
        }
    }

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    [GeneratedRegex("^[a-z][a-z0-9-]*$")]
    private static partial Regex SiteKey();

    [GeneratedRegex("^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$")]
    private static partial Regex PlainHost();

    [GeneratedRegex("^/[A-Za-z0-9._~!$&'()*+,;=:@/-]*$")]
    private static partial Regex PlainPath();

    private sealed class RegistryFile
    {
        public string? Fallback { get; set; }

        public List<SiteFile>? Sites { get; set; }

        public List<HostRedirectFile>? HostRedirects { get; set; }

        public List<PathRedirectFile>? PathRedirects { get; set; }
    }

    private sealed class SiteFile
    {
        public string? Key { get; set; }

        public List<string?>? Hosts { get; set; }

        public bool? Spa { get; set; }
    }

    private sealed class HostRedirectFile
    {
        public string? From { get; set; }

        public string? To { get; set; }
    }

    private sealed class PathRedirectFile
    {
        public string? Site { get; set; }

        public List<string?>? Prefixes { get; set; }

        public string? To { get; set; }
    }
}
