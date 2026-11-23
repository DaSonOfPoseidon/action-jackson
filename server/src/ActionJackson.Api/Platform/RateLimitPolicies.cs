using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ActionJackson.Api.Platform;

// The named rate-limit policies, at the numbers the Express API used (fixed windows, one bucket per client
// IP). Each endpoint attaches its policy with RequireRateLimiting(name). There is no global limiter and
// nothing on /healthz. The limiters live in memory: there is one API instance. The login and
// refresh limits belong with identity and are added there.
public static class RateLimitPolicies
{
    public const string ConsultationCreate = "consultation-create";
    public const string QuoteCreate = "quote-create";
    public const string QuoteCalculate = "quote-calculate";
    public const string CatalogRead = "catalog-read";
    public const string Booking = "booking";
    public const string Upload = "upload";
    public const string Download = "download";
    public const string Admin = "admin";

    public sealed record Policy(string Name, int PermitLimit, TimeSpan Window, string Detail);

    public static IReadOnlyList<Policy> All { get; } =
    [
        new(ConsultationCreate, 3, TimeSpan.FromMinutes(15), "Too many consultation requests from this IP, please try again in 15 minutes."),
        new(QuoteCreate, 3, TimeSpan.FromMinutes(15), "Too many quote requests from this IP, please try again in 15 minutes."),
        new(QuoteCalculate, 30, TimeSpan.FromMinutes(1), "Too many calculation requests, please slow down."),
        new(CatalogRead, 30, TimeSpan.FromMinutes(1), "Too many requests, please slow down."),
        new(Booking, 5, TimeSpan.FromMinutes(15), "Too many scheduling requests from this IP, please try again later."),
        new(Upload, 20, TimeSpan.FromMinutes(15), "Too many file uploads. Please try again later."),
        new(Download, 100, TimeSpan.FromMinutes(5), "Too many download requests. Please try again later."),
        new(Admin, 100, TimeSpan.FromMinutes(15), "Too many admin requests. Please try again later."),
    ];

    private const string UnknownPolicyDetail = "Too many requests. Please try again later.";

    public static Policy Get(string name) =>
        All.FirstOrDefault(policy => policy.Name == name)
        ?? throw new ArgumentException($"No rate-limit policy named '{name}'.", nameof(name));

    // The partition for one request under one policy: a fixed window per client IP. This is the function the
    // limiter calls, public so a test can drive the limiter with it directly.
    public static RateLimitPartition<string> Partition(string policyName, HttpContext context)
    {
        var policy = Get(policyName);
        return RateLimitPartition.GetFixedWindowLimiter(
            ClientIp.PartitionKey(context.GetClientIp()),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = policy.PermitLimit,
                Window = policy.Window,
                QueueLimit = 0,
                AutoReplenishment = true,
            });
    }

    public static IServiceCollection AddPlatformRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            foreach (var policy in All)
            {
                options.AddPolicy(policy.Name, context => Partition(policy.Name, context));
            }

            options.OnRejected = RejectAsync;
        });

    // 429 as a problem document with the legacy sentence, and Retry-After in whole seconds, rounded up.
    private static async ValueTask RejectAsync(OnRejectedContext rejected, CancellationToken cancellationToken)
    {
        var http = rejected.HttpContext;
        var name = http.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        var detail = All.FirstOrDefault(policy => policy.Name == name)?.Detail ?? UnknownPolicyDetail;

        if (rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            var seconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
            http.Response.Headers.RetryAfter = seconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await http.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Too Many Requests",
                Detail = detail,
            },
        });
    }
}
