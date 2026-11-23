using System.Net;
using ActionJackson.Edge.Platform;
using Microsoft.Extensions.Primitives;
using ApiClientIp = ActionJackson.Api.Platform.ClientIp;
using ApiEdgeOptions = ActionJackson.Api.Platform.EdgeOptions;

namespace ActionJackson.Edge.Tests;

public class ClientIpTests
{
    // The table of the API's own ClientIpTests (Only_a_bare_address_parses), plus the cases this edge cares about.
    public static TheoryData<string, bool> BareTable() => new()
    {
        { "1.2.3.4", true },
        { "2001:db8::1", true },
        { "::ffff:1.2.3.4", true },
        { "198.51.100.7", true },
        { "::1", true },
        { "", false },
        { "1.2.3.4, 5.6.7.8", false },
        { "1.2.3.4:80", false },
        { "198.51.100.7:80", false },
        { "[2001:db8::1]:80", false },
        { "[2001:db8::1]", false },
        { "not-an-ip", false },
        { " 1.2.3.4", false },
        { "1.2.3.4 ", false },
        { "1", false },
        { "1.2.3", false },
        { "fe80::1%eth0", false },
        { "fe80::1%3", false },
        { "0x7f.0.0.1", false },
        { "1.2.3.4\r\nX-Evil: 1", false },
        { "1.2.3.4.5", false },
        { "::ffff:1.2.3.4:80", false },
    };

    [Theory]
    [MemberData(nameof(BareTable))]
    public void Only_a_bare_address_parses(string value, bool valid)
    {
        Assert.Equal(valid, ClientIp.TryParseBare(value, out _));
    }

    [Fact]
    public void Null_does_not_parse()
    {
        Assert.False(ClientIp.TryParseBare(null, out _));
    }

    [Theory]
    [MemberData(nameof(BareTable))]
    public void The_edge_and_the_api_agree_on_the_table(string value, bool _)
    {
        AssertSame(value);
    }

    [Fact]
    public void The_edge_and_the_api_agree_on_generated_text()
    {
        // The two parsers are copies. This feeds both the same few thousand strings built from the characters an
        // address, a port, a bracket or a scope id is made of, so a change to one that the other lacks fails here.
        var random = new Random(20261123);
        const string alphabet = "0123456789abcdefABCDEF.:%[] ,x-/\r\n\0é";
        for (var i = 0; i < 5000; i++)
        {
            var length = random.Next(0, 24);
            var text = new string(Enumerable.Range(0, length).Select(_ => alphabet[random.Next(alphabet.Length)]).ToArray());
            AssertSame(text);
        }

        // Plus mutations of valid addresses.
        string[] valid = ["1.2.3.4", "255.255.255.255", "2001:db8::1", "::", "::ffff:10.0.0.1", "fe80::1", "1:2:3:4:5:6:7:8"];
        foreach (var address in valid)
        {
            foreach (var suffix in new[] { "", " ", ":80", "%1", "]", "\n", "0", ".0", ":" })
            {
                AssertSame(address + suffix);
                AssertSame(suffix + address);
            }
        }
    }

    [Fact]
    public void The_header_names_and_key_length_match_the_apis()
    {
        Assert.Equal(ApiEdgeOptions.KeyHeader, EdgeHeaders.Key);
        Assert.Equal(ApiEdgeOptions.ClientIpHeader, EdgeHeaders.ClientIp);
        Assert.Equal(ApiEdgeOptions.MinKeyLength, EdgeHeaders.MinKeyLength);
    }

    private static void AssertSame(string text)
    {
        var edge = ClientIp.TryParseBare(text, out var edgeAddress);
        var api = ApiClientIp.TryParseBare(text, out var apiAddress);

        Assert.True(edge == api, $"the parsers disagree on {System.Text.Json.JsonSerializer.Serialize(text)}: edge {edge}, api {api}");
        Assert.Equal(apiAddress, edgeAddress);
    }

