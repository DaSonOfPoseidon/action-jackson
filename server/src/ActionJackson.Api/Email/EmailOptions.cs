namespace ActionJackson.Api.Email;

// How the connection to the SMTP server is secured.
public enum SmtpSecurity
{
    // Connect in clear text, then upgrade with STARTTLS (port 587). The upgrade is required.
    StartTls,

    // TLS from the first byte (port 465).
    SslOnConnect,

    // No encryption. Accepted only with no username, so credentials are never sent in clear text.
    None,
}

// The SMTP server. SMTP is optional (issue #15): a blank Host means delivery is off, queued email stays
// Pending, and nothing else here is required.
public sealed class SmtpOptions
{
    public const string Section = "Smtp";

    public string? Host { get; set; }

    public int Port { get; set; } = 587;

    public SmtpSecurity Security { get; set; } = SmtpSecurity.StartTls;

    public string? Username { get; set; }

    // A secret. It lives only in the environment (Smtp__Password), has no default, and is never logged
    // or stored.
    public string? Password { get; set; }

    public bool Enabled => !string.IsNullOrWhiteSpace(Host);
}

public sealed class EmailOptions
{
    public const string Section = "Email";

    // The sender: an address with an optional display name, e.g. Action Jackson <noreply@example.com>.
    public string? From { get; set; }

    // Where admin notifications go. Blank means they are not queued.
    public string? AdminAddress { get; set; }

    // How often the sender looks for due rows.
    public TimeSpan SenderPollInterval { get; set; } = TimeSpan.FromSeconds(15);

    // Rows claimed per poll.
    public int BatchSize { get; set; } = 20;

    // The attempt after which a transient failure becomes Failed.
    public int MaxAttempts { get; set; } = 8;

    // How long a claimed row is hidden from other senders. A send that never records its result (a
    // crash) is retried after this. It must be longer than one send can take (90 seconds), or a second
    // sender could send the same row too.
    public TimeSpan ClaimLease { get; set; } = TimeSpan.FromMinutes(5);
}
