using System.Net;
using System.Text.Json.Nodes;
using ActionJackson.Core;
using ActionJackson.Data.Tests;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

public class ConsultationEndpointTests(TestDatabase database) : IClassFixture<TestDatabase>, IDisposable
{
    private const string Path = "/api/lan/consultations";

    private readonly FormsHost host = new(database);

    public void Dispose() => host.Dispose();

    [DbFact]
    public async Task A_valid_request_is_saved_in_the_lan_schema_and_answers_201_with_only_its_number()
    {
        var email = Forms.NewEmail().ToUpperInvariant();
        var client = FormsHost.NewClient();

        using var response = await host.Post(Path, Forms.Consultation(email), client, userAgent: new string('u', 300));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await FormsHost.Json(response);
        var number = body.GetProperty("requestNumber").GetString()!;
        Assert.Matches("^[0-9]{8}$", number);
        Assert.Single(body.EnumerateObject());

        await using var lan = database.Lan();
        var row = await lan.ConsultationRequests.SingleAsync(r => r.RequestNumber == number);
        Assert.Equal(email.ToLowerInvariant(), row.Email);
        Assert.Equal("Jane O'Neil", row.Name);
        Assert.Equal("(555) 123-4567", row.Phone);
        Assert.Equal(ConsultationStatus.New, row.Status);
        Assert.Equal(client, row.SourceIp);
        Assert.Equal(200, row.UserAgent.Length);
        Assert.Equal(host.Time.GetUtcNow(), row.CreatedAt);
        var details = JsonNode.Parse(row.Details)!;
        Assert.Equal("1,500-2,500", (string?)details["squareFootage"]);
        Assert.Equal("Cox", (string?)details["isp"]);
        Assert.Equal(["Weak WiFi", "Dead zones"], details["currentIssues"]!.AsArray().Select(n => (string?)n));
        Assert.Equal(["networking", "cameras"], details["interestedServices"]!.AsArray().Select(n => (string?)n));
        Assert.Equal("foundation", (string?)details["interestedPackage"]);
    }

    [DbFact]
    public async Task The_request_is_never_written_to_another_sites_schema()
    {
        var email = Forms.NewEmail();
        await using var car = database.Car();
        var carBefore = await car.ConsultationRequests.CountAsync();

        using var response = await host.Post(Path, Forms.Consultation(email));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(carBefore, await car.ConsultationRequests.CountAsync());
    }

    [DbFact]
    public async Task The_site_comes_from_the_route_not_the_host_header_or_the_body()
    {
        var email = Forms.NewEmail();
        var body = Forms.Consultation(email);
        body["site"] = "car";
        var request = new HttpRequestMessage(HttpMethod.Post, Path) { Content = new StringContent(body.ToJsonString(), System.Text.Encoding.UTF8, "application/json") };
        request.Headers.Host = "car.actionjacksoninstalls.com";
        request.Headers.TryAddWithoutValidation("X-Site", "car");

        using var response = await host.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await using var lan = database.Lan();
        await using var car = database.Car();
        Assert.True(await lan.ConsultationRequests.AnyAsync(r => r.Email == email));
        Assert.False(await car.ConsultationRequests.AnyAsync(r => r.Email == email));
    }

    [DbFact]
    public async Task There_is_no_car_route_yet()
    {
        using var response = await host.Post("/api/car/consultations", Forms.Consultation());

        await FormsHost.AssertProblem(response, HttpStatusCode.NotFound);
    }

    [DbFact]
    public async Task An_admin_notice_and_an_acknowledgement_are_queued_in_the_same_transaction()
    {
        var email = Forms.NewEmail();

        using var response = await host.Post(Path, Forms.Consultation(email));
        var number = (await FormsHost.Json(response)).GetProperty("requestNumber").GetString()!;

        await using var core = database.Core();
        var rows = await core.EmailOutbox.Where(m => m.Subject.Contains(number)).ToListAsync();
        Assert.Equal(2, rows.Count);
        var admin = Assert.Single(rows, m => m.Template == "consultation-admin");
        var ack = Assert.Single(rows, m => m.Template == "consultation-ack");
        Assert.Equal(FormsHost.AdminAddress, admin.ToAddress);
        Assert.Equal(email, ack.ToAddress);
        Assert.All(rows, m => Assert.Equal(EmailStatus.Pending, m.Status));
        Assert.Contains("Foundation Network", admin.TextBody);
        Assert.Contains("Networking, Cameras", admin.TextBody);
        Assert.Contains("We'll review your request and contact you to schedule your consultation.", ack.TextBody);
        Assert.DoesNotContain("booking link", ack.TextBody);
        Assert.DoesNotContain("24 hours", ack.TextBody);
    }

    [DbFact]
    public async Task A_failed_validation_saves_nothing()
    {
        var email = Forms.NewEmail();
        var body = Forms.Consultation(email);
        body["interestedServices"] = new JsonArray();

        using var response = await host.Post(Path, body);

        var problem = await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.True(problem.GetProperty("errors").TryGetProperty("interestedServices", out _));
        await using var lan = database.Lan();
        Assert.False(await lan.ConsultationRequests.AnyAsync(r => r.Email == email));
    }

