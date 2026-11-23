using System.Net;
using ActionJackson.Api.Business;
using ActionJackson.Core;
using ActionJackson.Core.Booking;
using ActionJackson.Data.Entities;
using ActionJackson.Data.Tests;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Tests.Business;

// The database constraints are the last line against a double booking. These tests make the database refuse a
// row for real, and check that the handler turns its errors into the same 409s the checks give.
public class BookingConstraintTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    private static Appointment Row(Guid customerId, Guid? quoteId, DateTimeOffset start, int hours) => new()
    {
        CustomerId = customerId,
        QuoteId = quoteId,
        Kind = BookingKinds.Survey,
        StartsAt = start,
        EndsAt = start.AddHours(hours),
        Status = AppointmentStatus.Scheduled,
    };

    private static void AssertConflict(IResult? result, string detail)
    {
        var problem = Assert.IsType<ProblemHttpResult>(result);
        Assert.Equal(409, problem.StatusCode);
        Assert.Equal(detail, problem.ProblemDetails.Detail);
    }

    [DbFact]
    public async Task An_overlap_the_database_refuses_is_the_409_for_a_taken_time()
    {
        var date = Bookings.NextDay(database);
        await Bookings.Existing(database, date, 10, 2);
        var quote = await Bookings.NewQuote(database);
        await using var lan = database.Lan();
        lan.Appointments.Add(Row(quote.CustomerId, quote.QuoteId, BusinessTime.ToInstant(date, new TimeOnly(11, 0)), 2));

        var error = await Assert.ThrowsAsync<DbUpdateException>(() => lan.SaveChangesAsync());

        AssertConflict(AppointmentBooking.MapConstraintViolation(error), "That time isn't available.");
    }

    [DbFact]
    public async Task A_second_appointment_for_a_quote_the_database_refuses_is_the_409_for_a_booked_quote()
    {
        var date = Bookings.NextDay(database, 2);
        var quote = await Bookings.NewQuote(database);
        await using var lan = database.Lan();
        lan.Appointments.Add(Row(quote.CustomerId, quote.QuoteId, BusinessTime.ToInstant(date, new TimeOnly(9, 0)), 2));
        await lan.SaveChangesAsync();
        await using var second = database.Lan();
        second.Appointments.Add(Row(quote.CustomerId, quote.QuoteId, BusinessTime.ToInstant(date.AddDays(1), new TimeOnly(9, 0)), 2));

        var error = await Assert.ThrowsAsync<DbUpdateException>(() => second.SaveChangesAsync());

        AssertConflict(AppointmentBooking.MapConstraintViolation(error), "This quote already has an appointment.");
    }

    [DbFact]
    public async Task Any_other_database_error_is_not_mapped()
    {
        await using var lan = database.Lan();
        // A customer that does not exist: a foreign key violation (23503), not ours to turn into a 409.
        lan.Appointments.Add(Row(Guid.NewGuid(), null, BusinessTime.ToInstant(Bookings.NextDay(database), new TimeOnly(9, 0)), 1));

        var error = await Assert.ThrowsAsync<DbUpdateException>(() => lan.SaveChangesAsync());

        Assert.Null(AppointmentBooking.MapConstraintViolation(error));
        Assert.Null(AppointmentBooking.MapConstraintViolation(new InvalidOperationException("nope")));
    }

    [Fact]
    public void A_deadlock_is_found_inside_the_wrappers_ef_puts_around_it()
    {
        var deadlock = new Npgsql.PostgresException("deadlock detected", "ERROR", "ERROR", "40P01");
        var wrapped = new InvalidOperationException("transient", new DbUpdateException("save", deadlock));

        Assert.True(AppointmentBooking.IsDeadlock(deadlock));
        Assert.True(AppointmentBooking.IsDeadlock(wrapped));
        Assert.True(AppointmentBooking.IsDeadlock(new DbUpdateException("save", new Npgsql.PostgresException("x", "ERROR", "ERROR", "40001"))));
        Assert.False(AppointmentBooking.IsDeadlock(new DbUpdateException("save", new Npgsql.PostgresException("x", "ERROR", "ERROR", "23P01"))));
        Assert.False(AppointmentBooking.IsDeadlock(new InvalidOperationException("nope")));
    }

    // 18:00 for twelve hours runs to 06:00 the next day. With a rule that opens at 04:00 on that next day,
    // the two bookings have different Chicago dates, so different day locks, and only the overlap check
    // (and, when both pass it, the exclusion constraint) stands between them.
    [DbFact]
    public async Task Bookings_that_overlap_across_midnight_in_parallel_make_one_appointment()
    {
        await using var owned = await OwnDatabase.Create();
        var own = owned.Database;
        await using (var lan = own.Lan())
        {
            await lan.AvailabilityRules.ExecuteDeleteAsync();
            for (short day = 0; day <= 6; day++)
            {
                lan.AvailabilityRules.Add(new AvailabilityRule { DayOfWeek = day, Opens = new TimeOnly(4, 0), Closes = new TimeOnly(18, 0), SlotMinutes = 60 });
            }

            await lan.SaveChangesAsync();
        }

        using var host = new FormsHost(own);
        for (var round = 0; round < 8; round++)
        {
            var date = new DateOnly(2026, 11, 24).AddDays(round * 2);
            var evening = await Bookings.NewQuote(own);
            var earlyNextDay = await Bookings.NewQuote(own);
            var body = Bookings.Body(evening, date, "18:00", BookingKinds.DropsOnlyInstall).With("durationMinutes", 720);

            var responses = await Task.WhenAll(
                host.Post(Bookings.Path, body),
                host.Post(Bookings.Path, Bookings.Body(earlyNextDay, date.AddDays(1), "04:00")));

            var statuses = responses.Select(r => r.StatusCode).Order().ToList();
            Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Conflict], statuses);
            await using var read = own.Lan();
            Assert.Equal(1, await read.Appointments.CountAsync(a => a.QuoteId == evening.QuoteId || a.QuoteId == earlyNextDay.QuoteId));
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }
}
