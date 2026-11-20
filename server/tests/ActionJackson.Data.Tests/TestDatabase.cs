using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace ActionJackson.Data.Tests;

// A random database per test class, migrated with the real initializer (EmptyTestDatabase skips
// that). TEST_DATABASE_URL comes from scripts/test-db.sh locally and from a service container in CI.
// The Api tests link this file, so keep it free of test-project specifics.
public class TestDatabase : IAsyncLifetime
{
    public static readonly string? Server = Environment.GetEnvironmentVariable("TEST_DATABASE_URL");

    // Tests skip only when there is no database AND this is not CI. In CI a missing database fails
    // the test, so nothing is silently skipped there.
    public static bool CanSkip => Server is null && Environment.GetEnvironmentVariable("CI") != "true";

    private readonly string name = $"t_{Guid.NewGuid():N}";
    private string? connectionString;
    private bool created;

    // False for a database that tests migrate themselves.
    protected virtual bool Migrate => true;

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

        if (Migrate)
        {
            await MigrateAndSeedAsync();
        }
    }

    public async Task MigrateAndSeedAsync()
    {
        await using var services = new ServiceCollection().AddActionJacksonData(ConnectionString).BuildServiceProvider();
        await DatabaseInitializer.MigrateAndSeedAsync(services);
    }

    // A new context per call, because a DbContext is not thread-safe. The caller disposes it.
    public CoreDbContext Core() => new(Options<CoreDbContext>("core"));

    public LanDbContext Lan() => new(Options<LanDbContext>("lan"));

    public CarDbContext Car() => new(Options<CarDbContext>("car"));

    public MainDbContext Main() => new(Options<MainDbContext>("main"));

    public DevDbContext Dev() => new(Options<DevDbContext>("dev"));

    private DbContextOptions<T> Options<T>(string schema)
        where T : DbContext
    {
        var builder = new DbContextOptionsBuilder<T>();
        DataServiceCollectionExtensions.Configure(builder, ConnectionString, schema);
        return builder.Options;
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

// A database with nothing in it, for the tests of the migration itself.
public sealed class EmptyTestDatabase : TestDatabase
{
    protected override bool Migrate => false;
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
