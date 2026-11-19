using System.Text.Json;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Tests;

public class DetailsPersistenceTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task Changing_details_on_a_tracked_customer_is_saved()
    {
        var customer = Rows.Customer();
        customer.Details = """{"squareFeet":"1500"}""";
        await using (var seed = database.Lan())
        {
            seed.Customers.Add(customer);
            await seed.SaveChangesAsync();
        }

        await using (var edit = database.Lan())
        {
            var tracked = await edit.Customers.SingleAsync(c => c.Id == customer.Id);
            tracked.Details = """{"squareFeet":"3000","floors":2}""";
            await edit.SaveChangesAsync();
        }

        await using var read = database.Lan();
        var saved = await read.Customers.SingleAsync(c => c.Id == customer.Id);
        using var json = JsonDocument.Parse(saved.Details);
        Assert.Equal("3000", json.RootElement.GetProperty("squareFeet").GetString());
        Assert.Equal(2, json.RootElement.GetProperty("floors").GetInt32());
    }

    [DbFact]
    public async Task Changing_details_on_a_row_the_same_context_added_is_saved()
    {
        var customer = Rows.Customer();
        await using var db = database.Car();
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        customer.Details = """{"vehicle":{"year":2021,"make":"Honda"}}""";
        await db.SaveChangesAsync();

        await using var read = database.Car();
        var saved = await read.Customers.SingleAsync(c => c.Id == customer.Id);
        using var json = JsonDocument.Parse(saved.Details);
        Assert.Equal("Honda", json.RootElement.GetProperty("vehicle").GetProperty("make").GetString());
    }

    [DbFact]
    public async Task Changing_details_on_an_appointment_is_saved()
    {
        var customer = Rows.Customer();
        var appointment = Rows.Appointment(Rows.UniqueDay(), customer.Id, 9, 10);
        await using (var seed = database.Lan())
        {
            seed.Customers.Add(customer);
            seed.Appointments.Add(appointment);
            await seed.SaveChangesAsync();
        }

        await using (var edit = database.Lan())
        {
            var tracked = await edit.Appointments.SingleAsync(a => a.Id == appointment.Id);
            tracked.Details = """{"wholeHome":true}""";
            await edit.SaveChangesAsync();
        }

        await using var read = database.Lan();
        Assert.Equal("""{"wholeHome": true}""", (await read.Appointments.SingleAsync(a => a.Id == appointment.Id)).Details);
    }

    [DbFact]
    public async Task Saving_a_modified_row_moves_updated_at_forward()
    {
        var customer = Rows.Customer();
        customer.UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1);
        await using var db = database.Lan();
        db.Customers.Add(customer);
        await db.SaveChangesAsync();
        var before = customer.UpdatedAt;

        customer.Phone = "555-0100";
        await db.SaveChangesAsync();

        Assert.True(customer.UpdatedAt > before);
    }

    [DbFact]
    public async Task A_details_value_that_is_not_json_is_rejected()
    {
        var customer = Rows.Customer();
        customer.Details = "not json";
        await using var db = database.Lan();
        db.Customers.Add(customer);

        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal("22P02", failure?.SqlState);
    }
}
