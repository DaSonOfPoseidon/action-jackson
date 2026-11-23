using ActionJackson.Api.Platform;
using ActionJackson.Core;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ActionJackson.Api.Business;

// The public endpoints of a business site, under /api/{site}. The site is captured here, by the group, and
// every handler gets it from this closure: a request can never name another one.
public static class BusinessEndpoints
{
    public static IServiceCollection AddPublicForms(this IServiceCollection services)
    {
        // Tests replace both to control time and numbers.
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IDocumentNumbers, RandomDocumentNumbers>();
        services.AddScoped<PublicForms>();
        return services;
    }

    // Throws at startup for a site that has no option lists yet (car arrives with its own unit).
    public static IEndpointRouteBuilder MapPublicForms(this IEndpointRouteBuilder app, Site site)
    {
        _ = SiteOptions.For(site);
        var group = app.MapGroup($"/api/{site.Schema()}");

        group.MapGet(
                "/quotes/pricing",
                (PublicForms forms, CancellationToken cancellationToken) => forms.PricingAsync(site, cancellationToken))
            .RequireRateLimiting(RateLimitPolicies.CatalogRead);

        group.MapPost(
                "/quotes/calculate",
                (PublicForms forms, HttpRequest request, CancellationToken cancellationToken) =>
                    forms.CalculateAsync(site, request, cancellationToken))
            .RequireRateLimiting(RateLimitPolicies.QuoteCalculate);

        group.MapPost(
                "/quotes",
                (PublicForms forms, HttpContext http, CancellationToken cancellationToken) =>
                    forms.CreateQuoteAsync(site, http, cancellationToken))
            .RequireRateLimiting(RateLimitPolicies.QuoteCreate);

        group.MapPost(
                "/consultations",
                (PublicForms forms, HttpContext http, CancellationToken cancellationToken) =>
                    forms.CreateConsultationAsync(site, http, cancellationToken))
            .RequireRateLimiting(RateLimitPolicies.ConsultationCreate);

        return app;
    }
}
