using ActionJackson.Data.Seed;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Data.Tests;

// Reads only: every test of this class sees the seeded rules as they were made.
public class AvailabilitySeedTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task Lan_gets_seven_rules_open_every_day_from_8_to_18_on_the_hour_and_car_gets_none()
    {
        await using var lan = database.Lan();
        await using var car = database.Car();

        var rules = await lan.AvailabilityRules.OrderBy(rule => rule.DayOfWeek).ToListAsync();

        Assert.Equal([0, 1, 2, 3, 4, 5, 6], rules.Select(rule => (int)rule.DayOfWeek));
        Assert.All(rules, rule =>
        {
            Assert.Equal(new TimeOnly(8, 0), rule.Opens);
            Assert.Equal(new TimeOnly(18, 0), rule.Closes);
            Assert.Equal(60, rule.SlotMinutes);
        });
        Assert.Equal(0, await car.AvailabilityRules.CountAsync());
        Assert.Equal(0, await lan.BlackoutDates.CountAsync());
    }

    [DbFact]
    public async Task Seeding_again_adds_no_rules()
    {
        await database.MigrateAndSeedAsync();
        await database.MigrateAndSeedAsync();

        await using var lan = database.Lan();
        Assert.Equal(7, await lan.AvailabilityRules.CountAsync());
    }
}

// Its own class, so its own database: this test changes the seeded rules.
public class AvailabilitySeedEditTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task Rules_an_admin_edited_or_removed_one_by_one_are_kept_but_an_empty_table_is_seeded_again()
    {
        await using (var lan = database.Lan())
        {
            var sunday = await lan.AvailabilityRules.SingleAsync(rule => rule.DayOfWeek == 0);
            sunday.Opens = new TimeOnly(10, 0);
            sunday.SlotMinutes = 30;
            await lan.SaveChangesAsync();
            await lan.AvailabilityRules.Where(rule => rule.DayOfWeek == 2 || rule.DayOfWeek == 3).ExecuteDeleteAsync();
        }

        await database.MigrateAndSeedAsync();

        await using (var kept = database.Lan())
        {
            Assert.Equal(5, await kept.AvailabilityRules.CountAsync());
            Assert.Empty(await kept.AvailabilityRules.Where(rule => rule.DayOfWeek == 2 || rule.DayOfWeek == 3).ToListAsync());
            var sunday = await kept.AvailabilityRules.SingleAsync(rule => rule.DayOfWeek == 0);
            Assert.Equal(new TimeOnly(10, 0), sunday.Opens);
            Assert.Equal(30, sunday.SlotMinutes);
            await kept.AvailabilityRules.ExecuteDeleteAsync();
        }

        // Deleting every rule is not a way to close: the next start brings the default hours back.
        await database.MigrateAndSeedAsync();

        await using var reseeded = database.Lan();
        var rules = await reseeded.AvailabilityRules.ToListAsync();
        Assert.Equal(7, rules.Count);
        Assert.All(rules, rule => Assert.Equal(new TimeOnly(8, 0), rule.Opens));
    }
}

public class AvailabilitySeedRaceTests(EmptyTestDatabase database) : IClassFixture<EmptyTestDatabase>
{
    [DbFact]
    public async Task Several_starts_at_once_seed_the_rules_once()
    {
        await database.MigrateAndSeedAsync();
        await using (var clear = database.Lan())
        {
            await clear.AvailabilityRules.ExecuteDeleteAsync();
        }

        await Task.WhenAll(Enumerable.Range(0, 4).Select(async _ =>
        {
            await using var core = database.Core();
            await using var lan = database.Lan();
            await DatabaseSeed.SeedAsync(core, lan);
        }));

        await using var read = database.Lan();
        Assert.Equal(7, await read.AvailabilityRules.CountAsync());
    }
}
