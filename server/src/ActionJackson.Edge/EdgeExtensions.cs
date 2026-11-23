using ActionJackson.Edge.Platform;
using ActionJackson.Edge.Proxy;
using ActionJackson.Edge.Routing;
using ActionJackson.Edge.Sites;
using Microsoft.AspNetCore.Mvc;

namespace ActionJackson.Edge;

// The edge's wiring in two calls, so a test can build a host with exactly the production pipeline.
internal static class EdgeExtensions
{
    // Services and settings. Throws when the settings or contracts/sites.json are unusable, so the edge never starts
    // half configured (and the message never contains the key).
    public static WebApplicationBuilder AddEdge(this WebApplicationBuilder builder)
    {
        var settings = EdgeSettings.Load(builder.Configuration);
        var registry = SiteRegistry.LoadEmbedded();

        builder.Services.AddSingleton(settings);
        builder.Services.AddSingleton(registry);
        builder.Services.AddSingleton<HostResolver>();
        builder.Services.AddSingleton(new RedirectRules(registry, settings.PublicScheme));
        builder.Services.AddSingleton<SiteFiles>();
        builder.Services.AddHttpForwarder();
        builder.Services.AddSingleton<ApiProxy>();
        return builder;
    }

    // The middleware, in this order: security headers, error handler, /healthz, redirects, then the /api proxy
    // endpoint, and the site files for everything else.
    public static WebApplication UseEdge(this WebApplication app)
    {
        app.UseMiddleware<SecurityHeadersMiddleware>();
        app.UseExceptionHandler(errors => errors.Run(WriteServerErrorAsync));
        app.UseMiddleware<HealthMiddleware>();
        app.UseMiddleware<RedirectMiddleware>();

        // /api and /api/*, on every host, with any method. Matched by routing before the files middleware runs.
        app.Map("/api", (HttpContext context, ApiProxy proxy) => proxy.HandleAsync(context));
        app.Map("/api/{**rest}", (HttpContext context, ApiProxy proxy) => proxy.HandleAsync(context));
        app.UseMiddleware<SiteFilesMiddleware>();
        return app;
    }

    // An unexpected failure: a fixed sentence, never the exception, its message or the path of a file.
    private static Task WriteServerErrorAsync(HttpContext context)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Server error",
            Detail = "An unexpected error occurred.",
        };
        problem.Extensions["traceId"] = System.Diagnostics.Activity.Current?.Id ?? context.TraceIdentifier;
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        return context.Response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json");
    }
}
