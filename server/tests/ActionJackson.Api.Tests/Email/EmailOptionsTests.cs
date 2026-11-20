using ActionJackson.Api.Email;
using ActionJackson.Api.Tests.Platform;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace ActionJackson.Api.Tests.Email;

public class EmailOptionsTests
{
    // A made-up value: no real secret is used in a test.
    private const string Password = "not-a-real-password-7f3a";

    private static ValidateOptionsResult Check(SmtpOptions smtp, EmailOptions email)
    {
        var smtpResult = new SmtpOptionsValidator().Validate(null, smtp);
        var emailResult = new EmailOptionsValidator(Options.Create(smtp)).Validate(null, email);
        return smtpResult.Failed ? smtpResult : emailResult;
    }

    [Fact]
    public void A_blank_host_with_everything_else_blank_is_valid()
    {
        var result = Check(new SmtpOptions(), new EmailOptions());

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void A_blank_host_ignores_the_rest_of_the_smtp_settings()
    {
        var smtp = new SmtpOptions { Port = 0, Username = "u", Security = SmtpSecurity.None };

        Assert.True(Check(smtp, new EmailOptions()).Succeeded);
    }

    [Fact]
    public void A_host_with_no_from_fails()
    {
        var result = Check(new SmtpOptions { Host = "smtp.example.com" }, new EmailOptions());

        Assert.True(result.Failed);
        Assert.Contains("Email:From", result.FailureMessage);
    }

    [Fact]
    public void A_host_with_an_unparseable_from_fails()
    {
        var result = Check(new SmtpOptions { Host = "smtp.example.com" }, new EmailOptions { From = "not an address" });

        Assert.True(result.Failed);
    }

    [Fact]
    public void A_host_with_a_from_that_has_a_display_name_is_valid()
    {
        var result = Check(
            new SmtpOptions { Host = "smtp.example.com" },
            new EmailOptions { From = "Action Jackson <noreply@example.com>" });

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void A_username_without_a_password_fails_and_the_message_has_no_password()
    {
        var result = Check(
            new SmtpOptions { Host = "smtp.example.com", Username = "user" },
            new EmailOptions { From = "noreply@example.com" });

        Assert.True(result.Failed);
        Assert.Contains("Smtp:Password", result.FailureMessage);
    }

    [Fact]
    public void Security_none_with_a_username_fails_without_echoing_the_password()
    {
        var result = Check(
            new SmtpOptions { Host = "smtp.example.com", Username = "user", Password = Password, Security = SmtpSecurity.None },
            new EmailOptions { From = "noreply@example.com" });

        Assert.True(result.Failed);
        Assert.Contains("clear text", result.FailureMessage);
        Assert.DoesNotContain(Password, result.FailureMessage);
    }

    [Fact]
    public void Security_none_without_a_username_is_valid()
    {
        var result = Check(
            new SmtpOptions { Host = "relay.internal", Security = SmtpSecurity.None, Port = 25 },
            new EmailOptions { From = "noreply@example.com" });

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(65536)]
    public void A_port_outside_1_to_65535_fails_when_a_host_is_set(int port)
    {
        var result = Check(
            new SmtpOptions { Host = "smtp.example.com", Port = port },
            new EmailOptions { From = "noreply@example.com" });

        Assert.True(result.Failed);
        Assert.Contains("Smtp:Port", result.FailureMessage);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(65535)]
    public void The_port_limits_are_valid(int port)
    {
        var result = Check(
            new SmtpOptions { Host = "smtp.example.com", Port = port },
            new EmailOptions { From = "noreply@example.com" });

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("a@b.c, d@e.f")]
    public void An_admin_address_that_does_not_parse_fails_even_with_no_host(string admin)
    {
        var result = Check(new SmtpOptions(), new EmailOptions { AdminAddress = admin });

        Assert.True(result.Failed);
        Assert.Contains("Email:AdminAddress", result.FailureMessage);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(1, 0)]
    public void A_batch_size_or_max_attempts_below_one_fails(int batchSize, int maxAttempts)
    {
        var result = Check(new SmtpOptions(), new EmailOptions { BatchSize = batchSize, MaxAttempts = maxAttempts });

        Assert.True(result.Failed);
    }

    [Fact]
    public async Task The_host_starts_with_no_smtp_settings()
    {
        await using var host = await PlatformHost.StartAsync();

        Assert.NotNull(host.Services.GetRequiredService<IOptions<EmailOptions>>().Value);
    }

    [Fact]
    public async Task The_host_does_not_start_with_a_host_and_no_from()
    {
        var error = await Assert.ThrowsAnyAsync<Exception>(() => PlatformHost.StartAsync(
            configure: builder =>
            {
                builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Smtp:Host"] = "smtp.example.com",
                    ["Smtp:Password"] = Password,
                });
            }));

        Assert.Contains("Email:From", error.ToString());
        Assert.DoesNotContain(Password, error.ToString());
    }
}
