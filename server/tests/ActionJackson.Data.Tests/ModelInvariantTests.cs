using ActionJackson.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;

namespace ActionJackson.Data.Tests;

// These build each context's model with a placeholder connection string and never touch a database.
public class ModelInvariantTests
{
    public static TheoryData<string> ContextNames => new() { "core", "lan", "car", "main", "dev" };

    [Theory]
    [MemberData(nameof(ContextNames))]
    public void No_property_is_a_double_or_a_float(string context)
    {
        var offenders = Properties(context)
            .Where(p => Unwrap(p.ClrType) == typeof(double) || Unwrap(p.ClrType) == typeof(float))
            .Select(Describe)
            .ToList();

        Assert.Empty(offenders);
    }

    [Theory]
    [MemberData(nameof(ContextNames))]
    public void Every_decimal_has_a_precision_and_scale(string context)
    {
        var decimals = Properties(context).Where(p => Unwrap(p.ClrType) == typeof(decimal)).ToList();

        if (context is "core" or "lan" or "car")
        {
            Assert.NotEmpty(decimals);
        }

        Assert.All(decimals, p =>
        {
            Assert.True(p.GetPrecision() is not null, Describe(p) + " has no precision");
            Assert.True(p.GetScale() is not null, Describe(p) + " has no scale");
        });
    }

    [Theory]
    [MemberData(nameof(ContextNames))]
    public void Every_enum_property_is_stored_as_a_string(string context)
    {
        var enums = Properties(context).Where(p => Unwrap(p.ClrType).IsEnum).ToList();

        Assert.All(enums, p =>
        {
            var providerType = p.GetValueConverter()?.ProviderClrType ?? p.GetProviderClrType();
            Assert.True(providerType == typeof(string), Describe(p) + " is not stored as a string");
            Assert.StartsWith("text", p.GetColumnType());
        });
    }

    [Theory]
    [InlineData("lan")]
    [InlineData("car")]
    public void Every_enum_column_has_a_check_constraint(string context)
    {
        var model = Model(context);
        var enumColumns = model.GetEntityTypes()
            .SelectMany(e => e.GetProperties().Where(p => Unwrap(p.ClrType).IsEnum).Select(p => (Entity: e, Property: p)))
            .ToList();

        Assert.NotEmpty(enumColumns);
        Assert.All(enumColumns, c =>
        {
            var column = c.Property.GetColumnName();
            var expected = $"\"{column}\" IN (" + string.Join(", ", Enum.GetNames(Unwrap(c.Property.ClrType)).Select(n => $"'{n}'")) + ")";
            Assert.Contains(c.Entity.GetCheckConstraints(), k => k.Sql == expected);
        });
    }

    [Fact]
    public void Lan_and_car_have_the_same_tables_columns_and_types()
    {
        var lan = Shape("lan");
        var car = Shape("car");

        Assert.NotEmpty(lan);
        Assert.Equal(lan, car);
        Assert.All(Model("lan").GetRelationalModel().Tables, t => Assert.Equal("lan", t.Schema));
        Assert.All(Model("car").GetRelationalModel().Tables, t => Assert.Equal("car", t.Schema));
    }

    [Fact]
    public void Lan_and_car_hold_the_business_tables()
    {
        var tables = Model("lan").GetRelationalModel().Tables.Select(t => t.Name).Order().ToList();

        Assert.Equal(
            new[]
            {
                "appointment_history", "appointments", "attachments", "availability_rules", "blackout_dates",
                "catalog_item_components", "catalog_items", "consultation_requests", "customers", "invoice_lines",
                "invoices", "payments", "quote_lines", "quotes", "service_packages", "testimonials",
            },
            tables);
    }

    [Fact]
    public void Core_holds_the_shared_tables_in_snake_case()
    {
        var tables = Model("core").GetRelationalModel().Tables.Select(t => t.Name).ToHashSet();

        foreach (var expected in new[]
        {
            "users", "roles", "user_roles", "settings", "page_views", "client_errors", "server_errors", "web_vitals",
            "request_metrics", "audit_log", "email_outbox", "edge_receipts", "number_counters", "data_protection_keys",
        })
        {
            Assert.Contains(expected, tables);
        }

        Assert.All(Model("core").GetRelationalModel().Tables, t => Assert.Equal("core", t.Schema));
    }

    [Fact]
    public void Info_sites_hold_contact_messages_in_their_own_schema()
    {
        foreach (var site in new[] { "main", "dev" })
        {
            var table = Assert.Single(Model(site).GetRelationalModel().Tables);
            Assert.Equal("contact_messages", table.Name);
            Assert.Equal(site, table.Schema);
        }
    }

    [Theory]
    [MemberData(nameof(ContextNames))]
    public void Every_table_and_column_name_is_snake_case(string context)
    {
        var names = Model(context).GetRelationalModel().Tables
            .SelectMany(t => t.Columns.Select(c => c.Name).Append(t.Name));

        Assert.All(names, name => Assert.Matches("^[a-z][a-z0-9_]*$", name));
    }

    [Fact]
    public void Blocking_statuses_leave_out_needs_review()
    {
        Assert.Equal(
            [AppointmentStatus.Scheduled, AppointmentStatus.Confirmed, AppointmentStatus.InProgress],
            AppointmentStatuses.Blocking);
    }

    [Fact]
    public void Sites_map_to_lowercase_schemas()
    {
        Assert.Equal(["main", "lan", "car", "dev"], Enum.GetValues<Site>().Select(s => s.Schema()));
        Assert.Equal([Site.Lan, Site.Car], BusinessSites.All);
    }

    private static Type Unwrap(Type type) => Nullable.GetUnderlyingType(type) ?? type;

    private static string Describe(IProperty p) => $"{p.DeclaringType.DisplayName()}.{p.Name}";

    private static IEnumerable<IProperty> Properties(string context) =>
        Model(context).GetEntityTypes().SelectMany(e => e.GetProperties());

    // table -> column -> store type and nullability, with the schema left out.
    private static Dictionary<string, string> Shape(string context) =>
        Model(context).GetRelationalModel().Tables.ToDictionary(
            t => t.Name,
            t => string.Join(
                ";",
                t.Columns.OrderBy(c => c.Name, StringComparer.Ordinal).Select(c => $"{c.Name}:{c.StoreType}:{c.IsNullable}")
                    .Concat(t.CheckConstraints.OrderBy(k => k.Name, StringComparer.Ordinal).Select(k => $"check {k.Name}: {k.Sql}"))
                    .Concat(t.Indexes.OrderBy(i => i.Name, StringComparer.Ordinal).Select(i => $"index {i.Name}: {i.IsUnique} {i.Filter}"))));

    private static IModel Model(string context)
    {
        using var db = Create(context);
        return db.GetService<IDesignTimeModel>().Model;
    }

    private static DbContext Create(string context) => context switch
    {
        "core" => new CoreDbContext(DesignTime.Options<CoreDbContext>("core")),
        "lan" => new LanDbContext(DesignTime.Options<LanDbContext>("lan")),
        "car" => new CarDbContext(DesignTime.Options<CarDbContext>("car")),
        "main" => new MainDbContext(DesignTime.Options<MainDbContext>("main")),
        "dev" => new DevDbContext(DesignTime.Options<DevDbContext>("dev")),
        _ => throw new ArgumentOutOfRangeException(nameof(context)),
    };
}
