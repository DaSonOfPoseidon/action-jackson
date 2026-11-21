using System.Collections.Concurrent;
using ActionJackson.Api.Email;
using ActionJackson.Api.Tests.Platform;
using ActionJackson.Core;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Tests;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace ActionJackson.Api.Tests.Email;

public class EmailSenderTests(TestDatabase database) : IClassFixture<TestDatabase>, IAsyncLifetime
{
    // A made-up value: no real secret is used in a test.
    private const string Password = "hunter2-not-a-real-password";

    public async Task InitializeAsync()
    {
        // The tests of a class run one at a time on one database: start each from an empty outbox.
        if (!TestDatabase.CanSkip)
        {
            await using var core = database.Core();
            await core.Database.ExecuteSqlRawAsync("TRUNCATE core.email_outbox");
        }
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<EmailOutboxMessage> AddAsync(
        DateTimeOffset? due = null,
        EmailStatus status = EmailStatus.Pending,
        int attempts = 0,
        string to = "pat@example.com")
    {
        var row = new EmailOutboxMessage
        {
            ToAddress = to,
            Subject = "Subject",
            TextBody = "text",
            HtmlBody = "<p>html</p>",
            Template = EmailTemplates.ConsultationAck,
            Status = status,
            Attempts = attempts,
            NextAttemptAt = due ?? DateTimeOffset.UtcNow.AddSeconds(-5),
        };
        await using var core = database.Core();
        core.EmailOutbox.Add(row);
        await core.SaveChangesAsync();
        return row;
    }

    private async Task<EmailOutboxMessage> RowAsync(Guid id)
    {
        await using var core = database.Core();
        return await core.EmailOutbox.AsNoTracking().SingleAsync(m => m.Id == id);
    }

    private async Task WaitForAsync(Func<Task<bool>> condition, int seconds = 15)
    {
        var deadline = DateTime.UtcNow.AddSeconds(seconds);
        while (!await condition())
        {
            Assert.True(DateTime.UtcNow < deadline, "timed out waiting for the sender");
            await Task.Delay(25);
        }
    }

    private Task<PlatformHost> StartAsync(
        FakeTransport transport,
        Action<SmtpOptions>? smtp = null,
        Action<EmailOptions>? email = null,
        string? connectionString = null,
        bool configured = true) =>
        PlatformHost.StartAsync(
            PlatformHost.NewKey(),
            app => app.MapGet("/ping", () => "pong"),
            builder =>
            {
                builder.Services.AddActionJacksonData(connectionString ?? database.ConnectionString);
                builder.Services.AddSingleton<IEmailTransport>(transport);
                builder.Services.Configure<SmtpOptions>(o =>
                {
                    if (configured)
                    {
                        o.Host = "smtp.test.invalid";
                        o.Password = Password;
                    }

                    smtp?.Invoke(o);
                });
                builder.Services.Configure<EmailOptions>(o =>
                {
                    o.From = "Action Jackson <noreply@example.com>";
                    o.SenderPollInterval = TimeSpan.FromMilliseconds(40);
                    email?.Invoke(o);
                });
            });

    [DbFact]
    public async Task With_no_smtp_host_rows_stay_pending_and_the_transport_is_never_used()
    {
        var row = await AddAsync();
        var transport = new FakeTransport();
        await using var host = await StartAsync(transport, configured: false);

        await Task.Delay(600);

        var after = await RowAsync(row.Id);
        Assert.Equal(EmailStatus.Pending, after.Status);
        Assert.Equal(0, after.Attempts);
        Assert.Equal(row.NextAttemptAt, after.NextAttemptAt, TimeSpan.FromMilliseconds(1));
        Assert.Equal(0, transport.Calls);
        var warnings = host.Logs.Lines.Where(l => l.Message.Contains("SMTP is not configured")).ToList();
        Assert.Single(warnings);
        Assert.Equal(LogLevel.Warning, warnings[0].Level);
    }

    [DbFact]
    public async Task A_due_pending_row_is_sent_and_marked_sent()
    {
        var row = await AddAsync();
        var transport = new FakeTransport();
        await using var host = await StartAsync(transport);

        await WaitForAsync(async () => (await RowAsync(row.Id)).Status == EmailStatus.Sent);

        var after = await RowAsync(row.Id);
        Assert.NotNull(after.SentAt);
        Assert.Equal(1, after.Attempts);
        Assert.Null(after.LastError);
        var sent = Assert.Single(transport.Sent);
        Assert.Equal("pat@example.com", sent.To.Mailboxes.Single().Address);
        Assert.Equal($"{row.Id}@actionjacksoninstalls.com", sent.MessageId);
    }

    [DbFact]
    public async Task Future_sent_and_failed_rows_are_never_picked_up()
    {
        var future = await AddAsync(due: DateTimeOffset.UtcNow.AddHours(1));
        var sentRow = await AddAsync(status: EmailStatus.Sent);
        var failed = await AddAsync(status: EmailStatus.Failed, attempts: 8);
        var due = await AddAsync();
        var transport = new FakeTransport();
        await using var host = await StartAsync(transport);

        await WaitForAsync(async () => (await RowAsync(due.Id)).Status == EmailStatus.Sent);
        await Task.Delay(300);

        Assert.Equal(1, transport.Calls);
        Assert.Equal(EmailStatus.Pending, (await RowAsync(future.Id)).Status);
        Assert.Equal(0, (await RowAsync(future.Id)).Attempts);
        Assert.Equal(EmailStatus.Sent, (await RowAsync(sentRow.Id)).Status);
        Assert.Equal(0, (await RowAsync(sentRow.Id)).Attempts);
        Assert.Equal(EmailStatus.Failed, (await RowAsync(failed.Id)).Status);
        Assert.Equal(8, (await RowAsync(failed.Id)).Attempts);
    }

    [DbFact]
    public async Task A_transient_failure_counts_an_attempt_and_backs_off_a_minute()
    {
        var row = await AddAsync();
        var transport = new FakeTransport { Fail = _ => new IOException("connection reset " + new string('x', 5000)) };
        await using var host = await StartAsync(transport);
        var started = DateTimeOffset.UtcNow;

        await WaitForAsync(async () => (await RowAsync(row.Id)).Attempts == 1);
        await Task.Delay(300);

        var after = await RowAsync(row.Id);
        Assert.Equal(EmailStatus.Pending, after.Status);
        Assert.Equal(1, after.Attempts);
        Assert.Null(after.SentAt);
        Assert.InRange(after.NextAttemptAt, started.AddSeconds(45), DateTimeOffset.UtcNow.AddSeconds(75));
        Assert.StartsWith("IOException: connection reset", after.LastError);
        Assert.Equal(2000, after.LastError!.Length);
        Assert.Equal(1, transport.Calls);
    }

    [DbFact]
    public async Task The_max_attempts_th_transient_failure_marks_the_row_failed()
    {
        var row = await AddAsync(attempts: 2);
        var transport = new FakeTransport { Fail = _ => new IOException("down") };
        await using var host = await StartAsync(transport, email: o => o.MaxAttempts = 3);

        await WaitForAsync(async () => (await RowAsync(row.Id)).Status == EmailStatus.Failed);

        var after = await RowAsync(row.Id);
        Assert.Equal(3, after.Attempts);
        Assert.NotNull(after.LastError);
    }

    [DbFact]
    public async Task One_transient_failure_before_the_max_leaves_the_row_pending()
    {
        var row = await AddAsync(attempts: 1);
        var transport = new FakeTransport { Fail = _ => new IOException("down") };
        await using var host = await StartAsync(transport, email: o => o.MaxAttempts = 3);

        await WaitForAsync(async () => (await RowAsync(row.Id)).Attempts == 2);
        await Task.Delay(200);

        Assert.Equal(EmailStatus.Pending, (await RowAsync(row.Id)).Status);
    }

    [DbFact]
    public async Task A_permanent_5xx_failure_marks_the_row_failed_at_once()
    {
        var row = await AddAsync();
        var transport = new FakeTransport
        {
            Fail = _ => new SmtpCommandException(SmtpErrorCode.RecipientNotAccepted, SmtpStatusCode.MailboxUnavailable, "550 no such user"),
        };
        await using var host = await StartAsync(transport);

        await WaitForAsync(async () => (await RowAsync(row.Id)).Status == EmailStatus.Failed);

        var after = await RowAsync(row.Id);
        Assert.Equal(1, after.Attempts);
        Assert.Contains("550 no such user", after.LastError);
        Assert.Equal(1, transport.Calls);
    }

    [DbFact]
    public async Task A_4xx_reply_is_transient()
    {
        var row = await AddAsync();
        var transport = new FakeTransport
        {
            Fail = _ => new SmtpCommandException(SmtpErrorCode.RecipientNotAccepted, SmtpStatusCode.MailboxBusy, "450 try later"),
        };
        await using var host = await StartAsync(transport);

        await WaitForAsync(async () => (await RowAsync(row.Id)).Attempts == 1);
        await Task.Delay(200);

        Assert.Equal(EmailStatus.Pending, (await RowAsync(row.Id)).Status);
    }

    [DbFact]
    public async Task An_authentication_failure_uses_no_attempt_and_releases_the_rest_of_the_batch()
    {
        var first = await AddAsync(due: DateTimeOffset.UtcNow.AddSeconds(-30));
        var second = await AddAsync(due: DateTimeOffset.UtcNow.AddSeconds(-20));
        var third = await AddAsync(due: DateTimeOffset.UtcNow.AddSeconds(-10));
        var transport = new FakeTransport { Fail = _ => new AuthenticationException("535 authentication failed") };
        await using var host = await StartAsync(transport, email: o => o.BatchSize = 3);

        await WaitForAsync(async () => (await RowAsync(first.Id)).LastError is not null);
        await Task.Delay(400);

        Assert.Equal(1, transport.Calls);
        var one = await RowAsync(first.Id);
        var two = await RowAsync(second.Id);
        var three = await RowAsync(third.Id);
        Assert.Equal(EmailStatus.Pending, one.Status);
        Assert.Equal(0, one.Attempts);
        Assert.Equal(0, two.Attempts);
        Assert.Equal(0, three.Attempts);
        Assert.Equal(EmailStatus.Pending, two.Status);
        Assert.Equal(EmailStatus.Pending, three.Status);

        // The released rows wait out the same backoff as the row that failed, so the next poll does not
        // try the broken server again.
        Assert.True(two.NextAttemptAt > DateTimeOffset.UtcNow.AddSeconds(30));
        Assert.True(three.NextAttemptAt > DateTimeOffset.UtcNow.AddSeconds(30));
    }

    [DbFact]
    public async Task A_server_outage_neither_fails_a_row_nor_uses_one_of_its_attempts()
    {
        // The server being down is not the email's fault: a long outage or a wrong password must not
        // permanently fail whichever row happens to be first in the queue.
        var row = await AddAsync(attempts: 7);
        var transport = new FakeTransport { Fail = _ => new AuthenticationException("535 authentication failed") };
        await using var host = await StartAsync(transport, email: o => o.MaxAttempts = 8);

        await WaitForAsync(async () => (await RowAsync(row.Id)).LastError is not null);
        await Task.Delay(300);

        // The row keeps the 7 attempts it had: an outage is not an attempt at this email, so once the
        // setting is fixed an ordinary 4xx still leaves it a try.
        var after = await RowAsync(row.Id);
        Assert.Equal(EmailStatus.Pending, after.Status);
        Assert.Equal(7, after.Attempts);
        Assert.StartsWith("AuthenticationException:", after.LastError);
        Assert.True(after.NextAttemptAt > DateTimeOffset.UtcNow.AddSeconds(30));
    }

    [DbFact]
    public async Task A_connection_failure_also_stops_the_batch()
    {
        var first = await AddAsync(due: DateTimeOffset.UtcNow.AddSeconds(-30));
        var second = await AddAsync(due: DateTimeOffset.UtcNow.AddSeconds(-20));
        var transport = new FakeTransport
        {
            Fail = _ => new TransportConnectionException("could not connect", new System.Net.Sockets.SocketException(111)),
        };
        await using var host = await StartAsync(transport);

        await WaitForAsync(async () => (await RowAsync(first.Id)).LastError is not null);
        await Task.Delay(300);

        Assert.Equal(1, transport.Calls);
        Assert.Equal(0, (await RowAsync(first.Id)).Attempts);
        Assert.Equal(0, (await RowAsync(second.Id)).Attempts);
    }

    [DbFact]
    public async Task Two_senders_over_ten_rows_send_each_row_exactly_once()
    {
        var ids = new List<Guid>();
        for (var i = 0; i < 10; i++)
        {
            ids.Add((await AddAsync(due: DateTimeOffset.UtcNow.AddSeconds(-60 + i))).Id);
        }

        // Both senders share one transport, so its log is the count of every send.
        var transport = new FakeTransport { Delay = TimeSpan.FromMilliseconds(30) };
        await using var one = await StartAsync(transport, email: o => o.BatchSize = 3);
        await using var two = await StartAsync(transport, email: o => o.BatchSize = 3);

        await WaitForAsync(async () =>
        {
            foreach (var id in ids)
            {
                if ((await RowAsync(id)).Status != EmailStatus.Sent)
                {
                    return false;
                }
            }

            return true;
        });
        await Task.Delay(300);

        var counts = transport.Sent.GroupBy(m => m.MessageId!).ToDictionary(g => g.Key, g => g.Count());
        Assert.Equal(10, counts.Count);
        Assert.All(counts, pair => Assert.Equal(1, pair.Value));
    }

    [DbFact]
    public async Task A_database_outage_is_logged_and_the_host_keeps_running()
    {
        var transport = new FakeTransport();
        await using var host = await StartAsync(
            transport,
            connectionString: "Host=127.0.0.1;Port=1;Username=x;Password=x;Database=x;Timeout=1");

        await WaitForAsync(() => Task.FromResult(
            host.Logs.Lines.Count(l => l.Level == LogLevel.Error && l.Message.Contains("email sender")) >= 2));

        using var response = await host.Client.GetAsync("/ping");
        Assert.True(response.IsSuccessStatusCode);
        Assert.Equal(0, transport.Calls);
    }

    [DbFact]
    public async Task The_smtp_password_never_reaches_last_error()
    {
        var row = await AddAsync();
        var transport = new FakeTransport
        {
            Fail = _ => new AuthenticationException($"AUTH failed, the password was {Password}"),
        };
        await using var host = await StartAsync(transport);

        await WaitForAsync(async () => (await RowAsync(row.Id)).LastError is not null);

        var after = await RowAsync(row.Id);
        Assert.NotNull(after.LastError);
        Assert.DoesNotContain(Password, after.LastError);
        Assert.StartsWith("AuthenticationException:", after.LastError);
        Assert.DoesNotContain(host.Logs.Lines, l => l.Message.Contains(Password));
    }

    [DbFact]
    public async Task Logs_name_the_row_and_template_but_never_the_address_subject_or_body()
    {
        var row = await AddAsync(to: "private.person@example.com");
        var transport = new FakeTransport { Fail = _ => new IOException("550 private.person@example.com rejected") };
        await using var host = await StartAsync(transport);

        await WaitForAsync(async () => (await RowAsync(row.Id)).Attempts == 1);
        await Task.Delay(200);

        var lines = host.Logs.Lines.Select(l => l.Message).ToList();
        Assert.Contains(lines, l => l.Contains(row.Id.ToString()));
        Assert.DoesNotContain(lines, l => l.Contains("private.person@example.com"));
        Assert.DoesNotContain(lines, l => l.Contains("<p>html</p>"));
    }

    [DbFact]
    public async Task A_send_cancelled_by_shutdown_leaves_the_row_claimed_until_its_lease_expires()
    {
        var row = await AddAsync();
        var transport = new FakeTransport { Block = true };
        var host = await StartAsync(transport, email: o => o.ClaimLease = TimeSpan.FromMinutes(5));
        await WaitForAsync(() => Task.FromResult(transport.Calls == 1));

        await host.DisposeAsync();

        var after = await RowAsync(row.Id);
        Assert.Equal(EmailStatus.Pending, after.Status);
        Assert.Equal(0, after.Attempts);
        Assert.Null(after.LastError);
        Assert.True(after.NextAttemptAt > DateTimeOffset.UtcNow.AddMinutes(4));
    }

    [DbFact]
    public async Task A_send_that_runs_past_the_send_timeout_is_cut_off_and_retried_later()
    {
        // Nothing else bounds a send that keeps answering each command just in time: the deadline does,
        // so the claim lease can never run out under a send that is still going.
        var row = await AddAsync();
        var transport = new FakeTransport { Block = true };
        await using var host = await StartAsync(transport, email: o => o.SendTimeout = TimeSpan.FromMilliseconds(200));

        await WaitForAsync(async () => (await RowAsync(row.Id)).Attempts == 1);

        var after = await RowAsync(row.Id);
        Assert.Equal(EmailStatus.Pending, after.Status);
        Assert.Contains("Cancel", after.LastError);
        Assert.True(after.NextAttemptAt > DateTimeOffset.UtcNow.AddSeconds(30));
    }

    [Fact]
    public void Backoff_doubles_from_a_minute_and_caps_at_six_hours()
    {
        Assert.Equal(TimeSpan.FromMinutes(1), EmailBackoff.Delay(1, 0));
        Assert.Equal(TimeSpan.FromMinutes(2), EmailBackoff.Delay(2, 0));
        Assert.Equal(TimeSpan.FromMinutes(4), EmailBackoff.Delay(3, 0));
        Assert.Equal(TimeSpan.FromMinutes(256), EmailBackoff.Delay(9, 0));
        Assert.Equal(TimeSpan.FromHours(6), EmailBackoff.Delay(10, 0));
        Assert.Equal(TimeSpan.FromHours(6), EmailBackoff.Delay(10, 1));
        Assert.Equal(TimeSpan.FromHours(6), EmailBackoff.Delay(500, 0));
        Assert.Equal(TimeSpan.FromHours(6), EmailBackoff.Delay(int.MaxValue, 0));
    }

    [Fact]
    public void Backoff_jitter_is_plus_or_minus_twenty_percent()
    {
        Assert.Equal(TimeSpan.FromSeconds(48), EmailBackoff.Delay(1, -1));
        Assert.Equal(TimeSpan.FromSeconds(72), EmailBackoff.Delay(1, 1));
        Assert.Equal(TimeSpan.FromSeconds(60), EmailBackoff.Delay(1, 0));
        var random = EmailBackoff.Delay(1);
        Assert.InRange(random, TimeSpan.FromSeconds(48), TimeSpan.FromSeconds(72));
    }

    [Fact]
    public void A_batch_stops_before_a_claim_lease_could_run_out()
    {
        var lease = TimeSpan.FromMinutes(5);
        var timeout = TimeSpan.FromSeconds(90);

        Assert.True(EmailSenderService.HasTimeToSend(TimeSpan.Zero, lease, timeout));
        Assert.True(EmailSenderService.HasTimeToSend(TimeSpan.FromMinutes(3), lease, timeout));
        Assert.False(EmailSenderService.HasTimeToSend(TimeSpan.FromMinutes(4.5), lease, timeout));
        Assert.False(EmailSenderService.HasTimeToSend(TimeSpan.FromMinutes(6), lease, timeout));
    }

    [Theory]
    [InlineData("auth", true)]
    [InlineData("not-connected", true)]
    [InlineData("not-authenticated", true)]
    [InlineData("socket", true)]
    [InlineData("transport", true)]
    [InlineData("io", false)]
    [InlineData("timeout", false)]
    public void Connection_and_authentication_failures_stop_the_batch(string kind, bool stops)
    {
        Exception error = kind switch
        {
            "auth" => new AuthenticationException("535"),
            "not-connected" => new ServiceNotConnectedException("not connected"),
            "not-authenticated" => new ServiceNotAuthenticatedException("not authenticated"),
            "socket" => new System.Net.Sockets.SocketException(111),
            "transport" => new TransportConnectionException("could not connect", new IOException()),
            "io" => new IOException("reset"),
            _ => new TimeoutException("slow"),
        };

        Assert.Equal(stops, EmailSenderService.Classify(error) == SendFailure.Connection);
    }

    [Fact]
    public void A_connection_failure_is_found_inside_a_wrapper()
    {
        var wrapped = new InvalidOperationException("outer", new AuthenticationException("inner"));

        Assert.Equal(SendFailure.Connection, EmailSenderService.Classify(wrapped));
    }

    [Fact]
    public void A_refused_sender_is_the_servers_problem_not_the_rows()
    {
        // Email:From rejected (an unverified domain, say) is true of every email: it must stop the batch
        // and fail nothing, so fixing the setting delivers the queue.
        var refused = new SmtpCommandException(SmtpErrorCode.SenderNotAccepted, SmtpStatusCode.MailboxUnavailable, "550 sender rejected");

        Assert.Equal(SendFailure.Connection, EmailSenderService.Classify(refused));
    }

    [Fact]
    public void Only_5xx_smtp_replies_are_permanent()
    {
        Assert.Equal(
            SendFailure.Permanent,
            EmailSenderService.Classify(new SmtpCommandException(SmtpErrorCode.MessageNotAccepted, SmtpStatusCode.TransactionFailed, "554")));
        Assert.Equal(
            SendFailure.Transient,
            EmailSenderService.Classify(new SmtpCommandException(SmtpErrorCode.MessageNotAccepted, SmtpStatusCode.InsufficientStorage, "452")));
        Assert.Equal(SendFailure.Transient, EmailSenderService.Classify(new IOException("reset")));
    }

    [Fact]
    public void Last_error_is_the_type_and_message_cut_to_2000_characters_without_the_password()
    {
        var error = new IOException($"{Password} " + new string('z', 3000));

        var text = EmailSenderService.DescribeError(error, Password);

        Assert.Equal(2000, text.Length);
        Assert.StartsWith("IOException: ", text);
        Assert.DoesNotContain(Password, text);
    }

    private sealed class FakeTransport : IEmailTransport
    {
        private int calls;

        public ConcurrentQueue<MimeMessage> Sent { get; } = new();

        public int Calls => Volatile.Read(ref calls);

        public Func<MimeMessage, Exception?>? Fail { get; init; }

        public TimeSpan Delay { get; init; }

        // Waits for the cancellation, like a send that hangs when the host shuts down.
        public bool Block { get; init; }

        public async Task SendAsync(MimeMessage message, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref calls);
            if (Block)
            {
                await Task.Delay(Timeout.Infinite, cancellationToken);
            }

            if (Delay > TimeSpan.Zero)
            {
                await Task.Delay(Delay, cancellationToken);
            }

            if (Fail?.Invoke(message) is { } error)
            {
                throw error;
            }

            Sent.Enqueue(message);
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
