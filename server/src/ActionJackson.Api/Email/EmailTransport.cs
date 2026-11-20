using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace ActionJackson.Api.Email;

// Delivers messages to an SMTP server. The sender asks for one per batch (a scoped service) and
// disposes it at the end, so a batch shares one connection.
public interface IEmailTransport : IAsyncDisposable
{
    // Sends one message. Throws when it could not: the sender classifies the exception (a connection or
    // authentication failure stops the batch, a 5xx reply fails the row, anything else is retried).
    Task SendAsync(MimeMessage message, CancellationToken cancellationToken);
}

// Connecting or authenticating failed. The sender treats it as the server's problem, not the row's.
public sealed class TransportConnectionException(string message, Exception innerException)
    : Exception(message, innerException);

// A thin adapter over MailKit's SmtpClient: no logic of its own, and no test against a live server.
internal sealed class MailKitTransport(IOptions<SmtpOptions> options) : IEmailTransport
{
    // Every connect, authenticate and send is cut off after this long.
    internal const int TimeoutMilliseconds = 30_000;

    private SmtpClient? client;

    public async Task SendAsync(MimeMessage message, CancellationToken cancellationToken)
    {
        var smtp = await ConnectedAsync(cancellationToken);
        await smtp.SendAsync(message, cancellationToken);
    }

    // Connects (and authenticates) on first use, and again after a failure dropped the connection.
    private async Task<SmtpClient> ConnectedAsync(CancellationToken cancellationToken)
    {
        if (client is { IsConnected: true })
        {
            return client;
        }

        client?.Dispose();
        client = null;

        var settings = options.Value;
        var created = new SmtpClient { Timeout = TimeoutMilliseconds };
        try
        {
            await created.ConnectAsync(settings.Host!, settings.Port, Map(settings.Security), cancellationToken);
            if (!string.IsNullOrWhiteSpace(settings.Username))
            {
                await created.AuthenticateAsync(settings.Username, settings.Password ?? string.Empty, cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            created.Dispose();
            throw;
        }
        catch (Exception e)
        {
            created.Dispose();
            throw new TransportConnectionException(
                $"Could not connect to the SMTP server: {e.GetType().Name}: {e.Message}", e);
        }

        client = created;
        return created;
    }

    private static SecureSocketOptions Map(SmtpSecurity security) => security switch
    {
        SmtpSecurity.StartTls => SecureSocketOptions.StartTls,
        SmtpSecurity.SslOnConnect => SecureSocketOptions.SslOnConnect,
        SmtpSecurity.None => SecureSocketOptions.None,
        _ => throw new InvalidOperationException("Smtp:Security is not a known value."),
    };

    public async ValueTask DisposeAsync()
    {
        var smtp = client;
        client = null;
        if (smtp is null)
        {
            return;
        }

        try
        {
            if (smtp.IsConnected)
            {
                using var limit = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await smtp.DisconnectAsync(true, limit.Token);
            }
        }
        catch (Exception)
        {
            // The batch is over; a polite QUIT that fails changes nothing.
        }
        finally
        {
            smtp.Dispose();
        }
    }
}
