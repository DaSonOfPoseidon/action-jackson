using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Tests;

public class MigrationTests(EmptyTestDatabase database) : IClassFixture<EmptyTestDatabase>
{
    private static readonly string[] Schemas = ["core", "lan", "car", "main", "dev"];

    [DbFact]
    public async Task Migrating_an_empty_database_creates_the_five_schemas()
    {
        await database.MigrateAndSeedAsync();

        await using var connection = await database.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY(@names) ORDER BY 1";
        command.Parameters.AddWithValue("names", Schemas);
        var found = new List<string>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            found.Add(reader.GetString(0));
        }

        Assert.Equal(Schemas.Order(), found);
    }

    [DbFact]
    public async Task Each_schema_keeps_its_own_history_table()
    {
        await database.MigrateAndSeedAsync();

        foreach (var schema in Schemas)
        {
            var rows = await Rows.ScalarAsync<long>(database, $"SELECT count(*) FROM {schema}.__ef_migrations");
            // core has had a second migration since the schemas were first made.
            Assert.Equal(schema == "core" ? 2 : 1, rows);
        }
    }

    [DbFact]
    public async Task Migrating_again_is_a_no_op()
    {
        await database.MigrateAndSeedAsync();
        var before = await Rows.ScalarAsync<long>(
            database,
            "SELECT (SELECT count(*) FROM core.__ef_migrations) + (SELECT count(*) FROM lan.__ef_migrations)");

        await database.MigrateAndSeedAsync();

        var after = await Rows.ScalarAsync<long>(
            database,
            "SELECT (SELECT count(*) FROM core.__ef_migrations) + (SELECT count(*) FROM lan.__ef_migrations)");
        Assert.Equal(before, after);
    }

    [DbFact]
    public async Task The_model_matches_the_migrations_for_every_context()
    {
        await database.MigrateAndSeedAsync();

        await using var core = database.Core();
        await using var lan = database.Lan();
        await using var car = database.Car();
        await using var main = database.Main();
        await using var dev = database.Dev();

        foreach (var db in new DbContext[] { core, lan, car, main, dev })
        {
            Assert.False(db.Database.HasPendingModelChanges(), db.GetType().Name + " has model changes with no migration");
            Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        }
    }
}
