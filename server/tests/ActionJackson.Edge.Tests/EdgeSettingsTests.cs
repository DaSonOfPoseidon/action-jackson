using ActionJackson.Edge.Platform;
using Microsoft.Extensions.Configuration;

namespace ActionJackson.Edge.Tests;

public class EdgeSettingsTests
{
    private static readonly string GoodKey = new('k', 32);

    private static IConfiguration Config(params (string Name, string? Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(v => v.Name, v => v.Value))
            .Build();

    private static EdgeSettings Load(string? key = null, string? apiUrl = "http://192.168.1.195:8110", params (string, string?)[] more)
    {
        var values = new List<(string, string?)> { ("Edge:Key", key ?? GoodKey), ("Edge:ApiUrl", apiUrl) };
        values.AddRange(more);
        return EdgeSettings.Load(Config([.. values]));
    }

    [Fact]
    public void A_valid_configuration_loads_with_the_defaults()
    {
        var settings = Load();

        Assert.Equal(GoodKey, settings.Key);
        Assert.Equal("http://192.168.1.195:8110", settings.ApiUrl);
        Assert.Equal("/app/sites", settings.WebRoot);
        Assert.Equal("https", settings.PublicScheme);
        Assert.Equal(8081, settings.TunnelPort);
        Assert.Equal(TimeSpan.FromSeconds(3), settings.ApiConnectTimeout);
        Assert.Equal(TimeSpan.FromSeconds(30), settings.ApiActivityTimeout);
    }

    [Fact]
    public void Everything_can_be_set()
    {
        var settings = Load(
            more:
            [
                ("Edge:WebRoot", "/srv/sites"),
                ("Edge:PublicScheme", "http"),
                ("Edge:TunnelPort", "9000"),
                ("Edge:ApiConnectTimeout", "00:00:01"),
                ("Edge:ApiActivityTimeout", "00:00:00.5"),
            ]);

        Assert.Equal("/srv/sites", settings.WebRoot);
        Assert.Equal("http", settings.PublicScheme);
        Assert.Equal(9000, settings.TunnelPort);
        Assert.Equal(TimeSpan.FromSeconds(1), settings.ApiConnectTimeout);
        Assert.Equal(TimeSpan.FromMilliseconds(500), settings.ApiActivityTimeout);
    }

    [Fact]
    public void A_trailing_slash_on_the_api_url_is_dropped()
    {
        Assert.Equal("http://192.168.1.195:8110", Load(apiUrl: "http://192.168.1.195:8110/").ApiUrl);
        Assert.Equal("https://api.example.com", Load(apiUrl: "https://api.example.com").ApiUrl);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("0123456789abcdef0123456789abcde")]
    public void A_missing_or_short_key_stops_startup(string? key)
    {
        var failure = Assert.Throws<InvalidOperationException>(() => EdgeSettings.Load(Config(("Edge:Key", key), ("Edge:ApiUrl", "http://a:1"))));

        Assert.Contains("Edge:Key", failure.Message);
    }

    [Fact]
    public void A_32_character_key_is_enough()
    {
        Assert.Equal(32, Load(key: "0123456789abcdef0123456789abcdef").Key.Length);
    }

    [Theory]
    [InlineData("0123456789abcdef0123456789abcdef x")]
    [InlineData("0123456789abcdef0123456789abcde\n")]
    [InlineData("0123456789abcdef0123456789abcdé!")]
    [InlineData(" 0123456789abcdef0123456789abcdef")]
    public void A_key_that_cannot_be_a_header_value_stops_startup(string key)
    {
        Assert.Throws<InvalidOperationException>(() => Load(key));
    }

    [Fact]
    public void The_key_is_never_in_an_error_message()
    {
        var secret = "s3cr3t-" + new string('x', 30);

        var failure = Assert.Throws<InvalidOperationException>(() => Load(secret, "not a url"));

        Assert.DoesNotContain(secret, failure.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("192.168.1.195:8110")]
    [InlineData("/relative/path")]
    [InlineData("api.example.com")]
    [InlineData("ftp://192.168.1.195")]
    [InlineData("http://user:pass@192.168.1.195:8110")]
    [InlineData("http://192.168.1.195:8110/path")]
    [InlineData("http://192.168.1.195:8110?x=1")]
    [InlineData("http://192.168.1.195:8110#frag")]
    public void A_missing_or_non_absolute_api_url_stops_startup(string? url)
    {
        var failure = Assert.Throws<InvalidOperationException>(() => Load(apiUrl: url));

        Assert.Contains("Edge:ApiUrl", failure.Message);
    }

    [Theory]
    [InlineData("Edge:PublicScheme", "ftp")]
    [InlineData("Edge:PublicScheme", "")]
    [InlineData("Edge:TunnelPort", "0")]
    [InlineData("Edge:TunnelPort", "70000")]
    [InlineData("Edge:TunnelPort", "abc")]
    [InlineData("Edge:ApiConnectTimeout", "00:00:00")]
    [InlineData("Edge:ApiConnectTimeout", "-00:00:01")]
    [InlineData("Edge:ApiActivityTimeout", "0")]
    [InlineData("Edge:WebRoot", "")]
    public void An_invalid_setting_stops_startup(string name, string value)
    {
        var failure = Assert.Throws<InvalidOperationException>(() => Load(more: [(name, value)]));

        Assert.Contains(name, failure.Message);
    }

    [Theory]
    [InlineData(null, null, 8080, 8081)]
    [InlineData("9000", "9001", 9000, 9001)]
    [InlineData("8080", null, 8080, 8081)]
    public void The_listen_ports_default_to_8080_and_8081(string? http, string? tunnel, int expectedHttp, int expectedTunnel)
    {
        var ports = EdgePorts.Parse(http, tunnel);

        Assert.Equal(expectedHttp, ports.Http);
        Assert.Equal(expectedTunnel, ports.Tunnel);
    }

    [Theory]
    [InlineData("8080", "8080")]
    [InlineData("0", "8081")]
    [InlineData("abc", "8081")]
    [InlineData("8080", "99999")]
    [InlineData("8080", "")]
    public void Bad_or_equal_listen_ports_stop_startup(string http, string tunnel)
    {
        Assert.Throws<InvalidOperationException>(() => EdgePorts.Parse(http, tunnel));
    }
}
