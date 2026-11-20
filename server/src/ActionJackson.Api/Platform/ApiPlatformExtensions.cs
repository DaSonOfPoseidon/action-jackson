using Microsoft.Extensions.Options;

namespace ActionJackson.Api.Platform;

// The cross-cutting platform every endpoint relies on. Two calls hold the wiring, so a test can build a
// small host with exactly the production pipeline.
public static class ApiPlatformExtensions
{
    // Services and options.
    public static WebApplicationBuilder AddApiPlatform(this WebApplicationBuilder builder)
    {
        // Bound lazily, so the configuration a host finishes with is what counts.
        builder.Services.AddOptions<EdgeOptions>().BindConfiguration(EdgeOptions.Section);
        return builder;
    }

    // The middleware, in this order: edge trust, routing. Endpoints are mapped by the caller after it.
    public static WebApplication UseApiPlatform(this WebApplication app)
    {
        var edge = app.Services.GetRequiredService<IOptions<EdgeOptions>>().Value;
        edge.Validate();
        if (string.IsNullOrWhiteSpace(edge.Key))
        {
            app.Logger.LogWarning(
                "Edge:Key is not set: X-Client-IP is ignored and every request is attributed to its connection address.");
        }

        app.UseMiddleware<EdgeTrustMiddleware>();
        app.UseRouting();
        return app;
    }
}
