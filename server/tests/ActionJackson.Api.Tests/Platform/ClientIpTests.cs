using System.Net;
using ActionJackson.Api.Platform;

namespace ActionJackson.Api.Tests.Platform;

public class ClientIpTests
{
    [Theory]
    [InlineData("10.0.0.1", "10.0.0.1")]
    [InlineData("::ffff:10.0.0.1", "10.0.0.1")]
    [InlineData("2001:db8:1:2:aaaa::1", "2001:db8:1:2::")]
    [InlineData("2001:db8:1:2:bbbb::2", "2001:db8:1:2::")]
    [InlineData("2001:db8:1:3::1", "2001:db8:1:3::")]
    [InlineData("::1", "::")]
    public void The_partition_key_is_the_normalised_address(string address, string expected)
    {
        Assert.Equal(expected, ClientIp.PartitionKey(IPAddress.Parse(address)));
    }

    [Fact]
    public void A_mapped_address_and_its_ipv4_form_share_a_bucket()
    {
        Assert.Equal(
            ClientIp.PartitionKey(IPAddress.Parse("::ffff:1.2.3.4")),
            ClientIp.PartitionKey(IPAddress.Parse("1.2.3.4")));
    }

    [Fact]
    public void Addresses_in_one_slash_64_share_a_bucket_and_other_slash_64s_do_not()
    {
        var a = ClientIp.PartitionKey(IPAddress.Parse("2001:db8:1:2:aaaa::1"));
        var b = ClientIp.PartitionKey(IPAddress.Parse("2001:db8:1:2:bbbb::2"));
        var other = ClientIp.PartitionKey(IPAddress.Parse("2001:db8:1:3::1"));

        Assert.Equal(a, b);
        Assert.NotEqual(a, other);
    }

    [Fact]
    public void A_scope_id_does_not_split_a_bucket()
    {
        var scoped = IPAddress.Parse("fe80::1%3");

        Assert.Equal(ClientIp.PartitionKey(IPAddress.Parse("fe80::2")), ClientIp.PartitionKey(scoped));
    }

    [Theory]
    [InlineData("1.2.3.4", true)]
    [InlineData("2001:db8::1", true)]
    [InlineData("::ffff:1.2.3.4", true)]
    [InlineData("", false)]
    [InlineData("1.2.3.4, 5.6.7.8", false)]
    [InlineData("1.2.3.4:80", false)]
    [InlineData("[2001:db8::1]:80", false)]
    [InlineData("not-an-ip", false)]
    [InlineData(" 1.2.3.4", false)]
    [InlineData("1.2.3.4 ", false)]
    [InlineData("1", false)]
    [InlineData("1.2.3", false)]
    [InlineData("fe80::1%eth0", false)]
    [InlineData("0x7f.0.0.1", false)]
    public void Only_a_bare_address_parses(string value, bool valid)
    {
        Assert.Equal(valid, ClientIp.TryParseBare(value, out _));
    }
}
