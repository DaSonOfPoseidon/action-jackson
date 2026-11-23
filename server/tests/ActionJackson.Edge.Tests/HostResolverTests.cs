using ActionJackson.Edge.Routing;
using ActionJackson.Edge.Sites;

namespace ActionJackson.Edge.Tests;

public class HostResolverTests
{
    private static readonly HostResolver Resolver = new(SiteRegistry.LoadEmbedded());

    [Theory]
    [InlineData("actionjacksoninstalls.com", "main")]
    [InlineData("localhost", "main")]
    [InlineData("localhost:4200", "main")]
    [InlineData("lan.actionjacksoninstalls.com", "lan")]
    [InlineData("LAN.ActionJacksonInstalls.com", "lan")]
    [InlineData("lan.actionjacksoninstalls.com:443", "lan")]
    [InlineData("lan.actionjacksoninstalls.com.", "lan")]
    [InlineData("lan.actionjacksoninstalls.com.:8180", "lan")]
    [InlineData("dev.localhost:4200", "dev")]
    [InlineData("car.actionjacksoninstalls.com", "car")]
    [InlineData("admin.actionjacksoninstalls.com", "admin")]
    public void A_site_host_resolves_to_its_site(string host, string site)
    {
        var resolved = Resolver.Resolve(host);

        Assert.Equal(site, resolved.Site.Key);
        Assert.True(resolved.IsSiteHost);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("192.168.1.69")]
    [InlineData("192.168.1.69:8180")]
    [InlineData("[::1]:8180")]
    [InlineData("[::1]")]
    [InlineData("unknown.example")]
    [InlineData("evil-lan.actionjacksoninstalls.com")]
    [InlineData("lan.actionjacksoninstalls.com.evil.com")]
    [InlineData("xlan.actionjacksoninstalls.com")]
    [InlineData("lan.actionjacksoninstalls.com x")]
    [InlineData(" lan.actionjacksoninstalls.com")]
    [InlineData("lan.actionjacksoninstalls.com ")]
    [InlineData("a@b")]
    [InlineData("lan.actionjacksoninstalls.com@evil.com")]
    [InlineData("evil.com#@lan.actionjacksoninstalls.com")]
    [InlineData("lan.actionjacksoninstalls.com\r\nX-Injected: 1")]
    [InlineData("lan.actionjacksoninstalls.com:")]
    [InlineData("lan.actionjacksoninstalls.com:abc")]
    [InlineData("lan.actionjacksoninstalls.com:8180:8180")]
    [InlineData("lan.actionjacksoninstalls.com:99999")]
    [InlineData("lan.actionjacksoninstalls.com:0")]
    [InlineData("lan.actionjacksoninstalls.com..")]
    [InlineData("lan.actionjacksoninstalls.com:8180.")]
    [InlineData(".lan.actionjacksoninstalls.com")]
    [InlineData("*.actionjacksoninstalls.com")]
    public void Anything_else_falls_back_to_main(string? host)
    {
        var resolved = Resolver.Resolve(host);

        Assert.Equal("main", resolved.Site.Key);
        Assert.False(resolved.IsSiteHost);
    }

    [Fact]
    public void A_one_kilobyte_host_falls_back_to_main()
    {
        var resolved = Resolver.Resolve(new string('a', 1024) + ".actionjacksoninstalls.com");

        Assert.Equal("main", resolved.Site.Key);
        Assert.False(resolved.IsSiteHost);
        Assert.Null(resolved.Host);
    }

    [Fact]
    public void Only_ascii_case_folding_is_applied()
    {
        // U+212A (Kelvin sign) lower-cases to a plain k in some Unicode tables: "jacKson" must not match.
        var resolved = Resolver.Resolve("lan.actionjacKson" + "installs.com");

        Assert.False(resolved.IsSiteHost);
        Assert.Equal("main", resolved.Site.Key);
    }

    [Fact]
    public void The_resolved_host_is_normalised_and_keeps_an_explicit_port()
    {
        var resolved = Resolver.Resolve("DEV.Localhost.:4200");

        Assert.Equal("dev.localhost", resolved.Host);
        Assert.Equal(4200, resolved.Port);
    }

    [Fact]
    public void A_host_without_a_port_has_no_port()
    {
        Assert.Null(Resolver.Resolve("lan.actionjacksoninstalls.com").Port);
    }

    [Fact]
    public void A_host_redirect_source_is_kept_as_a_host_but_is_no_site_host()
    {
        var resolved = Resolver.Resolve("www.actionjacksoninstalls.com:8180");

        Assert.Equal("www.actionjacksoninstalls.com", resolved.Host);
        Assert.Equal(8180, resolved.Port);
        Assert.False(resolved.IsSiteHost);
        Assert.Equal("main", resolved.Site.Key);
    }
}
