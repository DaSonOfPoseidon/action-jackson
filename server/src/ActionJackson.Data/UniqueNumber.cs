using System.Globalization;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ActionJackson.Data;

// Quote and consultation numbers are eight random digits. Two requests can draw the same one, so the
// column has a unique constraint and the insert retries with a new number when that constraint is hit.
public static class UniqueNumber
{
    // Retries after the first attempt, so at most six inserts.
    public const int MaxRetries = 5;

    private const string UniqueViolation = "23505";

    public static string RandomEightDigits() =>
        RandomNumberGenerator.GetInt32(10_000_000, 100_000_000).ToString(CultureInfo.InvariantCulture);

    // Calls insert with a number until it succeeds, and returns that number. Only a violation of
    // `constraint` (the unique index on the number column) is retried: any other failure, including a
    // unique violation of some other index, is thrown at once. insert is called again after a failure,
    // so it must start clean (build a new entity, or clear the context's change tracker). When all the
    // retries collide, it throws InvalidOperationException with the last violation inside.
    public static async Task<string> InsertWithRetryAsync(
        Func<string, CancellationToken, Task> insert,
        string constraint,
        Func<string>? generate = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(insert);
        ArgumentException.ThrowIfNullOrWhiteSpace(constraint);
        generate ??= RandomEightDigits;

        for (var retries = 0; ; retries++)
        {
            var number = generate();
            try
            {
                await insert(number, cancellationToken);
                return number;
            }
            catch (Exception e) when (IsUniqueViolation(e, constraint))
            {
                if (retries >= MaxRetries)
                {
                    throw new InvalidOperationException(
                        $"Could not find an unused number after {MaxRetries} retries ({constraint})", e);
                }
            }
        }
    }

    // True when e is, or wraps, Postgres error 23505 on the named constraint or index.
    public static bool IsUniqueViolation(Exception e, string constraint)
    {
        var postgres = e as PostgresException ?? (e as DbUpdateException)?.InnerException as PostgresException;
        return postgres is { SqlState: UniqueViolation } && postgres.ConstraintName == constraint;
    }
}
