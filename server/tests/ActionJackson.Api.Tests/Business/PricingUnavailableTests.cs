using System.Net;
using System.Text.Json;
using ActionJackson.Data.Tests;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ActionJackson.Api.Tests.Business;

// These tests change the catalog, so they have a database of their own.
public class PricingUnavailableTests(TestDatabase database) : IClassFixture<TestDatabase>, IAsyncLifetime
{
    private FormsHost host = null!;

    // Every test starts from the seeded catalog: the tests of this class share one database.
    public async Task InitializeAsync()
    {
        await using var connection = await database.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE lan.catalog_items SET is_active = true";
        await command.ExecuteNonQueryAsync();
        host = new FormsHost(database);
    }

    public Task DisposeAsync()
    {
        host.Dispose();
        return Task.CompletedTask;
    }

    private async Task Deactivate(params string[] codes)
    {
        await using var connection = await database.OpenAsync();
        foreach (var code in codes)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "UPDATE lan.catalog_items SET is_active = false WHERE code = @code";
            command.Parameters.AddWithValue("code", code);
            await command.ExecuteNonQueryAsync();
        }
    }

    [DbFact]
    public async Task A_missing_drops_deposit_is_a_503_with_nothing_saved_and_the_error_logged()
    {
        await Deactivate("DEPOSIT-DROPS");
        var email = Forms.NewEmail();

        using var response = await host.Post("/api/lan/quotes", Forms.DropsOnly(email));

        var problem = await FormsHost.AssertProblem(response, HttpStatusCode.ServiceUnavailable);
        Assert.Equal("Pricing isn't available right now. Please try again later.", problem.GetProperty("detail").GetString());
        await using var lan = database.Lan();
        Assert.False(await lan.Customers.AnyAsync(c => c.Email == email));
        Assert.Contains(host.Logs.Lines, line => line.Level == LogLevel.Error && line.Message.Contains("DEPOSIT-DROPS"));
    }

    [DbFact]
    public async Task A_missing_whole_home_deposit_is_a_503_and_never_a_zero_deposit()
    {
        await Deactivate("DEPOSIT-WHOLE");
        var email = Forms.NewEmail();

        using var response = await host.Post("/api/lan/quotes", Forms.WholeHome(email));

        await FormsHost.AssertProblem(response, HttpStatusCode.ServiceUnavailable);
        await using var lan = database.Lan();
        Assert.False(await lan.Customers.AnyAsync(c => c.Email == email));
        Assert.Contains(host.Logs.Lines, line => line.Level == LogLevel.Error && line.Message.Contains("DEPOSIT-WHOLE"));
    }

    [DbFact]
    public async Task Calculate_is_a_503_without_the_deposit_too()
    {
        await Deactivate("DEPOSIT-DROPS");

        using var response = await host.Post("/api/lan/quotes/calculate", Forms.Calculate());

        await FormsHost.AssertProblem(response, HttpStatusCode.ServiceUnavailable);
    }

    [DbFact]
    public async Task A_selected_option_that_is_inactive_is_a_400_on_its_field_and_one_not_selected_is_fine()
    {
        await Deactivate("FIBER-RUN", "INSTALL-MPANEL");

        using var selected = await host.Post("/api/lan/quotes", Forms.DropsOnly());
        var errors = (await FormsHost.AssertProblem(selected, HttpStatusCode.BadRequest)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("runs.fiber", out _));
        Assert.True(errors.TryGetProperty("centralization", out _));

        var request = Forms.DropsOnly();
        request["runs"]!.AsObject().Remove("fiber");
        request.Remove("centralization");
        using var other = await host.Post("/api/lan/quotes", request);
        Assert.Equal(HttpStatusCode.Created, other.StatusCode);
    }

    [DbFact]
    public async Task Pricing_leaves_out_an_option_whose_item_is_inactive()
    {
        await Deactivate("FIBER-RUN", "DEPOSIT-WHOLE");

        using var response = await host.Get("/api/lan/quotes/pricing");

        var body = JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(body.GetProperty("runs").TryGetProperty("cat6", out _));
        Assert.False(body.GetProperty("runs").TryGetProperty("fiber", out _));
        Assert.False(body.TryGetProperty("wholeHome", out _));
        Assert.True(body.TryGetProperty("dropsOnly", out _));
    }
}
