using ActionJackson.Data.Entities;
using ActionJackson.Data.Modeling;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data;

// The core schema: the admin users, per-site settings, telemetry, the email outbox, idempotency
// receipts, document number counters and the data-protection keys.
public sealed class CoreDbContext(DbContextOptions<CoreDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options), IDataProtectionKeyContext
{
    public const string Schema = "core";

    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<PageView> PageViews => Set<PageView>();
    public DbSet<ClientError> ClientErrors => Set<ClientError>();
    public DbSet<ServerError> ServerErrors => Set<ServerError>();
    public DbSet<WebVital> WebVitals => Set<WebVital>();
    public DbSet<RequestMetric> RequestMetrics => Set<RequestMetric>();
    public DbSet<AuditLogEntry> AuditLog => Set<AuditLogEntry>();
    public DbSet<EmailOutboxMessage> EmailOutbox => Set<EmailOutboxMessage>();
    public DbSet<EdgeReceipt> EdgeReceipts => Set<EdgeReceipt>();
    public DbSet<NumberCounter> NumberCounters => Set<NumberCounter>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);
        ModelRules.Configure(configurationBuilder);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema(Schema);

        // The Identity tables, named like the rest.
        modelBuilder.Entity<AppUser>(e =>
        {
            e.ToTable("users");
            e.HasIndex(x => x.NormalizedUserName).HasDatabaseName("ix_users_normalized_user_name");
            e.HasIndex(x => x.NormalizedEmail).HasDatabaseName("ix_users_normalized_email");
        });
        modelBuilder.Entity<IdentityRole<Guid>>(e =>
        {
            e.ToTable("roles");
            e.HasIndex(x => x.NormalizedName).HasDatabaseName("ix_roles_normalized_name");
        });
        modelBuilder.Entity<IdentityUserRole<Guid>>().ToTable("user_roles");
        modelBuilder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        modelBuilder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        modelBuilder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");
        modelBuilder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims");

        modelBuilder.Entity<Setting>(e =>
        {
            e.HasKey(x => x.Site);
            e.Property(x => x.Data).HasColumnType("jsonb");
            e.ToTable(t => t.HasCheckConstraint("ck_settings_data", ModelRules.JsonObjectCheck("data")));
        });

        modelBuilder.Entity<PageView>(e => e.Property(x => x.Country).HasColumnType("char(2)"));

        modelBuilder.Entity<ClientError>(e => e.HasIndex(x => new { x.Source, x.Fingerprint }).IsUnique());
        modelBuilder.Entity<ServerError>(e => e.HasIndex(x => new { x.Source, x.Fingerprint }).IsUnique());

        modelBuilder.Entity<WebVital>(e =>
        {
            e.Property(x => x.Value).HasPrecision(12, 3);
            e.ToTable(t => t.HasCheckConstraint("ck_web_vitals_metric", "metric IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')"));
        });

        modelBuilder.Entity<RequestMetric>(e =>
        {
            e.Property(x => x.DurationMs).HasPrecision(10, 2);
            e.ToTable(t => t.HasCheckConstraint("ck_request_metrics_status", "status BETWEEN 100 AND 599"));
        });

        modelBuilder.Entity<AuditLogEntry>(e => e.Property(x => x.Data).HasColumnType("jsonb"));

        modelBuilder.Entity<EmailOutboxMessage>(e =>
        {
            e.HasIndex(x => new { x.Status, x.NextAttemptAt });
            e.ToTable(t => t.HasCheckConstraint("ck_email_outbox_attempts", "attempts >= 0"));
        });

        modelBuilder.Entity<EdgeReceipt>(e =>
        {
            e.HasKey(x => x.IdempotencyKey);
            e.Property(x => x.ResponseBody).HasColumnType("jsonb");
            e.ToTable(t => t.HasCheckConstraint("ck_edge_receipts_response_status", "response_status BETWEEN 100 AND 599"));
        });

        modelBuilder.Entity<NumberCounter>(e =>
        {
            e.HasKey(x => new { x.Site, x.Kind, x.Year });
            e.ToTable(t => t.HasCheckConstraint("ck_number_counters_next_value", "next_value >= 1"));
        });

        ModelRules.Finish(modelBuilder);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ModelRules.Touch(ChangeTracker);
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ModelRules.Touch(ChangeTracker);
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }
}
