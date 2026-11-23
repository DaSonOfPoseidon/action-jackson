using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using ActionJackson.Core;
using ActionJackson.Core.Booking;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Tests;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

public class IdempotencyTests(TestDatabase database) : IClassFixture<TestDatabase>, IDisposable
{
    private const string KeyHeader = "Idempotency-Key";
    private const string ReplayHeader = "Idempotent-Replayed";

    private readonly FormsHost host = new(database);

    public void Dispose() => host.Dispose();

    private static string NewKey() => Guid.NewGuid().ToString("D");

    private Task<HttpResponseMessage> Keyed(JsonNode body, string key) =>
        host.Post(Bookings.Path, body, configure: request => request.Headers.TryAddWithoutValidation(KeyHeader, key));

    private static bool Replayed(HttpResponseMessage response) =>
        response.Headers.TryGetValues(ReplayHeader, out var values) && values.Contains("true");

    private async Task<int> Appointments(Quoted quote)
    {
        await using var lan = database.Lan();
        return await lan.Appointments.CountAsync(a => a.QuoteId == quote.QuoteId);
    }

    [DbFact]
    public async Task The_same_key_and_body_replay_the_first_answer_without_booking_or_mailing_again()
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        var body = Bookings.Body(quote, Bookings.NextDay(database));

        using var first = await Keyed(body, key);
        using var second = await Keyed(body, key);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.False(first.Headers.Contains(ReplayHeader));
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.True(Replayed(second));
        Assert.Equal("application/json", second.Content.Headers.ContentType?.MediaType);
        var firstBody = await FormsHost.Json(first);
        var secondBody = await FormsHost.Json(second);
        Assert.Equal(firstBody.GetProperty("reference").GetString(), secondBody.GetProperty("reference").GetString());
        Assert.Equal(firstBody.GetProperty("startsAt").GetDateTimeOffset(), secondBody.GetProperty("startsAt").GetDateTimeOffset());
        Assert.Equal(firstBody.GetProperty("startsAt").GetString(), secondBody.GetProperty("startsAt").GetString());
        Assert.Equal(firstBody.GetProperty("endsAt").GetString(), secondBody.GetProperty("endsAt").GetString());
        Assert.Equal(firstBody.GetProperty("kind").GetString(), secondBody.GetProperty("kind").GetString());

