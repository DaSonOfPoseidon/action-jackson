namespace ActionJackson.Api.Email;

// How long a failed email waits before its next attempt: a minute for the first failure, doubling each
// time, never more than six hours, with up to 20 percent of jitter either way so rows that failed together
// do not all come back together.
internal static class EmailBackoff
{
    internal static readonly TimeSpan Base = TimeSpan.FromMinutes(1);
    internal static readonly TimeSpan Cap = TimeSpan.FromHours(6);
    internal const double JitterFraction = 0.2;

    // `attempts` is the number of attempts made so far, including the one that just failed (1 or more).
    public static TimeSpan Delay(int attempts) => Delay(attempts, (Random.Shared.NextDouble() * 2) - 1);

    // `jitter` is in [-1, 1]. Exposed so a test can pin it.
    internal static TimeSpan Delay(int attempts, double jitter)
    {
        // 2^20 minutes is far above the cap; clamping the exponent keeps the shift from overflowing.
        var exponent = Math.Clamp(attempts - 1, 0, 20);
        var delay = TimeSpan.FromTicks(Base.Ticks * (1L << exponent));
        if (delay > Cap)
        {
            delay = Cap;
        }

        delay *= 1 + (JitterFraction * Math.Clamp(jitter, -1, 1));
        return delay > Cap ? Cap : delay;
    }
}
