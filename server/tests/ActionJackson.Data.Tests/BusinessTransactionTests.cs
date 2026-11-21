using ActionJackson.Core;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ActionJackson.Data.Tests;

public class BusinessTransactionTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    private static EmailOutboxMessage Outbox() => new()
    {
        ToAddress = "pat@example.com",
        Subject = $"s-{Guid.NewGuid():N}",
        TextBody = "text",
        HtmlBody = "<p>html</p>",
        Template = "consultation-ack",
    };

    private static async Task<int> CountOutboxAsync(CoreDbContext core, Guid id) =>
        await core.EmailOutbox.CountAsync(m => m.Id == id);

    [DbFact]
    public async Task A_lan_row_and_an_outbox_row_commit_together()
    {
        var customer = Rows.Customer();
        var message = Outbox();
        await using (var lan = database.Lan())
        await using (var core = database.Core())
        {
            await BusinessTransaction.ExecuteAsync(lan, core, async ct =>
            {
                lan.Customers.Add(customer);
                core.EmailOutbox.Add(message);
                await lan.SaveChangesAsync(ct);
                await core.SaveChangesAsync(ct);
            });
        }

        await using var checkLan = database.Lan();
        await using var checkCore = database.Core();
        Assert.True(await checkLan.Customers.AnyAsync(c => c.Id == customer.Id));
        Assert.Equal(1, await CountOutboxAsync(checkCore, message.Id));
    }

    [DbFact]
    public async Task A_car_row_and_an_outbox_row_commit_together()
    {
        var customer = Rows.Customer();
        var message = Outbox();
        await using (var car = database.Car())
        await using (var core = database.Core())
        {
            await BusinessTransaction.ExecuteAsync(car, core, async ct =>
            {
                car.Customers.Add(customer);
                core.EmailOutbox.Add(message);
                await car.SaveChangesAsync(ct);
                await core.SaveChangesAsync(ct);
            });
        }

        await using var checkCar = database.Car();
        await using var checkLan = database.Lan();
        await using var checkCore = database.Core();
        Assert.True(await checkCar.Customers.AnyAsync(c => c.Id == customer.Id));
        Assert.False(await checkLan.Customers.AnyAsync(c => c.Id == customer.Id));
        Assert.Equal(1, await CountOutboxAsync(checkCore, message.Id));
    }

    [DbFact]
    public async Task Work_that_throws_after_both_saves_leaves_neither_row()
    {
        var customer = Rows.Customer();
        var message = Outbox();
        await using (var lan = database.Lan())
        await using (var core = database.Core())
        {
            var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                BusinessTransaction.ExecuteAsync(lan, core, async ct =>
                {
                    lan.Customers.Add(customer);
                    core.EmailOutbox.Add(message);
                    await lan.SaveChangesAsync(ct);
                    await core.SaveChangesAsync(ct);
                    throw new InvalidOperationException("after both saves");
                }));
            Assert.Equal("after both saves", error.Message);
        }

        await using var checkLan = database.Lan();
        await using var checkCore = database.Core();
        Assert.False(await checkLan.Customers.AnyAsync(c => c.Id == customer.Id));
        Assert.Equal(0, await CountOutboxAsync(checkCore, message.Id));
    }

    [DbFact]
    public async Task A_failing_outbox_save_rolls_the_business_row_back()
    {
        var customer = Rows.Customer();
        var message = Outbox();
        message.Attempts = -1;
        await using (var lan = database.Lan())
        await using (var core = database.Core())
        {
            await Assert.ThrowsAsync<DbUpdateException>(() =>
                BusinessTransaction.ExecuteAsync(lan, core, async ct =>
                {
                    lan.Customers.Add(customer);
                    core.EmailOutbox.Add(message);
                    await lan.SaveChangesAsync(ct);
                    await core.SaveChangesAsync(ct);
                }));
        }

        await using var checkLan = database.Lan();
        Assert.False(await checkLan.Customers.AnyAsync(c => c.Id == customer.Id));
    }

    [DbFact]
    public async Task The_result_of_the_work_is_returned()
    {
        await using var lan = database.Lan();
        await using var core = database.Core();

        var result = await BusinessTransaction.ExecuteAsync(lan, core, _ => Task.FromResult(42));

        Assert.Equal(42, result);
    }

    [DbFact]
    public async Task A_core_context_that_already_opened_its_own_connection_is_refused()
    {
        var customer = Rows.Customer();
        await using var lan = database.Lan();
        await using var core = database.Core();
        await core.Database.OpenConnectionAsync();
        var ran = false;

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            BusinessTransaction.ExecuteAsync(lan, core, async ct =>
            {
                ran = true;
                lan.Customers.Add(customer);
                await lan.SaveChangesAsync(ct);
            }));

        Assert.Contains("core", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.False(ran);
        await using var check = database.Lan();
        Assert.False(await check.Customers.AnyAsync(c => c.Id == customer.Id));
    }

    [DbFact]
    public async Task A_context_that_is_already_in_a_transaction_is_refused()
    {
        await using var lan = database.Lan();
        await using var core = database.Core();
        await using var outer = await core.Database.BeginTransactionAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            BusinessTransaction.ExecuteAsync(lan, core, _ => Task.CompletedTask));
    }

    [DbFact]
    public async Task The_core_context_is_usable_on_its_own_connection_afterwards()
    {
        var first = Outbox();
        var second = Outbox();
        await using var core = database.Core();
        await using (var lan = database.Lan())
        {
            await BusinessTransaction.ExecuteAsync(lan, core, async ct =>
            {
                core.EmailOutbox.Add(first);
                await core.SaveChangesAsync(ct);
            });
        }

        // The business context is gone; core must not still depend on its connection or transaction.
        core.EmailOutbox.Add(second);
        await core.SaveChangesAsync();

        await using var check = database.Core();
        Assert.Equal(1, await CountOutboxAsync(check, first.Id));
        Assert.Equal(1, await CountOutboxAsync(check, second.Id));
    }

    [DbFact]
    public async Task The_core_context_is_usable_on_its_own_connection_after_a_rollback()
    {
        var kept = Outbox();
        await using var core = database.Core();
        await using (var lan = database.Lan())
        {
            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                BusinessTransaction.ExecuteAsync(lan, core, async ct =>
                {
                    await Task.Yield();
                    throw new InvalidOperationException("no");
                }));
        }

        core.EmailOutbox.Add(kept);
        await core.SaveChangesAsync();

        await using var check = database.Core();
        Assert.Equal(1, await CountOutboxAsync(check, kept.Id));
    }

    [DbFact]
    public async Task A_cancelled_token_rolls_back_and_surfaces_the_cancellation()
    {
        var customer = Rows.Customer();
        using var cancel = new CancellationTokenSource();
        await using var lan = database.Lan();
        await using var core = database.Core();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            BusinessTransaction.ExecuteAsync(lan, core, async ct =>
            {
                lan.Customers.Add(customer);
                await lan.SaveChangesAsync(ct);
                await cancel.CancelAsync();
                ct.ThrowIfCancellationRequested();
            }, cancel.Token));

        await using var check = database.Lan();
        Assert.False(await check.Customers.AnyAsync(c => c.Id == customer.Id));
    }

    [DbFact]
    public async Task Concurrent_transactions_do_not_share_state()
    {
        var tasks = Enumerable.Range(0, 8).Select(async _ =>
        {
            var customer = Rows.Customer();
            var message = Outbox();
            await using var lan = database.Lan();
            await using var core = database.Core();
            await BusinessTransaction.ExecuteAsync(lan, core, async ct =>
            {
                lan.Customers.Add(customer);
                core.EmailOutbox.Add(message);
                await lan.SaveChangesAsync(ct);
                await core.SaveChangesAsync(ct);
            });
            return (customer.Id, message.Id);
        }).ToArray();

        var ids = await Task.WhenAll(tasks);

        await using var checkLan = database.Lan();
        await using var checkCore = database.Core();
        foreach (var (customerId, messageId) in ids)
        {
            Assert.True(await checkLan.Customers.AnyAsync(c => c.Id == customerId));
            Assert.Equal(1, await CountOutboxAsync(checkCore, messageId));
        }
    }
}
