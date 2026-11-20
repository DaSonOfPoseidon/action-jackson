using ActionJackson.Api.Email;
using ActionJackson.Core;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace ActionJackson.Api.Tests.Email;

// The writer only adds tracked rows; nothing here connects to a database.
public class EmailOutboxWriterTests
{
    private static readonly RenderedEmail Email = new("Subject", "text", "<p>html</p>", EmailTemplates.ConsultationAdmin);

    private static CoreDbContext Core()
    {
        var builder = new DbContextOptionsBuilder<CoreDbContext>();
        DataServiceCollectionExtensions.Configure(builder, "Host=127.0.0.1;Port=1;Username=x;Password=x;Database=x", CoreDbContext.Schema);
        return new CoreDbContext(builder.Options);
    }

    private static EmailOutboxWriter Writer(string? admin = "admin@example.com") =>
        new(Options.Create(new EmailOptions { AdminAddress = admin }), NullLogger<EmailOutboxWriter>.Instance);

    [Fact]
    public void Queue_adds_a_pending_row_without_saving()
    {
        using var core = Core();
        var before = DateTimeOffset.UtcNow;

        var row = Writer().Queue(core, "pat@example.com", Email);

        var tracked = Assert.Single(core.ChangeTracker.Entries<EmailOutboxMessage>());
        Assert.Equal(EntityState.Added, tracked.State);
        Assert.Same(row, tracked.Entity);
        Assert.Equal("pat@example.com", row.ToAddress);
        Assert.Equal("Subject", row.Subject);
        Assert.Equal("text", row.TextBody);
        Assert.Equal("<p>html</p>", row.HtmlBody);
        Assert.Equal(EmailTemplates.ConsultationAdmin, row.Template);
        Assert.Equal(EmailStatus.Pending, row.Status);
        Assert.Equal(0, row.Attempts);
        Assert.InRange(row.NextAttemptAt, before, DateTimeOffset.UtcNow);
        Assert.Null(row.SentAt);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("a@b.c, d@e.f")]
    [InlineData("a@b.c; d@e.f")]
    [InlineData("x@y.z\r\nBcc: q@r.s")]
    [InlineData("x@y.z\nBcc: q@r.s")]
    [InlineData("Pat <p@example.com>")]
    [InlineData("")]
    [InlineData("   ")]
    public void Queue_rejects_an_address_that_is_not_one_plain_mailbox(string to)
    {
        using var core = Core();

        Assert.Throws<ArgumentException>(() => Writer().Queue(core, to, Email));

        Assert.Empty(core.ChangeTracker.Entries());
    }

    [Fact]
    public void Queue_rejects_an_address_over_254_characters()
    {
        using var core = Core();
        var to = new string('a', 250) + "@b.cd";

        Assert.Throws<ArgumentException>(() => Writer().Queue(core, to, Email));
    }

    [Fact]
    public void Queue_rejects_a_null_address_with_an_argument_exception()
    {
        using var core = Core();

        Assert.Throws<ArgumentNullException>(() => Writer().Queue(core, null!, Email));
    }

    [Fact]
    public void QueueAdmin_sends_to_the_configured_address()
    {
        using var core = Core();

        var queued = Writer("boss@example.com").QueueAdmin(core, Email);

        Assert.True(queued);
        var row = Assert.Single(core.ChangeTracker.Entries<EmailOutboxMessage>()).Entity;
        Assert.Equal("boss@example.com", row.ToAddress);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void QueueAdmin_with_a_blank_admin_address_adds_nothing(string? admin)
    {
        using var core = Core();

        var queued = Writer(admin).QueueAdmin(core, Email);

        Assert.False(queued);
        Assert.Empty(core.ChangeTracker.Entries());
    }
}
