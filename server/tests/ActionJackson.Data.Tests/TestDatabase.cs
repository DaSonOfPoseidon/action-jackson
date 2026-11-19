using Npgsql;

namespace ActionJackson.Data.Tests;

// A random database per test class. TEST_DATABASE_URL comes from scripts/test-db.sh locally and
// from a service container in CI. The Api tests link this file, so keep it free of test-project
// specifics.
public sealed class TestDatabase : IAsyncLifetime
{
    public static readonly string? Server = Environment.GetEnvironmentVariable("TEST_DATABASE_URL");

    // Tests skip only when there is no database AND this is not CI. In CI a missing database fails
    // the test, so nothing is silently skipped there.
    public static bool CanSkip => Server is null && Environment.GetEnvironmentVariable("CI") != "true";

    private readonly string name = $"t_{Guid.NewGuid():N}";
    private string? connectionString;
    private bool created;

    public string ConnectionString =>
        connectionString ?? throw new InvalidOperationException("TEST_DATABASE_URL is not set");

    public async Task InitializeAsync()
    {
        if (Server is null)
        {
            // A skipped DbFact still builds the fixture: do nothing, the tests never run.
            if (CanSkip)
            {
                return;
            }

            throw new InvalidOperationException("TEST_DATABASE_URL is not set, and CI must have a database");
        }

        await Admin($"CREATE DATABASE {name}");
        created = true;
        connectionString = new NpgsqlConnectionStringBuilder(Server) { Database = name }.ConnectionString;
    }

    public async Task DisposeAsync()
    {
        if (!created)
        {
            return;
        }

        NpgsqlConnection.ClearAllPools();
        await Admin($"DROP DATABASE IF EXISTS {name} WITH (FORCE)");
    }

    public async Task<NpgsqlConnection> OpenAsync()
    {
        var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        return connection;
    }

    private static async Task Admin(string sql)
    {
        await using var connection = new NpgsqlConnection(Server);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}

public sealed class DbFactAttribute : FactAttribute
{
    public DbFactAttribute()
    {
        if (TestDatabase.CanSkip)
        {
            Skip = "TEST_DATABASE_URL is not set (scripts/test-db.sh up)";
        }
    }
}

public sealed class DbTheoryAttribute : TheoryAttribute
{
    public DbTheoryAttribute()
    {
        if (TestDatabase.CanSkip)
        {
            Skip = "TEST_DATABASE_URL is not set (scripts/test-db.sh up)";
        }
    }
}
