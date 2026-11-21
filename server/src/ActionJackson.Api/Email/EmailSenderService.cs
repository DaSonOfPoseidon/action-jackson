using System.Diagnostics;
using System.Net.Sockets;
using ActionJackson.Core;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using NpgsqlTypes;

namespace ActionJackson.Api.Email;

// What a failed send means for its row.
internal enum SendFailure
{
    // Try again later (a timeout, a 4xx reply, a dropped connection mid-session).
    Transient,

    // Retrying cannot help (a 5xx reply to this email's recipient or content).
    Permanent,

    // The connection, the login or the sender address failed: true of every email, not of this row. The
    // whole batch stops, and the row is never marked Failed for it and never charged an attempt, however
    // long the outage lasts: fixing the server or the setting then delivers the queue.
    Connection,
}

// Delivers core.email_outbox rows over SMTP, in the background.
//
// SMTP is optional (issue #15). With no Smtp:Host this service logs one warning and returns: it never
// touches a row, so everything stays Pending, and adding the settings later and redeploying delivers
// the queue.
//
// Delivery is at least once. A row is claimed by pushing its next_attempt_at out by the claim lease, which
// hides it from every other sender (also a second instance during an overlapping redeploy). The result is
// written right after the send. A crash between the send and that write leaves the row Pending, and it is
// sent again when the lease expires; the Message-ID comes from the row id, so the copy is recognisable.
//
// Logs name a row by its id and template only. Never the address, subject or body: they are customer data.
public sealed class EmailSenderService(
    IServiceScopeFactory scopes,
    IOptions<SmtpOptions> smtpOptions,
    IOptions<EmailOptions> emailOptions,
    ILogger<EmailSenderService> logger) : BackgroundService
{
    private const int MaxLastError = 2000;

    internal static readonly TimeSpan ResultWriteTimeout = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!smtpOptions.Value.Enabled)
        {
            logger.LogWarning("SMTP is not configured (Smtp:Host is blank); queued email stays Pending.");
            return;
        }

        var settings = emailOptions.Value;
        while (!stoppingToken.IsCancellationRequested)
        {
            var moreWaiting = false;
            try
            {
                moreWaiting = await ProcessBatchAsync(settings, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception e)
            {
                // A database outage, say. Never crash the host: try again next poll.
                logger.LogError(e, "The email sender could not process a batch; it will try again.");
            }

            if (moreWaiting)
            {
                continue;
            }

            try
            {
                await Task.Delay(settings.SenderPollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    // Claims one batch and sends it. Returns whether to poll again at once: the batch was full, so more
    // rows may be due, and the server was not failing.
    private async Task<bool> ProcessBatchAsync(EmailOptions settings, CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var core = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        var rows = await ClaimAsync(core, settings, cancellationToken);
        if (rows.Count == 0)
        {
            return false;
        }

        var transport = scope.ServiceProvider.GetRequiredService<IEmailTransport>();
        var clock = Stopwatch.StartNew();
        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];

            // The claims of the rows still waiting run out after the lease. Do not send past it: give them
            // back, and the next poll claims them afresh.
            if (i > 0 && !HasTimeToSend(clock.Elapsed, settings.ClaimLease, settings.SendTimeout))
            {
                await ReleaseAsync(core, rows.Skip(i), DateTimeOffset.UtcNow);
                logger.LogInformation("The email sender gave back {Count} claimed rows before their claim ran out.", rows.Count - i);
                return true;
            }

            var failure = await TrySendAsync(transport, row, settings, cancellationToken);
            if (failure is null)
            {
                await FinishAsync(core, row.Id, EmailStatus.Sent, row.Attempts + 1, DateTimeOffset.UtcNow, null, DateTimeOffset.UtcNow);
                logger.LogInformation("Email {EmailId} ({Template}) was sent.", row.Id, row.Template);
                continue;
            }

            var kind = failure.Value.Kind;

            // A connection failure is not an attempt at this email: it is true of every email, so it is
            // never charged to the row (however long the outage, the row keeps the tries it had), and the
            // row waits one base backoff, not a growing one.
            var attempts = kind == SendFailure.Connection ? row.Attempts : row.Attempts + 1;
            var failed = kind == SendFailure.Permanent || (kind == SendFailure.Transient && attempts >= settings.MaxAttempts);
            var next = DateTimeOffset.UtcNow + EmailBackoff.Delay(kind == SendFailure.Connection ? 1 : attempts);
            await FinishAsync(
                core,
                row.Id,
                failed ? EmailStatus.Failed : EmailStatus.Pending,
                attempts,
                next,
                DescribeError(failure.Value.Error, smtpOptions.Value.Password),
                null);
            logger.LogWarning(
                "Email {EmailId} ({Template}) was not sent: {ErrorType}. Attempts used {Attempts} of {MaxAttempts}; now {Status}.",
                row.Id,
                row.Template,
                failure.Value.Error.GetType().Name,
                attempts,
                settings.MaxAttempts,
                failed ? EmailStatus.Failed : EmailStatus.Pending);

            if (kind == SendFailure.Connection)
            {
                // Do not let every remaining row burn an attempt on the same broken server: they wait out
                // the same backoff, with their attempt counts untouched.
                await ReleaseAsync(core, rows.Skip(i + 1), next);
                return false;
            }
        }

        return rows.Count >= settings.BatchSize;
    }

    private async Task<(SendFailure Kind, Exception Error)?> TrySendAsync(
        IEmailTransport transport,
        EmailOutboxMessage row,
        EmailOptions settings,
        CancellationToken cancellationToken)
    {
        MimeKit.MimeMessage message;
        try
        {
            message = EmailMessageFactory.Build(row, settings);
        }
        catch (Exception e)
        {
            // A row that cannot be turned into a message never will be.
            return (SendFailure.Permanent, e);
        }

        try
        {
            // The deadline covers the whole send (connect, login, every command), which the transport's
            // per-operation timeout does not, so the claim lease always outlasts a send that is going on.
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            deadline.CancelAfter(settings.SendTimeout);
            await transport.SendAsync(message, deadline.Token);
            return null;
        }
        catch (Exception) when (cancellationToken.IsCancellationRequested)
        {
            // Shutting down, however the transport reported the cancellation (a bare one, or a failed
            // connect that wraps it): the row keeps its claim, and is retried after the lease.
            throw;
        }
        catch (Exception e)
        {
            return (Classify(e), e);
        }
    }

    // Claims up to BatchSize due Pending rows in one statement and returns them. FOR UPDATE SKIP LOCKED
    // lets two senders each take different rows; setting next_attempt_at ahead hides the rows afterwards.
    // Everything is a parameter, including the status, which comes from the enum.
    private static async Task<List<EmailOutboxMessage>> ClaimAsync(
        CoreDbContext core,
        EmailOptions settings,
        CancellationToken cancellationToken)
    {
        await core.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var connection = (NpgsqlConnection)core.Database.GetDbConnection();
            await using var command = connection.CreateCommand();
            command.CommandText = """
                WITH due AS MATERIALIZED (
                    SELECT id FROM core.email_outbox
                    WHERE status = @pending AND next_attempt_at <= now()
                    ORDER BY next_attempt_at
                    LIMIT @batch
                    FOR UPDATE SKIP LOCKED)
                UPDATE core.email_outbox AS e
                SET next_attempt_at = now() + @lease
                FROM due
                WHERE e.id = due.id
                RETURNING e.id, e.created_at, e.to_address, e.subject, e.text_body, e.html_body, e.template, e.attempts
                """;
            command.Parameters.Add(new NpgsqlParameter("pending", NpgsqlDbType.Text) { Value = EmailStatus.Pending.ToString() });
            command.Parameters.Add(new NpgsqlParameter("batch", NpgsqlDbType.Integer) { Value = settings.BatchSize });
            command.Parameters.Add(new NpgsqlParameter("lease", NpgsqlDbType.Interval) { Value = settings.ClaimLease });

            var rows = new List<EmailOutboxMessage>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                rows.Add(new EmailOutboxMessage
                {
                    Id = reader.GetGuid(0),
                    CreatedAt = reader.GetFieldValue<DateTimeOffset>(1),
                    ToAddress = reader.GetString(2),
                    Subject = reader.GetString(3),
                    TextBody = reader.GetString(4),
                    HtmlBody = reader.GetString(5),
                    Template = reader.GetString(6),
                    Attempts = reader.GetInt32(7),
                    Status = EmailStatus.Pending,
                });
            }

            return [.. rows.OrderBy(r => r.CreatedAt)];
        }
        finally
        {
            await core.Database.CloseConnectionAsync();
        }
    }

    // Writes the result of one send. Only a row that is still Pending is touched: if another sender sent
    // it after this one's claim ran out, its result stands. It deliberately ignores the host's shutdown
    // token: a send that already happened must have its result recorded, or the row is sent again. A
    // database that does not answer within ResultWriteTimeout is given up on (the row is then resent).
    private static async Task FinishAsync(
        CoreDbContext core,
        Guid id,
        EmailStatus status,
        int attempts,
        DateTimeOffset nextAttemptAt,
        string? lastError,
        DateTimeOffset? sentAt)
    {
        using var limit = new CancellationTokenSource(ResultWriteTimeout);
        var pending = EmailStatus.Pending;
        await core.EmailOutbox
            .Where(m => m.Id == id && m.Status == pending)
            .ExecuteUpdateAsync(
                set => set
                    .SetProperty(m => m.Status, status)
                    .SetProperty(m => m.Attempts, attempts)
                    .SetProperty(m => m.NextAttemptAt, nextAttemptAt)
                    .SetProperty(m => m.LastError, lastError)
                    .SetProperty(m => m.SentAt, sentAt),
                limit.Token);
    }

    // Makes rows due again at `at`, attempts untouched. Like FinishAsync, it ignores the shutdown token.
    private static async Task ReleaseAsync(
        CoreDbContext core,
        IEnumerable<EmailOutboxMessage> rows,
        DateTimeOffset at)
    {
        var ids = rows.Select(r => r.Id).ToList();
        if (ids.Count == 0)
        {
            return;
        }

        using var limit = new CancellationTokenSource(ResultWriteTimeout);
        var pending = EmailStatus.Pending;
        await core.EmailOutbox
            .Where(m => ids.Contains(m.Id) && m.Status == pending)
            .ExecuteUpdateAsync(set => set.SetProperty(m => m.NextAttemptAt, at), limit.Token);
    }

    // Whether a batch that started `elapsed` ago can still send one more row before its claims run out.
    internal static bool HasTimeToSend(TimeSpan elapsed, TimeSpan lease, TimeSpan sendTimeout) => elapsed + sendTimeout + ResultWriteTimeout < lease;

    // Looks through the whole exception chain, because MailKit and the socket layer wrap each other.
    internal static SendFailure Classify(Exception error)
    {
        var permanent = false;
        var depth = 0;
        for (var e = error; e is not null && depth < 8; e = e.InnerException, depth++)
        {
            if (e is AuthenticationException or SaslException or ServiceNotConnectedException
                or ServiceNotAuthenticatedException or SslHandshakeException or SocketException
                or TransportConnectionException)
            {
                return SendFailure.Connection;
            }

            // The sender (Email:From) is refused for every email, so it is the server's problem like a login.
            if (e is SmtpCommandException { ErrorCode: SmtpErrorCode.SenderNotAccepted })
            {
                return SendFailure.Connection;
            }

            if (e is SmtpCommandException { StatusCode: >= (SmtpStatusCode)500 })
            {
                permanent = true;
            }
        }

        return permanent ? SendFailure.Permanent : SendFailure.Transient;
    }

    // "Type: message", with the SMTP password removed if a server or library echoed it, cut to 2000
    // characters (never in the middle of a surrogate pair).
    internal static string DescribeError(Exception error, string? password)
    {
        var text = $"{error.GetType().Name}: {error.Message}";
        if (!string.IsNullOrEmpty(password))
        {
            text = text.Replace(password, "[redacted]", StringComparison.Ordinal);
        }

        if (text.Length <= MaxLastError)
        {
            return text;
        }

        var length = char.IsHighSurrogate(text[MaxLastError - 1]) ? MaxLastError - 1 : MaxLastError;
        return text[..length];
    }
}
