using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace ActionJackson.Edge.Tests;

public class ProxyTests
{
    private const string Lan = "lan.actionjacksoninstalls.com";

    private static async Task<(EdgeHost Host, FakeApi Api)> StartAsync(
        Func<HttpContext, Task>? handler = null,
        IDictionary<string, string?>? settings = null)
    {
        var api = await FakeApi.StartAsync(handler);
        var host = await EdgeHost.StartAsync(new WebRoot().WithSites("main", "lan"), api.Url, settings);
        return (host, api);
    }

    [Fact]
    public async Task Inbound_edge_headers_are_replaced_by_the_configured_key_and_the_remote_address()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;
        var request = host.Request(HttpMethod.Get, "/api/lan/quotes/pricing", Lan, remote: "203.0.113.9");
        request.Headers.TryAddWithoutValidation("X-Edge-Key", "forged");
        request.Headers.TryAddWithoutValidation("X-Client-IP", "1.2.3.4");
        request.Headers.TryAddWithoutValidation("X-Forwarded-For", "5.6.7.8");
        request.Headers.TryAddWithoutValidation("X-Forwarded-Proto", "http");
        request.Headers.TryAddWithoutValidation("X-Forwarded-Host", "evil.example");
        request.Headers.TryAddWithoutValidation("X-Forwarded-Prefix", "/x");
        request.Headers.TryAddWithoutValidation("Forwarded", "for=9.9.9.9");
        request.Headers.TryAddWithoutValidation("CF-Connecting-IP", "198.51.100.7");

        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var seen = api.Last;
        Assert.Equal(host.Key, seen.Header("X-Edge-Key"));
        Assert.Single(seen.Headers["X-Edge-Key"]);
        Assert.Equal("203.0.113.9", seen.Header("X-Client-IP"));
        Assert.Single(seen.Headers["X-Client-IP"]);
        Assert.False(seen.Has("X-Forwarded-For"));
        Assert.False(seen.Has("X-Forwarded-Proto"));
        Assert.False(seen.Has("X-Forwarded-Host"));
        Assert.False(seen.Has("X-Forwarded-Prefix"));
        Assert.False(seen.Has("Forwarded"));
        Assert.False(seen.Has("CF-Connecting-IP"));
    }

    [Fact]
    public async Task The_edge_adds_no_forwarded_headers_of_its_own()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        await host.GetAsync("/api/lan/x", Lan);

        Assert.DoesNotContain(api.Last.Headers.Keys, name => name.StartsWith("X-Forwarded", StringComparison.OrdinalIgnoreCase));
        Assert.False(api.Last.Has("Forwarded"));
    }

    [Fact]
    public async Task The_test_only_headers_never_reach_the_api()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        await host.GetAsync("/api/lan/x", Lan, localPort: EdgeHost.LanPort);

        Assert.False(api.Last.Has(EdgeHost.RemoteHeader));
        Assert.False(api.Last.Has(EdgeHost.LocalPortHeader));
    }

    [Fact]
    public async Task On_the_lan_port_cf_connecting_ip_is_ignored()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;
        var request = host.Request(HttpMethod.Get, "/api/lan/x", Lan, remote: "203.0.113.9", localPort: EdgeHost.LanPort);
        request.Headers.TryAddWithoutValidation("CF-Connecting-IP", "198.51.100.7");

        await host.Client.SendAsync(request);

        Assert.Equal("203.0.113.9", api.Last.Header("X-Client-IP"));
    }

    [Fact]
    public async Task On_the_tunnel_port_one_valid_cf_connecting_ip_is_the_client()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;
        var request = host.Request(HttpMethod.Get, "/api/lan/x", Lan, remote: "172.18.0.1", localPort: EdgeHost.TunnelPort);
        request.Headers.TryAddWithoutValidation("CF-Connecting-IP", "198.51.100.7");

        await host.Client.SendAsync(request);

        Assert.Equal("198.51.100.7", api.Last.Header("X-Client-IP"));
        Assert.False(api.Last.Has("CF-Connecting-IP"));
    }

    [Theory]
    [InlineData("198.51.100.7:80")]
    [InlineData("[2001:db8::1]")]
    [InlineData("fe80::1%eth0")]
    [InlineData("garbage")]
    [InlineData("198.51.100.7, 198.51.100.8")]
    public async Task On_the_tunnel_port_anything_but_one_bare_address_falls_back_to_the_remote_address(string value)
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;
        var request = host.Request(HttpMethod.Get, "/api/lan/x", Lan, remote: "172.18.0.1", localPort: EdgeHost.TunnelPort);
        request.Headers.TryAddWithoutValidation("CF-Connecting-IP", value);

        await host.Client.SendAsync(request);

        Assert.Equal("172.18.0.1", api.Last.Header("X-Client-IP"));
    }

    [Fact]
    public async Task Two_cf_connecting_ip_headers_fall_back_to_the_remote_address()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;
        var request = host.Request(HttpMethod.Get, "/api/lan/x", Lan, remote: "172.18.0.1", localPort: EdgeHost.TunnelPort);
        request.Headers.TryAddWithoutValidation("CF-Connecting-IP", ["198.51.100.7", "198.51.100.8"]);

        await host.Client.SendAsync(request);

        Assert.Equal("172.18.0.1", api.Last.Header("X-Client-IP"));
    }

    [Fact]
    public async Task An_ipv4_mapped_address_is_sent_as_ipv4()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        await host.GetAsync("/api/lan/x", Lan, remote: "::ffff:203.0.113.5");

        Assert.Equal("203.0.113.5", api.Last.Header("X-Client-IP"));
    }

    [Fact]
    public async Task The_path_and_query_are_unchanged()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        var response = await host.GetAsync("/api/lan/availability?from=2026-11-24&to=2026-11-25&kind=survey", Lan);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("/api/lan/availability", api.Last.Path);
        Assert.Equal("?from=2026-11-24&to=2026-11-25&kind=survey", api.Last.Query);
    }

    [Theory]
    [InlineData("/api")]
    [InlineData("/api/")]
    [InlineData("/api/lan/quotes/pricing")]
    [InlineData("/API/lan/quotes")]
    public async Task The_api_route_matches_with_and_without_a_trailing_slash(string path)
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        var response = await host.GetAsync(path, Lan);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(path, api.Last.Path);
    }

    [Fact]
    public async Task A_path_that_only_starts_like_api_is_not_proxied()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        var response = await host.GetAsync("/apix", Lan);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(api.Requests);
    }

    [Theory]
    [InlineData("www.actionjacksoninstalls.com")]
    [InlineData("actionjacksoninstalls.com")]
    [InlineData("unknown.example")]
    [InlineData("admin.localhost:4200")]
    public async Task The_api_is_proxied_on_every_host_and_never_redirected(string hostName)
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        var response = await host.GetAsync("/api/lan/x", hostName);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("/api/lan/x", api.Last.Path);
    }

    [Fact]
    public async Task The_upstream_host_is_the_apis_not_the_original()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        await host.GetAsync("/api/lan/x", Lan);

        Assert.Equal(new Uri(api.Url).Authority, api.Last.Host);
    }

    [Fact]
    public async Task A_post_body_and_headers_reach_the_api()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;
        var request = host.Request(HttpMethod.Post, "/api/lan/consultations", Lan);
        request.Content = new StringContent("{\"name\":\"A\"}", Encoding.UTF8, "application/json");
        request.Headers.Add("Idempotency-Key", "abc-123");
        request.Headers.Add("Cookie", "a=b");

        var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("POST", api.Last.Method);
        Assert.Equal("{\"name\":\"A\"}", api.Last.Body);
        Assert.Equal("abc-123", api.Last.Header("Idempotency-Key"));
        Assert.Equal("a=b", api.Last.Header("Cookie"));
        Assert.StartsWith("application/json", api.Last.Header("Content-Type"));
    }

    [Fact]
    public async Task Upstream_status_body_and_headers_pass_through_a_409_problem_stays_a_409_problem()
    {
        var (host, api) = await StartAsync(async context =>
        {
            context.Response.StatusCode = 409;
            context.Response.ContentType = "application/problem+json";
            context.Response.Headers["X-Api-Header"] = "kept";
            context.Response.Headers["Retry-After"] = "5";
            await context.Response.WriteAsync("{\"title\":\"Slot taken\",\"status\":409}");
        });
        await using var _ = host;
        await using var __ = api;

        var response = await host.GetAsync("/api/lan/appointments", Lan);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("{\"title\":\"Slot taken\",\"status\":409}", await response.Content.ReadAsStringAsync());
        Assert.Equal("kept", Assert.Single(response.Headers.GetValues("X-Api-Header")));
        Assert.Equal("5", Assert.Single(response.Headers.GetValues("Retry-After")));
    }

    [Fact]
    public async Task Other_upstream_statuses_pass_through_untouched()
    {
        foreach (var status in new[] { 201, 204, 400, 404, 422, 429, 500, 503 })
        {
            var (host, api) = await StartAsync(context =>
            {
                context.Response.StatusCode = status;
                return Task.CompletedTask;
            });
            await using var _ = host;
            await using var __ = api;

            var response = await host.GetAsync("/api/lan/x", Lan);

            Assert.Equal(status, (int)response.StatusCode);
        }
    }

    [Fact]
    public async Task The_security_headers_are_added_to_a_proxied_response_unless_the_api_sent_them()
    {
        var (host, api) = await StartAsync(context =>
        {
            context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
            context.Response.Headers["Referrer-Policy"] = "no-referrer";
            return Task.CompletedTask;
        });
        await using var _ = host;
        await using var __ = api;

        var response = await host.GetAsync("/api/lan/x", Lan);

        Assert.Equal("SAMEORIGIN", Assert.Single(response.Headers.GetValues("X-Frame-Options")));
        Assert.Equal("no-referrer", Assert.Single(response.Headers.GetValues("Referrer-Policy")));
        Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
        Assert.Equal("camera=(), microphone=(), geolocation=()", Assert.Single(response.Headers.GetValues("Permissions-Policy")));
    }

    [Fact]
    public async Task A_proxied_response_with_its_own_csp_keeps_it_and_one_without_gets_the_edges()
    {
        var (host, api) = await StartAsync(context =>
        {
            if (context.Request.Path.Value!.EndsWith("/own", StringComparison.Ordinal))
            {
                context.Response.Headers["Content-Security-Policy"] = "default-src 'none'";
            }

            return Task.CompletedTask;
        });
        await using var _ = host;
        await using var __ = api;

        var own = await host.GetAsync("/api/lan/own", Lan);
        var plain = await host.GetAsync("/api/lan/plain", Lan);

        Assert.Equal("default-src 'none'", Assert.Single(own.Headers.GetValues("Content-Security-Policy")));
        Assert.Equal(HealthAndHeadersTests.ContentSecurityPolicy, Assert.Single(plain.Headers.GetValues("Content-Security-Policy")));
    }

    [Fact]
    public async Task A_proxied_response_has_all_five_security_headers()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;

        var response = await host.GetAsync("/api/lan/x", Lan);

        foreach (var name in new[] { "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy" })
        {
            Assert.True(response.Headers.Contains(name), name);
        }
    }

    [Fact]
    public async Task An_api_that_is_down_is_a_503_problem_with_retry_after_within_about_three_seconds()
    {
        await using var host = await EdgeHost.StartAsync(new WebRoot().WithSites("main", "lan"), FakeApi.ClosedUrl());
        var clock = Stopwatch.StartNew();

        var response = await host.GetAsync("/api/lan/quotes/pricing", Lan);

        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(4), $"took {clock.Elapsed}");
        await AssertOfflineAsync(response);
    }

    [Fact]
    public async Task A_slow_api_past_the_activity_timeout_is_a_503_problem()
    {
        var (host, api) = await StartAsync(
            async context =>
            {
                await Task.Delay(TimeSpan.FromSeconds(5), context.RequestAborted);
            },
            new Dictionary<string, string?> { ["Edge:ApiActivityTimeout"] = "00:00:00.4" });
        await using var _ = host;
        await using var __ = api;
        var clock = Stopwatch.StartNew();

        var response = await host.GetAsync("/api/lan/x", Lan);

        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(4), $"took {clock.Elapsed}");
        await AssertOfflineAsync(response);
    }

    [Fact]
    public async Task The_503_has_the_security_headers_and_never_names_the_upstream()
    {
        var closed = FakeApi.ClosedUrl();
        await using var host = await EdgeHost.StartAsync(new WebRoot().WithSites("main"), closed);

        var response = await host.GetAsync("/api/lan/x", Lan);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
        Assert.DoesNotContain(closed, body);
        Assert.DoesNotContain("127.0.0.1", body);
        Assert.DoesNotContain("Exception", body);
    }

    [Fact]
    public async Task The_edge_key_is_never_logged()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;
        await using var down = await EdgeHost.StartAsync(new WebRoot().WithSites("main"), FakeApi.ClosedUrl());

        await host.GetAsync("/api/lan/x", Lan);
        await host.GetAsync("/", Lan);
        await down.GetAsync("/api/lan/x", Lan);

        Assert.DoesNotContain(host.Logs.Lines, line => line.Message.Contains(host.Key));
        Assert.DoesNotContain(down.Logs.Lines, line => line.Message.Contains(down.Key));
    }

    [Fact]
    public async Task The_client_ip_is_not_logged_above_debug()
    {
        var (host, api) = await StartAsync();
        await using var _ = host;
        await using var __ = api;
        var request = host.Request(HttpMethod.Get, "/api/lan/x", Lan, remote: "203.0.113.77", localPort: EdgeHost.TunnelPort);
        request.Headers.TryAddWithoutValidation("CF-Connecting-IP", "198.51.100.77");

        await host.Client.SendAsync(request);

        Assert.DoesNotContain(
            host.Logs.Lines,
            line => line.Level > Microsoft.Extensions.Logging.LogLevel.Debug
                && (line.Message.Contains("203.0.113.77") || line.Message.Contains("198.51.100.77")));
    }

    [Fact]
    public async Task A_client_that_gives_up_is_not_an_error_page_or_a_crash()
    {
        var (host, api) = await StartAsync(async context =>
        {
            await Task.Delay(TimeSpan.FromSeconds(5), context.RequestAborted);
        });
        await using var _ = host;
        await using var __ = api;
        using var cancel = new CancellationTokenSource(TimeSpan.FromMilliseconds(200));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => host.Client.SendAsync(host.Request(HttpMethod.Get, "/api/lan/x", Lan), cancel.Token));

        // The edge is still serving.
        Assert.Equal(HttpStatusCode.OK, (await host.GetAsync("/healthz")).StatusCode);
    }

    private static async Task AssertOfflineAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("30", Assert.Single(response.Headers.GetValues("Retry-After")));
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Service unavailable", problem.GetProperty("title").GetString());
        Assert.Equal(503, problem.GetProperty("status").GetInt32());
        Assert.Equal("The service is offline right now. Please try again later.", problem.GetProperty("detail").GetString());
    }
}
