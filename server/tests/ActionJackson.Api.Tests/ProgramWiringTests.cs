using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ActionJackson.Api.Tests;

// The real Program: the platform is wired into the production pipeline.
public class ProgramWiringTests
{
    // No database is touched by these tests: migration is off and the address is never connected to.
    private static WebApplicationFactory<Program> Factory(string? edgeKey = null) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ConnectionStrings:Postgres", "Host=127.0.0.1;Port=1;Username=x;Password=x;Database=x");
            builder.UseSetting("Database:MigrateOnStartup", "false");
            if (edgeKey is not null)
            {
                builder.UseSetting("Edge:Key", edgeKey);
            }
        });

    [Fact]
    public async Task An_unknown_path_is_a_404_problem_with_a_trace_id()
    {
        using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/no/such/path");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(404, body.GetProperty("status").GetInt32());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("traceId").GetString()));
    }

    [Fact]
    public async Task An_edge_key_of_31_characters_stops_startup()
    {
        using var factory = Factory(new string('k', 31));

        var error = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("Edge:Key", Flatten(error));
    }

    [Fact]
    public void An_edge_key_of_32_characters_starts()
    {
        using var factory = Factory(new string('k', 32));

        using var client = factory.CreateClient();
    }

    [Fact]
    public async Task Healthz_is_still_not_a_problem_document()
    {
        using var factory = Factory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/healthz");

        // The database is unreachable here, so 503; the body is healthz's own JSON, not a problem.
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("degraded", body.GetProperty("status").GetString());
        Assert.False(body.TryGetProperty("traceId", out _));
    }

    private static string Flatten(Exception e)
    {
        var messages = new List<string>();
        for (Exception? current = e; current is not null; current = current.InnerException)
        {
            messages.Add(current.Message);
        }

        return string.Join(" | ", messages);
    }
}
