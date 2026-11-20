using System.Net.Http.Json;
using System.Text.Json;
using ActionJackson.Api.Platform;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace ActionJackson.Api.Tests.Platform;

public class EdgeTrustTests
{
    private static readonly string Key = PlatformHost.NewKey();

    private static void MapEcho(WebApplication app) =>
        app.MapGet("/echo", (HttpContext context) => Results.Json(new
        {
            ip = context.GetClientIp().ToString(),
            // What a later handler can still see of the two headers.
            edgeKeyHeader = context.Request.Headers.ContainsKey("X-Edge-Key"),
            clientIpHeader = context.Request.Headers.ContainsKey("X-Client-IP"),
            fromEdge = context.Features.Get<IClientIpFeature>()?.FromEdge,
            remote = context.Connection.RemoteIpAddress?.ToString(),
        }));

    private static async Task<JsonElement> EchoAsync(PlatformHost host, string? edgeKey, params string[] clientIps)
    {
        using var request = host.Request(HttpMethod.Get, "/echo", edgeKey: edgeKey, clientIps: clientIps);
        using var response = await host.Client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        // In every case both headers are gone downstream.
        Assert.False(body.GetProperty("edgeKeyHeader").GetBoolean());
        Assert.False(body.GetProperty("clientIpHeader").GetBoolean());
        return body;
    }

    [Theory]
    [InlineData("198.51.100.7", "198.51.100.7")]
    [InlineData("2001:db8::7", "2001:db8::7")]
    [InlineData("::ffff:198.51.100.7", "::ffff:198.51.100.7")]
    public async Task A_valid_key_makes_the_forwarded_address_the_client_ip(string forwarded, string expected)
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);

        var body = await EchoAsync(host, Key, forwarded);

        Assert.Equal(expected, body.GetProperty("ip").GetString());
        Assert.True(body.GetProperty("fromEdge").GetBoolean());
        // The connection's own address is untouched.
        Assert.Equal(PlatformHost.DefaultRemote, body.GetProperty("remote").GetString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("1.2.3.4, 5.6.7.8")]
    [InlineData("1.2.3.4:80")]
    [InlineData("not-an-ip")]
    [InlineData(" 1.2.3.4")]
    public async Task A_valid_key_with_a_missing_or_malformed_address_falls_back_to_the_remote_address(string forwarded)
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);

        var body = await EchoAsync(host, Key, forwarded);

        Assert.Equal(PlatformHost.DefaultRemote, body.GetProperty("ip").GetString());
        Assert.Contains(host.Logs.Lines, l => l.Level == LogLevel.Warning && l.Message.Contains("X-Client-IP"));
    }

    [Fact]
    public async Task A_valid_key_without_an_address_header_falls_back_to_the_remote_address()
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);

        var body = await EchoAsync(host, Key);

        Assert.Equal(PlatformHost.DefaultRemote, body.GetProperty("ip").GetString());
    }

    [Fact]
    public async Task A_valid_key_with_two_address_header_values_falls_back_to_the_remote_address()
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);

        var body = await EchoAsync(host, Key, "1.2.3.4", "5.6.7.8");

        Assert.Equal(PlatformHost.DefaultRemote, body.GetProperty("ip").GetString());
    }

    [Theory]
    [InlineData("wrong-key")]
    [InlineData("")]
    public async Task A_wrong_or_empty_key_is_untrusted(string presented)
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);

        var body = await EchoAsync(host, presented, "198.51.100.7");

        Assert.Equal(PlatformHost.DefaultRemote, body.GetProperty("ip").GetString());
        Assert.False(body.GetProperty("fromEdge").GetBoolean());
    }

    [Fact]
    public async Task A_key_of_a_different_length_is_untrusted()
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);

        var body = await EchoAsync(host, Key + "0", "198.51.100.7");
        var shorter = await EchoAsync(host, Key[..^1], "198.51.100.7");

        Assert.Equal(PlatformHost.DefaultRemote, body.GetProperty("ip").GetString());
        Assert.Equal(PlatformHost.DefaultRemote, shorter.GetProperty("ip").GetString());
    }

    [Fact]
    public async Task Two_key_header_values_are_untrusted_even_when_one_is_right()
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);
        using var request = host.Request(HttpMethod.Get, "/echo", clientIps: "198.51.100.7");
        request.Headers.TryAddWithoutValidation("X-Edge-Key", [Key, Key]);

        using var response = await host.Client.SendAsync(request);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(PlatformHost.DefaultRemote, body.GetProperty("ip").GetString());
        Assert.False(body.GetProperty("clientIpHeader").GetBoolean());
        Assert.False(body.GetProperty("edgeKeyHeader").GetBoolean());
    }

    [Fact]
    public async Task A_wrong_key_is_logged_without_its_value()
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);
        const string secretLookingValue = "super-secret-wrong-value";

        await EchoAsync(host, secretLookingValue, "198.51.100.7");

        Assert.Contains(host.Logs.Lines, l => l.Level == LogLevel.Warning && l.Message.Contains("X-Edge-Key"));
        Assert.DoesNotContain(host.Logs.Lines, l => l.Message.Contains(secretLookingValue) || l.Message.Contains(Key));
    }

    [Fact]
    public async Task Without_a_key_a_forged_address_is_ignored()
    {
        await using var host = await PlatformHost.StartAsync(Key, MapEcho);

        var body = await EchoAsync(host, edgeKey: null, "198.51.100.7");

        Assert.Equal(PlatformHost.DefaultRemote, body.GetProperty("ip").GetString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task A_blank_configured_key_trusts_nothing_even_an_empty_header(string? configured)
    {
        await using var host = await PlatformHost.StartAsync(configured, MapEcho);

        var emptyKey = await EchoAsync(host, "", "198.51.100.7");
        var blankKey = await EchoAsync(host, "   ", "198.51.100.7");
        var someKey = await EchoAsync(host, Key, "198.51.100.7");

        Assert.Equal(PlatformHost.DefaultRemote, emptyKey.GetProperty("ip").GetString());
        Assert.Equal(PlatformHost.DefaultRemote, blankKey.GetProperty("ip").GetString());
        Assert.Equal(PlatformHost.DefaultRemote, someKey.GetProperty("ip").GetString());
    }

    [Fact]
    public async Task A_blank_configured_key_logs_one_startup_warning()
    {
        await using var host = await PlatformHost.StartAsync(null, MapEcho);

        Assert.Single(host.Logs.Lines, l => l.Level == LogLevel.Warning && l.Message.Contains("Edge:Key"));
    }

    [Fact]
    public async Task A_key_of_31_characters_stops_startup_and_32_starts()
    {
        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => PlatformHost.StartAsync(new string('a', 31), MapEcho));
        Assert.Contains("Edge:Key", error.Message);
        Assert.DoesNotContain(new string('a', 31), error.Message);

        await using var host = await PlatformHost.StartAsync(new string('a', 32), MapEcho);
    }

    [Fact]
    public void Without_the_edge_middleware_the_client_ip_is_never_taken_from_a_header()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Client-IP"] = "198.51.100.7";
        context.Request.Headers["X-Edge-Key"] = Key;

        Assert.Equal(System.Net.IPAddress.None, context.GetClientIp());
    }
}
