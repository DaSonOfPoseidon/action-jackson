using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using ActionJackson.Data.Tests;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ActionJackson.Api.Tests;

public class HealthzTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task Returns_ok_when_the_database_answers()
    {
        using var factory = Factory(database.ConnectionString, migrate: false);
        var client = factory.CreateClient();

        var response = await client.GetAsync("/healthz");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("ok", json.RootElement.GetProperty("status").GetString());
        Assert.Equal("ok", json.RootElement.GetProperty("db").GetString());
    }

    [Fact]
    public async Task Returns_503_when_the_database_is_unreachable()
    {
        // Nothing listens on this port, so the connection is refused.
        using var factory = Factory($"Host=127.0.0.1;Port={FreePort()};Database=none;Username=none", migrate: false);
        var client = factory.CreateClient();

        var response = await client.GetAsync("/healthz");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("degraded", json.RootElement.GetProperty("status").GetString());
        Assert.Equal("down", json.RootElement.GetProperty("db").GetString());
    }

    [Fact]
    public async Task Gives_up_on_a_database_that_accepts_but_never_answers_without_any_error_logged()
    {
        // A server that takes the connection and then says nothing, like a hung Postgres.
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try
        {
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            var logs = new CapturingLoggerProvider();
            using var factory = Factory($"Host=127.0.0.1;Port={port};Database=none;Username=none;Timeout=30;Command Timeout=30", migrate: false, logs);
            var client = factory.CreateClient();
            var clock = Stopwatch.StartNew();

            using var response = await client.GetAsync("/healthz");
            var body = await response.Content.ReadAsStringAsync();
            var elapsed = clock.Elapsed;

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            using var json = JsonDocument.Parse(body);
            Assert.Equal("degraded", json.RootElement.GetProperty("status").GetString());
            Assert.Equal("down", json.RootElement.GetProperty("db").GetString());
            // Only a loose sanity bound: the pass/fail signal is the outcome and the logs.
            Assert.InRange(elapsed, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(10));

            // The abandoned probe is still waiting for the silent server. Stopping the listener fails its
            // connect; then wait (bounded) until the probe has ended and cleaned up, and only then read the logs.
            listener.Stop();
            var ended = await logs.WaitForAsync(e => e.Message.Contains(HealthzProbe.EndedMessage), TimeSpan.FromSeconds(10));

            var errors = logs.Entries.Where(e => e.Level >= LogLevel.Error).Select(e => $"{e.Category}: {e.Message} {e.Exception}").ToList();
            Assert.True(errors.Count == 0, "error-level logs: " + string.Join(" | ", errors));
            Assert.True(ended, "the abandoned probe never ended");
        }
        finally
        {
            listener.Stop();
        }
    }

    [Fact]
    public async Task A_client_that_leaves_mid_probe_leaves_no_error_and_the_probe_still_cleans_up()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try
        {
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            var logs = new CapturingLoggerProvider();
            using var factory = Factory($"Host=127.0.0.1;Port={port};Database=none;Username=none;Timeout=30;Command Timeout=30", migrate: false, logs);
            var client = factory.CreateClient();
            using var leaves = new CancellationTokenSource(TimeSpan.FromMilliseconds(500));

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.GetAsync("/healthz", leaves.Token));

            listener.Stop();
            var ended = await logs.WaitForAsync(e => e.Message.Contains(HealthzProbe.EndedMessage), TimeSpan.FromSeconds(10));

            var errors = logs.Entries.Where(e => e.Level >= LogLevel.Error).Select(e => $"{e.Category}: {e.Message} {e.Exception}").ToList();
            Assert.True(errors.Count == 0, "error-level logs: " + string.Join(" | ", errors));
            Assert.True(ended, "the abandoned probe never ended");
        }
        finally
        {
            listener.Stop();
        }
    }

    [Fact]
    public void Startup_fails_without_a_connection_string()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:Postgres", "");
            builder.UseSetting("Database:MigrateOnStartup", "false");
        });

        var error = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("ConnectionStrings:Postgres is not set", Messages(error));
    }

    [DbFact]
    public async Task Startup_migrates_and_seeds_a_new_database_unless_told_not_to()
    {
        await using var empty = new EmptyTestDatabase();
        await empty.InitializeAsync();
        try
        {
            using (var skipped = Factory(empty.ConnectionString, migrate: false))
            {
                var response = await skipped.CreateClient().GetAsync("/healthz");
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                Assert.Equal(0, await TableCount(empty, "lan"));
            }

            using var migrating = Factory(empty.ConnectionString, migrate: true);
            migrating.CreateClient();

            Assert.True(await TableCount(empty, "lan") > 0);
            Assert.Equal(21, await Count(empty, "SELECT count(*) FROM lan.catalog_items"));
        }
        finally
        {
            await empty.DisposeAsync();
        }
    }

    private static WebApplicationFactory<Program> Factory(string connectionString, bool migrate, ILoggerProvider? logs = null) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:Postgres", connectionString);
            builder.UseSetting("Database:MigrateOnStartup", migrate ? "true" : "false");
            if (logs is not null)
            {
                builder.ConfigureServices(services => services.AddLogging(logging =>
                {
                    logging.ClearProviders();
                    logging.SetMinimumLevel(LogLevel.Debug);
                    logging.AddProvider(logs);
                }));
            }
        });

    private static async Task<long> TableCount(TestDatabase db, string schema) =>
        await Count(db, $"SELECT count(*) FROM information_schema.tables WHERE table_schema = '{schema}'");

    private static async Task<long> Count(TestDatabase db, string sql)
    {
        await using var connection = await db.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return (long)(await command.ExecuteScalarAsync())!;
    }

    private static string Messages(Exception e)
    {
        var all = new List<string>();
        for (var current = e; current is not null; current = current.InnerException!)
        {
            all.Add(current.Message);
            if (current.InnerException is null)
            {
                break;
            }
        }

        return string.Join(" | ", all);
    }

    private static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try
        {
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
        finally
        {
            listener.Stop();
        }
    }
}

// Keeps every log entry of a host, so a test can assert on what the host wrote.
internal sealed class CapturingLoggerProvider : ILoggerProvider
{
    private readonly List<Entry> entries = [];

    public IReadOnlyList<Entry> Entries
    {
        get
        {
            lock (entries)
            {
                return [.. entries];
            }
        }
    }

    public ILogger CreateLogger(string categoryName) => new CapturingLogger(this, categoryName);

    public void Dispose()
    {
    }

    // Polls until an entry matches or the time is up. Not a fixed delay: it returns as soon as the entry is there.
    public async Task<bool> WaitForAsync(Func<Entry, bool> match, TimeSpan limit)
    {
        var clock = Stopwatch.StartNew();
        while (clock.Elapsed < limit)
        {
            if (Entries.Any(match))
            {
                return true;
            }

            await Task.Delay(25);
        }

        return Entries.Any(match);
    }

    public sealed record Entry(string Category, LogLevel Level, string Message, Exception? Exception);

    private sealed class CapturingLogger(CapturingLoggerProvider owner, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            lock (owner.entries)
            {
                owner.entries.Add(new Entry(category, logLevel, formatter(state, exception), exception));
            }
        }
    }
}
