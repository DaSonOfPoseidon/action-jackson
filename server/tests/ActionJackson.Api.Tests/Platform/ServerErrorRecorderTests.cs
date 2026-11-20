using System.Diagnostics;
using System.Net;
using System.Runtime.CompilerServices;
using ActionJackson.Api.Platform;
using ActionJackson.Core;
using ActionJackson.Data;
using ActionJackson.Data.Tests;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ActionJackson.Api.Tests.Platform;

public class ErrorFingerprintTests
{
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static Exception Thrown(string message)
    {
        try
        {
            throw new InvalidOperationException(message);
        }
        catch (Exception e)
        {
            return e;
        }
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static Exception OtherThrower()
    {
        try
        {
            throw new InvalidOperationException("x");
        }
        catch (Exception e)
        {
            return e;
        }
    }

    [Fact]
    public void The_message_is_not_part_of_the_fingerprint()
    {
        Assert.Equal(
            ErrorFingerprint.Of(Thrown("user 1 not found"), "/u/{id}"),
            ErrorFingerprint.Of(Thrown("user 2 not found"), "/u/{id}"));
    }

    [Fact]
    public void The_fingerprint_is_64_lowercase_hex_characters()
    {
        var fingerprint = ErrorFingerprint.Of(Thrown("m"), "/r");

        Assert.Matches("^[0-9a-f]{64}$", fingerprint);
    }

    [Fact]
    public void Another_route_is_another_group()
    {
        Assert.NotEqual(ErrorFingerprint.Of(Thrown("m"), "/a"), ErrorFingerprint.Of(Thrown("m"), "/b"));
    }

    [Fact]
    public void Another_throwing_method_is_another_group()
    {
        Assert.NotEqual(ErrorFingerprint.Of(Thrown("m"), "/a"), ErrorFingerprint.Of(OtherThrower(), "/a"));
    }

    [Fact]
    public void The_innermost_exception_type_counts()
    {
        var a = new AggregateException(new InvalidOperationException("a"));
        var b = new AggregateException(new ArgumentException("b"));

        Assert.NotEqual(ErrorFingerprint.Of(a, "/r"), ErrorFingerprint.Of(b, "/r"));
    }

    [Fact]
    public void An_exception_that_was_never_thrown_still_has_a_fingerprint()
    {
        Assert.Matches("^[0-9a-f]{64}$", ErrorFingerprint.Of(new InvalidOperationException("never thrown"), ErrorFingerprint.Unmatched));
    }
}

public class ServerErrorRecorderTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void Fail(string message) => throw new InvalidOperationException(message);

    private static void Map(WebApplication app)
    {
        app.MapGet("/fail/{message}", (string message) =>
        {
            Fail(message);
            return "unreachable";
        });
        app.MapGet("/fail-b/{message}", (string message) =>
        {
            Fail(message);
            return "unreachable";
        });
        app.MapGet("/long", () =>
        {
            Fail(new string('x', 20_000));
            return "unreachable";
        });
        app.MapGet("/query", () =>
        {
            Fail("with a query");
            return "unreachable";
        });
    }

    private Task<PlatformHost> StartAsync(string? connectionString = null) =>
        PlatformHost.StartAsync(
            PlatformHost.NewKey(),
            Map,
            builder => builder.Services.AddActionJacksonData(connectionString ?? database.ConnectionString));

    private async Task<List<ActionJackson.Data.Entities.ServerError>> RowsAsync(string pathPrefix)
    {
        await using var db = database.Core();
        return await db.ServerErrors.AsNoTracking().Where(e => e.Path.StartsWith(pathPrefix)).ToListAsync();
    }

    [DbFact]
    public async Task The_same_fault_with_different_messages_is_one_row_with_count_2()
    {
        await using var host = await StartAsync();

        using var first = await host.Client.GetAsync("/fail/same-a");
        using var second = await host.Client.GetAsync("/fail/same-b");

        Assert.Equal(HttpStatusCode.InternalServerError, first.StatusCode);
        Assert.Equal(HttpStatusCode.InternalServerError, second.StatusCode);
        var rows = (await RowsAsync("/fail/same-")).ToList();
        // Path is the latest sample of a group, so the group is found by what it shares.
        var group = Assert.Single(rows);
        Assert.Equal(2, group.Count);
        Assert.Equal("System.InvalidOperationException", group.Type);
        Assert.Equal(ErrorSource.Api, group.Source);
        Assert.Null(group.Site);
        Assert.Matches("^[0-9a-f]{64}$", group.Fingerprint);
        Assert.Equal("same-b", group.Message);
    }

