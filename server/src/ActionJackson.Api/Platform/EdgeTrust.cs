using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;

namespace ActionJackson.Api.Platform;

public sealed class EdgeOptions
{
    public const string Section = "Edge";
    public const int MinKeyLength = 32;
    public const string KeyHeader = "X-Edge-Key";
    public const string ClientIpHeader = "X-Client-IP";

    // Edge:Key (env Edge__Key). Blank trusts no forwarded header. There is deliberately no default.
    public string? Key { get; set; }

    // Throws when the key is set but too short to be a real secret. A blank key is allowed.
    public void Validate()
    {
        if (!string.IsNullOrWhiteSpace(Key) && Key.Length < MinKeyLength)
        {
            throw new InvalidOperationException(
                $"Edge:Key is set but shorter than {MinKeyLength} characters. Set it to a long random value " +
                "(openssl rand -hex 32) in the environment (Edge__Key); there is no default.");
        }
    }
}

// Decides the client IP. X-Client-IP counts only on a request with exactly one valid X-Edge-Key. Both
// headers are removed from every request afterwards, so no later code can read the raw values. This
// replaces UseForwardedHeaders on purpose, which would trust X-Forwarded-For from anyone.
public sealed class EdgeTrustMiddleware(
    RequestDelegate next,
    IOptions<EdgeOptions> options,
    ILogger<EdgeTrustMiddleware> logger)
{
    // The key's hash, made once. Hashing both sides makes the comparison independent of length.
    private readonly byte[]? keyHash = string.IsNullOrWhiteSpace(options.Value.Key)
        ? null
        : SHA256.HashData(Encoding.UTF8.GetBytes(options.Value.Key));

    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Request.Headers;
        var key = headers[EdgeOptions.KeyHeader];
        var forwarded = headers[EdgeOptions.ClientIpHeader];
        headers.Remove(EdgeOptions.KeyHeader);
        headers.Remove(EdgeOptions.ClientIpHeader);

        var trusted = IsValidKey(key);
        if (!trusted && keyHash is not null && key.Count > 0)
        {
            // The presented value is never logged.
            logger.LogWarning("A request carried a wrong {Header}; its forwarded headers are ignored.", EdgeOptions.KeyHeader);
        }

        var address = context.Connection.RemoteIpAddress ?? IPAddress.None;
        if (trusted)
        {
            if (forwarded.Count == 1 && ClientIp.TryParseBare(forwarded[0], out var parsed))
            {
                address = parsed;
            }
            else
            {
                logger.LogWarning("A request with a valid edge key had a missing or invalid {Header}; using the connection address.", EdgeOptions.ClientIpHeader);
            }
        }

        context.Features.Set<IClientIpFeature>(new ClientIpFeature(address, trusted));
        return next(context);
    }

    private bool IsValidKey(StringValues presented)
    {
        if (keyHash is null || presented.Count != 1 || string.IsNullOrEmpty(presented[0]))
        {
            return false;
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(presented[0]!));
        return CryptographicOperations.FixedTimeEquals(hash, keyHash);
    }
}