    // Tunnel listener 8081, LAN listener 8080. The listener is told by the connection's local port only.
    private const int Lan = 8080;
    private const int Tunnel = 8081;

    [Theory]
    // The LAN port never believes CF-Connecting-IP.
    [InlineData(Lan, "198.51.100.7", "203.0.113.9", "203.0.113.9")]
    [InlineData(Lan, "", "203.0.113.9", "203.0.113.9")]
    // The tunnel port uses one valid bare value.
    [InlineData(Tunnel, "198.51.100.7", "172.18.0.1", "198.51.100.7")]
    [InlineData(Tunnel, "2001:db8::1", "172.18.0.1", "2001:db8::1")]
    [InlineData(Tunnel, "::ffff:198.51.100.7", "172.18.0.1", "198.51.100.7")]
    // Anything else on the tunnel port falls back to the remote address.
    [InlineData(Tunnel, "198.51.100.7:80", "172.18.0.1", "172.18.0.1")]
    [InlineData(Tunnel, "[2001:db8::1]", "172.18.0.1", "172.18.0.1")]
    [InlineData(Tunnel, "fe80::1%eth0", "172.18.0.1", "172.18.0.1")]
    [InlineData(Tunnel, "garbage", "172.18.0.1", "172.18.0.1")]
    [InlineData(Tunnel, "", "172.18.0.1", "172.18.0.1")]
    [InlineData(Tunnel, "198.51.100.7, 203.0.113.1", "172.18.0.1", "172.18.0.1")]
    // An IPv4-mapped remote address is sent as IPv4.
    [InlineData(Lan, "", "::ffff:203.0.113.5", "203.0.113.5")]
    [InlineData(Tunnel, "", "::ffff:172.18.0.1", "172.18.0.1")]
    // No port but the tunnel's counts as the tunnel.
    [InlineData(9999, "198.51.100.7", "203.0.113.9", "203.0.113.9")]
    [InlineData(0, "198.51.100.7", "203.0.113.9", "203.0.113.9")]
    public void The_client_ip_follows_the_listener(int localPort, string cfHeader, string remote, string expected)
    {
        var values = cfHeader.Length == 0 ? StringValues.Empty : new StringValues(cfHeader);

        var address = ClientIpSource.Resolve(IPAddress.Parse(remote), localPort, Tunnel, values);

        Assert.Equal(expected, ClientIpSource.Format(address));
    }

    [Fact]
    public void Two_cf_connecting_ip_values_fall_back_to_the_remote_address()
    {
        var address = ClientIpSource.Resolve(IPAddress.Parse("172.18.0.1"), Tunnel, Tunnel, new StringValues(["198.51.100.7", "198.51.100.8"]));

        Assert.Equal("172.18.0.1", ClientIpSource.Format(address));
    }

    [Fact]
    public void A_scope_id_is_never_sent()
    {
        var scoped = IPAddress.Parse("fe80::1%3");

        var text = ClientIpSource.Format(scoped);

        Assert.Equal("fe80::1", text);
        Assert.True(ClientIp.TryParseBare(text, out _));
        Assert.True(ApiClientIp.TryParseBare(text, out _));
    }

    [Fact]
    public void A_missing_remote_address_is_sent_as_a_bare_address_the_api_accepts()
    {
        var address = ClientIpSource.Resolve(null, Lan, Tunnel, StringValues.Empty);

        Assert.True(ApiClientIp.TryParseBare(ClientIpSource.Format(address), out _));
    }

    [Theory]
    [InlineData("10.0.0.1")]
    [InlineData("::ffff:10.0.0.1")]
    [InlineData("2001:db8:1:2:aaaa::1")]
    [InlineData("fe80::1%3")]
    [InlineData("::")]
    public void Every_formatted_address_is_accepted_by_the_api_parser(string text)
    {
        Assert.True(ApiClientIp.TryParseBare(ClientIpSource.Format(IPAddress.Parse(text)), out _));
    }
}
