using System.Net;
using System.Text.Json;

namespace ActionJackson.Edge.Tests;

public class HealthAndHeadersTests
{
    // The edge's header policy. It has no default-src and no script-src: a built page carries its own script-src
    // (a <meta> with the hashes of its inline scripts, added by apps/web/scripts/csp.mjs), and both policies are
    // enforced, so this one must not restrict scripts.
    internal const string ContentSecurityPolicy =
        "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'";

    private static readonly (string Name, string Value)[] SecurityHeaders =
    [
        ("X-Content-Type-Options", "nosniff"),
        ("X-Frame-Options", "DENY"),
        ("Referrer-Policy", "strict-origin-when-cross-origin"),
        ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
        ("Content-Security-Policy", ContentSecurityPolicy),
    ];

    private static void AssertSecurityHeaders(HttpResponseMessage response)
    {
        foreach (var (name, value) in SecurityHeaders)
        {
            Assert.True(response.Headers.TryGetValues(name, out var values), $"{name} is missing");
            Assert.Equal(value, Assert.Single(values));
        }
    }

    [Theory]
    [InlineData("actionjacksoninstalls.com")]
    [InlineData("lan.actionjacksoninstalls.com")]
    [InlineData("www.actionjacksoninstalls.com")]
    [InlineData("admin.localhost:4200")]
    [InlineData("192.168.1.69:8180")]
    [InlineData("unknown.example")]
    public async Task Healthz_answers_200_on_every_host_and_is_never_redirected(string hostName)
    {
        await using var host = await EdgeHost.StartAsync();

        var response = await host.GetAsync("/healthz", hostName);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("ok", json.RootElement.GetProperty("status").GetString());
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Healthz_works_with_the_api_down_and_with_no_web_root()
    {
        // ApiUrl points at a closed port and the web root is empty: the edge answers for itself.
        using var root = new WebRoot();
        await using var host = await EdgeHost.StartAsync(root, apiUrl: "http://127.0.0.1:1");

        var response = await host.GetAsync("/healthz");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Healthz_head_has_no_body_and_other_methods_get_405()
    {
        await using var host = await EdgeHost.StartAsync();

        var head = await host.Client.SendAsync(host.Request(HttpMethod.Head, "/healthz"));
        var post = await host.Client.SendAsync(host.Request(HttpMethod.Post, "/healthz"));

        Assert.Equal(HttpStatusCode.OK, head.StatusCode);
        Assert.Empty(await head.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.MethodNotAllowed, post.StatusCode);
    }

    [Fact]
    public async Task The_csp_header_restricts_nothing_about_scripts_and_is_sent_once()
    {
        using var root = new WebRoot().WithSites("main");
        await using var host = await EdgeHost.StartAsync(root);

        var response = await host.GetAsync("/");

        var policy = Assert.Single(response.Headers.GetValues("Content-Security-Policy"));
        Assert.DoesNotContain("script-src", policy);
        Assert.DoesNotContain("default-src", policy);
        Assert.DoesNotContain("unsafe-eval", policy);
    }

    [Fact]
    public async Task A_file_response_has_the_security_headers()
    {
        using var root = new WebRoot().WithSites("main");
        await using var host = await EdgeHost.StartAsync(root);

        AssertSecurityHeaders(await host.GetAsync("/"));
    }

    [Fact]
    public async Task A_redirect_has_the_security_headers()
    {
        await using var host = await EdgeHost.StartAsync();

        var response = await host.GetAsync("/x", "www.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.MovedPermanently, response.StatusCode);
        AssertSecurityHeaders(response);
    }

    [Fact]
    public async Task A_404_and_a_405_have_the_security_headers()
    {
        await using var host = await EdgeHost.StartAsync();

        AssertSecurityHeaders(await host.GetAsync("/missing"));
        AssertSecurityHeaders(await host.Client.SendAsync(host.Request(HttpMethod.Put, "/")));
        AssertSecurityHeaders(await host.GetAsync("/healthz"));
    }
}
