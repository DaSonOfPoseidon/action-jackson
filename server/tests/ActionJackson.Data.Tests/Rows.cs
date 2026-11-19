using ActionJackson.Core;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ActionJackson.Data.Tests;

// Small builders and helpers shared by the database tests.
internal static class Rows
{
    private static int days;

    // A day no other test has used. Tests in a class share one database, so appointments on the same
    // day would collide with each other's.
    public static DateTimeOffset UniqueDay() =>
        new DateTimeOffset(2030, 1, 1, 0, 0, 0, TimeSpan.Zero).AddDays(Interlocked.Increment(ref days));

    public static Customer Customer(string? email = null) => new()
    {
        Name = "Test Customer",
        Email = email ?? $"{Guid.NewGuid():N}@example.com",
    };

    // An appointment from hour `from` to hour `to` of `day`.
    public static Appointment Appointment(
        DateTimeOffset day,
        Guid customerId,
        int from,
        int to,
        AppointmentStatus status = AppointmentStatus.Scheduled,
        Guid? quoteId = null) => new()
        {
            CustomerId = customerId,
            QuoteId = quoteId,
            Kind = "survey",
            StartsAt = day.AddHours(from),
            EndsAt = day.AddHours(to),
            Status = status,
        };

    public static Quote Quote(Guid customerId, string? number = null) => new()
    {
        QuoteNumber = number ?? UniqueNumber.RandomEightDigits(),
        CustomerId = customerId,
        Status = QuoteStatus.Approved,
        Kind = "drops-only",
    };

    public static Invoice Invoice(Guid quoteId, Guid customerId, string number) => new()
    {
        InvoiceNumber = number,
        QuoteId = quoteId,
        CustomerId = customerId,
        Status = InvoiceStatus.Draft,
    };

    // Saves the entities and returns the Postgres error the save failed with, or null when it worked.
    public static async Task<PostgresException?> SaveFailureAsync(DbContext db)
    {
        try
        {
            await db.SaveChangesAsync();
            return null;
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException postgres)
        {
            return postgres;
        }
    }

    public static async Task<int> ExecuteAsync(TestDatabase database, string sql)
    {
        await using var connection = await database.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return await command.ExecuteNonQueryAsync();
    }

    public static async Task<PostgresException?> ExecuteFailureAsync(TestDatabase database, string sql)
    {
        try
        {
            await ExecuteAsync(database, sql);
            return null;
        }
        catch (PostgresException e)
        {
            return e;
        }
    }

    public static async Task<T> ScalarAsync<T>(TestDatabase database, string sql)
    {
        await using var connection = await database.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        return (T)(await command.ExecuteScalarAsync())!;
    }
}
