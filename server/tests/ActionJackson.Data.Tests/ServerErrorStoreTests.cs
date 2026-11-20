using ActionJackson.Core;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Tests;

public class ServerErrorStoreTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    private static ServerError Error(string fingerprint, string message = "m", string stack = "s", string path = "/p") => new()
    {
        Source = ErrorSource.Api,
        Fingerprint = fingerprint,
        Type = "System.InvalidOperationException",
        Message = message,
        Stack = stack,
        Path = path,
    };

    private async Task<ServerError> LoadAsync(string fingerprint)
    {
        await using var db = database.Core();
        return await db.ServerErrors.AsNoTracking().SingleAsync(e => e.Fingerprint == fingerprint);
    }

    [DbFact]
    public async Task The_first_upsert_inserts_a_row_with_count_one()
    {
        var fingerprint = Guid.NewGuid().ToString("N");
        await using (var db = database.Core())
        {
            await ServerErrorStore.UpsertAsync(db, Error(fingerprint), CancellationToken.None);
        }

        var row = await LoadAsync(fingerprint);
        Assert.Equal(1, row.Count);
        Assert.Equal(ErrorSource.Api, row.Source);
        Assert.Null(row.Site);
        Assert.Null(row.UserAgent);
    }

    [DbFact]
    public async Task A_repeat_increments_the_count_keeps_the_first_seen_and_stores_the_latest_sample()
    {
        var fingerprint = Guid.NewGuid().ToString("N");
        await using (var db = database.Core())
        {
            await ServerErrorStore.UpsertAsync(db, Error(fingerprint, message: "first", stack: "s1", path: "/a"), CancellationToken.None);
        }

        var first = await LoadAsync(fingerprint);
        await Task.Delay(20);
        await using (var db = database.Core())
        {
            await ServerErrorStore.UpsertAsync(db, Error(fingerprint, message: "second", stack: "s2", path: "/b"), CancellationToken.None);
            await ServerErrorStore.UpsertAsync(db, Error(fingerprint, message: "third", stack: "s3", path: "/c"), CancellationToken.None);
        }

        var row = await LoadAsync(fingerprint);
        Assert.Equal(3, row.Count);
        Assert.Equal("third", row.Message);
        Assert.Equal("s3", row.Stack);
        Assert.Equal("/c", row.Path);
        Assert.Equal(first.FirstSeen, row.FirstSeen);
        Assert.True(row.LastSeen > first.LastSeen);
    }

    [DbFact]
    public async Task The_same_fingerprint_from_another_source_is_another_row()
    {
        var fingerprint = Guid.NewGuid().ToString("N");
        await using var db = database.Core();
        await ServerErrorStore.UpsertAsync(db, Error(fingerprint), CancellationToken.None);
        var edge = Error(fingerprint);
        edge.Source = ErrorSource.Edge;
        await ServerErrorStore.UpsertAsync(db, edge, CancellationToken.None);

        Assert.Equal(2, await db.ServerErrors.CountAsync(e => e.Fingerprint == fingerprint));
    }

    [DbFact]
    public async Task Long_values_are_cut_to_their_limits()
    {
        var fingerprint = Guid.NewGuid().ToString("N");
        var error = Error(fingerprint, message: new string('m', 20_000), stack: new string('s', 50_000), path: "/" + new string('p', 5_000));
        error.UserAgent = new string('u', 2_000);
        await using (var db = database.Core())
        {
            await ServerErrorStore.UpsertAsync(db, error, CancellationToken.None);
        }

        var row = await LoadAsync(fingerprint);
        Assert.Equal(ServerErrorStore.MaxMessage, row.Message.Length);
        Assert.Equal(ServerErrorStore.MaxStack, row.Stack.Length);
        Assert.Equal(ServerErrorStore.MaxPath, row.Path.Length);
        Assert.Equal(ServerErrorStore.MaxUserAgent, row.UserAgent!.Length);
    }

    [DbFact]
    public async Task A_cut_never_splits_a_surrogate_pair_and_nul_characters_are_dropped()
    {
        var fingerprint = Guid.NewGuid().ToString("N");
        // The emoji is two chars, and the limit falls between them. Postgres text cannot hold a NUL.
        var message = new string('a', ServerErrorStore.MaxMessage - 1) + "\U0001F600" + "tail";
        await using (var db = database.Core())
        {
            await ServerErrorStore.UpsertAsync(db, Error(fingerprint, message: message, stack: "a\0b"), CancellationToken.None);
        }

        var row = await LoadAsync(fingerprint);
        Assert.Equal(new string('a', ServerErrorStore.MaxMessage - 1), row.Message);
        Assert.Equal("ab", row.Stack);
    }

    [DbFact]
    public async Task Values_are_parameters_not_sql()
    {
        var fingerprint = Guid.NewGuid().ToString("N");
        const string hostile = "x'); DROP TABLE core.server_errors; --";
        await using (var db = database.Core())
        {
            await ServerErrorStore.UpsertAsync(db, Error(fingerprint, message: hostile, path: hostile), CancellationToken.None);
        }

        var row = await LoadAsync(fingerprint);
        Assert.Equal(hostile, row.Message);
        Assert.Equal(hostile, row.Path);
    }

    [DbFact]
    public async Task A_site_is_stored_as_its_lowercase_name()
    {
        var fingerprint = Guid.NewGuid().ToString("N");
        var error = Error(fingerprint);
        error.Site = Site.Lan;
        await using (var db = database.Core())
        {
            await ServerErrorStore.UpsertAsync(db, error, CancellationToken.None);
        }

        Assert.Equal(Site.Lan, (await LoadAsync(fingerprint)).Site);
    }
}
