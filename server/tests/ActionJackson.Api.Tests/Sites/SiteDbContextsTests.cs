using ActionJackson.Api.Sites;
using ActionJackson.Core;
using ActionJackson.Data;
using Microsoft.Extensions.DependencyInjection;

namespace ActionJackson.Api.Tests.Sites;

// The contexts are built but never connected: nothing here touches a database.
public class SiteDbContextsTests
{
    private static ServiceProvider Provider() =>
        new ServiceCollection().AddActionJacksonData("Host=127.0.0.1;Port=1;Username=x;Password=x;Database=x").BuildServiceProvider();

    [Fact]
    public void Lan_and_car_get_their_own_context()
    {
        using var provider = Provider();
        using var scope = provider.CreateScope();

        var lan = SiteDbContexts.For(scope.ServiceProvider, Site.Lan);
        var car = SiteDbContexts.For(scope.ServiceProvider, Site.Car);

        Assert.IsType<LanDbContext>(lan);
        Assert.IsType<CarDbContext>(car);
        Assert.Equal(Site.Lan, lan.Site);
        Assert.Equal(Site.Car, car.Site);
        Assert.NotSame(lan, car);
    }

    [Fact]
    public void A_scope_gets_the_same_context_each_time()
    {
        using var provider = Provider();
        using var scope = provider.CreateScope();

        Assert.Same(
            SiteDbContexts.For(scope.ServiceProvider, Site.Lan),
            SiteDbContexts.For(scope.ServiceProvider, Site.Lan));
    }

    [Theory]
    [InlineData(Site.Main)]
    [InlineData(Site.Dev)]
    public void A_site_without_business_tables_throws(Site site)
    {
        using var provider = Provider();
        using var scope = provider.CreateScope();

        Assert.Throws<ArgumentOutOfRangeException>(() => SiteDbContexts.For(scope.ServiceProvider, site));
    }
}
