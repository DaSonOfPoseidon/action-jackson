using System.Net;

namespace ActionJackson.Edge.Tests;

public class StaticFilesTests
{
    private static WebRoot Sites() => new WebRoot()
        .WithSites("main", "lan", "car", "dev", "admin");

    [Fact]
    public async Task The_root_serves_the_index_of_the_sites_host()
    {
        await using var host = await EdgeHost.StartAsync(Sites());

        var lan = await host.GetAsync("/", "lan.actionjacksoninstalls.com");
        var dev = await host.GetAsync("/", "dev.localhost:4200");

        Assert.Equal(HttpStatusCode.OK, lan.StatusCode);
        Assert.Equal("<html>lan index</html>", await lan.Content.ReadAsStringAsync());
        Assert.Equal("text/html", lan.Content.Headers.ContentType?.MediaType);
        Assert.Equal("<html>dev index</html>", await dev.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task An_unknown_host_serves_the_main_index()
    {
        await using var host = await EdgeHost.StartAsync(Sites());

        var response = await host.GetAsync("/", "192.168.1.69:8180");
        var evil = await host.GetAsync("/", "lan.actionjacksoninstalls.com.evil.com");

        Assert.Equal("<html>main index</html>", await response.Content.ReadAsStringAsync());
        Assert.Equal("<html>main index</html>", await evil.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_missing_or_empty_host_serves_the_main_index()
    {
        await using var host = await EdgeHost.StartAsync(Sites());

        var empty = await host.RawAsync("GET", "/", host: "");

        Assert.Equal(200, empty.Status);
        Assert.Equal("<html>main index</html>", empty.Body);
    }

    [Fact]
    public async Task A_folder_serves_its_index_with_or_without_a_trailing_slash()
    {
        using var root = Sites().File("main", "about/index.html", "about page");
        await using var host = await EdgeHost.StartAsync(root);

        Assert.Equal("about page", await (await host.GetAsync("/about")).Content.ReadAsStringAsync());
        Assert.Equal("about page", await (await host.GetAsync("/about/")).Content.ReadAsStringAsync());
        Assert.Equal("about page", await (await host.GetAsync("/about/index.html")).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_missing_path_gets_the_sites_404_page_with_status_404_and_no_cache()
    {
        using var root = Sites().File("lan", "404.html", "lan not found");
        await using var host = await EdgeHost.StartAsync(root);

        var response = await host.GetAsync("/missing", "lan.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("lan not found", await response.Content.ReadAsStringAsync());
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task A_missing_path_on_a_site_without_a_404_page_gets_a_plain_text_404()
    {
        await using var host = await EdgeHost.StartAsync(Sites());

        var response = await host.GetAsync("/missing", "lan.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task A_spa_site_serves_its_index_for_an_unknown_path()
    {
        using var root = Sites().File("admin", "404.html", "never served");
        await using var host = await EdgeHost.StartAsync(root);

        var response = await host.GetAsync("/quotes/123", "admin.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("<html>admin index</html>", await response.Content.ReadAsStringAsync());
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
    }

    [Theory]
    [InlineData("/missing.js")]
    [InlineData("/x/y.css")]
    [InlineData("/quotes/123.json")]
    [InlineData("/.env")]
    public async Task A_spa_site_gives_a_404_for_a_missing_path_with_an_extension(string path)
    {
        using var root = Sites().File("admin", "404.html", "admin not found");
        await using var host = await EdgeHost.StartAsync(root);

        var response = await host.GetAsync(path, "admin.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("admin not found", await response.Content.ReadAsStringAsync());
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task A_spa_site_with_no_404_page_gives_a_plain_404_for_a_missing_asset()
    {
        await using var host = await EdgeHost.StartAsync(Sites());

        var response = await host.GetAsync("/missing.js", "admin.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("text/plain", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task A_site_that_is_not_a_spa_never_falls_back_to_its_index()
    {
        await using var host = await EdgeHost.StartAsync(Sites());

        var response = await host.GetAsync("/quotes/123", "lan.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_missing_site_folder_is_a_404_not_a_500()
    {
        using var root = new WebRoot().WithSites("main");
        await using var host = await EdgeHost.StartAsync(root);

        var response = await host.GetAsync("/", "car.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_missing_web_root_is_a_404_not_a_500()
    {
        using var root = new WebRoot();
        Directory.Delete(root.Path);
        await using var host = await EdgeHost.StartAsync(root);

        var response = await host.GetAsync("/");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("/main-AB12CD34.js", "public, max-age=31536000, immutable")]
    [InlineData("/chunk-0A1B2C3D.css", "public, max-age=31536000, immutable")]
    [InlineData("/media/font-1A2B3C4D.woff2", "public, max-age=31536000, immutable")]
    [InlineData("/img/photo-ABCDEFG1.jpeg", "public, max-age=31536000, immutable")]
    [InlineData("/favicon.ico", "public, max-age=3600")]
    [InlineData("/app.js", "public, max-age=3600")]
    [InlineData("/app-AB1.js", "public, max-age=3600")]
    [InlineData("/hero-illustration.svg", "public, max-age=3600")]
    [InlineData("/main-container.css", "public, max-age=3600")]
    [InlineData("/logo-BRANDING.png", "public, max-age=3600")]
    [InlineData("/app-ABCDEFGH.js", "public, max-age=3600")]
    [InlineData("/app-AB12CD345.js", "public, max-age=3600")]
    [InlineData("/app.AB12CD34.js", "public, max-age=3600")]
    [InlineData("/app-ab12cd34.js", "public, max-age=3600")]
    [InlineData("/robots.txt", "public, max-age=3600")]
    [InlineData("/index.html", "no-cache")]
    [InlineData("/about/index.html", "no-cache")]
    public async Task Cache_control_follows_the_file_name(string path, string expected)
    {
        using var root = Sites()
            .File("main", "main-AB12CD34.js", "js")
            .File("main", "chunk-0A1B2C3D.css", "css")
            .File("main", "media/font-1A2B3C4D.woff2", "font")
            .File("main", "img/photo-ABCDEFG1.jpeg", "jpeg")
            .File("main", "favicon.ico", "ico")
            .File("main", "app.js", "js")
            .File("main", "app-AB1.js", "js")
            .File("main", "hero-illustration.svg", "<svg/>")
            .File("main", "main-container.css", "css")
            .File("main", "logo-BRANDING.png", "png")
            .File("main", "app-ABCDEFGH.js", "js")
            .File("main", "app-AB12CD345.js", "js")
            .File("main", "app.AB12CD34.js", "js")
            .File("main", "app-ab12cd34.js", "js")
            .File("main", "robots.txt", "robots")
            .File("main", "about/index.html", "about");
        await using var host = await EdgeHost.StartAsync(root);

        var response = await host.GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expected, response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Content_types_come_from_the_extension()
    {
        using var root = Sites().File("main", "a.js", "x").File("main", "a.css", "x").File("main", "a.svg", "<svg/>").File("main", "a.woff2", "x");
        await using var host = await EdgeHost.StartAsync(root);

        Assert.Equal("text/javascript", (await host.GetAsync("/a.js")).Content.Headers.ContentType?.MediaType);
        Assert.Equal("text/css", (await host.GetAsync("/a.css")).Content.Headers.ContentType?.MediaType);
        Assert.Equal("image/svg+xml", (await host.GetAsync("/a.svg")).Content.Headers.ContentType?.MediaType);
        Assert.Equal("font/woff2", (await host.GetAsync("/a.woff2")).Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task An_unknown_extension_is_a_404_never_octet_stream()
    {
        using var root = Sites().File("main", "data.unknownext", "secret").File("admin", "data.unknownext", "secret");
        await using var host = await EdgeHost.StartAsync(root);

        var main = await host.GetAsync("/data.unknownext");
        var admin = await host.GetAsync("/data.unknownext", "admin.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.NotFound, main.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, admin.StatusCode);
        Assert.DoesNotContain("secret", await main.Content.ReadAsStringAsync());
        Assert.DoesNotContain("secret", await admin.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Files_carry_an_etag_and_last_modified_and_answer_a_conditional_request_with_304()
    {
        using var root = Sites().File("main", "app.js", "console.log(1)");
        await using var host = await EdgeHost.StartAsync(root);

        var first = await host.GetAsync("/app.js");
        var etag = first.Headers.ETag;
        Assert.NotNull(etag);
        Assert.NotNull(first.Content.Headers.LastModified);

        var request = host.Request(HttpMethod.Get, "/app.js");
        request.Headers.IfNoneMatch.Add(etag);
        var second = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, second.StatusCode);
    }

    [Fact]
    public async Task Head_has_the_headers_and_no_body()
    {
        using var root = Sites().File("main", "app.js", "console.log(1)");
        await using var host = await EdgeHost.StartAsync(root);

        var get = await host.GetAsync("/app.js");
        var head = await host.Client.SendAsync(host.Request(HttpMethod.Head, "/app.js"));

        Assert.Equal(HttpStatusCode.OK, head.StatusCode);
        Assert.Equal(get.Content.Headers.ContentLength, head.Content.Headers.ContentLength);
        Assert.Equal("text/javascript", head.Content.Headers.ContentType?.MediaType);
        Assert.Empty(await head.Content.ReadAsByteArrayAsync());
    }

    [Theory]
    [InlineData("PUT")]
    [InlineData("POST")]
    [InlineData("DELETE")]
    [InlineData("PATCH")]
    [InlineData("OPTIONS")]
    public async Task Other_methods_on_a_non_api_path_get_405(string method)
    {
        await using var host = await EdgeHost.StartAsync(Sites());

        var response = await host.Client.SendAsync(host.Request(new HttpMethod(method), "/"));

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.Equal(["GET", "HEAD"], response.Content.Headers.Allow.Order());
    }

    [Theory]
    [InlineData("/../secret")]
    [InlineData("/a/../../secret")]
    [InlineData("/..%2fsecret")]
    [InlineData("/%2e%2e%2fsecret")]
    [InlineData("/a%2Fb")]
    [InlineData("/a\\b")]
    [InlineData("/a%5Cb")]
    [InlineData("/a\0b")]
    [InlineData("/%00")]
    [InlineData("/..")]
    [InlineData("/a/..")]
    public async Task A_traversal_or_odd_path_is_a_404_before_the_disk_is_touched(string path)
    {
        // A file the traversal would reach if it worked: next to the site folders.
        using var root = Sites();
        File.WriteAllText(Path.Combine(root.Path, "secret"), "outside");
        root.File("main", "a/b", "inside");
        await using var host = await EdgeHost.StartAsync(root);

        var (status, body, _) = await host.RawAsync("GET", path, "actionjacksoninstalls.com");

        Assert.Equal(404, status);
        Assert.DoesNotContain("outside", body);
        Assert.DoesNotContain("inside", body);
    }

    [Fact]
    public async Task Another_sites_folder_cannot_be_reached_by_path()
    {
        using var root = Sites();
        await using var host = await EdgeHost.StartAsync(root);

        var response = await host.GetAsync("/%2e%2e/main/index.html", "lan.actionjacksoninstalls.com");
        var other = await host.GetAsync("/main/index.html", "lan.actionjacksoninstalls.com");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, other.StatusCode);
    }

    [Fact]
    public async Task Dotfiles_and_dot_folders_are_never_served()
    {
        using var root = Sites().File("main", ".env", "SECRET=1").File("main", ".git/config", "[core]").File("main", "ok/.hidden", "x");
        await using var host = await EdgeHost.StartAsync(root);

        foreach (var path in new[] { "/.env", "/.git/config", "/ok/.hidden", "/.ENV" })
        {
            var response = await host.GetAsync(path);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.DoesNotContain("SECRET", await response.Content.ReadAsStringAsync());
        }
    }
}
