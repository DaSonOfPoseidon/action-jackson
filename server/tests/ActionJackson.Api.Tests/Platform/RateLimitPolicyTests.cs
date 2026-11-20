using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.RateLimiting;
using ActionJackson.Api.Platform;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;

namespace ActionJackson.Api.Tests.Platform;

public class RateLimitPolicyTests
{
    // The Express API's numbers, spelled out here so a change to either side is noticed.
    public static TheoryData<string, int, int, string> Legacy => new()
    {
        { "consultation-create", 3, 15 * 60, "Too many consultation requests from this IP, please try again in 15 minutes." },
        { "quote-create", 3, 15 * 60, "Too many quote requests from this IP, please try again in 15 minutes." },
        { "quote-calculate", 30, 60, "Too many calculation requests, please slow down." },
        { "catalog-read", 30, 60, "Too many requests, please slow down." },
        { "booking", 5, 15 * 60, "Too many scheduling requests from this IP, please try again later." },
        { "upload", 20, 15 * 60, "Too many file uploads. Please try again later." },
        { "download", 100, 5 * 60, "Too many download requests. Please try again later." },
        { "admin", 100, 15 * 60, "Too many admin requests. Please try again later." },
    };

    [Theory]
    [MemberData(nameof(Legacy))]
    public void A_policy_has_the_legacy_limit_window_and_message(string name, int permits, int seconds, string detail)
    {
        var policy = RateLimitPolicies.Get(name);

        Assert.Equal(permits, policy.PermitLimit);
        Assert.Equal(TimeSpan.FromSeconds(seconds), policy.Window);
        Assert.Equal(detail, policy.Detail);
    }

    [Fact]
    public void There_are_exactly_the_eight_policies()
    {
        Assert.Equal(
            ["admin", "booking", "catalog-read", "consultation-create", "download", "quote-calculate", "quote-create", "upload"],
            RateLimitPolicies.All.Select(p => p.Name).Order().ToArray());
    }

    [Theory]
    [MemberData(nameof(Legacy))]
    public void Exactly_the_permit_limit_succeeds_then_the_next_is_refused(string name, int permits, int seconds, string detail)
    {
        _ = seconds;
        _ = detail;
        using var limiter = PartitionedRateLimiter.Create<HttpContext, string>(context => RateLimitPolicies.Partition(name, context));
        var context = From("198.51.100.20");

        for (var i = 0; i < permits; i++)
        {
            using var lease = limiter.AttemptAcquire(context);
            Assert.True(lease.IsAcquired, $"request {i + 1} of {permits} was refused");
        }

        using var refused = limiter.AttemptAcquire(context);
        Assert.False(refused.IsAcquired);
        Assert.True(refused.TryGetMetadata(MetadataName.RetryAfter, out var retry));
        Assert.True(retry > TimeSpan.Zero);
    }

    [Fact]
    public void Another_address_has_its_own_bucket()
    {
        using var limiter = PartitionedRateLimiter.Create<HttpContext, string>(context => RateLimitPolicies.Partition("consultation-create", context));

        for (var i = 0; i < 3; i++)
        {
            limiter.AttemptAcquire(From("198.51.100.20")).Dispose();
        }

        using var sameAddress = limiter.AttemptAcquire(From("198.51.100.20"));
        using var otherAddress = limiter.AttemptAcquire(From("198.51.100.21"));
        Assert.False(sameAddress.IsAcquired);
        Assert.True(otherAddress.IsAcquired);
    }

    [Fact]
    public void An_unknown_policy_name_is_an_error()
    {
        Assert.Throws<ArgumentException>(() => RateLimitPolicies.Get("nope"));
    }

    private static DefaultHttpContext From(string address)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse(address);
        return context;
    }
}

public class RateLimitHostTests
{
    private static readonly string Key = PlatformHost.NewKey();

    private static void Map(WebApplication app)
    {
        app.MapGet("/book", () => "booked").RequireRateLimiting(RateLimitPolicies.Booking);
        app.MapGet("/free", () => "free");
        app.MapGet("/healthz", () => "ok");
    }

