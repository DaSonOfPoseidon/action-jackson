using System.Net;
using System.Net.Sockets;

namespace ActionJackson.Edge.Tests;

public class HealthCheckModeTests
{
    [Fact]
    public async Task Exits_1_without_server()
    {
        var port = FreePort();
        var previous = Environment.GetEnvironmentVariable("HTTP_PORT");
        Environment.SetEnvironmentVariable("HTTP_PORT", port.ToString());
        try
        {
            // Run the real entry point (the compiler's blocking Main wrapper). If --healthcheck started
            // the web host, this would never return, so the wait is bounded.
            var main = typeof(HealthCheckCommand).Assembly.EntryPoint!;
            var run = Task.Run(() => (int)main.Invoke(null, [new[] { "--healthcheck" }])!);

            var exitCode = await run.WaitAsync(TimeSpan.FromSeconds(30));

            Assert.Equal(1, exitCode);
        }
        finally
        {
            Environment.SetEnvironmentVariable("HTTP_PORT", previous);
        }
    }

    // A port that was free a moment ago, so nothing listens on it.
    private static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try
        {
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
        finally
        {
            listener.Stop();
        }
    }
}
