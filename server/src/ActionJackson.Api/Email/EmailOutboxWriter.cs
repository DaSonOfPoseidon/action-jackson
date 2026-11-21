using System.Collections.Concurrent;
using ActionJackson.Core;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using Microsoft.Extensions.Options;
using MimeKit;

namespace ActionJackson.Api.Email;

// Queues an email as a row of the caller's own unit of work: it adds to the context and never saves.
// The caller saves the domain row and this row together, in one transaction (BusinessTransaction), so a
// booking and its confirmation either both exist or neither does. Delivery is the sender's job.
public sealed class EmailOutboxWriter(IOptions<EmailOptions> options, ILogger<EmailOutboxWriter> logger)
{
    // The longest address SMTP allows (RFC 5321 section 4.5.3.1).
    internal const int MaxAddressLength = 254;

    // Templates whose admin copy was skipped, so the log says it once per template, not once per request.
    private readonly ConcurrentDictionary<string, bool> skippedTemplates = new();

    // Adds a Pending row due now. `to` must be one plain mailbox (the calling endpoint validates the
    // customer's email first; this stops a malformed value, and header injection through it, at the last
    // door). Throws ArgumentException otherwise.
    public EmailOutboxMessage Queue(CoreDbContext core, string to, RenderedEmail email)
    {
        ArgumentNullException.ThrowIfNull(core);
        ArgumentNullException.ThrowIfNull(to);
        ArgumentNullException.ThrowIfNull(email);

        var address = ParseRecipient(to);
        var row = new EmailOutboxMessage
        {
            ToAddress = address,
            Subject = email.Subject,
            TextBody = email.TextBody,
            HtmlBody = email.HtmlBody,
            Template = email.Template,
            Status = EmailStatus.Pending,
            Attempts = 0,
            NextAttemptAt = DateTimeOffset.UtcNow,
        };
        core.EmailOutbox.Add(row);
        return row;
    }

    // Queues the email for the admin inbox. With no Email:AdminAddress it queues nothing and says so once
    // per template (Information): it is a setting, not an error. Returns whether a row was queued.
    public bool QueueAdmin(CoreDbContext core, RenderedEmail email)
    {
        ArgumentNullException.ThrowIfNull(email);

        var admin = options.Value.AdminAddress;
        if (string.IsNullOrWhiteSpace(admin))
        {
            if (skippedTemplates.TryAdd(email.Template, true))
            {
                logger.LogInformation(
                    "Email:AdminAddress is not set; {Template} admin notifications are not queued.", email.Template);
            }

            return false;
        }

        Queue(core, admin, email);
        return true;
    }

    // The bare address of one mailbox, or ArgumentException. A display name, a list, a comment or a line
    // break is not accepted.
    internal static string ParseRecipient(string to)
    {
        if (!TryParseRecipient(to, out var address))
        {
            throw new ArgumentException("The recipient must be one plain email address.", nameof(to));
        }

        return address;
    }

    internal static bool TryParseRecipient(string? to, out string address)
    {
        address = string.Empty;
        if (string.IsNullOrWhiteSpace(to) || to.Length > MaxAddressLength || to.Any(char.IsControl))
        {
            return false;
        }

        if (!MailboxAddress.TryParse(to.Trim(), out var mailbox)
            || !string.IsNullOrEmpty(mailbox.Name)
            || mailbox.Address.Length == 0
            || mailbox.Address.Contains(' ')
            || !mailbox.Address.Contains('@'))
        {
            return false;
        }

        address = mailbox.Address;
        return true;
    }
}
