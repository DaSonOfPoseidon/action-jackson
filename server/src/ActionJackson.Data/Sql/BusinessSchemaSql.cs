using ActionJackson.Core;
using ActionJackson.Data.Modeling;

namespace ActionJackson.Data.Sql;

// The SQL that EF's model cannot express. The lan and car migrations both call these, so the two
// schemas cannot drift apart. A migration that already ran is never edited: if the blocking statuses
// change, a new migration drops and re-adds appointments_no_overlap (and the model's filtered index).
public static class BusinessSchemaSql
{
    // status IN ('Scheduled', 'Confirmed', 'InProgress'): the statuses that hold a time slot.
    public static string BlockingStatusCondition() => BlockingStatusCondition(AppointmentStatuses.Blocking);

    public static string BlockingStatusCondition(IEnumerable<AppointmentStatus> activeStatuses)
    {
        var names = activeStatuses.Select(status => ModelRules.SqlLiteral(status.ToString())).ToList();
        if (names.Count == 0)
        {
            throw new ArgumentException("at least one active status is required", nameof(activeStatuses));
        }

        return $"status IN ({string.Join(", ", names)})";
    }

    // No two active appointments in a schema may overlap in time. Two bookings that touch
    // ([10:00,11:00) and [11:00,12:00)) are fine. A plain range && needs no btree_gist.
    public static string NoOverlap(string schema, IEnumerable<AppointmentStatus> activeStatuses) =>
        $"""
        ALTER TABLE {Schema(schema)}.appointments ADD CONSTRAINT appointments_no_overlap
          EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
          WHERE ({BlockingStatusCondition(activeStatuses)})
        """;

    // One customer per email, however it is cased. EF cannot model an expression index.
    public static string CustomerEmailIndex(string schema) =>
        $"CREATE UNIQUE INDEX ix_customers_email_lower ON {Schema(schema)}.customers (lower(email))";

    // The schema name goes into SQL text, so only a plain lowercase name is accepted.
    private static string Schema(string schema)
    {
        if (schema.Length == 0 || schema.Any(c => !char.IsAsciiLetterLower(c)))
        {
            throw new ArgumentException($"'{schema}' is not a plain schema name", nameof(schema));
        }

        return schema;
    }
}
