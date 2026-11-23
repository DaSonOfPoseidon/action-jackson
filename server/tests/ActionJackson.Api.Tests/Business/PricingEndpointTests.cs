using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using ActionJackson.Data.Tests;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

public class PricingEndpointTests(TestDatabase database) : IClassFixture<TestDatabase>, IDisposable
{
    private readonly FormsHost host = new(database);

    public void Dispose() => host.Dispose();

    [DbFact]
    public async Task Pricing_lists_the_unit_prices_deposits_and_limits_of_the_catalog()
    {
        using var response = await host.Get("/api/lan/quotes/pricing");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        var body = JsonSerializer.Deserialize<JsonElement>(raw);
        var runs = body.GetProperty("runs");
        Assert.Equal(100m, runs.GetProperty("cat6").GetDecimal());
        Assert.Equal(150m, runs.GetProperty("cat6a").GetDecimal());
        Assert.Equal(150m, runs.GetProperty("coax").GetDecimal());
        Assert.Equal(150m, runs.GetProperty("fiber").GetDecimal());
        Assert.Equal(50m, body.GetProperty("services").GetProperty("apMounts").GetDecimal());
        Assert.Equal(25m, body.GetProperty("services").GetProperty("ethernetRelocations").GetDecimal());
        var centralization = body.GetProperty("centralization");
        Assert.Equal(100m, centralization.GetProperty("media-panel").GetDecimal());
        Assert.Equal(25m, centralization.GetProperty("patch-panel").GetDecimal());
        Assert.Equal(0m, centralization.GetProperty("loose-termination").GetDecimal());
        Assert.Equal(100m, body.GetProperty("dropsOnly").GetProperty("depositThreshold").GetDecimal());
        Assert.Equal(20m, body.GetProperty("dropsOnly").GetProperty("depositAmount").GetDecimal());
        Assert.Equal(200m, body.GetProperty("wholeHome").GetProperty("depositAmount").GetDecimal());
        Assert.Equal(50, body.GetProperty("limits").GetProperty("runsPerType").GetProperty("max").GetInt32());
        Assert.Equal(20, body.GetProperty("limits").GetProperty("apMounts").GetProperty("max").GetInt32());

        // No internal id, catalog code or cost leaves the API.
        Assert.DoesNotContain("\"id\"", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("-RUN", raw);
    }

    [DbFact]
    public async Task Calculate_prices_a_selection_with_the_one_calculator_and_writes_nothing()
    {
        await using var lan = database.Lan();
        var quotesBefore = await lan.Quotes.CountAsync();
        var customersBefore = await lan.Customers.CountAsync();

        using var response = await host.Post("/api/lan/quotes/calculate", Forms.Calculate());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        var body = JsonSerializer.Deserialize<JsonElement>(raw);
        Assert.Equal(700m, body.GetProperty("subtotal").GetDecimal());
        Assert.Equal(700m, body.GetProperty("total").GetDecimal());
        Assert.Equal(20m, body.GetProperty("deposit").GetDecimal());
        var lines = body.GetProperty("lines").EnumerateArray().ToList();
        Assert.Equal(6, lines.Count);
        Assert.Equal("CAT6-RUN", lines[0].GetProperty("code").GetString());
        Assert.Equal(2, lines[0].GetProperty("quantity").GetInt32());
        Assert.Equal(100m, lines[0].GetProperty("unitPrice").GetDecimal());
        Assert.Equal(200m, lines[0].GetProperty("lineTotal").GetDecimal());
        Assert.False(string.IsNullOrWhiteSpace(lines[0].GetProperty("description").GetString()));
        Assert.DoesNotContain("catalogItemId", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"id\"", raw, StringComparison.OrdinalIgnoreCase);

        Assert.Equal(quotesBefore, await lan.Quotes.CountAsync());
        Assert.Equal(customersBefore, await lan.Customers.CountAsync());
    }

    [DbFact]
    public async Task Calculate_honours_an_existing_media_panel()
    {
        var body = Forms.Calculate();
        body["hasExistingPanel"] = true;

        using var response = await host.Post("/api/lan/quotes/calculate", body);

        var result = await FormsHost.Json(response);
        Assert.Equal(600m, result.GetProperty("total").GetDecimal());
    }

    [DbFact]
    public async Task Calculate_ignores_a_discount_the_client_sends()
    {
        var body = Forms.Calculate();
        body["discount"] = 100;
        body["discountPercent"] = 100;

        using var response = await host.Post("/api/lan/quotes/calculate", body);

        Assert.Equal(700m, (await FormsHost.Json(response)).GetProperty("total").GetDecimal());
    }

    [DbFact]
    public async Task Calculate_refuses_a_count_over_the_limit_and_an_empty_selection()
    {
        var over = Forms.Calculate();
        over["runs"]!["cat6"] = 51;
        using var tooMany = await host.Post("/api/lan/quotes/calculate", over);
        var errors = (await FormsHost.AssertProblem(tooMany, HttpStatusCode.BadRequest)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("runs.cat6", out _));

        using var empty = await host.Post("/api/lan/quotes/calculate", new JsonObject());
        var emptyErrors = (await FormsHost.AssertProblem(empty, HttpStatusCode.BadRequest)).GetProperty("errors");
        Assert.True(emptyErrors.TryGetProperty("runs", out _));
    }

    [DbFact]
    public async Task Fifty_runs_is_accepted()
    {
        var body = Forms.Calculate();
        body["runs"]!["cat6"] = 50;

        using var response = await host.Post("/api/lan/quotes/calculate", body);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(5000m + 150m + 150m + 50m + 50m + 100m, (await FormsHost.Json(response)).GetProperty("total").GetDecimal());
    }

    [DbFact]
    public async Task Calculate_accepts_only_post()
    {
        using var response = await host.Get("/api/lan/quotes/calculate");

        await FormsHost.AssertProblem(response, HttpStatusCode.MethodNotAllowed);
    }

    [DbFact]
    public async Task Each_public_endpoint_is_behind_its_rate_limit_policy()
    {
        var calculate = FormsHost.NewClient();
        for (var i = 0; i < 30; i++)
        {
            using var ok = await host.Post("/api/lan/quotes/calculate", Forms.Calculate(), calculate);
            Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        }

        using var refused = await host.Post("/api/lan/quotes/calculate", Forms.Calculate(), calculate);
        await FormsHost.AssertProblem(refused, HttpStatusCode.TooManyRequests);

        var pricing = FormsHost.NewClient();
        for (var i = 0; i < 30; i++)
        {
            using var ok = await host.Get("/api/lan/quotes/pricing", pricing);
            Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        }

        using var pricingRefused = await host.Get("/api/lan/quotes/pricing", pricing);
        await FormsHost.AssertProblem(pricingRefused, HttpStatusCode.TooManyRequests);
    }
}
