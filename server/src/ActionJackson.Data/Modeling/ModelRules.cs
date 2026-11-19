using ActionJackson.Core;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace ActionJackson.Data.Modeling;

// The rules every context shares. Each context calls Configure from ConfigureConventions and Finish
// at the end of OnModelCreating, so no table repeats them.
public static class ModelRules
{
    // Money and quantities default to numeric(12,2). A column that needs another precision sets it itself.
    public const int DefaultPrecision = 12;
    public const int DefaultScale = 2;

    public static void Configure(ModelConfigurationBuilder configuration)
    {
        configuration.Properties<decimal>().HavePrecision(DefaultPrecision, DefaultScale);

        // Every enum is stored as its name. Site is lowercase, the same spelling as its schema.
        foreach (var enumType in EnumTypes())
        {
            if (enumType == typeof(Site))
            {
                configuration.Properties<Site>().HaveConversion<SiteConverter>();
            }
            else
            {
                configuration.Properties(enumType).HaveConversion<string>();
            }
        }
    }

    // Adds the checks that depend on the finished mapping: every enum column accepts only its
    // enum's names, and every details column is a jsonb object.
    public static void Finish(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            var table = entity.GetTableName();
            if (table is null)
            {
                continue;
            }

            foreach (var property in entity.GetProperties())
            {
                var type = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                if (!type.IsEnum)
                {
                    continue;
                }

                var column = property.GetColumnName();
                entity.AddCheckConstraint($"ck_{table}_{column}", EnumCheck(column, type));
            }

            if (entity.ClrType.IsAssignableTo(typeof(IHasDetails)))
            {
                var details = entity.FindProperty(nameof(IHasDetails.Details))!;
                details.SetColumnType("jsonb");
                details.SetDefaultValueSql("'{}'::jsonb");
                entity.AddCheckConstraint($"ck_{table}_details", JsonObjectCheck(details.GetColumnName()));
            }
        }
    }

    // column IN ('A', 'B'): one helper builds every enum check, from the enum type itself.
    public static string EnumCheck(string column, Type enumType)
    {
        var values = enumType == typeof(Site)
            ? Enum.GetValues<Site>().Select(site => site.Schema())
            : Enum.GetNames(enumType);
        return $"\"{column}\" IN ({string.Join(", ", values.Select(SqlLiteral))})";
    }

    public static string JsonObjectCheck(string column) => $"jsonb_typeof(\"{column}\") = 'object'";

    // A quoted SQL string literal for a name we control (an enum name or a schema).
    public static string SqlLiteral(string value)
    {
        if (value.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_'))
        {
            throw new ArgumentException($"'{value}' is not a plain name", nameof(value));
        }

        return $"'{value}'";
    }

    // Sets updated_at on every modified row of a table that has one.
    public static void Touch(ChangeTracker tracker)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in tracker.Entries<IHasUpdatedAt>())
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }
    }

    private static IEnumerable<Type> EnumTypes() =>
        typeof(Site).Assembly.GetTypes().Where(type => type.IsEnum);
}

// Stores a Site as its lowercase schema name ('lan'), which is also how the API and the edge spell it.
public sealed class SiteConverter : ValueConverter<Site, string>
{
    public SiteConverter()
        : base(site => site.Schema(), value => Parse(value))
    {
    }

    private static Site Parse(string value)
    {
        foreach (var site in Enum.GetValues<Site>())
        {
            if (site.Schema() == value)
            {
                return site;
            }
        }

        throw new InvalidOperationException($"'{value}' is not a site");
    }
}
