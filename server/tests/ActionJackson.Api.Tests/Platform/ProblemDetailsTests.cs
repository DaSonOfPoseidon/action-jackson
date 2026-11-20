using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace ActionJackson.Api.Tests.Platform;

// A type name nobody else uses, so a test can look for it in a response body.
public sealed class LeakCheckException(string message) : Exception(message);

public class ProblemDetailsTests
{
    private const string Marker = "marker-7f3a91c2-do-not-leak";

    private static void Map(WebApplication app)
    {
        app.MapGet("/boom", (Func<IResult>)(() => throw new LeakCheckException($"database password is {Marker}")));
        app.MapGet("/only-get", () => "ok");
        app.MapGet("/t/{id}", (int id) => id);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    public async Task An_unknown_path_is_a_404_problem_with_a_trace_id(string environment)
    {
        await using var host = await PlatformHost.StartAsync(PlatformHost.NewKey(), Map, environment: environment);

        using var response = await host.Client.GetAsync("/no/such/path");

        await AssertProblem(response, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task A_wrong_method_is_a_405_problem()
    {
        await using var host = await PlatformHost.StartAsync(PlatformHost.NewKey(), Map);

        using var response = await host.Client.PostAsync("/only-get", content: null);

        await AssertProblem(response, HttpStatusCode.MethodNotAllowed);
    }

    [Fact]
    public async Task A_request_that_does_not_accept_json_still_gets_a_problem_body()
    {
        await using var host = await PlatformHost.StartAsync(PlatformHost.NewKey(), Map);
        using var request = host.Request(HttpMethod.Get, "/no/such/path");
        request.Headers.TryAddWithoutValidation("Accept", "text/html");

        using var response = await host.Client.SendAsync(request);

        await AssertProblem(response, HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    public async Task A_thrown_exception_is_a_500_problem_that_leaks_nothing_about_it(string environment)
    {
        await using var host = await PlatformHost.StartAsync(PlatformHost.NewKey(), Map, environment: environment);

        using var response = await host.Client.GetAsync("/boom");
        var raw = await response.Content.ReadAsStringAsync();

        var body = JsonSerializer.Deserialize<JsonElement>(raw);
        Assert.Equal(500, body.GetProperty("status").GetInt32());
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.False(string.IsNullOrEmpty(body.GetProperty("traceId").GetString()));
        Assert.Equal(Platform_ServerErrorDetail, body.GetProperty("detail").GetString());

        Assert.DoesNotContain(Marker, raw);
        Assert.DoesNotContain(nameof(LeakCheckException), raw);
        Assert.DoesNotContain("StackTrace", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(" at ", raw);
        Assert.DoesNotContain("exception", raw, StringComparison.OrdinalIgnoreCase);
        // Only these members are present.
        Assert.All(body.EnumerateObject().Select(p => p.Name), name => Assert.Contains(name, new[] { "type", "title", "status", "detail", "traceId" }));
    }

    [Fact]
    public async Task A_thrown_exception_does_not_fail_when_no_database_is_registered()
    {
        // The recorder cannot get a CoreDbContext here; that must stay invisible to the client.
        await using var host = await PlatformHost.StartAsync(PlatformHost.NewKey(), Map);

        using var response = await host.Client.GetAsync("/boom");

        await AssertProblem(response, HttpStatusCode.InternalServerError);
        Assert.Contains(host.Logs.Lines, l => l.Message.Contains("Could not record a server error"));
    }

    [Fact]
    public async Task A_matched_route_still_answers_normally()
    {
        await using var host = await PlatformHost.StartAsync(PlatformHost.NewKey(), Map);

        using var response = await host.Client.GetAsync("/t/42");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("42", await response.Content.ReadAsStringAsync());
    }

    private const string Platform_ServerErrorDetail = ActionJackson.Api.Platform.ProblemDetailsSetup.ServerErrorDetail;

    private static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal((int)status, body.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("traceId").GetString()));
    }
}
