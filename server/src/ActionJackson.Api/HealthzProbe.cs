using Npgsql;

// The database check behind /healthz. It runs on a connection of its own, never on the request's DbContext: when
// the database accepts the connection and then goes quiet, Npgsql ignores the cancellation token while it waits
// for the startup reply, so the endpoint gives up on the probe and answers while the probe is still running. A
// request-scoped context would be disposed under it ("Can't close, connection is in state Connecting"), which
// aborted the 503 response. Here the probe disposes its own connection, and only after the connect or the query
// has finished, whatever the outcome.
internal static class HealthzProbe
{
    internal static readonly TimeSpan Limit = TimeSpan.FromSeconds(3);

    internal const string EndedMessage = "Healthz probe ended";

    // Opens a connection and runs SELECT 1. Cancelled after Limit (the token is only honoured once the
    // driver is past the connect), and independent of the request: it may outlive it. Everything it
    // throws is on the returned task, so a caller that gives up must still observe that task.
    internal static async Task RunAsync(string connectionString, ILogger logger)
    {
        using var timeout = new CancellationTokenSource(Limit);
        try
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync(timeout.Token);
            await using var command = new NpgsqlCommand("SELECT 1", connection);
            await command.ExecuteScalarAsync(timeout.Token);
        }
        finally
        {
            // After the connection is disposed: this is what a test waits for before it reads the logs.
            logger.LogDebug(EndedMessage);
        }
    }
}