    [DbFact]
    public async Task The_same_exception_on_a_different_route_is_a_second_row()
    {
        await using var host = await StartAsync();

        using var a = await host.Client.GetAsync("/fail/route-x");
        using var b = await host.Client.GetAsync("/fail-b/route-x");

        await using var db = database.Core();
        var fingerprints = await db.ServerErrors
            .Where(e => e.Path == "/fail/route-x" || e.Path == "/fail-b/route-x")
            .Select(e => e.Fingerprint)
            .ToListAsync();
        Assert.Equal(2, fingerprints.Distinct().Count());
    }

    [DbFact]
    public async Task The_query_string_is_not_stored()
    {
        await using var host = await StartAsync();

        using var response = await host.Client.GetAsync("/query?email=a@b.c&token=secret-token");

        var row = Assert.Single(await RowsAsync("/query"));
        Assert.Equal("/query", row.Path);
        Assert.DoesNotContain("a@b.c", row.Path + row.Message + row.Stack + row.UserAgent);
        Assert.DoesNotContain("secret-token", row.Path + row.Message + row.Stack + row.UserAgent);
    }

    [DbFact]
    public async Task A_20000_character_message_is_truncated_and_the_stack_is_bounded()
    {
        await using var host = await StartAsync();

        using var response = await host.Client.GetAsync("/long");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var row = Assert.Single(await RowsAsync("/long"));
        Assert.Equal(ServerErrorStore.MaxMessage, row.Message.Length);
        Assert.True(row.Stack.Length <= ServerErrorStore.MaxStack);
    }

    [DbFact]
    public async Task The_user_agent_is_stored_and_cut()
    {
        await using var host = await StartAsync();
        using var request = host.Request(HttpMethod.Get, "/fail/ua");
        request.Headers.TryAddWithoutValidation("User-Agent", new string('u', 1_000));

        using var response = await host.Client.SendAsync(request);

        var row = Assert.Single(await RowsAsync("/fail/ua"));
        Assert.Equal(ServerErrorStore.MaxUserAgent, row.UserAgent?.Length);
    }

    [DbFact]
    public async Task A_database_that_is_down_still_gives_a_500_problem_in_under_3_seconds()
    {
        // Nothing listens on port 1, so the connection is refused.
        await using var host = await StartAsync("Host=127.0.0.1;Port=1;Username=x;Password=x;Database=x;Timeout=1");
        var clock = Stopwatch.StartNew();

        using var response = await host.Client.GetAsync("/fail/db-down");

        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(3), $"took {clock.Elapsed}");
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains(host.Logs.Lines, l => l.Message.Contains("Could not record a server error"));
    }

    [DbFact]
    public async Task A_client_abort_records_nothing_and_still_returns_false()
    {
        await using var host = await StartAsync();
        var recorder = new ServerErrorRecorder(host.Services.GetRequiredService<IServiceScopeFactory>(), NullLogger<ServerErrorRecorder>.Instance);
        using var aborted = new CancellationTokenSource();
        var context = new DefaultHttpContext { RequestAborted = aborted.Token };
        context.Request.Path = "/fail/aborted";
        await aborted.CancelAsync();

        var handled = await recorder.TryHandleAsync(context, new OperationCanceledException(aborted.Token), CancellationToken.None);

        Assert.False(handled);
        Assert.Empty(await RowsAsync("/fail/aborted"));
    }

    [DbFact]
    public async Task A_cancellation_that_is_not_a_client_abort_is_recorded()
    {
        await using var host = await StartAsync();
        var recorder = new ServerErrorRecorder(host.Services.GetRequiredService<IServiceScopeFactory>(), NullLogger<ServerErrorRecorder>.Instance);
        var context = new DefaultHttpContext();
        context.Request.Path = "/fail/not-aborted";

        var handled = await recorder.TryHandleAsync(context, new OperationCanceledException("internal timeout"), CancellationToken.None);

        Assert.False(handled);
        Assert.Single(await RowsAsync("/fail/not-aborted"));
    }
}
