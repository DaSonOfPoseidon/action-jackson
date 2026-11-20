using Microsoft.Extensions.Options;

namespace ActionJackson.Api.Email;

public static class EmailServiceCollectionExtensions
{
    // The email outbox writer, the sender and their settings. Needs the data contexts
    // (AddActionJacksonData) only when Smtp:Host is set and the sender runs. Settings are validated
    // when the host starts: a half-set SMTP configuration stops startup with a message naming the
    // setting, and a blank Smtp:Host is valid.
    public static IServiceCollection AddEmail(this IServiceCollection services)
    {
        services.AddOptions<SmtpOptions>().BindConfiguration(SmtpOptions.Section).ValidateOnStart();
        services.AddOptions<EmailOptions>().BindConfiguration(EmailOptions.Section).ValidateOnStart();
        services.AddSingleton<IValidateOptions<SmtpOptions>, SmtpOptionsValidator>();
        services.AddSingleton<IValidateOptions<EmailOptions>, EmailOptionsValidator>();

        // Stateless apart from its log-once memory: the context to write to is passed in by the caller.
        services.AddSingleton<EmailOutboxWriter>();

        // One per batch, disposed (disconnected) with the batch's scope.
        services.AddScoped<IEmailTransport, MailKitTransport>();
        services.AddHostedService<EmailSenderService>();
        return services;
    }
}
