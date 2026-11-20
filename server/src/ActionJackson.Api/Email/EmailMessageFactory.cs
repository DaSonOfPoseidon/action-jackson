using ActionJackson.Data.Entities;
using MimeKit;

namespace ActionJackson.Api.Email;

// Turns an outbox row into the message to send. Pure: no I/O, no clock.
public static class EmailMessageFactory
{
    // The Message-ID domain. The id comes from the row, so a resend after a crash (the sender is
    // at-least-once) carries the same Message-ID and a mail client or server can recognise the duplicate.
    internal const string MessageIdDomain = "actionjacksoninstalls.com";

    public static MimeMessage Build(EmailOutboxMessage row, EmailOptions options)
    {
        ArgumentNullException.ThrowIfNull(row);
        ArgumentNullException.ThrowIfNull(options);

        if (!MailboxAddress.TryParse(options.From, out var from))
        {
            throw new InvalidOperationException("Email:From is not set to a valid address.");
        }

        // The row's address was validated when it was queued; this keeps a row edited by hand from
        // reaching the wire as anything but one plain mailbox.
        var to = EmailOutboxWriter.ParseRecipient(row.ToAddress);

        var message = new MimeMessage();
        message.From.Add(from);
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = row.Subject;
        message.MessageId = $"{row.Id}@{MessageIdDomain}";
        message.Body = new BodyBuilder { TextBody = row.TextBody, HtmlBody = row.HtmlBody }.ToMessageBody();
        return message;
    }
}