    private static async Task<HttpStatusCode> GetAsync(PlatformHost host, string path, string? edgeKey = null, string? clientIp = null, string? remote = null)
    {
        using var request = clientIp is null
            ? host.Request(HttpMethod.Get, path, remote, edgeKey)
            : host.Request(HttpMethod.Get, path, remote, edgeKey, clientIp);
        using var response = await host.Client.SendAsync(request);
        return response.StatusCode;
    }

    [Fact]
    public async Task Two_client_ips_through_a_trusted_edge_have_separate_buckets()
    {
        await using var host = await PlatformHost.StartAsync(Key, Map);

        for (var i = 0; i < 5; i++)
        {
            Assert.Equal(HttpStatusCode.OK, await GetAsync(host, "/book", Key, "198.51.100.1"));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, await GetAsync(host, "/book", Key, "198.51.100.1"));
        Assert.Equal(HttpStatusCode.OK, await GetAsync(host, "/book", Key, "198.51.100.2"));
    }

    [Fact]
    public async Task An_ipv4_address_and_its_mapped_form_share_a_bucket()
    {
        await using var host = await PlatformHost.StartAsync(Key, Map);

        for (var i = 0; i < 5; i++)
        {
            Assert.Equal(HttpStatusCode.OK, await GetAsync(host, "/book", Key, "198.51.100.1"));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, await GetAsync(host, "/book", Key, "::ffff:198.51.100.1"));
    }

    [Fact]
    public async Task Without_the_key_a_forged_client_ip_cannot_buy_a_new_bucket()
    {
        await using var host = await PlatformHost.StartAsync(Key, Map);

        for (var i = 0; i < 5; i++)
        {
            Assert.Equal(HttpStatusCode.OK, await GetAsync(host, "/book", clientIp: $"203.0.113.{100 + i}"));
        }

        // Every request shared the remote address's bucket, whatever it claimed to be.
        Assert.Equal(HttpStatusCode.TooManyRequests, await GetAsync(host, "/book", clientIp: "203.0.113.200"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await GetAsync(host, "/book", edgeKey: "wrong", clientIp: "203.0.113.201"));
    }

    [Fact]
    public async Task Different_remote_addresses_without_the_key_have_separate_buckets()
    {
        await using var host = await PlatformHost.StartAsync(Key, Map);

        for (var i = 0; i < 5; i++)
        {
            Assert.Equal(HttpStatusCode.OK, await GetAsync(host, "/book", remote: "192.0.2.10"));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, await GetAsync(host, "/book", remote: "192.0.2.10"));
        Assert.Equal(HttpStatusCode.OK, await GetAsync(host, "/book", remote: "192.0.2.11"));
    }

    [Fact]
    public async Task The_429_is_a_problem_with_retry_after_and_the_legacy_sentence()
    {
        await using var host = await PlatformHost.StartAsync(Key, Map);
        for (var i = 0; i < 5; i++)
        {
            await GetAsync(host, "/book");
        }

        using var response = await host.Client.GetAsync("/book");

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var retryAfter = int.Parse(Assert.Single(response.Headers.GetValues("Retry-After")));
        Assert.InRange(retryAfter, 1, 15 * 60);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(429, body.GetProperty("status").GetInt32());
        Assert.Equal("Too Many Requests", body.GetProperty("title").GetString());
        Assert.Equal("Too many scheduling requests from this IP, please try again later.", body.GetProperty("detail").GetString());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("traceId").GetString()));
    }

    [Fact]
    public async Task A_429_is_a_problem_even_when_the_request_does_not_accept_json()
    {
        await using var host = await PlatformHost.StartAsync(Key, Map);
        for (var i = 0; i < 5; i++)
        {
            await GetAsync(host, "/book");
        }

        using var request = host.Request(HttpMethod.Get, "/book");
        request.Headers.TryAddWithoutValidation("Accept", "text/html");
        using var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Endpoints_without_a_policy_and_healthz_are_never_limited()
    {
        await using var host = await PlatformHost.StartAsync(Key, Map);

        for (var i = 0; i < 300; i++)
        {
            Assert.Equal(HttpStatusCode.OK, await GetAsync(host, "/free"));
            Assert.Equal(HttpStatusCode.OK, await GetAsync(host, "/healthz"));
        }
    }
}
