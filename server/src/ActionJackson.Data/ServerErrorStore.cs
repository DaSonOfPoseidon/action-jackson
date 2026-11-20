using System.Text;
using ActionJackson.Core;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data;

// Writes core.server_errors: one row per (source, fingerprint), with a count. The API's error handler
// uses it, and so can the browser and edge error intake later.
public static class ServerErrorStore
{
    public const int MaxType = 512;
    public const int MaxMessage = 2000;
    public const int MaxStack = 16000;
    public const int MaxPath = 2048;
    public const int MaxUserAgent = 512;

    // Inserts the error, or when (source, fingerprint) exists, counts it again and keeps the latest sample
    // (message, stack, path). first_seen keeps the first. One statement, so concurrent errors cannot lose
    // a count. The values are parameters; they are cut to their limits first.
    public static async Task UpsertAsync(CoreDbContext db, ServerError error, CancellationToken cancellationToken)
    {
        var source = error.Source.ToString();
        var site = error.Site?.Schema();
        var fingerprint = Clean(error.Fingerprint, 128)!;
        var type = Clean(error.Type, MaxType)!;
        var message = Clean(error.Message, MaxMessage)!;
        var stack = Clean(error.Stack, MaxStack)!;
        var path = Clean(error.Path, MaxPath)!;
        var userAgent = Clean(error.UserAgent, MaxUserAgent);
        var count = error.Count;
        var firstSeen = error.FirstSeen.ToUniversalTime();
        var lastSeen = error.LastSeen.ToUniversalTime();

        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO core.server_errors
                (source, site, fingerprint, type, message, stack, user_agent, path, count, first_seen, last_seen)
            VALUES
                ({source}, {site}, {fingerprint}, {type}, {message}, {stack}, {userAgent}, {path}, {count}, {firstSeen}, {lastSeen})
            ON CONFLICT (source, fingerprint) DO UPDATE SET
                count = server_errors.count + 1,
                last_seen = now(),
                message = excluded.message,
                stack = excluded.stack,
                path = excluded.path
            """,
            cancellationToken);
    }

    // Cuts to `max` characters without splitting a surrogate pair. Postgres text cannot hold a NUL, and
    // an unpaired surrogate is not valid UTF-8, so those are dropped / replaced first.
    internal static string? Clean(string? value, int max)
    {
        if (value is null)
        {
            return null;
        }

        var clean = new StringBuilder(Math.Min(value.Length, max + 1));
        for (var i = 0; i < value.Length && clean.Length < max; i++)
        {
            var c = value[i];
            if (c == '\0')
            {
                continue;
            }

            if (char.IsHighSurrogate(c))
            {
                // A pair needs room for both halves.
                if (i + 1 < value.Length && char.IsLowSurrogate(value[i + 1]))
                {
                    if (clean.Length + 2 > max)
                    {
                        break;
                    }

                    clean.Append(c).Append(value[++i]);
                }
                else
                {
                    clean.Append('�');
                }
            }
            else
            {
                clean.Append(char.IsLowSurrogate(c) ? '�' : c);
            }
        }

        return clean.ToString();
    }
}
