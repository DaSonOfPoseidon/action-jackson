using ActionJackson.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ActionJackson.Data;

// `dotnet ef` builds a context through these. The connection string is a placeholder: adding a
// migration reads the model and never connects.
internal static class DesignTime
{
    public const string ConnectionString = "Host=localhost;Database=design_time";

    public static DbContextOptions<T> Options<T>(string schema)
        where T : DbContext
    {
        var builder = new DbContextOptionsBuilder<T>();
        DataServiceCollectionExtensions.Configure(builder, ConnectionString, schema);
        return builder.Options;
    }
}

internal sealed class CoreDbContextFactory : IDesignTimeDbContextFactory<CoreDbContext>
{
    public CoreDbContext CreateDbContext(string[] args) =>
        new(DesignTime.Options<CoreDbContext>(CoreDbContext.Schema));
}

internal sealed class LanDbContextFactory : IDesignTimeDbContextFactory<LanDbContext>
{
    public LanDbContext CreateDbContext(string[] args) =>
        new(DesignTime.Options<LanDbContext>(Site.Lan.Schema()));
}

internal sealed class CarDbContextFactory : IDesignTimeDbContextFactory<CarDbContext>
{
    public CarDbContext CreateDbContext(string[] args) =>
        new(DesignTime.Options<CarDbContext>(Site.Car.Schema()));
}

internal sealed class MainDbContextFactory : IDesignTimeDbContextFactory<MainDbContext>
{
    public MainDbContext CreateDbContext(string[] args) =>
        new(DesignTime.Options<MainDbContext>(Site.Main.Schema()));
}

internal sealed class DevDbContextFactory : IDesignTimeDbContextFactory<DevDbContext>
{
    public DevDbContext CreateDbContext(string[] args) =>
        new(DesignTime.Options<DevDbContext>(Site.Dev.Schema()));
}
