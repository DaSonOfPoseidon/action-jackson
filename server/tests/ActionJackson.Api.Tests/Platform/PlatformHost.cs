using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ActionJackson.Api.Platform;

namespace ActionJackson.Api.Tests.Platform;

// A small TestServer host that runs the real platform pipeline (AddApiPlatform / UseApiPlatform) and
// whatever endpoints a test maps. The connection's remote address is set from the X-Test-Remote header
// (default 203.0.113.9), because TestServer has none.
internal sealed class PlatformHost : IAsyncDisposable
{
    public const string DefaultRemote = "203.0.113.9";
    public const string RemoteHeader = "X-Test-Remote";

    private readonly WebApplication app;

    private PlatformHost(WebApplication app, LogSink logs, string? edgeKey)
    {
        this.app = app;
        Logs = logs;
        EdgeKey = edgeKey;
        Client = app.GetTestClient();
    }

    public HttpClient Client { get; }

    public LogSink Logs { get; }

    public string? EdgeKey { get; }

    public IServiceProvider Services => app.Services;

    // A random key of the length the platform accepts. Tests never use a fixed secret.
    public static string NewKey() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    public static async Task<PlatformHost> StartAsync(
        string? edgeKey = null,
        Action<WebApplication>? map = null,
        Action<WebApplicationBuilder>? configure = null,
        string environment = "Production")
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = environment });
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Edge:Key"] = edgeKey,
        });
        var logs = new LogSink();
        builder.Logging.ClearProviders();
        builder.Logging.AddProvider(logs);
        builder.AddApiPlatform();
        configure?.Invoke(builder);

        var app = builder.Build();
        app.Use(async (context, next) =>
        {
            var remote = context.Request.Headers[RemoteHeader].ToString();
            context.Request.Headers.Remove(RemoteHeader);
            context.Connection.RemoteIpAddress = IPAddress.Parse(remote.Length > 0 ? remote : DefaultRemote);
            await next(context);
        });
        app.UseApiPlatform();
        map?.Invoke(app);
        await app.StartAsync();
        return new PlatformHost(app, logs, edgeKey);
    }

    public HttpRequestMessage Request(HttpMethod method, string path, string? remote = null, string? edgeKey = null, params string[] clientIps)
    {
        var request = new HttpRequestMessage(method, path);
        if (remote is not null)
        {
            request.Headers.Add(RemoteHeader, remote);
        }

        if (edgeKey is not null)
        {
            request.Headers.TryAddWithoutValidation(EdgeOptions.KeyHeader, edgeKey);
        }

        if (clientIps.Length > 0)
        {
            request.Headers.TryAddWithoutValidation(EdgeOptions.ClientIpHeader, clientIps);
        }

        return request;
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();
    }
}

// Keeps every log line, so a test can assert what was (and was not) logged.
internal sealed class LogSink : ILoggerProvider
{
    private readonly ConcurrentQueue<(LogLevel Level, string Message)> lines = new();

    public IReadOnlyList<(LogLevel Level, string Message)> Lines => [.. lines];

    public ILogger CreateLogger(string categoryName) => new Sink(lines);

    public void Dispose()
    {
    }

    private sealed class Sink(ConcurrentQueue<(LogLevel, string)> lines) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            lines.Enqueue((logLevel, formatter(state, exception) + (exception is null ? "" : " | " + exception)));
    }
}
