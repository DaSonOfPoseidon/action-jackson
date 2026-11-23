using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using ActionJackson.Edge.Platform;
using ActionJackson.Edge.Routing;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;
using Microsoft.Net.Http.Headers;

namespace ActionJackson.Edge.Sites;

// One PhysicalFileProvider per site folder under Edge:WebRoot. A provider is rooted in its site's folder and keeps
// its default exclusions (dotfiles, hidden and system files), so nothing outside the folder or starting with a dot
// is ever served. A folder that does not exist gives null (a 404), also when it appears later.
internal sealed class SiteFiles(EdgeSettings settings) : IDisposable
{
    private readonly string root = Path.GetFullPath(settings.WebRoot);
    private readonly ConcurrentDictionary<string, PhysicalFileProvider> providers = new(StringComparer.Ordinal);

    // site is a registry key, which the registry guarantees to be lower-case letters, digits and hyphens.
    public IFileProvider? For(string site)
    {
        if (providers.TryGetValue(site, out var known))
        {
            return known;
        }

        var folder = Path.Combine(root, site);
        if (!Directory.Exists(folder))
        {
            return null;
        }

        var created = new PhysicalFileProvider(folder);
        if (!providers.TryAdd(site, created))
        {
            created.Dispose();
            return providers[site];
        }

        return created;
    }

    public void Dispose()
    {
        foreach (var provider in providers.Values)
        {
            provider.Dispose();
        }
    }
}

// Serves a site's prerendered files (invariant 6: no API at request time).
//   file itself, then <path>/index.html, then (a spa site, extensionless path) its index.html with 200, otherwise the site's 404.html
//   with status 404 (a plain-text 404 when there is none). Only GET and HEAD; other methods get 405.
// Anything routing already matched (the /api endpoint) passes straight through.
internal sealed partial class SiteFilesMiddleware(
    RequestDelegate next,
    HostResolver hosts,
    SiteFiles files)
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.GetEndpoint() is not null)
        {
            await next(context);
            return;
        }

        var request = context.Request;
        var head = HttpMethods.IsHead(request.Method);
        if (!head && !HttpMethods.IsGet(request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
            context.Response.Headers.Allow = "GET, HEAD";
            return;
        }

        var site = hosts.Resolve(request.Headers.Host.ToString()).Site;
        var path = request.Path.Value ?? "/";
        var provider = IsSafe(path) ? files.For(site.Key) : null;
        if (provider is null)
        {
            // An unsafe path, or a site with no folder: a plain 404, with no lookup on disk.
            await NotFoundAsync(context, null, head);
            return;
        }

        // The file itself, then a folder's index, then (spa) the site's index.
        var file = provider.GetFileInfo(path);
        if (!file.Exists)
        {
            file = provider.GetFileInfo(path.TrimEnd('/') + "/index.html");
        }

        // The spa fallback is for app routes (/quotes/123) only: a path whose last segment has an extension is a
        // missing asset, which must be a 404 and never the index page with a 200.
        if (!file.Exists && site.Spa && !path[(path.LastIndexOf('/') + 1)..].Contains('.'))
        {
            file = provider.GetFileInfo("/index.html");
        }

        if (!file.Exists || !ContentTypes.TryGetContentType(file.Name, out var contentType))
        {
            // No such file, or one whose type we do not know: never served as octet-stream.
            await NotFoundAsync(context, provider, head);
            return;
        }

        context.Response.Headers.CacheControl = CacheControlFor(file.Name);
        var etag = new EntityTagHeaderValue(ETagFor(file.LastModified, file.Length));
        await Results.File(file.CreateReadStream(), contentType, lastModified: file.LastModified, entityTag: etag, enableRangeProcessing: true)
            .ExecuteAsync(context);
    }

    // The two parts stay apart ("<mtime ticks>-<length>"): folding them into one number (xor, sum) lets two
    // different files share a tag, and a changed file would then answer a conditional request with a 304.
    internal static string ETagFor(DateTimeOffset lastModified, long length) =>
        $"\"{lastModified.UtcTicks:x}-{length:x}\"";

    // A path that could leave the site folder or mean something else on disk gets a 404 without any lookup: an
    // encoded slash or backslash that survived decoding, a backslash, a NUL or other control character, or a ".."
    // segment.
    internal static bool IsSafe(string path)
    {
        if (path.Length == 0 || path[0] != '/')
        {
            return false;
        }

        foreach (var c in path)
        {
            if (c is '\\' or < ' ' or '\u007f')
            {
                return false;
            }
        }

        if (path.Contains("%2f", StringComparison.OrdinalIgnoreCase)
            || path.Contains("%5c", StringComparison.OrdinalIgnoreCase)
            || path.Contains("%00", StringComparison.Ordinal))
        {
            return false;
        }

        return !path.Split('/').Contains("..");
    }

    // .html (the indexes and the 404 page) is always revalidated; a name ending in "-" and an 8-character content
    // hash (Angular's esbuild output: [A-Z0-9], at least one digit) is immutable; everything else is cached for an
    // hour. A hash with no digit (about 7%) gets the hour, which is safe. Ordinary names such as hero-illustration.svg
    // never match.
    internal static string CacheControlFor(string name)
    {
        if (name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
        {
            return "no-cache";
        }

        return HashedName().IsMatch(name) ? "public, max-age=31536000, immutable" : "public, max-age=3600";
    }

    private static async Task NotFoundAsync(HttpContext context, IFileProvider? provider, bool head)
    {
        var response = context.Response;
        response.StatusCode = StatusCodes.Status404NotFound;
        response.Headers.CacheControl = "no-cache";
        var page = provider?.GetFileInfo("/404.html");
        if (page is { Exists: true })
        {
            response.ContentType = "text/html";
            response.ContentLength = page.Length;
            if (!head)
            {
                await using var stream = page.CreateReadStream();
                await stream.CopyToAsync(response.Body, context.RequestAborted);
            }

            return;
        }

        response.ContentType = "text/plain; charset=utf-8";
        var body = "Not found"u8;
        response.ContentLength = body.Length;
        if (!head)
        {
            await response.Body.WriteAsync(body.ToArray(), context.RequestAborted);
        }
    }

    [GeneratedRegex(@"-(?=[A-Z0-9]{0,7}\d)[A-Z0-9]{8}\.(js|css|woff2?|png|jpe?g|svg|webp|avif)$")]
    private static partial Regex HashedName();
}
