using Microsoft.Extensions.Caching.Hybrid;
using StackExchange.Redis;

namespace ActionJackson.Api.Platform;

public static class CacheSetup
{
    // Short waits: Redis is a cache, so when it is slow or down a request must not wait on it.
    private const int RedisTimeoutMs = 2000;

    // HybridCache: an in-memory L1, and Redis as the L2 when ConnectionStrings:Redis is set. Redis is only a
    // cache, never a dependency: /healthz does not check it, and HybridCache treats a failing L2 as a miss
    // (tests/.../HybridCacheTests.cs checks it against an unreachable address). With no connection string
    // the cache runs on L1 alone. Nothing calls the cache yet.
    // One HybridCache rule to know: it reads a tag-invalidation time from L2 in the background, and when that
    // read fails it treats entries created before the failure as invalid. So in the first seconds after start
    // with Redis down, an L1 entry can be re-fetched. Once that read has failed, L1 serves normally and a miss
    // costs about a millisecond. The tests wait for that point instead of assuming it.
    public static IServiceCollection AddPlatformCache(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            ConfigurationOptions redis;
            try
            {
                redis = ConfigurationOptions.Parse(connectionString);
            }
            catch (Exception)
            {
                // The connection string holds the password, so neither it nor the parser's message is echoed.
                throw new InvalidOperationException(
                    "ConnectionStrings:Redis is not a valid Redis connection string (host:port,password=...).");
            }

            // Do not stop the host, or retry in the foreground, when Redis is down at start.
            redis.AbortOnConnectFail = false;
            redis.ConnectTimeout = RedisTimeoutMs;
            redis.SyncTimeout = RedisTimeoutMs;
            redis.AsyncTimeout = RedisTimeoutMs;

            // While Redis is down, fail a command at once instead of queueing it until its timeout: a queued
            // command would hold every cache read and write for the full timeout.
            redis.BacklogPolicy = BacklogPolicy.FailFast;

            services.AddStackExchangeRedisCache(options =>
            {
                options.ConfigurationOptions = redis;
                options.InstanceName = "aj:";
            });
        }

        services.AddHybridCache();
        return services;
    }
}
