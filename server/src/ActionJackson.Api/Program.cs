using ActionJackson.Api.Business;
using ActionJackson.Api.Platform;
using ActionJackson.Core;
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

builder.AddApiPlatform();
builder.Services.AddPublicForms();

var app = builder.Build();

// No connection string, no start. There is deliberately no default.
if (string.IsNullOrWhiteSpace(app.Configuration.GetConnectionString("Postgres")))
{
    throw new InvalidOperationException(Program.MissingConnectionString);
}

// Edge trust, routing and the rest of the platform; an Edge:Key that is set but too short stops startup.
app.UseApiPlatform();

if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    await DatabaseInitializer.MigrateAndSeedAsync(app.Services);
}

// 200 when the database answers SELECT 1 within three seconds, otherwise 503. The probe runs on a connection of
// its own (HealthzProbe), not on a request-scoped context, so giving up on it never disposes anything it is using.
app.MapGet("/healthz", async (IConfiguration configuration, ILoggerFactory loggers, CancellationToken requestAborted) =>
{
    var connectionString = configuration.GetConnectionString("Postgres")
        ?? throw new InvalidOperationException(Program.MissingConnectionString);
    var probe = HealthzProbe.RunAsync(connectionString, loggers.CreateLogger("ActionJackson.Api.Healthz"));
    try
    {
        // WaitAsync enforces the limit even when the driver ignores the token, as Npgsql does while it
        // waits for a server that accepted the connection and then went quiet.
        await probe.WaitAsync(HealthzProbe.Limit, requestAborted);
        return Results.Json(new { status = "ok", db = "ok" });
    }
    catch (Exception)
    {
        // A refused connection, a timeout, bad credentials, a client that left: the database is down for our purposes.
        // The abandoned probe may still be running and may still fail: it disposes its own connection when it
        // ends, and this observes its exception, so it is never an unhandled error.
        _ = probe.ContinueWith(
            finished => finished.Exception,
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);
        return Results.Json(new { status = "degraded", db = "down" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

// The public forms of the lan site: /api/lan/consultations and /api/lan/quotes/*. /api/car/* stays a 404
// until the car site arrives.
app.MapPublicForms(Site.Lan);

app.Run();
return 0;

// WebApplicationFactory needs a public Program type.
public partial class Program
{
    internal const string MissingConnectionString =
        "ConnectionStrings:Postgres is not set. Set it in the environment (ConnectionStrings__Postgres); there is no default.";
}
