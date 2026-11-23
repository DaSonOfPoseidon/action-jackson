using System.Globalization;
using System.Text.Json.Nodes;
using ActionJackson.Core;
using ActionJackson.Core.Booking;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Tests;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

// A customer's quote that a test made directly in the lan schema.
internal sealed record Quoted(string Number, string Email, Guid QuoteId, Guid CustomerId);

// Builders for the booking tests: quotes and appointments written straight to the database, the bodies of
// the requests, and a day nobody else in the class has booked.
internal static class Bookings
{
    public const string Path = "/api/lan/appointments";
    public const string AvailabilityPath = "/api/lan/availability";

    // The Tuesday after the host's clock (2026-11-23 06:00 in Chicago).
    public static readonly DateOnly First = new(2026, 11, 24);

    private static readonly Dictionary<string, int> Used = [];

    // A date in the next 85 days that this database's tests have not used before. Tests of one class share
    // a database, and two appointments cannot overlap in it.
    // `span` days in a row are reserved, for a test that also books the days after.
    public static DateOnly NextDay(TestDatabase database, int span = 1)
    {
        lock (Used)
        {
            var start = Used.GetValueOrDefault(database.ConnectionString, 0);
            Used[database.ConnectionString] = start + span;
            Assert.True(start + span <= 85, "this class uses more days than the booking window has");
            return First.AddDays(start);
        }
    }

    public static string Text(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    // A quote of its own, for a customer of that email (made when there is none yet).
    public static async Task<Quoted> NewQuote(
        TestDatabase database,
        string kind = QuoteKinds.DropsOnly,
        QuoteStatus status = QuoteStatus.Pending,
        string? email = null)
    {
        email = (email ?? Forms.NewEmail()).ToLowerInvariant();
        await using var lan = database.Lan();
        var customer = await lan.Customers.SingleOrDefaultAsync(c => c.Email == email);
        if (customer is null)
        {
            customer = new Customer { Name = "Jane O'Neil", Email = email, Phone = "(555) 000-0000" };
            lan.Customers.Add(customer);
        }

        var quote = new Quote
        {
            QuoteNumber = UniqueNumber.RandomEightDigits(),
            CustomerId = customer.Id,
            Status = status,
            Kind = kind,
        };
        lan.Quotes.Add(quote);
        await lan.SaveChangesAsync();
        return new Quoted(quote.QuoteNumber, email, quote.Id, customer.Id);
    }

    public static JsonObject Body(Quoted quote, DateOnly date, string time = "09:00", string kind = BookingKinds.Survey) => new()
    {
        ["quoteNumber"] = quote.Number,
        ["email"] = quote.Email,
        ["kind"] = kind,
        ["date"] = Text(date),
        ["time"] = time,
    };

    // An appointment someone else holds: `hours` long from `hour` Chicago time on the date, for a customer of its own.
    public static async Task<Guid> Existing(
        TestDatabase database,
        DateOnly date,
        int hour,
        int hours,
        string kind = BookingKinds.Survey,
        AppointmentStatus status = AppointmentStatus.Scheduled)
    {
        await using var lan = database.Lan();
        var customer = new Customer { Name = "Someone Else", Email = Forms.NewEmail() };
        var start = BusinessTime.ToInstant(date, new TimeOnly(hour, 0));
        var appointment = new Appointment
        {
            CustomerId = customer.Id,
            Kind = kind,
            StartsAt = start,
            EndsAt = start.AddHours(hours),
            Status = status,
        };
        lan.Customers.Add(customer);
        lan.Appointments.Add(appointment);
        await lan.SaveChangesAsync();
        return appointment.Id;
    }

    public static async Task SetStatus(TestDatabase database, Guid appointmentId, AppointmentStatus status)
    {
        await using var lan = database.Lan();
        await lan.Appointments.Where(a => a.Id == appointmentId).ExecuteUpdateAsync(set => set.SetProperty(a => a.Status, status));
    }

}

// A database of its own, for a test that changes the opening hours.
internal sealed class OwnDatabase : IAsyncDisposable
{
    private OwnDatabase(TestDatabase database) => Database = database;

    public TestDatabase Database { get; }

    public static async Task<OwnDatabase> Create()
    {
        var database = new TestDatabase();
        await database.InitializeAsync();
        return new OwnDatabase(database);
    }

    public ValueTask DisposeAsync() => new(Database.DisposeAsync());
}
