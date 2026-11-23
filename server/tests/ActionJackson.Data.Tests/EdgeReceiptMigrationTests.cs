using ActionJackson.Core;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace ActionJackson.Data.Tests;

// The AddEdgeReceiptRequestHash migration, on a database that already has the initial core migration and a
// receipt in it, and on one that has nothing. Its own class: it migrates core by hand.
public class EdgeReceiptMigrationTests(EmptyTestDatabase database) : IClassFixture<EmptyTestDatabase>
{
    private const string InitialMigration = "20261119212508_Initial";

    [DbFact]
    public async Task The_migration_adds_a_required_request_hash_and_keeps_an_existing_receipt()
    {
        await using (var core = database.Core())
        {
            await core.GetService<IMigrator>().MigrateAsync(InitialMigration);
        }

        await using (var connection = await database.OpenAsync())
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO core.edge_receipts (idempotency_key, site, endpoint, response_status, response_body, created_at)
                VALUES ('11111111-1111-1111-1111-111111111111', 'lan', 'POST /old', 201, '{}', now())
                """;
            await command.ExecuteNonQueryAsync();
        }

        await database.MigrateAndSeedAsync();

        await using var read = database.Core();
        var old = await read.EdgeReceipts.SingleAsync();
        Assert.Equal("POST /old", old.Endpoint);
        Assert.Equal(string.Empty, old.RequestHash);

        // The column is NOT NULL: a row without a hash cannot be written.
        await using var connection2 = await database.OpenAsync();
        await using var insert = connection2.CreateCommand();
        insert.CommandText = """
            INSERT INTO core.edge_receipts (idempotency_key, site, endpoint, response_status, response_body, created_at)
            VALUES ('22222222-2222-2222-2222-222222222222', 'lan', 'POST /new', 201, '{}', now())
            """;
        var missing = await Assert.ThrowsAsync<PostgresException>(() => insert.ExecuteNonQueryAsync());
        Assert.Equal("23502", missing.SqlState);

        // A receipt with a hash round-trips, and the key is the primary key.
        var key = Guid.NewGuid().ToString("D");
        await using (var core = database.Core())
        {
            core.EdgeReceipts.Add(new EdgeReceipt
            {
                IdempotencyKey = key,
                Site = Site.Lan,
                Endpoint = "POST /api/lan/appointments",
                RequestHash = new string('a', 64),
                ResponseStatus = 201,
                ResponseBody = """{"reference":"20260001"}""",
            });
            await core.SaveChangesAsync();
        }

        await using var again = database.Core();
        again.EdgeReceipts.Add(new EdgeReceipt
        {
            IdempotencyKey = key,
            Site = Site.Lan,
            Endpoint = "POST /api/lan/appointments",
            RequestHash = new string('b', 64),
            ResponseStatus = 201,
        });
        var duplicate = await Assert.ThrowsAsync<DbUpdateException>(() => again.SaveChangesAsync());
        Assert.Equal("pk_edge_receipts", ((PostgresException)duplicate.InnerException!).ConstraintName);

        await using var reread = database.Core();
        Assert.Equal(new string('a', 64), (await reread.EdgeReceipts.SingleAsync(receipt => receipt.IdempotencyKey == key)).RequestHash);
    }
}
