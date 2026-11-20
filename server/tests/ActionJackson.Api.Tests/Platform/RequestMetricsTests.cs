using System.Net;
using ActionJackson.Api.Platform;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Tests;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace ActionJackson.Api.Tests.Platform;

public class RequestMetricsDurationTests
{
    [Theory]
    [InlineData(1.234, "1.23")]
    [InlineData(1.235, "1.24")]
    [InlineData(0, "0.00")]
    public void Durations_round_to_cents_away_from_zero(double milliseconds, string expected)
    {
        var rounded = RequestMetricsMiddleware.Duration(TimeSpan.FromMilliseconds(milliseconds));

        Assert.Equal(expected, rounded.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public void A_huge_duration_is_clamped_to_what_the_column_holds()
    {
        Assert.Equal(99_999_999.99m, RequestMetricsMiddleware.Duration(TimeSpan.FromDays(10_000)));
    }
}

public class RequestMetricsQueueTests
{
    [Fact]
    public void A_full_queue_drops_and_counts_instead_of_blocking()
    {
        var queue = new RequestMetricsQueue(Microsoft.Extensions.Options.Options.Create(new RequestMetricsOptions { ChannelCapacity = 2 }));

        for (var i = 0; i < 5; i++)
        {
            queue.Enqueue(new RequestMetric { Method = "GET", Route = "/r" });
        }

        Assert.Equal(3, queue.Dropped);
        Assert.Equal(2, queue.Reader.Count);
    }
}

public class RequestMetricsTests(TestDatabase database) : IClassFixture<TestDatabase>, IAsyncLifetime
{
    // Each test starts from an empty table; tests in a class run one after another.
    public async Task InitializeAsync()
    {
        await using var connection = await database.OpenAsync();
        await using var command = new NpgsqlCommand("TRUNCATE core.request_metrics", connection);
        await command.ExecuteNonQueryAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static void Map(WebApplication app)
    {
        app.MapGet("/t/{id}", (int id) => id);
        app.MapGet("/healthz", () => "ok");
        app.MapGet("/boom", (Func<IResult>)(() => throw new InvalidOperationException("boom")));
    }

    private Task<PlatformHost> StartAsync(string? connectionString = null, Action<RequestMetricsOptions>? tune = null) =>
        PlatformHost.StartAsync(
            PlatformHost.NewKey(),
            Map,
            builder =>
            {
                builder.Services.AddActionJacksonData(connectionString ?? database.ConnectionString);
                builder.Services.Configure<RequestMetricsOptions>(o =>
                {
                    o.FlushInterval = TimeSpan.FromMilliseconds(50);
                    tune?.Invoke(o);
                });
            });

    private async Task<List<RequestMetric>> WaitForAsync(int count)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (true)
        {
            await using var db = database.Core();
            var rows = await db.RequestMetrics.AsNoTracking().OrderBy(m => m.Id).ToListAsync();
            if (rows.Count >= count || DateTime.UtcNow > deadline)
            {
                return rows;
            }

            await Task.Delay(50);
        }
    }

    [DbFact]
    public async Task One_request_is_one_row_with_the_route_template_not_the_raw_path()
    {
        await using var host = await StartAsync();
        var before = DateTimeOffset.UtcNow;

        using var response = await host.Client.GetAsync("/t/42?secret=abc");

        var row = Assert.Single(await WaitForAsync(1));
        Assert.Equal("GET", row.Method);
        Assert.Equal("/t/{id}", row.Route);
        Assert.Equal((short)200, row.Status);
        Assert.True(row.DurationMs >= 0);
        Assert.True(row.At >= before.AddSeconds(-1) && row.At <= DateTimeOffset.UtcNow.AddSeconds(1));
    }

    [DbFact]
    public async Task Healthz_is_not_recorded()
    {
        await using var host = await StartAsync();

        using var health = await host.Client.GetAsync("/healthz");
        using var other = await host.Client.GetAsync("/t/1");
        using var upper = await host.Client.GetAsync("/HEALTHZ");

        // The /t/1 row arrives; give a (wrong) healthz row time to follow it, then read everything.
        await WaitForAsync(1);
        await Task.Delay(300);
        await using var db = database.Core();
        var rows = await db.RequestMetrics.AsNoTracking().ToListAsync();
        Assert.Single(rows);
        Assert.Equal("/t/{id}", rows[0].Route);
    }

    [DbFact]
    public async Task A_throwing_endpoint_is_recorded_as_500()
    {
        await using var host = await StartAsync();

        using var response = await host.Client.GetAsync("/boom");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var row = Assert.Single(await WaitForAsync(1));
        Assert.Equal("/boom", row.Route);
        Assert.Equal((short)500, row.Status);
    }

    [DbFact]
    public async Task An_unknown_path_is_recorded_as_unmatched_404()
    {
        await using var host = await StartAsync();

        using var response = await host.Client.GetAsync("/user/supplied/path/12345");

        var row = Assert.Single(await WaitForAsync(1));
        Assert.Equal("(unmatched)", row.Route);
        Assert.Equal((short)404, row.Status);
    }

    [DbFact]
    public async Task An_odd_method_is_recorded_as_other()
    {
        await using var host = await StartAsync();

        using var response = await host.Client.SendAsync(host.Request(new HttpMethod("BREW-COFFEE-FOR-EVERYONE"), "/t/1"));

        var row = Assert.Single(await WaitForAsync(1));
        Assert.Equal("OTHER", row.Method);
    }

    [DbFact]
    public async Task A_full_channel_drops_writes_and_requests_still_complete()
    {
        // A flush interval of an hour keeps the writer from emptying the channel.
        await using var host = await StartAsync(tune: o =>
        {
            o.ChannelCapacity = 2;
            o.FlushInterval = TimeSpan.FromHours(1);
        });

        for (var i = 0; i < 6; i++)
        {
            using var response = await host.Client.GetAsync("/t/1");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        Assert.Equal(4, host.Services.GetRequiredService<RequestMetricsQueue>().Dropped);
    }

    [DbFact]
    public async Task A_database_that_is_down_at_flush_does_not_crash_the_host()
    {
        await using var host = await StartAsync("Host=127.0.0.1;Port=1;Username=x;Password=x;Database=x;Timeout=1");

        using var first = await host.Client.GetAsync("/t/1");
        await WaitForLogAsync(host, 1);
        using var second = await host.Client.GetAsync("/t/2");
        await WaitForLogAsync(host, 2);

        // Still serving after two failed batches.
        using var third = await host.Client.GetAsync("/t/3");
        Assert.Equal(HttpStatusCode.OK, third.StatusCode);
    }

    private static async Task WaitForLogAsync(PlatformHost host, int count)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (host.Logs.Lines.Count(l => l.Message.Contains("Could not write")) < count)
        {
            Assert.True(DateTime.UtcNow < deadline, "the failed flush was not logged");
            await Task.Delay(50);
        }
    }

    [DbFact]
    public async Task The_rows_still_queued_are_written_at_shutdown()
    {
        var host = await StartAsync(tune: o => o.FlushInterval = TimeSpan.FromHours(1));
        using (var response = await host.Client.GetAsync("/t/1"))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        await host.DisposeAsync();

        Assert.Single(await WaitForAsync(1));
    }
}
