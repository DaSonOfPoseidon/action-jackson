using ActionJackson.Edge;
using ActionJackson.Edge.Platform;

// Container healthcheck mode: answer before any host is built, so no port is bound.
if (args.Contains("--healthcheck"))
{
    return await HealthCheckCommand.RunAsync(Environment.GetEnvironmentVariable("HTTP_PORT") ?? "8080");
}

var ports = EdgePorts.Parse(
    Environment.GetEnvironmentVariable("HTTP_PORT"),
    Environment.GetEnvironmentVariable("TUNNEL_PORT"));

var builder = WebApplication.CreateBuilder(args);

// Two listeners: HTTP_PORT is the LAN's and untrusted; TUNNEL_PORT is cloudflared's (published to localhost only)
// and may carry CF-Connecting-IP. The edge tells them apart by the connection's local port.
builder.WebHost.UseUrls($"http://+:{ports.Http};http://+:{ports.Tunnel}");
builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
{
    ["Edge:TunnelPort"] = ports.Tunnel.ToString(System.Globalization.CultureInfo.InvariantCulture),
});

// Missing or invalid settings (Edge:Key, Edge:ApiUrl, sites.json) stop startup here.
builder.AddEdge();

var app = builder.Build();
app.UseEdge();
app.Run();
return 0;
