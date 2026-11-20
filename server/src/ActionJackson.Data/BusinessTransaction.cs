using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace ActionJackson.Data;

// One database transaction across a business schema (lan or car) and the core schema, so a domain row
// and the email it queues (core.email_outbox) either both exist or neither does. All the contexts use
// the same database; only the schema differs, so one connection and one transaction can serve two.
//
// How: the business context opens the connection and begins the transaction. The core context is
// pointed at that same connection and enlisted in that transaction. The work saves both contexts.
// Then the business context commits, or rolls back on any exception.
//
// No retrying execution strategy is configured (EnableRetryOnFailure is not used). If one ever is,
// this must run inside CreateExecutionStrategy().ExecuteAsync, or EF throws on the user-initiated
// transaction.
public static class BusinessTransaction
{
    public static async Task ExecuteAsync(
        BusinessDbContext business,
        CoreDbContext core,
        Func<CancellationToken, Task> work,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(work);
        await ExecuteAsync<object?>(
            business,
            core,
            async ct =>
            {
                await work(ct);
                return null;
            },
            cancellationToken);
    }

    // Runs `work` (which saves both contexts) in one transaction and returns its result. Throws
    // InvalidOperationException, before anything runs, when core or business is already in a
    // transaction or core already has its own open connection: two connections would mean two
    // transactions, and a silent half-commit. After it returns or throws, core is back on a connection of
    // its own and usable; the entities either context still tracks are the caller's to discard after a
    // failure.
    public static async Task<T> ExecuteAsync<T>(
        BusinessDbContext business,
        CoreDbContext core,
        Func<CancellationToken, Task<T>> work,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(business);
        ArgumentNullException.ThrowIfNull(core);
        ArgumentNullException.ThrowIfNull(work);

        if (business.Database.CurrentTransaction is not null || core.Database.CurrentTransaction is not null)
        {
            throw new InvalidOperationException(
                "The core and business contexts must not already be in a transaction: BusinessTransaction starts one.");
        }

        if (core.Database.GetDbConnection().State != ConnectionState.Closed)
        {
            throw new InvalidOperationException(
                "The core context already has an open connection of its own; it cannot join the business transaction.");
        }

        // Kept to give core a connection of its own again afterwards.
        var coreConnectionString = core.Database.GetConnectionString()
            ?? throw new InvalidOperationException("The core context has no connection string.");

        await using var transaction = await business.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // The business connection is owned by the business context, which closes it.
            core.Database.SetDbConnection(business.Database.GetDbConnection(), contextOwnsConnection: false);
            await core.Database.UseTransactionAsync(transaction.GetDbTransaction(), cancellationToken);

            var result = await work(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            // Not the caller's token: a cancelled request must still roll back.
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
        finally
        {
            await core.Database.UseTransactionAsync(null, CancellationToken.None);
            core.Database.SetDbConnection(new NpgsqlConnection(coreConnectionString), contextOwnsConnection: true);
        }
    }
}
