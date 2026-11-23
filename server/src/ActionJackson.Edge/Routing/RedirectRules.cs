using ActionJackson.Edge.Sites;

namespace ActionJackson.Edge.Routing;

// The www and legacy-path redirects (invariant 8: always a 301 that keeps the path and query). One hop: the host
// redirect first (www to the apex), then the path redirects of the site that host belongs to. The Location is built
// from the registry's hosts, the validated scheme and the parsed port, never from the raw Host header.
internal sealed class RedirectRules(SiteRegistry registry, string scheme)
{
    // path is the decoded request path, used for matching. rawPath and query are what the Location carries, byte for
    // byte (rawPath defaults to path). query includes its leading "?" and is empty when there is none.
    // Returns null when the request is not redirected.
    public string? Resolve(ResolvedHost request, string path, string query, string? rawPath = null)
    {
        // The API and the health check answer on every host and are never redirected.
        if (request.Host is null || IsApiOrHealth(path))
        {
            return null;
        }

        // A host that matched no site is served as the fallback site and not redirected. Only a registry host
        // (a site's or a host redirect's source) is ever acted on.
        string targetHost;
        SiteDefinition targetSite;
        var hostRedirect = registry.HostRedirects.FirstOrDefault(r => r.From == request.Host);
        if (hostRedirect is not null)
        {
            targetHost = hostRedirect.To;
            targetSite = registry.FindByHost(targetHost)!;
        }
        else if (request.IsSiteHost)
        {
            targetHost = request.Host;
            targetSite = request.Site;
        }
        else
        {
            return null;
        }

        var pathRedirect = registry.PathRedirects.FirstOrDefault(r => r.Site == targetSite.Key && r.Prefixes.Any(p => Matches(path, p)));
        if (pathRedirect is not null)
        {
            targetHost = HostInFamilyOf(registry.Get(pathRedirect.To), targetHost);
        }
        else if (hostRedirect is null)
        {
            return null;
        }

        var port = request.Port is { } explicitPort ? ":" + explicitPort : "";
        return $"{scheme}://{targetHost}{port}{rawPath ?? path}{query}";
    }

    // A prefix matches a whole segment, case-sensitively: "/services" matches "/services" and "/services/x" only.
    internal static bool Matches(string path, string prefix) =>
        path.StartsWith(prefix, StringComparison.Ordinal)
        && (path.Length == prefix.Length || path[prefix.Length] == '/');

    // /api is matched without regard to case, as the router does; /healthz is matched exactly.
    internal static bool IsApiOrHealth(string path) =>
        (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase) && (path.Length == 4 || path[4] == '/'))
        || path == "/healthz";

    // The target site's host in the same family as the request's: .localhost for a .localhost request, the
    // production domain otherwise. Picked by suffix, never by position. The registry guarantees both exist.
    private static string HostInFamilyOf(SiteDefinition site, string requestHost) =>
        SiteRegistry.IsLocalFamily(requestHost)
            ? site.Hosts.First(SiteRegistry.IsLocalFamily)
            : site.Hosts.First(SiteRegistry.IsProductionFamily);
}
