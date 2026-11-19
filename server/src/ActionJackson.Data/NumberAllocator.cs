using ActionJackson.Core;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data;

// Hands out document numbers that cannot collide. One statement both reads and bumps the counter, so
// two callers can never see the same value (never read-max-then-insert). A number is used up even if
// the caller's own insert later fails, so gaps are possible and fine.
public sealed class NumberAllocator(CoreDbContext db)
{
    public const string InvoiceKind = "invoice";

    // The next value for (site, kind, year), starting at 1 for each new year.
    public async Task<int> NextAsync(Site site, string kind, int year, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(kind);
        ArgumentOutOfRangeException.ThrowIfLessThan(year, 1);

        // INSERT ... RETURNING cannot be wrapped in a subquery, so read the rows with ToListAsync
        // (which adds nothing to the SQL), not SingleAsync.
        var rows = await db.Database
            .SqlQuery<int>($"""
                INSERT INTO core.number_counters (site, kind, year, next_value)
                VALUES ({site.Schema()}, {kind}, {year}, 2)
                ON CONFLICT (site, kind, year) DO UPDATE SET next_value = number_counters.next_value + 1
                RETURNING next_value - 1 AS "Value"
                """)
            .ToListAsync(cancellationToken);
        return rows.Single();
    }

    // INV-2026-0001, per site, reset each year. Above 9999 the number just grows wider.
    public async Task<string> NextInvoiceNumberAsync(Site site, int year, CancellationToken cancellationToken = default)
    {
        var next = await NextAsync(site, InvoiceKind, year, cancellationToken);
        return $"INV-{year}-{next:D4}";
    }
}
