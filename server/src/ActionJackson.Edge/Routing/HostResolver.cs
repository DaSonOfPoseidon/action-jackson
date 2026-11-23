using ActionJackson.Edge.Sites;

namespace ActionJackson.Edge.Routing;

// The outcome of looking at a Host header. Host is the normalised host name when the header was a plain host
// (and null for anything else: empty, an IP-literal with brackets, spaces, '@', control characters, non-ASCII).
// Site is the matched site, or the fallback site when the host matched none.
internal readonly record struct ResolvedHost(SiteDefinition Site, bool IsSiteHost, string? Host, int? Port);

// Picks the site from the Host header (invariant 8). The Host header is untrusted input: it is the only header
// read (never X-Forwarded-Host), it is matched exactly, and a host that matches nothing is served as the fallback
// site. There is no wildcard or suffix matching.
internal sealed class HostResolver(SiteRegistry registry)
{
    // A DNS name is at most 253 characters; anything longer cannot be a site host.
    private const int MaxHostLength = 255;

    public ResolvedHost Resolve(string? hostHeader)
    {
        if (!TryNormalise(hostHeader, out var host, out var port))
        {
            return new ResolvedHost(registry.Fallback, false, null, null);
        }

        var site = registry.FindByHost(host);
        return new ResolvedHost(site ?? registry.Fallback, site is not null, host, port);
    }

    // Lower-cases (ASCII only), strips one ":port" and then one trailing dot. A header that is not a plain host
    // name afterwards is rejected.
    private static bool TryNormalise(string? header, out string host, out int? port)
    {
        host = "";
        port = null;
        if (string.IsNullOrEmpty(header) || header.Length > MaxHostLength)
        {
            return false;
        }

        var text = header;
        var colon = text.IndexOf(':');
        if (colon >= 0)
        {
            // One port only; an IPv6 literal ("[::1]:80") has more colons and brackets and is rejected below.
            if (text.IndexOf(':', colon + 1) >= 0 || !TryParsePort(text.AsSpan(colon + 1), out var parsed))
            {
                return false;
            }

            port = parsed;
            text = text[..colon];
        }

        if (text.EndsWith('.'))
        {
            text = text[..^1];
        }

        if (text.Length == 0)
        {
            return false;
        }

        // ASCII only: ToLowerInvariant would also fold some non-ASCII characters (the Kelvin sign) onto ASCII letters.
        var chars = new char[text.Length];
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (c is >= 'A' and <= 'Z')
            {
                c = (char)(c + ('a' - 'A'));
            }

            if (!(c is >= 'a' and <= 'z' or >= '0' and <= '9' or '-' or '.'))
            {
                port = null;
                return false;
            }

            chars[i] = c;
        }

        host = new string(chars);
        return true;
    }

    private static bool TryParsePort(ReadOnlySpan<char> text, out int port)
    {
        port = 0;
        if (text.Length is 0 or > 5)
        {
            return false;
        }

        foreach (var c in text)
        {
            if (c is < '0' or > '9')
            {
                return false;
            }
        }

        port = int.Parse(text, System.Globalization.CultureInfo.InvariantCulture);
        return port is >= 1 and <= 65535;
    }
}
