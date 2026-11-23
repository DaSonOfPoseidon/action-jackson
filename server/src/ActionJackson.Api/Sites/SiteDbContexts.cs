using ActionJackson.Core;
using ActionJackson.Data;

namespace ActionJackson.Api.Sites;

// Picks the business context of a site. The site is always an argument the endpoint code holds (it is
// captured by the route group that mapped the endpoint): never read from the Host header, a header or a
// body, so a request for one site cannot reach another site's schema.
public static class SiteDbContexts
{
    // The lan or car context of this request's scope. Throws for a site that has no business tables
    // (main and dev): a bug in the caller, not something a client can cause.
    public static BusinessDbContext For(IServiceProvider services, Site site)
    {
        ArgumentNullException.ThrowIfNull(services);
        return site switch
        {
            Site.Lan => services.GetRequiredService<LanDbContext>(),
            Site.Car => services.GetRequiredService<CarDbContext>(),
            _ => throw new ArgumentOutOfRangeException(nameof(site), site, "This site has no business tables."),
        };
    }
}
