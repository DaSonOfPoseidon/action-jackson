using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ActionJackson.Edge.Tests;

// A TestServer host running the real edge pipeline (AddEdge / UseEdge) over a temporary web root. TestServer has
// no connection, so the remote address and the local (listener) port are set from the X-Test-Remote and
// X-Test-Local-Port headers, which are removed before the edge sees the request.
internal sealed class EdgeHost : IAsyncDisposable
{
    public const string RemoteHeader = "X-Test-Remote";
    public const string LocalPortHeader = "X-Test-Local-Port";
    public const string DefaultRemote = "203.0.113.9";
    public const int LanPort = 8080;
    public const int TunnelPort = 8081;

    private readonly WebApplication app;

    private EdgeHost(WebApplication app, LogSink logs, string key, WebRoot root)
    {
        this.app = app;
        Logs = logs;
        Key = key;
        Root = root;
        Client = app.GetTestClient();
        Server = app.GetTestServer();
    }

    public HttpClient Client { get; }

    public TestServer Server { get; }

    public LogSink Logs { get; }

    public string Key { get; }

    public WebRoot Root { get; }

    // A random key of a valid length. Tests never use a fixed secret.
    public static string NewKey() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    public static async Task<EdgeHost> StartAsync(
        WebRoot? root = null,
        string? apiUrl = "http://127.0.0.1:9",
        IDictionary<string, string?>? settings = null)
    {
        root ??= new WebRoot();
        var key = NewKey();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Production" });
        builder.WebHost.UseTestServer();
        var config = new Dictionary<string, string?>
        {
            ["Edge:Key"] = key,
            ["Edge:ApiUrl"] = apiUrl,
            ["Edge:WebRoot"] = root.Path,
            ["Edge:TunnelPort"] = TunnelPort.ToString(),
        };
        foreach (var (name, value) in settings ?? new Dictionary<string, string?>())
        {
            config[name] = value;
        }

        builder.Configuration.AddInMemoryCollection(config);
        var logs = new LogSink();
        builder.Logging.ClearProviders();
        builder.Logging.AddProvider(logs);
        builder.AddEdge();

        var app = builder.Build();
        app.Use(async (context, next) =>
        {
            var remote = context.Request.Headers[RemoteHeader].ToString();
            var port = context.Request.Headers[LocalPortHeader].ToString();
            context.Request.Headers.Remove(RemoteHeader);
            context.Request.Headers.Remove(LocalPortHeader);
            context.Connection.RemoteIpAddress = IPAddress.Parse(remote.Length > 0 ? remote : DefaultRemote);
            context.Connection.LocalPort = port.Length > 0 ? int.Parse(port) : LanPort;
            await next(context);
        });
        app.UseEdge();
        await app.StartAsync();
        return new EdgeHost(app, logs, key, root);
    }

    // host: the Host header ("" sends an empty one; null keeps TestServer's default). localPort picks the listener.
    public HttpRequestMessage Request(HttpMethod method, string path, string? host = null, string? remote = null, int? localPort = null)
    {
        var request = new HttpRequestMessage(method, path);
        if (host is not null)
        {
            request.Headers.Host = host;
        }

        if (remote is not null)
        {
            request.Headers.Add(RemoteHeader, remote);
        }

        if (localPort is not null)
        {
            request.Headers.Add(LocalPortHeader, localPort.Value.ToString());
        }

        return request;
    }

    public Task<HttpResponseMessage> GetAsync(string path, string? host = null, int? localPort = null, string? remote = null) =>
        Client.SendAsync(Request(HttpMethod.Get, path, host, remote, localPort));

    // A request whose path is set directly on the HttpContext, so encoded characters and dot segments reach
    // the edge as written (HttpClient would normalise them first).
    public async Task<(int Status, string Body, IHeaderDictionary Headers)> RawAsync(string method, string path, string? host = null)
    {
        var context = await Server.SendAsync(http =>
        {
            http.Request.Method = method;
            http.Request.Path = new PathString(path);
            http.Request.Headers.Host = host ?? "lan.actionjacksoninstalls.com";
            http.Connection.RemoteIpAddress = IPAddress.Parse(DefaultRemote);
            http.Connection.LocalPort = LanPort;
        });
        using var reader = new StreamReader(context.Response.Body);
        return (context.Response.StatusCode, await reader.ReadToEndAsync(), context.Response.Headers);
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();
        Root.Dispose();
    }
}

// A temporary web root: one folder per site key, filled by the test. Deleted on dispose.
internal sealed class WebRoot : IDisposable
{
    public WebRoot()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "aj-edge-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path);
    }

    public string Path { get; }

    // Writes a file at <root>/<site>/<relative>.
    public WebRoot File(string site, string relative, string content = "x")
    {
        var full = System.IO.Path.Combine(Path, site, relative);
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(full)!);
        System.IO.File.WriteAllText(full, content);
        return this;
    }

    // Every site of the registry with an index.html naming it, which is what most tests need.
    public WebRoot WithSites(params string[] sites)
    {
        foreach (var site in sites)
        {
            File(site, "index.html", $"<html>{site} index</html>");
        }

        return this;
    }

    public void Dispose()
    {
        try
        {
            Directory.Delete(Path, true);
        }
        catch (IOException)
        {
            // A temp folder left behind is harmless.
        }
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
