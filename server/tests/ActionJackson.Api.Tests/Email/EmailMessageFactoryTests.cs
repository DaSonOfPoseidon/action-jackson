using ActionJackson.Api.Email;
using ActionJackson.Core;
using ActionJackson.Data.Entities;
using MimeKit;

namespace ActionJackson.Api.Tests.Email;

public class EmailMessageFactoryTests
{
    private static EmailOutboxMessage Row() => new()
    {
        ToAddress = "pat@example.com",
        Subject = "Hello \U0001F4C5",
        TextBody = "plain body",
        HtmlBody = "<p>html body</p>",
        Template = EmailTemplates.BookingConfirmation,
    };

    private static readonly EmailOptions Options = new() { From = "Action Jackson <noreply@example.com>" };

    [Fact]
    public void The_message_is_multipart_alternative_with_text_and_html()
    {
        var message = EmailMessageFactory.Build(Row(), Options);

        var body = Assert.IsType<MultipartAlternative>(message.Body);
        Assert.Equal("plain body", message.TextBody);
        Assert.Equal("<p>html body</p>", message.HtmlBody);
        Assert.Equal(2, body.Count);
    }

    [Fact]
    public void From_and_to_come_from_the_options_and_the_row()
    {
        var message = EmailMessageFactory.Build(Row(), Options);

        var from = Assert.Single(message.From.Mailboxes);
        Assert.Equal("noreply@example.com", from.Address);
        Assert.Equal("Action Jackson", from.Name);
        var to = Assert.Single(message.To.Mailboxes);
        Assert.Equal("pat@example.com", to.Address);
        Assert.Empty(message.Cc);
        Assert.Empty(message.Bcc);
    }

    [Fact]
    public void The_message_id_is_derived_from_the_row_id()
    {
        var row = Row();

        var first = EmailMessageFactory.Build(row, Options);
        var second = EmailMessageFactory.Build(row, Options);

        Assert.Equal($"{row.Id}@actionjacksoninstalls.com", first.MessageId);
        Assert.Equal(first.MessageId, second.MessageId);
        Assert.NotEqual(first.MessageId, EmailMessageFactory.Build(Row(), Options).MessageId);
    }

    [Fact]
    public void The_subject_is_the_stored_subject()
    {
        Assert.Equal("Hello \U0001F4C5", EmailMessageFactory.Build(Row(), Options).Subject);
    }

    [Fact]
    public void A_stored_recipient_with_a_second_address_is_refused()
    {
        var row = Row();
        row.ToAddress = "a@b.c, d@e.f";

        Assert.ThrowsAny<Exception>(() => EmailMessageFactory.Build(row, Options));
    }

    [Fact]
    public void A_missing_from_is_refused()
    {
        Assert.Throws<InvalidOperationException>(() => EmailMessageFactory.Build(Row(), new EmailOptions()));
    }
}
