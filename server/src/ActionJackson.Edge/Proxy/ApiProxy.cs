using System.Net;
using ActionJackson.Edge.Platform;
using Microsoft.AspNetCore.Mvc;
using Yarp.ReverseProxy.Forwarder;

namespace ActionJackson.Edge.Proxy;

// Forwards /api and /api/* to the PC's API (YARP's forwarder). The edge is the API's trust boundary (invariant 1):
// every edge or forwarding header a client sent is dropped, and the edge sets its own X-Edge-Key and X-Client-IP.
internal sealed class ApiProxy : IDisposable
{
    private readonly IHttpForwarder forwarder;
    private readonly EdgeSettings settings;
    private readonly ILogger<ApiProxy> logger;
    private readonly HttpMessageInvoker client;
    private readonly ForwarderRequestConfig requestConfig;
    private readonly EdgeTransformer transformer;

    public ApiProxy(IHttpForwarder forwarder, EdgeSettings settings, ILogger<ApiProxy> logger)
    {
        this.forwarder = forwarder;
        this.settings = settings;
        this.logger = logger;
        client = new HttpMessageInvoker(new SocketsHttpHandler
        {
            UseProxy = false,
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.None,
            UseCookies = false,
            ConnectTimeout = settings.ApiConnectTimeout,
        });
        requestConfig = new ForwarderRequestConfig { ActivityTimeout = settings.ApiActivityTimeout };
        transformer = new EdgeTransformer(settings);
    }

    public async Task HandleAsync(HttpContext context)
    {
        var error = await forwarder.SendAsync(context, settings.ApiUrl, client, requestConfig, transformer);
        if (error == ForwarderError.None)
        {
            return;
        }

        // The error feature's exception can name the API's address; only its type is logged, and never a header.
        var feature = context.Features.Get<IForwarderErrorFeature>();
        logger.LogWarning("The API did not answer ({Error}, {Exception}).", error, feature?.Exception?.GetType().Name ?? "none");

        // Every failure before the response started is one stable answer for the forms (unit 13/21 build on it).
        // YARP's own 502 and 504 are never relayed. A response already on its way cannot be replaced.
        if (!context.Response.HasStarted && !context.RequestAborted.IsCancellationRequested)
        {
            await WriteOfflineAsync(context);
        }
    }

    public void Dispose() => client.Dispose();

    private static Task WriteOfflineAsync(HttpContext context)
    {
        var response = context.Response;
        response.Clear();
        response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        response.Headers.RetryAfter = "30";
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status503ServiceUnavailable,
            Title = "Service unavailable",
            Detail = "The service is offline right now. Please try again later.",
        };
        problem.Extensions["traceId"] = System.Diagnostics.Activity.Current?.Id ?? context.TraceIdentifier;
        return response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json");
    }
}

// Builds the request to the API from the client's, minus everything the client must not control.
internal sealed class EdgeTransformer(EdgeSettings settings) : HttpTransformer
{
    // Never forwarded from the client: the edge's own two headers, Cloudflare's client address, and every
    // forwarding header (X-Forwarded-*, Forwarded). The edge adds none of its own forwarding headers.
    private static readonly string[] Dropped =
    [
        EdgeHeaders.Key,
        EdgeHeaders.ClientIp,
        EdgeHeaders.CfConnectingIp,
        "Forwarded",
    ];

    public override async ValueTask TransformRequestAsync(
        HttpContext httpContext,
        HttpRequestMessage proxyRequest,
        string destinationPrefix,
        CancellationToken cancellationToken)
    {
        // Copies the client's headers and builds the destination address (path and query unchanged).
        await base.TransformRequestAsync(httpContext, proxyRequest, destinationPrefix, cancellationToken);

        // The default outbound Host: the API's, not the original.
        proxyRequest.Headers.Host = null;

        foreach (var name in proxyRequest.Headers.Select(h => h.Key).ToList())
        {
            if (Dropped.Contains(name, StringComparer.OrdinalIgnoreCase)
                || name.StartsWith("X-Forwarded-", StringComparison.OrdinalIgnoreCase))
            {
                proxyRequest.Headers.Remove(name);
            }
        }

        var connection = httpContext.Connection;
        var client = ClientIpSource.Resolve(
            connection.RemoteIpAddress,
            connection.LocalPort,
            settings.TunnelPort,
            httpContext.Request.Headers[EdgeHeaders.CfConnectingIp]);
        proxyRequest.Headers.TryAddWithoutValidation(EdgeHeaders.Key, settings.Key);
        proxyRequest.Headers.TryAddWithoutValidation(EdgeHeaders.ClientIp, ClientIpSource.Format(client));
    }
}
