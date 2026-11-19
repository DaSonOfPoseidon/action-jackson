namespace ActionJackson.Data.Tests;

public class TestDatabaseTests(TestDatabase database) : IClassFixture<TestDatabase>
{
    [DbFact]
    public async Task Creates_a_reachable_database()
    {
        await using var connection = await database.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT current_database()";

        var name = (string?)await command.ExecuteScalarAsync();

        Assert.StartsWith("t_", name);
    }
}
