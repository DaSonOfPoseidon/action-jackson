using Microsoft.Extensions.Options;
using MimeKit;

namespace ActionJackson.Api.Email;

// Startup validation. A blank Smtp:Host means delivery is off, and the SMTP settings are not looked at.
// A message names the setting, never its value: the password in particular is never echoed.
internal sealed class SmtpOptionsValidator : IValidateOptions<SmtpOptions>
{
    public ValidateOptionsResult Validate(string? name, SmtpOptions options)
    {
        if (!options.Enabled)
        {
            return ValidateOptionsResult.Success;
        }

        var failures = new List<string>();
        if (options.Port is < 1 or > 65535)
        {
            failures.Add("Smtp:Port must be between 1 and 65535.");
        }

        if (!Enum.IsDefined(options.Security))
        {
            failures.Add("Smtp:Security must be StartTls, SslOnConnect or None.");
        }

        var hasUsername = !string.IsNullOrWhiteSpace(options.Username);
        if (hasUsername && string.IsNullOrEmpty(options.Password))
        {
            failures.Add("Smtp:Password is required when Smtp:Username is set (environment variable Smtp__Password).");
        }

        if (hasUsername && options.Security == SmtpSecurity.None)
        {
            failures.Add("Smtp:Security None cannot be used with Smtp:Username: credentials would be sent in clear text.");
        }

        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }
}

internal sealed class EmailOptionsValidator(IOptions<SmtpOptions> smtp) : IValidateOptions<EmailOptions>
{
    public ValidateOptionsResult Validate(string? name, EmailOptions options)
    {
        var failures = new List<string>();

        // The sender needs a From only when it will send.
        if (smtp.Value.Enabled && !MailboxAddress.TryParse(options.From, out _))
        {
            failures.Add("Email:From must be a valid address (for example noreply@example.com) when Smtp:Host is set.");
        }

        if (!string.IsNullOrWhiteSpace(options.AdminAddress)
            && !EmailOutboxWriter.TryParseRecipient(options.AdminAddress, out _))
        {
            failures.Add("Email:AdminAddress must be one plain email address.");
        }

        if (options.SenderPollInterval <= TimeSpan.Zero)
        {
            failures.Add("Email:SenderPollInterval must be greater than zero.");
        }

        if (options.BatchSize < 1)
        {
            failures.Add("Email:BatchSize must be at least 1.");
        }

        if (options.MaxAttempts < 1)
        {
            failures.Add("Email:MaxAttempts must be at least 1.");
        }

        if (options.SendTimeout <= TimeSpan.Zero)
        {
            failures.Add("Email:SendTimeout must be greater than zero.");
        }

        // The first row of a batch is sent whatever the clock says. A send is cut off at SendTimeout and
        // its result written within ResultWriteTimeout, so the lease must outlast both: a shorter one
        // lets a second sender claim the row while this one still handles it.
        if (options.ClaimLease <= options.SendTimeout + EmailSenderService.ResultWriteTimeout)
        {
            failures.Add("Email:ClaimLease must be longer than Email:SendTimeout plus 10 seconds (the time to record the result).");
        }

        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }
}
