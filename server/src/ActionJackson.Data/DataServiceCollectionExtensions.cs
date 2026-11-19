using ActionJackson.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ActionJackson.Data;

public static class DataServiceCollectionExtensions
{
    // Every context uses one history table name, in its own schema, so a migration of one schema
    // never touches another's.
    public const string HistoryTable = "__ef_migrations";

    // Registers all five contexts against one database. The connection string is read when a context
    // is first built, so a host can finish configuring before it is needed.
    public static IServiceCollection AddActionJacksonData(
        this IServiceCollection services,
        Func<IServiceProvider, string> connectionString)
    {
        services.AddDbContext<CoreDbContext>((sp, o) => Configure(o, connectionString(sp), CoreDbContext.Schema));
        services.AddDbContext<LanDbContext>((sp, o) => Configure(o, connectionString(sp), Site.Lan.Schema()));
        services.AddDbContext<CarDbContext>((sp, o) => Configure(o, connectionString(sp), Site.Car.Schema()));
        services.AddDbContext<MainDbContext>((sp, o) => Configure(o, connectionString(sp), Site.Main.Schema()));
        services.AddDbContext<DevDbContext>((sp, o) => Configure(o, connectionString(sp), Site.Dev.Schema()));
        return services;
    }

    public static IServiceCollection AddActionJacksonData(this IServiceCollection services, string connectionString) =>
        services.AddActionJacksonData(_ => connectionString);

    // Npgsql with snake_case names, and the history table in the context's own schema. The design-time
    // factories use this too, so the migrations and the running app agree.
    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString, string schema) =>
        options
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(HistoryTable, schema))
            .UseSnakeCaseNamingConvention();
}
