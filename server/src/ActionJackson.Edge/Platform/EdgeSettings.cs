using System.Globalization;

namespace ActionJackson.Edge.Platform;

// The edge's settings, read once at startup from configuration (environment: Edge__Key, Edge__ApiUrl, ...). Every
// problem stops startup. A message names the setting and never its value: Edge:Key is a secret.
internal sealed record EdgeSettings(
    string Key,
    string ApiUrl,
    string WebRoot,
    string PublicScheme,
    int TunnelPort,
    TimeSpan ApiConnectTimeout,
    TimeSpan ApiActivityTimeout)
{
    public const string Section = "Edge";

    public static EdgeSettings Load(IConfiguration configuration)
    {
        var problems = new List<string>();

        var key = configuration[Section + ":Key"];
        if (string.IsNullOrWhiteSpace(key))
        {
            problems.Add("Edge:Key is not set. Set it in the environment (Edge__Key) to the API's key (openssl rand -hex 32); there is no default");
        }
        else if (key.Length < EdgeHeaders.MinKeyLength)
        {
            problems.Add($"Edge:Key is shorter than {EdgeHeaders.MinKeyLength} characters. Set it to a long random value (openssl rand -hex 32)");
        }
        else if (key.Any(c => c is < '!' or > '~'))
        {
            problems.Add("Edge:Key contains a character that cannot be sent in a header (spaces, control characters and non-ASCII are not allowed)");
        }

        var apiUrl = ParseApiUrl(configuration[Section + ":ApiUrl"], problems);

        var webRoot = configuration[Section + ":WebRoot"] ?? "/app/sites";
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            problems.Add("Edge:WebRoot is empty");
        }

        var scheme = configuration[Section + ":PublicScheme"] ?? "https";
        if (scheme is not ("http" or "https"))
        {
            problems.Add("Edge:PublicScheme must be http or https");
        }

        var tunnelPort = 8081;
        var tunnelText = configuration[Section + ":TunnelPort"];
        if (tunnelText is not null && !(int.TryParse(tunnelText, NumberStyles.None, CultureInfo.InvariantCulture, out tunnelPort) && tunnelPort is >= 1 and <= 65535))
        {
            problems.Add("Edge:TunnelPort must be a port number from 1 to 65535");
        }

        var connectTimeout = ParseDuration(configuration, "ApiConnectTimeout", TimeSpan.FromSeconds(3), problems);
        var activityTimeout = ParseDuration(configuration, "ApiActivityTimeout", TimeSpan.FromSeconds(30), problems);

        if (problems.Count > 0)
        {
            throw new InvalidOperationException("The edge is misconfigured: " + string.Join("; ", problems) + ".");
        }

        return new EdgeSettings(key!, apiUrl!, webRoot, scheme, tunnelPort, connectTimeout, activityTimeout);
    }

    // An absolute http(s) URL with a host and nothing else (no user info, path, query or fragment), without a
    // trailing slash. There is no default: the edge must be told where the API is.
    private static string? ParseApiUrl(string? value, List<string> problems)
    {
        const string Message = "Edge:ApiUrl must be an absolute http or https URL with just a host and optional port, such as http://192.168.1.195:8110 (no default)";
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https")
            || string.IsNullOrEmpty(uri.Host)
            || uri.UserInfo.Length > 0
            || uri.AbsolutePath != "/"
            || uri.Query.Length > 0
            || uri.Fragment.Length > 0)
        {
            problems.Add(Message);
            return null;
        }

        return uri.GetLeftPart(UriPartial.Authority);
    }

    private static TimeSpan ParseDuration(IConfiguration configuration, string name, TimeSpan fallback, List<string> problems)
    {
        var text = configuration[Section + ":" + name];
        if (text is null)
        {
            return fallback;
        }

        if (!TimeSpan.TryParse(text, CultureInfo.InvariantCulture, out var parsed) || parsed <= TimeSpan.Zero)
        {
            problems.Add($"Edge:{name} must be a positive duration such as 00:00:03");
            return fallback;
        }

        return parsed;
    }
}

// The two Kestrel listeners: HTTP_PORT (the LAN-facing, untrusted one) and TUNNEL_PORT (cloudflared's, published
// to localhost only). They must differ, or the client IP could not tell them apart.
internal sealed record EdgePorts(int Http, int Tunnel)
{
    public static EdgePorts Parse(string? http, string? tunnel)
    {
        var httpPort = ParsePort("HTTP_PORT", http ?? "8080");
        var tunnelPort = ParsePort("TUNNEL_PORT", tunnel ?? "8081");
        if (httpPort == tunnelPort)
        {
            throw new InvalidOperationException("HTTP_PORT and TUNNEL_PORT must differ: the edge tells its two listeners apart by port.");
        }

        return new EdgePorts(httpPort, tunnelPort);
    }

    private static int ParsePort(string name, string text) =>
        int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var port) && port is >= 1 and <= 65535
            ? port
            : throw new InvalidOperationException($"{name} must be a port number from 1 to 65535.");
}
