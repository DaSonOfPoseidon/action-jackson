var port = Environment.GetEnvironmentVariable("HTTP_PORT") ?? "8080";

// Container healthcheck mode: answer before any host is built, so no port is bound.
if (args.Contains("--healthcheck"))
{
    return await HealthCheckCommand.RunAsync(port);
}

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://+:" + port);

var app = builder.Build();
// Unit 3 adds a database check here.
app.MapGet("/healthz", () => Results.Json(new { status = "ok" }));

app.Run();
return 0;

// WebApplicationFactory needs a public Program type.
public partial class Program;