    [DbFact]
    public async Task Every_error_is_reported_keyed_by_its_json_path()
    {
        var body = Forms.Consultation();
        body["customer"]!["email"] = "a@mailinator.com";
        body["property"]!["currentIssues"] = new JsonArray("Weak WiFi", "Haunted");

        using var response = await host.Post(Path, body);

        var errors = (await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("customer.email", out _));
        Assert.True(errors.TryGetProperty("property.currentIssues[1]", out _));
    }

    [DbFact]
    public async Task A_non_ascii_address_is_accepted_or_refused_with_a_400_never_a_500()
    {
        // Whatever the outbox writer would refuse as a recipient must be caught before anything is saved.
        using var response = await host.Post(Path, Forms.Consultation($"jos\u00e9-{Guid.NewGuid():N}@example.com"));

        Assert.True(
            response.StatusCode is HttpStatusCode.Created or HttpStatusCode.BadRequest,
            $"got {(int)response.StatusCode}");
    }

    [DbFact]
    public async Task The_honeypot_gives_a_400_and_saves_nothing()
    {
        var email = Forms.NewEmail();
        var body = Forms.Consultation(email);
        body["honeypot"] = "http://spam.example";
        await using var core = database.Core();
        var outboxBefore = await core.EmailOutbox.CountAsync();

        using var response = await host.Post(Path, body);

        var problem = await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.True(problem.GetProperty("errors").TryGetProperty("honeypot", out _));
        await using var lan = database.Lan();
        Assert.False(await lan.ConsultationRequests.AnyAsync(r => r.Email == email));
        Assert.Equal(outboxBefore, await core.EmailOutbox.CountAsync());
    }

    [DbFact]
    public async Task A_second_request_for_the_same_email_within_ten_minutes_is_a_429_whatever_the_case()
    {
        var email = Forms.NewEmail();
        using var first = await host.Post(Path, Forms.Consultation(email));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        host.Time.Advance(TimeSpan.FromMinutes(9) + TimeSpan.FromSeconds(59));
        await using var core = database.Core();
        var outboxBefore = await core.EmailOutbox.CountAsync();

        using var second = await host.Post(Path, Forms.Consultation(email.ToUpperInvariant()));

        var problem = await FormsHost.AssertProblem(second, HttpStatusCode.TooManyRequests);
        Assert.Equal("Please wait 10 minutes between requests.", problem.GetProperty("detail").GetString());
        await using var lan = database.Lan();
        Assert.Equal(1, await lan.ConsultationRequests.CountAsync(r => r.Email == email));
        Assert.Equal(outboxBefore, await core.EmailOutbox.CountAsync());
    }

    [DbFact]
    public async Task The_same_email_is_accepted_again_after_ten_minutes_and_a_different_email_at_once()
    {
        var email = Forms.NewEmail();
        using var first = await host.Post(Path, Forms.Consultation(email));

        using var other = await host.Post(Path, Forms.Consultation());
        host.Time.Advance(TimeSpan.FromMinutes(10) + TimeSpan.FromSeconds(1));
        using var again = await host.Post(Path, Forms.Consultation(email));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, other.StatusCode);
        Assert.Equal(HttpStatusCode.Created, again.StatusCode);
        await using var lan = database.Lan();
        Assert.Equal(2, await lan.ConsultationRequests.CountAsync(r => r.Email == email));
    }

    [DbFact]
    public async Task A_number_that_is_taken_is_retried_and_leaves_one_row_and_one_set_of_emails()
    {
        host.Numbers.Enqueue("40000001", "40000001", "40000002");
        using var first = await host.Post(Path, Forms.Consultation());
        var email = Forms.NewEmail();

        using var second = await host.Post(Path, Forms.Consultation(email));

        Assert.Equal("40000001", (await FormsHost.Json(first)).GetProperty("requestNumber").GetString());
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal("40000002", (await FormsHost.Json(second)).GetProperty("requestNumber").GetString());
        await using var lan = database.Lan();
        Assert.Equal(1, await lan.ConsultationRequests.CountAsync(r => r.Email == email));
        await using var core = database.Core();
        Assert.Equal(2, await core.EmailOutbox.CountAsync(m => m.Subject.Contains("40000001")));
        Assert.Equal(2, await core.EmailOutbox.CountAsync(m => m.Subject.Contains("40000002")));
    }

    [DbFact]
    public async Task The_fourth_request_from_one_address_in_fifteen_minutes_is_a_429()
    {
        var client = FormsHost.NewClient();

        for (var i = 0; i < 3; i++)
        {
            using var accepted = await host.Post(Path, Forms.Consultation(), client);
            Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
        }

        using var refused = await host.Post(Path, Forms.Consultation(), client);

        var problem = await FormsHost.AssertProblem(refused, HttpStatusCode.TooManyRequests);
        Assert.Contains("Too many consultation requests", problem.GetProperty("detail").GetString());
    }
}
