using ActionJackson.Core;
using Microsoft.AspNetCore.Identity;

namespace ActionJackson.Data.Entities;

// The tables of the core schema, shared by every site. Append-only telemetry uses a bigint identity id.

public class AppUser : IdentityUser<Guid>
{
    public AppUser()
    {
        Id = Guid.CreateVersion7();
    }

    public string DisplayName { get; set; } = "";
}

// Per-site settings as one jsonb object, such as {"laborRate": 50}.
public class Setting : IHasUpdatedAt
{
    public Site Site { get; set; }
    public string Data { get; set; } = "{}";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class PageView
{
    public long Id { get; set; }
    public Site Site { get; set; }
    public required string Path { get; set; }
    public string? ReferrerHost { get; set; }

    // char(2), from the CDN's country header
    public string? Country { get; set; }
    public required string DeviceClass { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}

// The columns client_errors and server_errors share. This base is not mapped itself. An upsert on
// (source, fingerprint) increments Count.
public abstract class ErrorRecord
{
    public long Id { get; set; }
    public ErrorSource Source { get; set; }
    public Site? Site { get; set; }
    public required string Fingerprint { get; set; }
    public required string Type { get; set; }
    public required string Message { get; set; }
    public required string Stack { get; set; }
    public string? UserAgent { get; set; }
    public int Count { get; set; } = 1;
    public DateTimeOffset FirstSeen { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset LastSeen { get; set; } = DateTimeOffset.UtcNow;
}

public class ClientError : ErrorRecord
{
    public required string Url { get; set; }
}

public class ServerError : ErrorRecord
{
    public required string Path { get; set; }
}

public class WebVital
{
    public long Id { get; set; }
    public Site Site { get; set; }
    public required string Path { get; set; }

    // LCP, INP, CLS, FCP or TTFB
    public required string Metric { get; set; }

    // numeric(12,3)
    public decimal Value { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
}

public class RequestMetric
{
    public long Id { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public required string Method { get; set; }
    public required string Route { get; set; }

    // The HTTP status code, smallint.
    public short Status { get; set; }

    // numeric(10,2)
    public decimal DurationMs { get; set; }
}

public class AuditLogEntry
{
    public long Id { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public required string Actor { get; set; }
    public Site? Site { get; set; }
    public required string Action { get; set; }
    public required string EntityType { get; set; }
    public required string EntityId { get; set; }
    public string Data { get; set; } = "{}";
    public required string Ip { get; set; }
}

public class EmailOutboxMessage
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public required string ToAddress { get; set; }
    public required string Subject { get; set; }
    public required string TextBody { get; set; }
    public required string HtmlBody { get; set; }
    public required string Template { get; set; }
    public EmailStatus Status { get; set; }
    public int Attempts { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;
    public string? LastError { get; set; }
    public DateTimeOffset? SentAt { get; set; }
}

// The stored response of a request that carried an idempotency key, so a replay gets the same answer.
public class EdgeReceipt
{
    public required string IdempotencyKey { get; set; }
    public Site Site { get; set; }
    public required string Endpoint { get; set; }

    // smallint
    public short ResponseStatus { get; set; }
    public string ResponseBody { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// The next document number per (site, kind, year). Only NumberAllocator writes it.
public class NumberCounter
{
    public Site Site { get; set; }
    public required string Kind { get; set; }
    public int Year { get; set; }
    public int NextValue { get; set; }
}
