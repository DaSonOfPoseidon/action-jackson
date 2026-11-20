using ActionJackson.Core;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Modeling;
using ActionJackson.Data.Sql;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data;

// The tables of one business site. All the mapping lives here; LanDbContext and CarDbContext only
// name their site (and so their schema). Each subclass is its own CLR type with its own options type,
// so EF caches one model per site and DI cannot hand one site's context to the other's code.
public abstract class BusinessDbContext : DbContext
{
    protected BusinessDbContext(DbContextOptions options, Site site)
        : base(options)
    {
        Site = site;
    }

    public Site Site { get; }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<ServicePackage> ServicePackages => Set<ServicePackage>();
    public DbSet<CatalogItem> CatalogItems => Set<CatalogItem>();
    public DbSet<CatalogItemComponent> CatalogItemComponents => Set<CatalogItemComponent>();
    public DbSet<AvailabilityRule> AvailabilityRules => Set<AvailabilityRule>();
    public DbSet<BlackoutDate> BlackoutDates => Set<BlackoutDate>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<AppointmentHistoryEntry> AppointmentHistory => Set<AppointmentHistoryEntry>();
    public DbSet<ConsultationRequest> ConsultationRequests => Set<ConsultationRequest>();
    public DbSet<Quote> Quotes => Set<Quote>();
    public DbSet<QuoteLine> QuoteLines => Set<QuoteLine>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceLine> InvoiceLines => Set<InvoiceLine>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Testimonial> Testimonials => Set<Testimonial>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder) =>
        ModelRules.Configure(configurationBuilder);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Site.Schema());

        modelBuilder.Entity<ServicePackage>(e => e.HasIndex(x => x.Code).IsUnique());

        modelBuilder.Entity<CatalogItem>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.LaborHours).HasPrecision(6, 2);
        });

        modelBuilder.Entity<CatalogItemComponent>(e =>
        {
            e.HasKey(x => new { x.ParentId, x.ComponentId });
            e.Property(x => x.Quantity).HasPrecision(10, 2);
            e.HasOne<CatalogItem>().WithMany().HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<CatalogItem>().WithMany().HasForeignKey(x => x.ComponentId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_catalog_item_components_not_self", "parent_id <> component_id");
                t.HasCheckConstraint("ck_catalog_item_components_quantity", "quantity > 0");
            });
        });

        modelBuilder.Entity<AvailabilityRule>(e => e.ToTable(t =>
        {
            t.HasCheckConstraint("ck_availability_rules_day_of_week", "day_of_week BETWEEN 0 AND 6");
            t.HasCheckConstraint("ck_availability_rules_hours", "closes > opens");
            t.HasCheckConstraint("ck_availability_rules_slot_minutes", "slot_minutes > 0");
        }));

        modelBuilder.Entity<BlackoutDate>(e => e.HasKey(x => x.Date));

        modelBuilder.Entity<Appointment>(e =>
        {
            e.HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Quote>().WithMany().HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.History).WithOne().HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.Cascade);

            // One active booking per quote.
            e.HasIndex(x => x.QuoteId)
                .IsUnique()
                .HasFilter($"quote_id IS NOT NULL AND {BusinessSchemaSql.BlockingStatusCondition()}");
            e.ToTable(t => t.HasCheckConstraint("ck_appointments_ends_after_starts", "ends_at > starts_at"));
        });

        modelBuilder.Entity<ConsultationRequest>(e =>
        {
            e.Property(x => x.RequestNumber).HasColumnType("char(8)");
            e.HasIndex(x => x.RequestNumber).IsUnique();
            e.ToTable(t => t.HasCheckConstraint("ck_consultation_requests_request_number", "request_number ~ '^[0-9]{8}$'"));
        });

        modelBuilder.Entity<Quote>(e =>
        {
            e.Property(x => x.QuoteNumber).HasColumnType("char(8)");
            e.Property(x => x.DiscountPercent).HasPrecision(5, 2);
            e.HasIndex(x => x.QuoteNumber).IsUnique();
            e.HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_quotes_quote_number", "quote_number ~ '^[0-9]{8}$'");
                t.HasCheckConstraint("ck_quotes_discount_percent", "discount_percent BETWEEN 0 AND 100");
                t.HasCheckConstraint("ck_quotes_amounts", "subtotal >= 0 AND total >= 0 AND deposit >= 0");
            });
        });

        modelBuilder.Entity<QuoteLine>(e =>
        {
            e.Property(x => x.Quantity).HasPrecision(10, 2);
            e.Property(x => x.LaborHours).HasPrecision(6, 2);
            e.HasOne<CatalogItem>().WithMany().HasForeignKey(x => x.CatalogItemId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Invoice>(e =>
        {
            e.HasIndex(x => x.InvoiceNumber).IsUnique();
            e.HasIndex(x => x.QuoteId).IsUnique();
            e.HasOne<Quote>().WithMany().HasForeignKey(x => x.QuoteId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Customer>().WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
            e.ToTable(t => t.HasCheckConstraint("ck_invoices_amounts", "subtotal >= 0 AND discount >= 0 AND total >= 0"));
        });

        modelBuilder.Entity<InvoiceLine>(e =>
        {
            e.Property(x => x.Quantity).HasPrecision(10, 2);
            e.Property(x => x.LaborHours).HasPrecision(6, 2);
            e.HasOne<CatalogItem>().WithMany().HasForeignKey(x => x.CatalogItemId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.HasOne<Invoice>().WithMany().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t => t.HasCheckConstraint("ck_payments_amount", "amount > 0"));
        });

        modelBuilder.Entity<Attachment>(e =>
        {
            e.Property(x => x.Sha256).HasColumnType("char(64)");
            e.HasIndex(x => x.ObjectKey).IsUnique();
            e.HasIndex(x => new { x.OwnerType, x.OwnerId });
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_attachments_size_bytes", "size_bytes >= 0");
                t.HasCheckConstraint("ck_attachments_sha256", "sha256 ~ '^[0-9a-f]{64}$'");
            });
        });

        modelBuilder.Entity<Testimonial>(e =>
            e.ToTable(t => t.HasCheckConstraint("ck_testimonials_rating", "rating BETWEEN 1 AND 5")));

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

public sealed class LanDbContext(DbContextOptions<LanDbContext> options) : BusinessDbContext(options, Site.Lan);

public sealed class CarDbContext(DbContextOptions<CarDbContext> options) : BusinessDbContext(options, Site.Car);
