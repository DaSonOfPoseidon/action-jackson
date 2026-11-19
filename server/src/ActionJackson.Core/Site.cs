namespace ActionJackson.Core;

// The four public sites. Each one owns a Postgres schema of the same name, lowercased.
public enum Site
{
    Main,
    Lan,
    Car,
    Dev,
}

public static class SiteExtensions
{
    // The Postgres schema that holds this site's tables.
    public static string Schema(this Site site) => site switch
    {
        Site.Main => "main",
        Site.Lan => "lan",
        Site.Car => "car",
        Site.Dev => "dev",
        _ => throw new ArgumentOutOfRangeException(nameof(site), site, "unknown site"),
    };
}

public static class BusinessSites
{
    // The sites that take bookings, quotes and invoices. Each has its own BusinessDbContext.
    public static readonly IReadOnlyList<Site> All = [Site.Lan, Site.Car];
}
