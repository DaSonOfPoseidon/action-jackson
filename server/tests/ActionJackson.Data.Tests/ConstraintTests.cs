using ActionJackson.Core;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Tests;

// The rules the database itself enforces. SqlState codes: 23P01 exclusion, 23505 unique, 23514 check.
public class ConstraintTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    private const string Exclusion = "23P01";
    private const string Unique = "23505";
    private const string Check = "23514";

    // xunit makes a new instance per test, so each test gets its own day.
    private readonly DateTimeOffset day = Rows.UniqueDay();

    [DbFact]
    public async Task Overlapping_scheduled_appointments_are_rejected()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 10, 12));
        await db.SaveChangesAsync();

        db.Appointments.Add(Rows.Appointment(day, customer.Id, 11, 13));
        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Exclusion, failure?.SqlState);
        Assert.Equal("appointments_no_overlap", failure?.ConstraintName);
    }

    [DbTheory]
    [InlineData(AppointmentStatus.Confirmed)]
    [InlineData(AppointmentStatus.InProgress)]
    public async Task Every_blocking_status_blocks_an_overlap(AppointmentStatus existing)
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 14, 16, existing));
        await db.SaveChangesAsync();

        db.Appointments.Add(Rows.Appointment(day, customer.Id, 15, 17));
        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Exclusion, failure?.SqlState);
    }

    [DbTheory]
    [InlineData(AppointmentStatus.Cancelled)]
    [InlineData(AppointmentStatus.NoShow)]
    [InlineData(AppointmentStatus.Completed)]
    [InlineData(AppointmentStatus.NeedsReview)]
    public async Task A_non_blocking_appointment_may_overlap_an_active_one(AppointmentStatus nonBlocking)
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 8, 10));
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 9, 11, nonBlocking));
        await db.SaveChangesAsync();

        Assert.Equal(2, await db.Appointments.CountAsync(a => a.CustomerId == customer.Id));
    }

    [DbFact]
    public async Task Adjacent_appointments_do_not_overlap()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 12, 13));
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 13, 14));
        await db.SaveChangesAsync();

        Assert.Equal(2, await db.Appointments.CountAsync(a => a.CustomerId == customer.Id));
    }

    [DbFact]
    public async Task The_same_range_is_allowed_in_lan_and_in_car()
    {
        await using var lan = database.Lan();
        await using var car = database.Car();
        var lanCustomer = Rows.Customer();
        var carCustomer = Rows.Customer();
        lan.Customers.Add(lanCustomer);
        car.Customers.Add(carCustomer);
        lan.Appointments.Add(Rows.Appointment(day, lanCustomer.Id, 15, 18));
        car.Appointments.Add(Rows.Appointment(day, carCustomer.Id, 15, 18));

        await lan.SaveChangesAsync();
        await car.SaveChangesAsync();

        Assert.Equal(1, await lan.Appointments.CountAsync(a => a.CustomerId == lanCustomer.Id));
        Assert.Equal(1, await car.Appointments.CountAsync(a => a.CustomerId == carCustomer.Id));
    }

    [DbFact]
    public async Task Cancelling_an_appointment_frees_its_slot()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var first = Rows.Appointment(day, customer.Id, 6, 7);
        db.Customers.Add(customer);
        db.Appointments.Add(first);
        await db.SaveChangesAsync();

        first.Status = AppointmentStatus.Cancelled;
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 6, 7));
        await db.SaveChangesAsync();

        Assert.Equal(2, await db.Appointments.CountAsync(a => a.CustomerId == customer.Id));
    }

    [DbFact]
    public async Task An_appointment_must_end_after_it_starts()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 5, 5));

        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Check, failure?.SqlState);
    }

    [DbFact]
    public async Task A_quote_has_one_active_appointment()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var quote = Rows.Quote(customer.Id);
        db.Customers.Add(customer);
        db.Quotes.Add(quote);
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 1, 2, quoteId: quote.Id));
        await db.SaveChangesAsync();

        db.Appointments.Add(Rows.Appointment(day, customer.Id, 3, 4, quoteId: quote.Id));
        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Unique, failure?.SqlState);
    }

    [DbFact]
    public async Task A_cancelled_appointment_does_not_use_up_the_quote()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var quote = Rows.Quote(customer.Id);
        db.Customers.Add(customer);
        db.Quotes.Add(quote);
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 1, 2, AppointmentStatus.Cancelled, quote.Id));
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 3, 4, quoteId: quote.Id));
        await db.SaveChangesAsync();

        Assert.Equal(2, await db.Appointments.CountAsync(a => a.QuoteId == quote.Id));
    }

    [DbTheory]
    [InlineData("pending")]
    [InlineData("No-Show")]
    [InlineData("noshow")]
    [InlineData("SCHEDULED")]
    public async Task A_status_with_another_spelling_is_rejected(string spelling)
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var appointment = Rows.Appointment(day, customer.Id, 20, 21);
        db.Customers.Add(customer);
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync();

        var failure = await Rows.ExecuteFailureAsync(
            database,
            $"UPDATE lan.appointments SET status = '{spelling}' WHERE id = '{appointment.Id}'");

        Assert.Equal(Check, failure?.SqlState);
        Assert.Equal("ck_appointments_status", failure?.ConstraintName);
    }

    // The status checks run before foreign keys, so these rows need no parents.
    [DbTheory]
    [InlineData("INSERT INTO lan.quotes (id, quote_number, customer_id, status, kind, discount_percent, subtotal, total, deposit, created_at, updated_at) VALUES (gen_random_uuid(), '11111111', gen_random_uuid(), 'pending', 'k', 0, 0, 0, 0, now(), now())", "ck_quotes_status")]
    [InlineData("INSERT INTO lan.invoices (id, invoice_number, quote_id, customer_id, status, subtotal, discount, total, created_at, updated_at) VALUES (gen_random_uuid(), 'INV-1', gen_random_uuid(), gen_random_uuid(), 'paid', 0, 0, 0, now(), now())", "ck_invoices_status")]
    [InlineData("INSERT INTO car.consultation_requests (id, request_number, name, email, status, source_ip, user_agent, created_at, updated_at) VALUES (gen_random_uuid(), '11111111', 'n', 'e', 'new', 'ip', 'ua', now(), now())", "ck_consultation_requests_status")]
    [InlineData("INSERT INTO main.contact_messages (id, name, email, body, status, source_ip, user_agent, created_at) VALUES (gen_random_uuid(), 'n', 'e', 'b', 'read', 'ip', 'ua', now())", "ck_contact_messages_status")]
    [InlineData("INSERT INTO core.email_outbox (id, created_at, to_address, subject, text_body, html_body, template, status, attempts, next_attempt_at) VALUES (gen_random_uuid(), now(), 'a', 's', 't', 'h', 'x', 'sent', 0, now())", "ck_email_outbox_status")]
    [InlineData("INSERT INTO lan.payments (id, invoice_id, amount, paid_on, method, created_at) VALUES (gen_random_uuid(), gen_random_uuid(), 5, current_date, 'cash', now())", "ck_payments_method")]
    public async Task Every_status_column_rejects_a_lowercase_spelling(string insert, string constraint)
    {
        var failure = await Rows.ExecuteFailureAsync(database, insert);

        Assert.Equal(Check, failure?.SqlState);
        Assert.Equal(constraint, failure?.ConstraintName);
    }

    [DbTheory]
    [InlineData("Lan")]
    [InlineData("LAN")]
    [InlineData("other")]
    public async Task A_site_column_accepts_only_the_lowercase_site_names(string site)
    {
        var failure = await Rows.ExecuteFailureAsync(
            database,
            $"INSERT INTO core.settings (site, data, updated_at) VALUES ('{site}', '{{}}', now())");

        Assert.Equal(Check, failure?.SqlState);
        Assert.Equal("ck_settings_site", failure?.ConstraintName);
    }

    [DbFact]
    public async Task A_server_error_upsert_on_source_and_fingerprint_increments_the_count()
    {
        var fingerprint = Guid.NewGuid().ToString("N");
        var upsert =
            "INSERT INTO core.server_errors (source, fingerprint, type, message, stack, path, count, first_seen, last_seen) " +
            $"VALUES ('Api', '{fingerprint}', 'T', 'm', 's', '/p', 1, now(), now()) " +
            "ON CONFLICT (source, fingerprint) DO UPDATE SET count = server_errors.count + 1, last_seen = now()";

        await Rows.ExecuteAsync(database, upsert);
        await Rows.ExecuteAsync(database, upsert);
        await Rows.ExecuteAsync(database, upsert);

        Assert.Equal(3, await Rows.ScalarAsync<int>(database, $"SELECT count FROM core.server_errors WHERE fingerprint = '{fingerprint}'"));
        Assert.Equal(1, await Rows.ScalarAsync<long>(database, $"SELECT count(*) FROM core.server_errors WHERE fingerprint = '{fingerprint}'"));
    }

    [DbFact]
    public async Task An_error_source_must_be_one_of_the_enum_names()
    {
        var failure = await Rows.ExecuteFailureAsync(
            database,
            "INSERT INTO core.client_errors (source, fingerprint, type, message, stack, url, count, first_seen, last_seen) " +
            "VALUES ('browser', 'f', 'T', 'm', 's', '/u', 1, now(), now())");

        Assert.Equal(Check, failure?.SqlState);
        Assert.Equal("ck_client_errors_source", failure?.ConstraintName);
    }

    [DbTheory]
    [InlineData("[]")]
    [InlineData("1")]
    [InlineData("\"text\"")]
    [InlineData("null")]
    public async Task Details_must_be_a_json_object(string json)
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        await db.SaveChangesAsync();

        var failure = await Rows.ExecuteFailureAsync(
            database,
            $"UPDATE lan.customers SET details = '{json}'::jsonb WHERE id = '{customer.Id}'");

        Assert.Equal(Check, failure?.SqlState);
    }

    [DbFact]
    public async Task Details_defaults_to_an_empty_object()
    {
        var id = Guid.NewGuid();
        await Rows.ExecuteAsync(
            database,
            "INSERT INTO car.customers (id, name, email, created_at, updated_at) " +
            $"VALUES ('{id}', 'n', '{id}@example.com', now(), now())");

        var details = await Rows.ScalarAsync<string>(database, $"SELECT details::text FROM car.customers WHERE id = '{id}'");

        Assert.Equal("{}", details);
    }

    [DbFact]
    public async Task A_quote_can_have_only_one_invoice()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var quote = Rows.Quote(customer.Id);
        db.Customers.Add(customer);
        db.Quotes.Add(quote);
        db.Invoices.Add(Rows.Invoice(quote.Id, customer.Id, "INV-2030-0001"));
        await db.SaveChangesAsync();

        db.Invoices.Add(Rows.Invoice(quote.Id, customer.Id, "INV-2030-0002"));
        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Unique, failure?.SqlState);
        Assert.Equal("ix_invoices_quote_id", failure?.ConstraintName);
    }

    [DbFact]
    public async Task An_invoice_number_cannot_repeat()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var first = Rows.Quote(customer.Id);
        var second = Rows.Quote(customer.Id);
        db.Customers.Add(customer);
        db.Quotes.AddRange(first, second);
        db.Invoices.Add(Rows.Invoice(first.Id, customer.Id, "INV-2030-0100"));
        await db.SaveChangesAsync();

        db.Invoices.Add(Rows.Invoice(second.Id, customer.Id, "INV-2030-0100"));
        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Unique, failure?.SqlState);
    }

    [DbFact]
    public async Task A_customer_email_is_unique_whatever_its_case()
    {
        await using var db = database.Lan();
        var email = $"{Guid.NewGuid():N}@Example.com";
        db.Customers.Add(Rows.Customer(email));
        await db.SaveChangesAsync();

        db.Customers.Add(Rows.Customer(email.ToLowerInvariant()));
        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Unique, failure?.SqlState);
        Assert.Equal("ix_customers_email_lower", failure?.ConstraintName);
    }

    [DbFact]
    public async Task The_same_email_is_allowed_in_lan_and_in_car()
    {
        await using var lan = database.Lan();
        await using var car = database.Car();
        var email = $"{Guid.NewGuid():N}@example.com";
        lan.Customers.Add(Rows.Customer(email));
        car.Customers.Add(Rows.Customer(email));

        await lan.SaveChangesAsync();
        await car.SaveChangesAsync();
    }

    [DbFact]
    public async Task A_quote_number_cannot_repeat()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        db.Quotes.Add(Rows.Quote(customer.Id, "44556677"));
        await db.SaveChangesAsync();

        db.Quotes.Add(Rows.Quote(customer.Id, "44556677"));
        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Unique, failure?.SqlState);
        Assert.Equal("ix_quotes_quote_number", failure?.ConstraintName);
    }

    [DbTheory]
    [InlineData("1234567")]
    [InlineData("123456789")]
    [InlineData("1234567a")]
    public async Task A_quote_number_must_be_eight_digits(string number)
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        db.Quotes.Add(Rows.Quote(customer.Id, number));

        var failure = await Rows.SaveFailureAsync(db);

        Assert.NotNull(failure);
        Assert.Contains(failure.SqlState, new[] { Check, "22001" });
    }

    [DbFact]
    public async Task A_catalog_item_cannot_be_its_own_component()
    {
        await using var db = database.Lan();
        var item = new CatalogItem
        {
            Code = $"X-{Guid.NewGuid():N}",
            Name = "x",
            Description = "",
            Category = "Equipment",
            UnitLabel = "per unit",
            UnitType = CatalogUnitType.PerUnit,
        };
        db.CatalogItems.Add(item);
        await db.SaveChangesAsync();

        db.CatalogItemComponents.Add(new CatalogItemComponent { ParentId = item.Id, ComponentId = item.Id, Quantity = 1 });
        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Check, failure?.SqlState);
    }

    [DbTheory]
    [InlineData(-0.01)]
    [InlineData(100.01)]
    public async Task A_discount_must_be_between_0_and_100(double percent)
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var quote = Rows.Quote(customer.Id);
        quote.DiscountPercent = (decimal)percent;
        db.Customers.Add(customer);
        db.Quotes.Add(quote);

        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Check, failure?.SqlState);
    }

    [DbFact]
    public async Task A_payment_must_be_positive()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var quote = Rows.Quote(customer.Id);
        var invoice = Rows.Invoice(quote.Id, customer.Id, "INV-2030-0200");
        db.Customers.Add(customer);
        db.Quotes.Add(quote);
        db.Invoices.Add(invoice);
        db.Payments.Add(new Payment { InvoiceId = invoice.Id, Amount = 0m, PaidOn = new DateOnly(2030, 6, 3) });

        var failure = await Rows.SaveFailureAsync(db);

        Assert.Equal(Check, failure?.SqlState);
    }

    [DbFact]
    public async Task Enums_are_stored_by_name()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        db.Customers.Add(customer);
        db.Appointments.Add(Rows.Appointment(day, customer.Id, 21, 22, AppointmentStatus.NoShow));
        await db.SaveChangesAsync();

        var stored = await Rows.ScalarAsync<string>(
            database,
            $"SELECT status FROM lan.appointments WHERE customer_id = '{customer.Id}'");

        Assert.Equal("NoShow", stored);
    }

    [DbFact]
    public async Task Money_round_trips_with_cents()
    {
        await using var db = database.Lan();
        var customer = Rows.Customer();
        var quote = Rows.Quote(customer.Id);
        quote.Subtotal = 1234567890.12m;
        quote.Total = 0.07m;
        db.Customers.Add(customer);
        db.Quotes.Add(quote);
        await db.SaveChangesAsync();

        await using var read = database.Lan();
        var saved = await read.Quotes.SingleAsync(q => q.Id == quote.Id);

        Assert.Equal(1234567890.12m, saved.Subtotal);
        Assert.Equal(0.07m, saved.Total);
    }
}
