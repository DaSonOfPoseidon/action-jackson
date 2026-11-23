using ActionJackson.Edge.Routing;
using ActionJackson.Edge.Sites;

namespace ActionJackson.Edge.Tests;

public class RedirectRulesTests
{
    private static readonly SiteRegistry Registry = SiteRegistry.LoadEmbedded();
    private static readonly HostResolver Resolver = new(Registry);
    private static readonly RedirectRules Rules = new(Registry, "https");

    private static string? Redirect(string? host, string path, string query = "", string scheme = "https")
    {
        var rules = scheme == "https" ? Rules : new RedirectRules(Registry, scheme);
        return rules.Resolve(Resolver.Resolve(host), path, query);
    }

    [Theory]
    [InlineData("www.actionjacksoninstalls.com", "/", "", "https://actionjacksoninstalls.com/")]
    [InlineData("www.actionjacksoninstalls.com", "/about", "?a=1", "https://actionjacksoninstalls.com/about?a=1")]
    // One hop: www and a legacy prefix together go straight to lan.
    [InlineData("www.actionjacksoninstalls.com", "/services/cameras", "?a=1&b=%20", "https://lan.actionjacksoninstalls.com/services/cameras?a=1&b=%20")]
    [InlineData("actionjacksoninstalls.com", "/services", "", "https://lan.actionjacksoninstalls.com/services")]
    [InlineData("actionjacksoninstalls.com", "/services/", "", "https://lan.actionjacksoninstalls.com/services/")]
    [InlineData("actionjacksoninstalls.com", "/get-started/x", "?y=1", "https://lan.actionjacksoninstalls.com/get-started/x?y=1")]
    [InlineData("actionjacksoninstalls.com", "/admin/quotes", "", "https://admin.actionjacksoninstalls.com/admin/quotes")]
    [InlineData("ACTIONJACKSONINSTALLS.COM.", "/services", "", "https://lan.actionjacksoninstalls.com/services")]
    // The localhost family keeps its own family and the explicit port.
    [InlineData("www.localhost:4200", "/get-started", "", "https://lan.localhost:4200/get-started")]
    [InlineData("localhost:4200", "/admin", "", "https://admin.localhost:4200/admin")]
    [InlineData("www.localhost", "/", "", "https://localhost/")]
    // A port is kept as given by the request's Host, and only then.
    [InlineData("www.actionjacksoninstalls.com:8443", "/", "", "https://actionjacksoninstalls.com:8443/")]
    public void A_legacy_or_www_request_gets_one_redirect(string host, string path, string query, string location)
    {
        Assert.Equal(location, Redirect(host, path, query));
    }

    [Theory]
    [InlineData("actionjacksoninstalls.com", "/")]
    [InlineData("actionjacksoninstalls.com", "/about")]
    [InlineData("actionjacksoninstalls.com", "/servicesx")]
    [InlineData("actionjacksoninstalls.com", "/Services")]
    [InlineData("actionjacksoninstalls.com", "/Services/cameras")]
    [InlineData("actionjacksoninstalls.com", "/get-startedx")]
    [InlineData("actionjacksoninstalls.com", "/x/services")]
    [InlineData("actionjacksoninstalls.com", "/api/services")]
    [InlineData("actionjacksoninstalls.com", "/api")]
    [InlineData("actionjacksoninstalls.com", "/healthz")]
    [InlineData("lan.actionjacksoninstalls.com", "/services")]
    [InlineData("lan.actionjacksoninstalls.com", "/admin")]
    [InlineData("dev.actionjacksoninstalls.com", "/services")]
    [InlineData("admin.actionjacksoninstalls.com", "/admin")]
    public void These_are_not_redirected(string host, string path)
    {
        Assert.Null(Redirect(host, path));
    }

    [Theory]
    [InlineData("www.actionjacksoninstalls.com", "/api/lan/quotes")]
    [InlineData("www.actionjacksoninstalls.com", "/api")]
    [InlineData("www.actionjacksoninstalls.com", "/healthz")]
    [InlineData("www.localhost:4200", "/api/x")]
    public void The_api_and_the_health_check_are_never_redirected_even_on_www(string host, string path)
    {
        Assert.Null(Redirect(host, path));
    }

    [Theory]
    [InlineData("www.actionjacksoninstalls.com/api")]
    [InlineData("www.actionjacksoninstalls.com/api/")]
    public void Api_paths_are_recognised_by_whole_segment(string hostAndPath)
    {
        var slash = hostAndPath.IndexOf('/');
        Assert.Null(Redirect(hostAndPath[..slash], hostAndPath[slash..]));
    }

    [Fact]
    public void A_path_that_only_starts_like_api_is_still_redirected_on_www()
    {
        Assert.Equal("https://actionjacksoninstalls.com/apix", Redirect("www.actionjacksoninstalls.com", "/apix"));
        Assert.Equal("https://actionjacksoninstalls.com/healthz/x", Redirect("www.actionjacksoninstalls.com", "/healthz/x"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("192.168.1.69:8180")]
    [InlineData("unknown.example")]
    [InlineData("lan.actionjacksoninstalls.com.evil.com")]
    [InlineData("a@b")]
    [InlineData("actionjacksoninstalls.com@evil.com")]
    [InlineData("www.actionjacksoninstalls.com@evil.com")]
    [InlineData("www.actionjacksoninstalls.com\r\nX: y")]
    public void An_unknown_host_is_served_as_main_and_never_redirected(string? host)
    {
        Assert.Null(Redirect(host, "/services/cameras", "?a=1"));
        Assert.Null(Redirect(host, "/admin"));
        Assert.Null(Redirect(host, "/"));
    }

    [Fact]
    public void The_scheme_comes_from_the_setting()
    {
        Assert.Equal(
            "http://lan.localhost:4200/services",
            Redirect("localhost:4200", "/services", scheme: "http"));
    }

    [Fact]
    public void The_query_string_is_kept_byte_for_byte()
    {
        Assert.Equal(
            "https://lan.actionjacksoninstalls.com/services?a=%2F%2f&b=%E2%82%AC&c&&d=;x",
            Redirect("actionjacksoninstalls.com", "/services", "?a=%2F%2f&b=%E2%82%AC&c&&d=;x"));
    }

    [Fact]
    public void An_empty_query_adds_no_question_mark()
    {
        Assert.Equal("https://lan.actionjacksoninstalls.com/services", Redirect("actionjacksoninstalls.com", "/services", ""));
    }
}