        Assert.Equal(1, await Appointments(quote));
        await using var core = database.Core();
        Assert.Equal(1, await core.EmailOutbox.CountAsync(m => m.Template == "booking-confirmation" && m.ToAddress == quote.Email));
        Assert.Equal(1, await core.EmailOutbox.CountAsync(m => m.Template == "booking-admin" && m.Subject.Contains(quote.Number)));
    }

    [DbFact]
    public async Task The_receipt_is_stored_with_the_site_endpoint_hash_status_and_body()
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        using var response = await Keyed(Bookings.Body(quote, Bookings.NextDay(database)), key);

        await using var core = database.Core();
        var receipt = await core.EdgeReceipts.SingleAsync(r => r.IdempotencyKey == key);

        Assert.Equal(Site.Lan, receipt.Site);
        Assert.Equal("POST /api/lan/appointments", receipt.Endpoint);
        Assert.Matches("^[0-9a-f]{64}$", receipt.RequestHash);
        Assert.Equal(201, receipt.ResponseStatus);
        Assert.Equal(quote.Number, JsonDocument.Parse(receipt.ResponseBody).RootElement.GetProperty("reference").GetString());
        Assert.Equal(host.Time.GetUtcNow(), receipt.CreatedAt);
    }

    [DbFact]
    public async Task A_key_in_capitals_is_the_same_key()
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        var body = Bookings.Body(quote, Bookings.NextDay(database));

        using var first = await Keyed(body, key);
        using var second = await Keyed(body, key.ToUpperInvariant());

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.True(Replayed(second));
        Assert.Equal(1, await Appointments(quote));
    }

    [DbFact]
    public async Task The_same_key_with_another_body_is_a_422_and_books_nothing()
    {
        var first = await Bookings.NewQuote(database);
        var second = await Bookings.NewQuote(database);
        var key = NewKey();

        using var booked = await Keyed(Bookings.Body(first, Bookings.NextDay(database)), key);
        using var reused = await Keyed(Bookings.Body(second, Bookings.NextDay(database)), key);

        Assert.Equal(HttpStatusCode.Created, booked.StatusCode);
        var problem = await FormsHost.AssertProblem(reused, (HttpStatusCode)422);
        Assert.Equal("This idempotency key was used for a different request.", problem.GetProperty("detail").GetString());
        Assert.False(reused.Headers.Contains(ReplayHeader));
        Assert.Equal(0, await Appointments(second));
    }

    [DbFact]
    public async Task The_same_body_with_different_spacing_is_a_different_request()
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        var json = Bookings.Body(quote, Bookings.NextDay(database)).ToJsonString();

        using var first = await host.PostText(Bookings.Path, json, configure: r => r.Headers.TryAddWithoutValidation(KeyHeader, key));
        using var spaced = await host.PostText(Bookings.Path, json + " ", configure: r => r.Headers.TryAddWithoutValidation(KeyHeader, key));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        await FormsHost.AssertProblem(spaced, (HttpStatusCode)422);
    }

    [DbTheory]
    [InlineData("lan", "POST /api/lan/quotes")]
    [InlineData("car", "POST /api/lan/appointments")]
    [InlineData("lan", "POST /api/car/appointments")]
    public async Task A_key_that_was_used_for_another_site_or_endpoint_is_a_422(string site, string endpoint)
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        await using (var core = database.Core())
        {
            core.EdgeReceipts.Add(new EdgeReceipt
            {
                IdempotencyKey = key,
                Site = site == "car" ? Site.Car : Site.Lan,
                Endpoint = endpoint,
                RequestHash = new string('0', 64),
                ResponseStatus = 201,
                ResponseBody = """{"quoteNumber":"99999999"}""",
            });
            await core.SaveChangesAsync();
        }

        using var response = await Keyed(Bookings.Body(quote, Bookings.NextDay(database)), key);

        await FormsHost.AssertProblem(response, (HttpStatusCode)422);
        Assert.Equal(0, await Appointments(quote));
    }

    [DbFact]
    public async Task A_receipt_with_the_right_site_and_endpoint_but_another_hash_is_a_422()
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        await using (var core = database.Core())
        {
            core.EdgeReceipts.Add(new EdgeReceipt
            {
                IdempotencyKey = key,
                Site = Site.Lan,
                Endpoint = "POST /api/lan/appointments",
                RequestHash = new string('0', 64),
                ResponseStatus = 201,
                ResponseBody = """{"reference":"99999999"}""",
            });
            await core.SaveChangesAsync();
        }

        using var response = await Keyed(Bookings.Body(quote, Bookings.NextDay(database)), key);

        await FormsHost.AssertProblem(response, (HttpStatusCode)422);
    }

    [DbTheory]
    [InlineData("abc")]
    [InlineData("   ")]
    [InlineData("0f8fad5bd9cb469fa16570867728950e")] // a UUID without hyphens
    [InlineData("{0f8fad5b-d9cb-469f-a165-70867728950e}")]
    [InlineData("0f8fad5b-d9cb-469f-a165-70867728950g")]
    [InlineData("00000000-0000-0000-0000-000000000000-1")]
    public async Task A_key_that_is_not_a_uuid_is_a_400_and_books_nothing(string key)
    {
        var quote = await Bookings.NewQuote(database);

        using var response = await Keyed(Bookings.Body(quote, Bookings.NextDay(database)), key);

        var problem = await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.True(problem.GetProperty("errors").TryGetProperty(KeyHeader, out _));
        Assert.Equal(0, await Appointments(quote));
    }

    [DbFact]
    public async Task Two_key_headers_are_a_400()
    {
        var quote = await Bookings.NewQuote(database);

        using var response = await host.Post(
            Bookings.Path,
            Bookings.Body(quote, Bookings.NextDay(database)),
            configure: r =>
            {
                r.Headers.TryAddWithoutValidation(KeyHeader, NewKey());
                r.Headers.TryAddWithoutValidation(KeyHeader, NewKey());
            });

        await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
        Assert.Equal(0, await Appointments(quote));
    }

    [DbFact]
    public async Task No_key_is_a_normal_booking_with_no_receipt_and_a_retry_is_a_409()
    {
        var quote = await Bookings.NewQuote(database);
        var body = Bookings.Body(quote, Bookings.NextDay(database));
        await using var core = database.Core();
        var receipts = await core.EdgeReceipts.CountAsync();

        using var first = await host.Post(Bookings.Path, body);
        using var second = await host.Post(Bookings.Path, body);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.False(first.Headers.Contains(ReplayHeader));
        await FormsHost.AssertProblem(second, HttpStatusCode.Conflict);
        Assert.Equal(receipts, await core.EdgeReceipts.CountAsync());
    }

    [DbFact]
    public async Task An_error_is_not_stored_so_a_retry_with_the_key_is_decided_again()
    {
        var date = Bookings.NextDay(database);
        var held = await Bookings.Existing(database, date, 9, 2);
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        var body = Bookings.Body(quote, date, "09:00");

        using var refused = await Keyed(body, key);
        await FormsHost.AssertProblem(refused, HttpStatusCode.Conflict);
        await using (var core = database.Core())
        {
            Assert.False(await core.EdgeReceipts.AnyAsync(r => r.IdempotencyKey == key));
        }

        await Bookings.SetStatus(database, held, AppointmentStatus.Cancelled);
        using var retried = await Keyed(body, key);

        Assert.Equal(HttpStatusCode.Created, retried.StatusCode);
        Assert.False(Replayed(retried));
    }

    [DbFact]
    public async Task A_validation_error_with_a_key_stores_nothing()
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        var body = Bookings.Body(quote, Bookings.NextDay(database), "07:00");

        using var response = await Keyed(body, key);

        await FormsHost.AssertProblem(response, HttpStatusCode.BadRequest);
        await using var core = database.Core();
        Assert.False(await core.EdgeReceipts.AnyAsync(r => r.IdempotencyKey == key));
    }

    [DbFact]
    public async Task A_replay_is_not_held_up_by_the_24_hour_rule_or_the_one_per_quote_rule()
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        var body = Bookings.Body(quote, Bookings.NextDay(database));

        using var first = await Keyed(body, key);
        host.Time.Advance(TimeSpan.FromMinutes(5));
        using var replay = await Keyed(body, key);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, replay.StatusCode);
        Assert.True(Replayed(replay));
    }

    [DbFact]
    public async Task Parallel_requests_with_one_key_and_body_all_get_the_same_201_and_one_appointment()
    {
        var quote = await Bookings.NewQuote(database);
        var key = NewKey();
        var body = Bookings.Body(quote, Bookings.NextDay(database));

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Keyed(body, key)));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Created, response.StatusCode));
        var bodies = new List<JsonElement>();
        foreach (var response in responses)
        {
            bodies.Add(await FormsHost.Json(response));
        }

        Assert.Single(bodies.Select(b => b.GetProperty("reference").GetString()).Distinct());
        Assert.Single(bodies.Select(b => b.GetProperty("startsAt").GetString()).Distinct());
        Assert.Equal(1, responses.Count(r => !Replayed(r)));
        Assert.Equal(1, await Appointments(quote));
        await using var core = database.Core();
        Assert.Equal(1, await core.EmailOutbox.CountAsync(m => m.Template == "booking-confirmation" && m.ToAddress == quote.Email));
        Assert.Equal(1, await core.EdgeReceipts.CountAsync(r => r.IdempotencyKey == key));
        foreach (var response in responses)
        {
            response.Dispose();
        }
    }

    [DbFact]
    public async Task Parallel_requests_that_share_a_key_but_differ_make_one_booking_and_a_422()
    {
        for (var round = 0; round < 6; round++)
        {
            var first = await Bookings.NewQuote(database);
            var second = await Bookings.NewQuote(database);
            var key = NewKey();
            var date = Bookings.NextDay(database);

            var responses = await Task.WhenAll(
                Keyed(Bookings.Body(first, date, "09:00"), key),
                Keyed(Bookings.Body(second, date, "13:00"), key));

            var statuses = responses.Select(r => (int)r.StatusCode).Order().ToList();
            Assert.Equal([201, 422], statuses);
            Assert.Equal(1, await Appointments(first) + await Appointments(second));
            await using var core = database.Core();
            Assert.Equal(1, await core.EdgeReceipts.CountAsync(r => r.IdempotencyKey == key));
            var admin = await core.EmailOutbox.Where(m => m.Template == "booking-admin").Select(m => m.Subject).ToListAsync();
            Assert.Equal(1, admin.Count(subject => subject.Contains(first.Number) || subject.Contains(second.Number)));
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }
}
