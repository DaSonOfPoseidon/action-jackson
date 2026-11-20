using ActionJackson.Core;

namespace ActionJackson.Data.Entities;

// The tables of the info sites (main and dev).

public class ContactMessage
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? Subject { get; set; }
    public required string Body { get; set; }
    public ContactStatus Status { get; set; }
    public required string SourceIp { get; set; }
    public required string UserAgent { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
