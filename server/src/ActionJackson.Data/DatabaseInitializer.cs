using ActionJackson.Data.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ActionJackson.Data;

public static class DatabaseInitializer
{
    // Brings the database up to date: migrates core, lan, car, main and dev, in that order, then seeds
    // what is missing (never overwriting). Running it again changes nothing. The caller registers the
    // contexts with AddActionJacksonData.
    public static async Task MigrateAndSeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var provider = scope.ServiceProvider;

        var core = provider.GetRequiredService<CoreDbContext>();
        var lan = provider.GetRequiredService<LanDbContext>();
        await core.Database.MigrateAsync(cancellationToken);
        await lan.Database.MigrateAsync(cancellationToken);
        await provider.GetRequiredService<CarDbContext>().Database.MigrateAsync(cancellationToken);
        await provider.GetRequiredService<MainDbContext>().Database.MigrateAsync(cancellationToken);
        await provider.GetRequiredService<DevDbContext>().Database.MigrateAsync(cancellationToken);

        // The lan catalog and the labor rates. Car has no catalog items.
        await DatabaseSeed.SeedAsync(core, lan, cancellationToken);
    }
}
