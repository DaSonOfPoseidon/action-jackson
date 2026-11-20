namespace ActionJackson.Data.Entities;

// A table with a validated jsonb "details" column for site-specific fields. The model gives it
// jsonb, a default of '{}' and a check that the value is a JSON object, so new fields need no migration.
// The CLR type is string: Npgsql sends it as jsonb, and a changed string is seen by change tracking.
public interface IHasDetails
{
    string Details { get; set; }
}

// A table whose updated_at is set by the context whenever a tracked row is modified.
public interface IHasUpdatedAt
{
    DateTimeOffset UpdatedAt { get; set; }
}
