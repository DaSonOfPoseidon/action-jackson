using ActionJackson.Core;
using ActionJackson.Data.Entities;

namespace ActionJackson.Data.Tests;

public class UniqueNumberTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    private const string RequestNumberIndex = "ix_consultation_requests_request_number";

    [DbFact]
    public async Task A_collision_is_retried_with_a_new_number()
    {
        await InsertRequestAsync("10000001");
        var offered = new Queue<string>(["10000001", "10000002"]);

        var number = await UniqueNumber.InsertWithRetryAsync(
            (candidate, _) => InsertRequestAsync(candidate),
            RequestNumberIndex,
            offered.Dequeue);

        Assert.Equal("10000002", number);
        Assert.Empty(offered);
        Assert.Equal(1, await Rows.ScalarAsync<long>(database, "SELECT count(*) FROM lan.consultation_requests WHERE request_number = '10000002'"));
    }

    [DbFact]
    public async Task Gives_up_after_five_retries()
    {
        await InsertRequestAsync("10000010");
        var attempts = 0;

        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(() => UniqueNumber.InsertWithRetryAsync(
            (candidate, _) =>
            {
                attempts++;
                return InsertRequestAsync(candidate);
            },
            RequestNumberIndex,
            () => "10000010"));

        // One try and five retries.
        Assert.Equal(1 + UniqueNumber.MaxRetries, attempts);
        Assert.Equal(5, UniqueNumber.MaxRetries);
        Assert.True(UniqueNumber.IsUniqueViolation(thrown.InnerException!, RequestNumberIndex));
    }

    [DbFact]
    public async Task A_violation_of_another_index_is_not_retried()
    {
        var email = $"{Guid.NewGuid():N}@example.com";
        await using (var seed = database.Lan())
        {
            seed.Customers.Add(Rows.Customer(email));
            await seed.SaveChangesAsync();
        }

        var attempts = 0;
        await Assert.ThrowsAnyAsync<Exception>(() => UniqueNumber.InsertWithRetryAsync(
            async (_, _) =>
            {
                attempts++;
                await using var db = database.Lan();
                db.Customers.Add(Rows.Customer(email));
                await db.SaveChangesAsync();
            },
            RequestNumberIndex));

        Assert.Equal(1, attempts);
    }

    [DbFact]
    public async Task The_first_free_number_is_used_at_once()
    {
        var attempts = 0;

        var number = await UniqueNumber.InsertWithRetryAsync(
            (candidate, _) =>
            {
                attempts++;
                return InsertRequestAsync(candidate);
            },
            RequestNumberIndex);

        Assert.Equal(1, attempts);
        Assert.Matches("^[0-9]{8}$", number);
    }

    [Fact]
    public void Random_numbers_have_eight_digits()
    {
        for (var i = 0; i < 1000; i++)
        {
            Assert.Matches("^[1-9][0-9]{7}$", UniqueNumber.RandomEightDigits());
        }
    }

    private async Task InsertRequestAsync(string number)
    {
        await using var db = database.Lan();
        db.ConsultationRequests.Add(new ConsultationRequest
        {
            RequestNumber = number,
            Name = "Test",
            Email = "test@example.com",
            Status = ConsultationStatus.New,
            SourceIp = "127.0.0.1",
            UserAgent = "tests",
        });
        await db.SaveChangesAsync();
    }
}
