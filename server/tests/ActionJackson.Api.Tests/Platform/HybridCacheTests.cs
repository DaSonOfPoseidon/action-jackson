using System.Diagnostics;
using ActionJackson.Api.Platform;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ActionJackson.Api.Tests.Platform;

public class HybridCacheTests
{
    private static ServiceProvider Build(string? redis)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Redis"] = redis })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging(logging => logging.SetMinimumLevel(LogLevel.None));
        services.AddPlatformCache(configuration);
        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task An_unreachable_redis_still_returns_the_factory_value_within_5_seconds()
    {
        // Nothing listens on port 1.
        await using var provider = Build("127.0.0.1:1,password=not-a-real-secret");
        var cache = provider.GetRequiredService<HybridCache>();
        var clock = Stopwatch.StartNew();

        var first = await cache.GetOrCreateAsync("k1", _ => ValueTask.FromResult("value-1"));
        var other = await cache.GetOrCreateAsync("k2", _ => ValueTask.FromResult("value-2"));

        Assert.Equal("value-1", first);
        Assert.Equal("value-2", other);
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(5), $"took {clock.Elapsed}");
    }

    [Fact]
    public async Task An_unreachable_redis_leaves_l1_serving_once_the_startup_tag_read_has_failed()
    {
        await using var provider = Build("127.0.0.1:1,password=not-a-real-secret");
        var cache = provider.GetRequiredService<HybridCache>();

        // With an L2, HybridCache reads the tag-invalidation time ("*") from Redis in the background, and when that
        // read fails it assumes everything created before the failure is invalid. So for the first seconds after
        // start an entry can be re-fetched even from L1. Wait until a fresh key is served from L1 on its second read.
        var deadline = Stopwatch.StartNew();
        var ready = false;
        for (var i = 0; !ready && deadline.Elapsed < TimeSpan.FromSeconds(30); i++)
        {
            var key = $"warm-{i}";
            var reran = false;
            await cache.GetOrCreateAsync(key, _ => ValueTask.FromResult("w"));
            await cache.GetOrCreateAsync(key, _ =>
            {
                reran = true;
                return ValueTask.FromResult("w");
            });
            ready = !reran;
            if (!ready)
            {
                await Task.Delay(50);
            }
        }

        Assert.True(ready, "L1 never served a read while Redis was down");

        // From here on the property is deterministic: a miss costs the factory once, then L1 answers.
        var calls = 0;
        var first = await cache.GetOrCreateAsync("k1", _ =>
        {
            calls++;
            return ValueTask.FromResult("value-1");
        });
        var second = await cache.GetOrCreateAsync("k1", _ =>
        {
            calls++;
            return ValueTask.FromResult("value-1-again");
        });

        Assert.Equal("value-1", first);
        Assert.Equal("value-1", second);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task The_unreachable_case_really_goes_through_the_redis_cache()
    {
        // Guards the test above against passing because Redis was never wired in.
        await using var provider = Build("127.0.0.1:1");

        var distributed = provider.GetRequiredService<IDistributedCache>();

        Assert.StartsWith("RedisCache", distributed.GetType().Name);
        await Assert.ThrowsAnyAsync<Exception>(() => distributed.GetAsync("probe"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Without_redis_the_cache_runs_on_l1_only(string? redis)
    {
        await using var provider = Build(redis);
        var cache = provider.GetRequiredService<HybridCache>();
        var calls = 0;

        var first = await cache.GetOrCreateAsync("k", _ =>
        {
            calls++;
            return ValueTask.FromResult("v");
        });
        var second = await cache.GetOrCreateAsync("k", _ =>
        {
            calls++;
            return ValueTask.FromResult("v2");
        });

        Assert.Null(provider.GetService<IDistributedCache>());
        Assert.Equal("v", first);
        Assert.Equal("v", second);
        Assert.Equal(1, calls);
    }

    [Fact]
    public void A_malformed_redis_connection_string_stops_startup_without_echoing_it()
    {
        const string bad = "redis:6379,password=hunter2,abortConnect=maybe-not-a-bool";

        var error = Assert.ThrowsAny<Exception>(() => Build(bad));

        Assert.DoesNotContain("hunter2", error.ToString());
        Assert.Contains("ConnectionStrings:Redis", error.Message);
    }

    [Fact]
    public async Task The_platform_registers_the_cache()
    {
        await using var host = await PlatformHost.StartAsync(PlatformHost.NewKey());

        Assert.NotNull(host.Services.GetService<HybridCache>());
    }
}
