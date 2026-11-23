using ActionJackson.Core;
using ActionJackson.Edge.Sites;

namespace ActionJackson.Edge.Tests;

public class SiteRegistryTests
{
    // A small valid registry; each validation test breaks one thing in it.
    private const string Valid = """
        {
          "fallback": "main",
          "sites": [
            { "key": "main", "hosts": ["actionjacksoninstalls.com", "localhost"] },
            { "key": "lan", "hosts": ["lan.actionjacksoninstalls.com", "lan.localhost"] },
            { "key": "admin", "hosts": ["admin.actionjacksoninstalls.com", "admin.localhost"], "spa": true }
          ],
          "hostRedirects": [
            { "from": "www.actionjacksoninstalls.com", "to": "actionjacksoninstalls.com" }
          ],
          "pathRedirects": [
            { "site": "main", "prefixes": ["/services", "/get-started"], "to": "lan" }
          ]
        }
        """;

    private static string With(string from, string to)
    {
        Assert.Contains(from, Valid);
        return Valid.Replace(from, to);
    }

    [Fact]
    public void A_valid_registry_parses()
    {
        var registry = SiteRegistry.Parse(Valid);

        Assert.Equal("main", registry.Fallback.Key);
        Assert.Equal(["main", "lan", "admin"], registry.Sites.Select(s => s.Key));
        Assert.True(registry.Get("admin").Spa);
        Assert.False(registry.Get("lan").Spa);
        Assert.Equal("lan", registry.FindByHost("lan.localhost")!.Key);
        Assert.Null(registry.FindByHost("www.actionjacksoninstalls.com"));
        Assert.Equal("/get-started", registry.PathRedirects[0].Prefixes[1]);
    }

    [Fact]
    public void The_embedded_registry_loads_and_names_every_data_site()
    {
        var registry = SiteRegistry.LoadEmbedded();

        // Each Site schema (main, lan, car, dev) has a site of that key; admin is no data site.
        foreach (var site in Enum.GetValues<Site>())
        {
            Assert.NotNull(registry.Sites.SingleOrDefault(s => s.Key == site.Schema()));
        }

        Assert.Equal("main", registry.Fallback.Key);
        Assert.True(registry.Get("admin").Spa);
    }

    [Theory]
    [InlineData("actionjacksoninstalls.com", "main")]
    [InlineData("localhost", "main")]
    [InlineData("lan.actionjacksoninstalls.com", "lan")]
    [InlineData("car.localhost", "car")]
    [InlineData("dev.actionjacksoninstalls.com", "dev")]
    [InlineData("admin.localhost", "admin")]
    public void The_embedded_registry_has_the_sites_of_the_design(string host, string key)
    {
        Assert.Equal(key, SiteRegistry.LoadEmbedded().FindByHost(host)!.Key);
    }

    [Theory]
    [MemberData(nameof(Broken))]
    public void A_broken_registry_is_refused(string json, string problem)
    {
        var failure = Assert.Throws<SiteRegistryException>(() => SiteRegistry.Parse(json));

        Assert.Contains(problem, failure.Message);
    }

    public static TheoryData<string, string> Broken() => new()
    {
        { "not json", "not valid JSON" },
        { "{}", "fallback" },
        { With("\"fallback\": \"main\"", "\"fallback\": \"nowhere\""), "fallback \"nowhere\" names no site" },
        { With("\"hosts\": [\"lan.actionjacksoninstalls.com\", \"lan.localhost\"]", "\"hosts\": [\"lan.actionjacksoninstalls.com\", \"actionjacksoninstalls.com\"]"), "duplicate host \"actionjacksoninstalls.com\"" },
        { With("\"lan.actionjacksoninstalls.com\"", "\"LAN.actionjacksoninstalls.com\""), "not lower-case" },
        { With("\"lan.actionjacksoninstalls.com\"", "\"lan.actionjacksoninstalls.com:8180\""), "not a plain host name" },
        { With("\"lan.actionjacksoninstalls.com\"", "\"lan.actionjacksoninstalls.com.\""), "not a plain host name" },
        { With("\"key\": \"lan\"", "\"key\": \"main\""), "duplicate site key \"main\"" },
        { With("\"key\": \"lan\"", "\"key\": \"../lan\""), "site key" },
        { With("\"key\": \"lan\"", "\"key\": \"Lan\""), "site key" },
        { With("\"hosts\": [\"admin.actionjacksoninstalls.com\", \"admin.localhost\"]", "\"hosts\": []"), "no hosts" },
        { With("\"to\": \"actionjacksoninstalls.com\"", "\"to\": \"nowhere.actionjacksoninstalls.com\""), "to \"nowhere.actionjacksoninstalls.com\" is not a site host" },
        { With("\"to\": \"actionjacksoninstalls.com\"", "\"to\": \"www.actionjacksoninstalls.com\""), "is not a site host" },
        { With("\"from\": \"www.actionjacksoninstalls.com\"", "\"from\": \"lan.actionjacksoninstalls.com\""), "is also a site host" },
        { With("\"from\": \"www.actionjacksoninstalls.com\"", "\"from\": \"WWW.actionjacksoninstalls.com\""), "not lower-case" },
        { With("\"to\": \"lan\"", "\"to\": \"nowhere\""), "to \"nowhere\" names no site" },
        { With("\"site\": \"main\"", "\"site\": \"nowhere\""), "site \"nowhere\" names no site" },
        { With("\"to\": \"lan\"", "\"to\": \"main\""), "redirects to itself" },
        { With("\"/services\"", "\"services\""), "must start with /" },
        { With("\"/services\"", "\"/services/\""), "must not end with /" },
        { With("\"/services\"", "\"/\""), "must not end with /" },
        { With("\"/services\"", "\"\""), "must start with /" },
        { With("\"/services\"", "\"/ser vices\""), "plain path" },
        { With("\"/services\"", "\"/services?x=1\""), "plain path" },
        { With("\"/services\"", "\"/api\""), "/api and /healthz are never redirected" },
        { With("\"/services\"", "\"/api/v2\""), "/api and /healthz are never redirected" },
        { With("\"/services\"", "\"/healthz\""), "/api and /healthz are never redirected" },
        { With("\"/services\"", "\"/get-started\""), "listed twice" },
        { With("\"prefixes\": [\"/services\", \"/get-started\"]", "\"prefixes\": []"), "no prefixes" },
        { With("\"spa\": true", "\"spaa\": true"), "not valid JSON" },
        { With("\"hosts\": [\"lan.actionjacksoninstalls.com\", \"lan.localhost\"]", "\"hosts\": [\"lan.actionjacksoninstalls.com\"]"), "has no .localhost host" },
        { With("\"hosts\": [\"lan.actionjacksoninstalls.com\", \"lan.localhost\"]", "\"hosts\": [\"lan.localhost\"]"), "has no actionjacksoninstalls.com host" },
    };

    [Fact]
    public void Every_problem_is_listed_not_just_the_first()
    {
        var json = With("\"fallback\": \"main\"", "\"fallback\": \"nowhere\"").Replace("\"lan.actionjacksoninstalls.com\"", "\"LAN.actionjacksoninstalls.com\"");

        var failure = Assert.Throws<SiteRegistryException>(() => SiteRegistry.Parse(json));

        Assert.Contains("nowhere", failure.Message);
        Assert.Contains("not lower-case", failure.Message);
    }
}
