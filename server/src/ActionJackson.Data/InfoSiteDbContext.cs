using ActionJackson.Core;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Modeling;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data;

// The tables of an info site (main or dev): for now just the contact form's messages. The schemas
// exist from the start, so later per-site tables don't move anything.
public abstract class InfoSiteDbContext : DbContext
{
    protected InfoSiteDbContext(DbContextOptions options, Site site)
        : base(options)
    {
        Site = site;
    }

    public Site Site { get; }

    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder) =>
        ModelRules.Configure(configurationBuilder);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Site.Schema());
        ModelRules.Finish(modelBuilder);
    }
}

public sealed class MainDbContext(DbContextOptions<MainDbContext> options) : InfoSiteDbContext(options, Site.Main);

public sealed class DevDbContext(DbContextOptions<DevDbContext> options) : InfoSiteDbContext(options, Site.Dev);
