using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using ActionJackson.Data.Tests;
using Microsoft.AspNetCore.Mvc.Testing;

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
    public async Task Gives_up_on_a_database_that_accepts_but_never_answers_within_about_three_seconds()
    {
        // A server that takes the connection and then says nothing, like a hung Postgres.
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try
        {
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            using var factory = Factory($"Host=127.0.0.1;Port={port};Database=none;Username=none;Timeout=30;Command Timeout=30", migrate: false);
            var client = factory.CreateClient();
            var clock = Stopwatch.StartNew();

            var response = await client.GetAsync("/healthz");

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            Assert.InRange(clock.Elapsed, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(10));
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

    private static WebApplicationFactory<Program> Factory(string connectionString, bool migrate) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:Postgres", connectionString);
            builder.UseSetting("Database:MigrateOnStartup", migrate ? "true" : "false");
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
