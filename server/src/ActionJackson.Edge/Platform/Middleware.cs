using ActionJackson.Edge.Routing;
using Microsoft.AspNetCore.Http.Features;

namespace ActionJackson.Edge.Platform;

// Adds the same five security headers to every response the edge sends: files, redirects, 404s, health and
// proxied responses. A header the response already has (the API's own, its CSP included) is left alone. There is no
// HSTS (Cloudflare owns it).
//
// The CSP header has no default-src and no script-src on purpose. Script control is in each built page: a <meta>
// policy with the SHA-256 hashes of its inline scripts (apps/web/scripts/csp.mjs). A page obeys both policies, so
// this one restricts everything else (base, objects, framing, forms, images, fonts, connections) and not scripts.
internal sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    private const string ContentSecurityPolicy =
        "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline'";

    private static readonly (string Name, string Value)[] Headers =
    [
        ("X-Content-Type-Options", "nosniff"),
        ("X-Frame-Options", "DENY"),
        ("Referrer-Policy", "strict-origin-when-cross-origin"),
        ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
        ("Content-Security-Policy", ContentSecurityPolicy),
    ];

    public Task InvokeAsync(HttpContext context)
    {
        // OnStarting runs once the response headers are final, after a proxied response's headers were copied.
        context.Response.OnStarting(static state =>
        {
            var headers = ((HttpContext)state).Response.Headers;
            foreach (var (name, value) in Headers)
            {
                if (!headers.ContainsKey(name))
                {
                    headers[name] = value;
                }
            }

            return Task.CompletedTask;
        }, context);
        return next(context);
    }
}

// GET /healthz on any host: 200 {"status":"ok"} from the edge itself. It never calls the API (invariant 6), so
// a down API does not make the edge unhealthy.
internal sealed class HealthMiddleware(RequestDelegate next)
{
    private static readonly byte[] Body = "{\"status\":\"ok\"}"u8.ToArray();

    public Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.Value != "/healthz")
        {
            return next(context);
        }

        var response = context.Response;
        if (!HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
        {
            response.StatusCode = StatusCodes.Status405MethodNotAllowed;
            response.Headers.Allow = "GET, HEAD";
            return Task.CompletedTask;
        }

        response.StatusCode = StatusCodes.Status200OK;
        response.ContentType = "application/json";
        response.Headers.CacheControl = "no-store";
        response.ContentLength = Body.Length;
        return HttpMethods.IsHead(context.Request.Method) ? Task.CompletedTask : response.Body.WriteAsync(Body).AsTask();
    }
}

// The www and legacy-path redirects: always a 301 that keeps the path and the raw query (invariant 8), whatever
// the method. /api and /healthz are never redirected.
internal sealed class RedirectMiddleware(RequestDelegate next, HostResolver hosts, RedirectRules rules)
{
    public Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        var resolved = hosts.Resolve(request.Headers.Host.ToString());
        var (rawPath, query) = RawTarget(context);
        var location = rules.Resolve(resolved, request.Path.Value ?? "/", query, rawPath);
        if (location is null)
        {
            return next(context);
        }

        context.Response.StatusCode = StatusCodes.Status301MovedPermanently;
        context.Response.Headers.Location = location;
        return Task.CompletedTask;
    }

    // The path and query exactly as the client sent them, when the request target is a plain origin-form one.
    // Otherwise (no raw target, an absolute-form target, control characters) it is rebuilt from the parsed request.
    private static (string RawPath, string Query) RawTarget(HttpContext context)
    {
        var raw = context.Features.Get<IHttpRequestFeature>()?.RawTarget;
        if (!string.IsNullOrEmpty(raw) && raw[0] == '/' && raw.All(c => c is > ' ' and < '\u007f' and not '#'))
        {
            var question = raw.IndexOf('?');
            return question < 0 ? (raw, "") : (raw[..question], raw[question..]);
        }

        return (context.Request.Path.ToUriComponent(), context.Request.QueryString.Value ?? "");
    }
}
