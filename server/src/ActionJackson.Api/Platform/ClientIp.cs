using System.Net;
using System.Net.Sockets;

namespace ActionJackson.Api.Platform;

// The client address the rest of the API sees. Only EdgeTrustMiddleware sets it.
public interface IClientIpFeature
{
    IPAddress Address { get; }

    // True when the address came from X-Client-IP on a request that carried the valid edge key.
    bool FromEdge { get; }
}

internal sealed record ClientIpFeature(IPAddress Address, bool FromEdge) : IClientIpFeature;

public static class ClientIp
{
    // The address as a rate-limit bucket key. An IPv4-mapped IPv6 address is its IPv4 form, and any other
    // IPv6 address is cut to its /64, so one host cannot rotate through a whole /64 for fresh buckets.
    public static string PartitionKey(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (address.AddressFamily != AddressFamily.InterNetworkV6)
        {
            return address.ToString();
        }

        Span<byte> bytes = stackalloc byte[16];
        address.TryWriteBytes(bytes, out _);
        bytes[8..].Clear();
        return new IPAddress(bytes).ToString();
    }

    // A bare IPv4 or IPv6 address and nothing else: no list, port, brackets, scope id or whitespace.
    // IPAddress.TryParse alone accepts several of those (and short forms such as "1"), so the text is
    // checked first.
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

    // The client address of this request, never null. Without the edge middleware that is the connection's
    // remote address, and without that IPAddress.None. The raw headers are never read here.
    public static IPAddress GetClientIp(this HttpContext context) =>
        context.Features.Get<IClientIpFeature>()?.Address
        ?? context.Connection.RemoteIpAddress
        ?? IPAddress.None;
}
