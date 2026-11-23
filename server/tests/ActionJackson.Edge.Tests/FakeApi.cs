using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ActionJackson.Edge.Tests;

// A real Kestrel server on 127.0.0.1 (a free port) that stands in for the PC's API. By default it answers 200 with
// a JSON echo of what it received; a test can replace the handler.
internal sealed class FakeApi : IAsyncDisposable
{
    private readonly WebApplication app;
    private readonly ConcurrentQueue<Received> requests = new();

    private FakeApi(WebApplication app, string url)
    {
        this.app = app;
        Url = url;
    }

    public string Url { get; }

    public IReadOnlyList<Received> Requests => [.. requests];

    public Received Last => requests.Last();

    public static async Task<FakeApi> StartAsync(Func<HttpContext, Task>? handler = null)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        var app = builder.Build();
        FakeApi? api = null;
        app.Run(async context =>
        {
            api!.requests.Enqueue(Received.From(context.Request));
            if (handler is not null)
            {
                await handler(context);
                return;
            }

            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(Received.From(context.Request)));
        });
        await app.StartAsync();
        var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        api = new FakeApi(app, address);
        return api;
    }

    // The URL of a port nothing listens on.
    public static string ClosedUrl()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return $"http://127.0.0.1:{port}";
    }

    public async ValueTask DisposeAsync()
    {
        await app.StopAsync();
        await app.DisposeAsync();
    }

    // What the API saw. Headers keeps every value of each name.
    public sealed record Received(string Method, string Path, string Query, string Host, Dictionary<string, string[]> Headers, string Body)
    {
        public string? Header(string name) => Headers.TryGetValue(name, out var values) ? string.Join(",", values) : null;

        public bool Has(string name) => Headers.ContainsKey(name);

        public static Received From(HttpRequest request)
        {
            var headers = request.Headers.ToDictionary(h => h.Key, h => h.Value.OfType<string>().ToArray(), StringComparer.OrdinalIgnoreCase);
            using var reader = new StreamReader(request.Body);
            return new Received(
                request.Method,
                request.Path.Value ?? "",
                request.QueryString.Value ?? "",
                request.Host.Value ?? "",
                headers,
                reader.ReadToEndAsync().GetAwaiter().GetResult());
        }
    }
}
