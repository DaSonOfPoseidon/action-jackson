using System.Net;
using System.Net.Sockets;
using Microsoft.Extensions.Primitives;

namespace ActionJackson.Edge.Platform;

// The names the edge and the API agree on. The API's copy is ActionJackson.Api.Platform.EdgeOptions; a test
// compares the two.
internal static class EdgeHeaders
{
    public const string Key = "X-Edge-Key";
    public const string ClientIp = "X-Client-IP";
    public const string CfConnectingIp = "CF-Connecting-IP";
    public const int MinKeyLength = 32;
}

internal static class ClientIp
{
    // A bare IPv4 or IPv6 address and nothing else: no list, port, brackets, scope id or whitespace.
    // IPAddress.TryParse alone accepts several of those (and short forms such as "1"), so the text is
    // checked first. This is a copy of ActionJackson.Api.Platform.ClientIp.TryParseBare: the edge cannot
    // reference the API, and a test feeds both copies the same inputs so they cannot drift.
    public static bool TryParseBare(string? value, out IPAddress address)
    {
        address = IPAddress.None;
        if (string.IsNullOrEmpty(value) || value.Length > 45)
        {
            return false;
        }

        foreach (var c in value)
        {
            if (!char.IsAsciiHexDigit(c) && c is not ('.' or ':'))
            {
                return false;
            }
        }

        var v6 = value.Contains(':');
        if (!v6 && value.Count(c => c == '.') != 3)
        {
            return false;
        }

        if (!IPAddress.TryParse(value, out var parsed))
        {
            return false;
        }

        // A literal with a colon must be IPv6, and one without must be IPv4.
        if (v6 != (parsed.AddressFamily == AddressFamily.InterNetworkV6))
        {
            return false;
        }

        address = parsed;
        return true;
    }
}

// Decides the client address the edge tells the API about (invariant 1). The listener is told by the
// connection's local port, never by a header: the LAN port is untrusted and uses the connection's remote
// address; the tunnel port (cloudflared's, published to localhost only) may carry CF-Connecting-IP.
internal static class ClientIpSource
{
    // remote is the connection's remote address (null only where there is none). cfConnectingIp is every
    // CF-Connecting-IP value of the request: it counts only on the tunnel port, only when there is exactly one,
    // and only when it is one bare address (the API's own rule for X-Client-IP).
    public static IPAddress Resolve(IPAddress? remote, int localPort, int tunnelPort, StringValues cfConnectingIp)
    {
        if (localPort == tunnelPort
            && cfConnectingIp.Count == 1
            && ClientIp.TryParseBare(cfConnectingIp[0], out var forwarded))
        {
            return forwarded;
        }

        return remote ?? IPAddress.None;
    }

    // The X-Client-IP value: one bare address. An IPv4-mapped address goes out as IPv4, and a scope id
    // ("fe80::1%3") is dropped, because the API's parser rejects both a scope id and anything but one address.
    public static string Format(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }
        else if (address.AddressFamily == AddressFamily.InterNetworkV6 && address.ScopeId != 0)
        {
            address = new IPAddress(address.GetAddressBytes());
        }

        return address.ToString();
    }
}
