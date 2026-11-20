using ActionJackson.Data;
using Microsoft.EntityFrameworkCore;

var port = Environment.GetEnvironmentVariable("HTTP_PORT") ?? "8080";

// Container healthcheck mode: answer before any host is built, so no port is bound.
if (args.Contains("--healthcheck"))
{
    return await HealthCheckCommand.RunAsync(port);
}

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://+:" + port);

// The contexts read the connection string when they are first built, after configuration is final.
builder.Services.AddActionJacksonData(services =>
    services.GetRequiredService<IConfiguration>().GetConnectionString("Postgres")
    ?? throw new InvalidOperationException(Program.MissingConnectionString));

var app = builder.Build();

// No connection string, no start. There is deliberately no default.
if (string.IsNullOrWhiteSpace(app.Configuration.GetConnectionString("Postgres")))
{
    throw new InvalidOperationException(Program.MissingConnectionString);
}

if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    await DatabaseInitializer.MigrateAndSeedAsync(app.Services);
}

// 200 when the database answers SELECT 1 within three seconds, otherwise 503.
app.MapGet("/healthz", async (CoreDbContext db, CancellationToken requestAborted) =>
{
    var limit = TimeSpan.FromSeconds(3);
    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(requestAborted);
    timeout.CancelAfter(limit);
    var query = db.Database.ExecuteSqlRawAsync("SELECT 1", timeout.Token);
    try
    {
        // WaitAsync enforces the limit even when the driver ignores the token, as Npgsql does while it
        // waits for a server that accepted the connection and then went quiet.
        await query.WaitAsync(limit, requestAborted);
        return Results.Json(new { status = "ok", db = "ok" });
    }
    catch (Exception)
    {
        // A refused connection, a timeout, bad credentials: the database is down for our purposes.
        // The abandoned query may still fail later: observe that, so it is never an unhandled error.
        _ = query.ContinueWith(
            finished => finished.Exception,
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);
        return Results.Json(new { status = "degraded", db = "down" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

app.Run();
return 0;

// WebApplicationFactory needs a public Program type.
public partial class Program
{
    internal const string MissingConnectionString =
        "ConnectionStrings:Postgres is not set. Set it in the environment (ConnectionStrings__Postgres); there is no default.";
}
