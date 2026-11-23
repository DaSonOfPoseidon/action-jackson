using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using ActionJackson.Api.Business;
using ActionJackson.Api.Platform;
using ActionJackson.Api.Tests.Platform;
using ActionJackson.Data.Tests;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace ActionJackson.Api.Tests.Business;

// The real Program against a test database, with a clock and a number source a test controls. Every
// request is sent as a trusted edge request with a client IP of its own, so one test's requests never
// share a rate-limit bucket with another's unless the test asks for it.
internal sealed class FormsHost : IDisposable
{
    public const string AdminAddress = "admin@example.com";

    private static int nextClient;

    private readonly WebApplicationFactory<Program> factory;
    private readonly string edgeKey = PlatformHost.NewKey();

    public FormsHost(TestDatabase database, Action<IServiceCollection>? configure = null)
    {
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:Postgres", database.ConnectionString);
            builder.UseSetting("Database:MigrateOnStartup", "false");
            builder.UseSetting("Edge:Key", edgeKey);
            builder.UseSetting("Email:AdminAddress", AdminAddress);
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<ILoggerProvider>(Logs);
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(Time);
                services.RemoveAll<IDocumentNumbers>();
                services.AddSingleton<IDocumentNumbers>(Numbers);
                configure?.Invoke(services);
            });
        });
        Client = factory.CreateClient();
    }

    public HttpClient Client { get; }

    public ManualTime Time { get; } = new(new DateTimeOffset(2026, 11, 23, 12, 0, 0, TimeSpan.Zero));

    public QueuedNumbers Numbers { get; } = new();

    public LogSink Logs { get; } = new();

    public IServiceProvider Services => factory.Services;

    // A client address nothing else in the run uses.
    public static string NewClient()
    {
        var n = Interlocked.Increment(ref nextClient);
        return $"198.51.{(n >> 8) & 0xFF}.{n & 0xFF}";
    }

    public Task<HttpResponseMessage> Get(string path, string? client = null) =>
        Client.SendAsync(Build(HttpMethod.Get, path, client));

    public Task<HttpResponseMessage> Post(string path, JsonNode? body, string? client = null, string? userAgent = null) =>
        PostText(path, body is null ? "null" : body.ToJsonString(), client, userAgent);

    public Task<HttpResponseMessage> PostText(
        string path,
        string text,
        string? client = null,
        string? userAgent = null,
        string contentType = "application/json")
    {
        var request = Build(HttpMethod.Post, path, client);
        request.Content = new StringContent(text, Encoding.UTF8);
        request.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(contentType);
        if (userAgent is not null)
        {
            request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        }

        return Client.SendAsync(request);
    }

    public static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());

    // The response is an RFC 9457 problem document with a trace id, and has the status.
    public static async Task<JsonElement> AssertProblem(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await Json(response);
        Assert.Equal((int)status, body.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("traceId").GetString()));
        return body;
    }

    public void Dispose()
    {
        Client.Dispose();
        factory.Dispose();
    }

    private HttpRequestMessage Build(HttpMethod method, string path, string? client)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.TryAddWithoutValidation(EdgeOptions.KeyHeader, edgeKey);
        request.Headers.TryAddWithoutValidation(EdgeOptions.ClientIpHeader, client ?? NewClient());
        return request;
    }
}

// A clock a test moves by hand. Only the wall clock is replaced.
internal sealed class ManualTime(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset now = start;

    public override DateTimeOffset GetUtcNow() => now;

    public void Advance(TimeSpan by) => now += by;
}

// Hands out the numbers a test queued first, then random ones.
internal sealed class QueuedNumbers : IDocumentNumbers
{
    private readonly Queue<string> queued = new();

    public void Enqueue(params string[] numbers)
    {
        foreach (var number in numbers)
        {
            queued.Enqueue(number);
        }
    }

    public string Next() => queued.Count > 0 ? queued.Dequeue() : ActionJackson.Data.UniqueNumber.RandomEightDigits();
}

// The request bodies of the tests: valid ones, which a test edits.
internal static class Forms
{
    public static string NewEmail() => $"user-{Guid.NewGuid():N}@example.com";

    public static JsonObject Consultation(string? email = null) => (JsonObject)JsonNode.Parse($$"""
        {
          "customer": { "name": "Jane O'Neil", "email": "{{email ?? NewEmail()}}", "phone": "(555) 123-4567" },
          "property": { "squareFootage": "1,500-2,500", "isp": "Cox", "currentIssues": ["Weak WiFi", "Dead zones"] },
          "interestedServices": ["networking", "cameras"],
          "interestedPackage": "foundation"
        }
        """)!;

    private const string Home = """
        { "liabilityAcknowledged": true, "homeAge": "1980-2000", "stories": 2, "atticAccess": "Walk-in attic",
          "hasMediaPanel": false, "mediaPanelLocation": "Garage", "hasCrawlspaceOrBasement": true,
          "address": { "street": "12 Main St", "city": "Springfield", "state": "il", "zip": "62704" } }
        """;

    // 2 cat6, 1 coax, 1 fiber, 1 AP mount, 2 ethernet relocations and a new media panel: 700, deposit 20.
    public static JsonObject DropsOnly(string? email = null) => (JsonObject)JsonNode.Parse($$"""
        {
          "customer": { "name": "Jane O'Neil", "email": "{{email ?? NewEmail()}}", "phone": "(555) 123-4567" },
          "kind": "drops-only",
          "runs": { "cat6": 2, "coax": 1, "fiber": 1 },
          "services": { "apMounts": 1, "ethernetRelocations": 2 },
          "centralization": "media-panel",
          "homeInfo": {{Home}}
        }
        """)!;

    public static JsonObject WholeHome(string? email = null) => (JsonObject)JsonNode.Parse($$"""
        {
          "customer": { "name": "Jane O'Neil", "email": "{{email ?? NewEmail()}}" },
          "kind": "whole-home",
          "homeInfo": {{Home}},
          "wholeHome": {
            "scope": { "networking": true, "security": true, "voip": false },
            "internetSpeed": "1 Gbps", "hasOwnEquipment": false,
            "networkingBrand": "UniFi", "securityBrand": "Reolink", "surveyPreference": "day-of",
            "networkingDetails": "Three floors", "securityDetails": "Four cameras", "notes": "Call first"
          }
        }
        """)!;

    public static JsonObject Calculate() => (JsonObject)JsonNode.Parse("""
        {
          "runs": { "cat6": 2, "coax": 1, "fiber": 1 },
          "services": { "apMounts": 1, "ethernetRelocations": 2 },
          "centralization": "media-panel"
        }
        """)!;
}
