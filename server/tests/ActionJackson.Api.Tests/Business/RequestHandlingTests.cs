using System.Net;
using System.Text;
using ActionJackson.Api.Platform;
using ActionJackson.Data.Tests;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

// Bodies the public endpoints must refuse cleanly: a 4xx problem document, never a 500.
public class RequestHandlingTests(TestDatabase database) : IClassFixture<TestDatabase>, IDisposable
{
    private readonly FormsHost host = new(database);

    public void Dispose() => host.Dispose();

    public static TheoryData<string> Posts => new()
    {
        { "/api/lan/consultations" },
        { "/api/lan/quotes" },
        { "/api/lan/quotes/calculate" },
    };

    [DbFact]
    public async Task A_body_over_32_kb_is_a_413_problem_and_saves_nothing()
    {
        await using var core = database.Core();
        var errorsBefore = await core.ServerErrors.CountAsync();
        var big = $$"""{ "honeypot": "{{new string('x', 40 * 1024)}}" }""";

        foreach (var path in new[] { "/api/lan/consultations", "/api/lan/quotes", "/api/lan/quotes/calculate" })
        {
            using var response = await host.PostText(path, big);

            await FormsHost.AssertProblem(response, HttpStatusCode.RequestEntityTooLarge);
        }

        Assert.Equal(errorsBefore, await core.ServerErrors.CountAsync());
    }

    [DbFact]
    public async Task A_body_that_grows_past_the_limit_without_a_length_header_is_also_a_413()
    {
        var chunked = new HttpRequestMessage(HttpMethod.Post, "/api/lan/consultations")
        {
            Content = new StreamContent(new MemoryStream(Encoding.UTF8.GetBytes($$"""{ "honeypot": "{{new string('x', 40 * 1024)}}" }"""))),
        };
        chunked.Content.Headers.ContentType = new("application/json");
        chunked.Headers.TransferEncodingChunked = true;

        using var response = await host.Client.SendAsync(chunked);

        await FormsHost.AssertProblem(response, HttpStatusCode.RequestEntityTooLarge);
    }

    [DbFact]
    public async Task A_body_just_under_the_limit_is_read()
    {
        var body = Forms.Consultation();
        body["padding"] = new string('x', 30 * 1024);

        using var response = await host.Post("/api/lan/consultations", body);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [DbTheory]
    [MemberData(nameof(Posts))]
    public async Task Malformed_json_is_a_400_problem(string path)
    {
        using var response = await host.PostText(path, """{ "customer": { "name": """);

        var errors = (await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("body", out _));
    }

    [DbTheory]
    [MemberData(nameof(Posts))]
    public async Task An_empty_or_null_or_non_object_body_is_a_400_problem(string path)
    {
        foreach (var text in new[] { "", "null", "[]", "42", "\"text\"" })
        {
            using var response = await host.PostText(path, text);

            await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
        }
    }

    [DbTheory]
    [MemberData(nameof(Posts))]
    public async Task A_wrong_json_type_is_a_400_problem_keyed_by_where_it_is(string path)
    {
        using var response = await host.PostText(path, """{ "customer": "Jane", "runs": { "cat6": 2.5 } }""");

        await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
    }

    [DbFact]
    public async Task A_fractional_or_string_count_is_a_400_not_a_500()
    {
        foreach (var count in new[] { "2.5", "\"2\"", "true", "[]", "1e400", "99999999999" })
        {
            using var response = await host.PostText("/api/lan/quotes/calculate", $$"""{ "runs": { "cat6": {{count}} } }""");

            var problem = await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
            Assert.True(problem.GetProperty("errors").TryGetProperty("runs.cat6", out _), count);
        }
    }

    [DbFact]
    public async Task A_string_where_a_boolean_or_text_is_expected_is_a_400()
    {
        using var boolean = await host.PostText(
            "/api/lan/quotes/calculate",
            """{ "runs": { "cat6": 1 }, "hasExistingPanel": "yes" }""");
        using var text = await host.PostText("/api/lan/consultations", """{ "customer": { "name": 5 } }""");

        await FormsHost.AssertProblem(boolean, HttpStatusCode.BadRequest);
        await FormsHost.AssertProblem(text, HttpStatusCode.BadRequest);
    }

    [DbFact]
    public async Task An_error_never_repeats_what_the_client_sent()
    {
        const string marker = "marker-9d2e41-do-not-echo";

        using var response = await host.PostText("/api/lan/consultations", $$"""{ "{{marker}}": [1, 2, "customer": }""");
        using var typed = await host.PostText("/api/lan/consultations", $$"""{ "customer": { "name": "{{marker}}", "email": "{{marker}}" } }""");

        Assert.DoesNotContain(marker, await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain(marker, await typed.Content.ReadAsStringAsync());
    }

    [DbTheory]
    [MemberData(nameof(Posts))]
    public async Task A_body_that_is_not_json_is_a_415(string path)
    {
        using var response = await host.PostText(path, "customer=Jane", contentType: "application/x-www-form-urlencoded");

        await FormsHost.AssertProblem(response, HttpStatusCode.UnsupportedMediaType);
    }

    [DbFact]
    public async Task The_json_content_type_may_carry_a_charset()
    {
        using var response = await host.PostText(
            "/api/lan/quotes/calculate",
            Forms.Calculate().ToJsonString(),
            contentType: "application/json; charset=utf-8");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [DbFact]
    public async Task Unknown_members_are_ignored()
    {
        var body = Forms.Calculate();
        body["surprise"] = new System.Text.Json.Nodes.JsonObject { ["a"] = 1 };

        using var response = await host.Post("/api/lan/quotes/calculate", body);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [DbFact]
    public void Each_public_endpoint_names_its_rate_limit_policy()
    {
        var endpoints = host.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>().ToList();

        Assert.Equal(RateLimitPolicies.ConsultationCreate, PolicyOf(endpoints, "/api/lan/consultations"));
        Assert.Equal(RateLimitPolicies.QuoteCreate, PolicyOf(endpoints, "/api/lan/quotes"));
        Assert.Equal(RateLimitPolicies.QuoteCalculate, PolicyOf(endpoints, "/api/lan/quotes/calculate"));
        Assert.Equal(RateLimitPolicies.CatalogRead, PolicyOf(endpoints, "/api/lan/quotes/pricing"));
        Assert.Equal(RateLimitPolicies.Booking, PolicyOf(endpoints, "/api/lan/appointments"));
        Assert.Equal(RateLimitPolicies.CatalogRead, PolicyOf(endpoints, "/api/lan/availability"));
    }

    [DbFact]
    public async Task Only_the_lan_routes_are_mapped()
    {
        foreach (var path in new[] { "/api/car/consultations", "/api/car/availability", "/api/car/quotes/pricing", "/api/main/consultations", "/api/consultations", "/api/lan" })
        {
            using var response = await host.Get(path);

            await FormsHost.AssertProblem(response, HttpStatusCode.NotFound);
        }
    }

    private static string? PolicyOf(List<RouteEndpoint> endpoints, string pattern) =>
        endpoints.Single(endpoint => endpoint.RoutePattern.RawText == pattern && endpoint.Metadata.GetMetadata<EnableRateLimitingAttribute>() is not null)
            .Metadata.GetMetadata<EnableRateLimitingAttribute>()!.PolicyName;
}
