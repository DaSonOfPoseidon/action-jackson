using ActionJackson.Core;
using ActionJackson.Data.Sql;

namespace ActionJackson.Data.Tests;

public class BusinessSchemaSqlTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    // The exact text the initial lan and car migrations ran. If the blocking statuses change, this
    // test fails: add a migration that replaces the constraint, then update the text here.
    private const string InitialNoOverlap =
        "ALTER TABLE lan.appointments ADD CONSTRAINT appointments_no_overlap\n" +
        "  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)\n" +
        "  WHERE (status IN ('Scheduled', 'Confirmed', 'InProgress'))";

    [Fact]
    public void The_initial_overlap_constraint_text_has_not_changed()
    {
        Assert.Equal(InitialNoOverlap, BusinessSchemaSql.NoOverlap("lan", AppointmentStatuses.Blocking).ReplaceLineEndings("\n"));
    }

    [Fact]
    public void The_overlap_sql_is_built_for_the_schema_it_is_given()
    {
        Assert.StartsWith("ALTER TABLE car.appointments ", BusinessSchemaSql.NoOverlap("car", AppointmentStatuses.Blocking));
    }

    [Theory]
    [InlineData("")]
    [InlineData("lan; DROP TABLE x")]
    [InlineData("Lan")]
    [InlineData("lan.x")]
    public void A_schema_that_is_not_a_plain_name_is_refused(string schema)
    {
        Assert.Throws<ArgumentException>(() => BusinessSchemaSql.NoOverlap(schema, AppointmentStatuses.Blocking));
        Assert.Throws<ArgumentException>(() => BusinessSchemaSql.CustomerEmailIndex(schema));
    }

    [Fact]
    public void At_least_one_active_status_is_needed()
    {
        Assert.Throws<ArgumentException>(() => BusinessSchemaSql.NoOverlap("lan", []));
    }

    [DbTheory]
    [InlineData("lan")]
    [InlineData("car")]
    public async Task The_database_holds_the_same_constraint_in_both_schemas(string schema)
    {
        var definition = await Rows.ScalarAsync<string>(
            database,
            $"""
            SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE n.nspname = '{schema}' AND c.conname = 'appointments_no_overlap'
            """);

        Assert.Contains("EXCLUDE USING gist", definition);
        Assert.Contains("'Scheduled'", definition);
        Assert.Contains("'Confirmed'", definition);
        Assert.Contains("'InProgress'", definition);
        Assert.DoesNotContain("NeedsReview", definition);
        Assert.DoesNotContain("btree_gist", await Rows.ScalarAsync<string>(database, "SELECT coalesce(string_agg(extname, ','), '') FROM pg_extension"));
    }
}
