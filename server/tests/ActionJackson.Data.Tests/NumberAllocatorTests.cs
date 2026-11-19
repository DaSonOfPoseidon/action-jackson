using ActionJackson.Core;

namespace ActionJackson.Data.Tests;

public class NumberAllocatorTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task Fifty_parallel_callers_get_the_numbers_1_to_50_once_each()
    {
        // A separate context per caller, as separate requests would have.
        var numbers = await Task.WhenAll(Enumerable.Range(0, 50).Select(async _ =>
        {
            await using var core = database.Core();
            return await new NumberAllocator(core).NextAsync(Site.Lan, "invoice", 2026);
        }));

        Assert.Equal(Enumerable.Range(1, 50), numbers.Order());
    }

    [DbFact]
    public async Task A_new_year_starts_again_at_1()
    {
        await using var core = database.Core();
        var allocator = new NumberAllocator(core);

        Assert.Equal(1, await allocator.NextAsync(Site.Lan, "year-reset", 2026));
        Assert.Equal(2, await allocator.NextAsync(Site.Lan, "year-reset", 2026));
        Assert.Equal(1, await allocator.NextAsync(Site.Lan, "year-reset", 2027));
        Assert.Equal(3, await allocator.NextAsync(Site.Lan, "year-reset", 2026));
    }

    [DbFact]
    public async Task Each_site_and_kind_counts_on_its_own()
    {
        await using var core = database.Core();
        var allocator = new NumberAllocator(core);

        Assert.Equal(1, await allocator.NextAsync(Site.Lan, "independent", 2026));
        Assert.Equal(2, await allocator.NextAsync(Site.Lan, "independent", 2026));
        Assert.Equal(1, await allocator.NextAsync(Site.Car, "independent", 2026));
        Assert.Equal(1, await allocator.NextAsync(Site.Lan, "other-kind", 2026));
        Assert.Equal(3, await allocator.NextAsync(Site.Lan, "independent", 2026));
    }

    [DbFact]
    public async Task Invoice_numbers_are_padded_to_four_digits_per_site_and_year()
    {
        await using var core = database.Core();
        var allocator = new NumberAllocator(core);

        Assert.Equal("INV-2031-0001", await allocator.NextInvoiceNumberAsync(Site.Lan, 2031));
        Assert.Equal("INV-2031-0002", await allocator.NextInvoiceNumberAsync(Site.Lan, 2031));
        Assert.Equal("INV-2031-0001", await allocator.NextInvoiceNumberAsync(Site.Car, 2031));
        Assert.Equal("INV-2032-0001", await allocator.NextInvoiceNumberAsync(Site.Lan, 2032));
    }

    [DbFact]
    public async Task Numbers_past_9999_grow_wider_without_an_error()
    {
        await using var core = database.Core();
        await Rows.ExecuteAsync(
            database,
            "INSERT INTO core.number_counters (site, kind, year, next_value) VALUES ('lan', 'invoice', 2040, 9999)");
        var allocator = new NumberAllocator(core);

        Assert.Equal("INV-2040-9999", await allocator.NextInvoiceNumberAsync(Site.Lan, 2040));
        Assert.Equal("INV-2040-10000", await allocator.NextInvoiceNumberAsync(Site.Lan, 2040));
        Assert.Equal("INV-2040-10001", await allocator.NextInvoiceNumberAsync(Site.Lan, 2040));
    }

    [DbTheory]
    [InlineData("", 2026)]
    [InlineData("invoice", 0)]
    public async Task Bad_arguments_are_refused(string kind, int year)
    {
        await using var core = database.Core();
        var allocator = new NumberAllocator(core);

        await Assert.ThrowsAnyAsync<ArgumentException>(() => allocator.NextAsync(Site.Lan, kind, year));
    }
}
