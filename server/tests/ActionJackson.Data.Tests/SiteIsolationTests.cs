using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Tests;

public class SiteIsolationTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task Lan_rows_are_invisible_to_car()
    {
        var day = Rows.UniqueDay();
        var customer = Rows.Customer();
        await using (var lan = database.Lan())
        {
            lan.Customers.Add(customer);
            lan.Appointments.Add(Rows.Appointment(day, customer.Id, 9, 10));
            await lan.SaveChangesAsync();
        }

        await using var car = database.Car();

        Assert.False(await car.Customers.AnyAsync(c => c.Id == customer.Id));
        Assert.False(await car.Appointments.AnyAsync(a => a.CustomerId == customer.Id));
    }

    [DbFact]
    public async Task Car_rows_are_invisible_to_lan()
    {
        var day = Rows.UniqueDay();
        var customer = Rows.Customer();
        await using (var car = database.Car())
        {
            car.Customers.Add(customer);
            car.Appointments.Add(Rows.Appointment(day, customer.Id, 9, 10));
            await car.SaveChangesAsync();
        }

        await using var lan = database.Lan();

        Assert.False(await lan.Customers.AnyAsync(c => c.Id == customer.Id));
        Assert.False(await lan.Appointments.AnyAsync(a => a.CustomerId == customer.Id));
    }

    [DbFact]
    public async Task Each_site_writes_only_to_its_own_schema()
    {
        var customer = Rows.Customer();
        await using (var lan = database.Lan())
        {
            lan.Customers.Add(customer);
            await lan.SaveChangesAsync();
        }

        Assert.Equal(1, await Rows.ScalarAsync<long>(database, $"SELECT count(*) FROM lan.customers WHERE id = '{customer.Id}'"));
        Assert.Equal(0, await Rows.ScalarAsync<long>(database, $"SELECT count(*) FROM car.customers WHERE id = '{customer.Id}'"));
    }

    [DbFact]
    public async Task A_customer_cannot_be_the_parent_of_an_appointment_in_the_other_site()
    {
        var customer = Rows.Customer();
        await using (var lan = database.Lan())
        {
            lan.Customers.Add(customer);
            await lan.SaveChangesAsync();
        }

        await using var car = database.Car();
        car.Appointments.Add(Rows.Appointment(Rows.UniqueDay(), customer.Id, 9, 10));
        var failure = await Rows.SaveFailureAsync(car);

        // The foreign key points inside car, where this customer does not exist.
        Assert.Equal("23503", failure?.SqlState);
    }
}
