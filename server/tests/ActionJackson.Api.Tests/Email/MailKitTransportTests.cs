using System.Net;
using System.Net.Sockets;
using ActionJackson.Api.Email;
using MimeKit;
using Microsoft.Extensions.Options;

namespace ActionJackson.Api.Tests.Email;

public class MailKitTransportTests
{
    [Fact]
    public async Task A_deadline_that_expires_before_the_server_greets_is_a_connection_failure()
    {
        // A server that accepts the connection and never says hello: the send deadline cuts the connect
        // off, and that must read as the server's problem (it stops the batch, no attempt is used), not
        // as a bare cancellation that the sender takes for one slow row.
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        await using var transport = new MailKitTransport(Options.Create(new SmtpOptions
        {
            Host = "127.0.0.1",
            Port = port,
            Security = SmtpSecurity.None,
        }));
        using var deadline = new CancellationTokenSource(TimeSpan.FromMilliseconds(300));
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress("", "from@example.com"));
        message.To.Add(new MailboxAddress("", "to@example.com"));
        message.Subject = "s";
        message.Body = new TextPart("plain") { Text = "t" };

        var error = await Assert.ThrowsAsync<TransportConnectionException>(() => transport.SendAsync(message, deadline.Token));

        Assert.Equal(SendFailure.Connection, EmailSenderService.Classify(error));
    }
}
