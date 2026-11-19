// The container healthcheck: the aspnet image has no curl, so the app checks itself.
public static class HealthCheckCommand
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(5);

    // Returns 0 when /healthz answers with a success status, 1 for anything else. Never throws.
    public static async Task<int> RunAsync(string port, HttpMessageHandler? handler = null)
    {
        try
        {
            using var http = handler is null
                ? new HttpClient { Timeout = RequestTimeout }
                : new HttpClient(handler, disposeHandler: false) { Timeout = RequestTimeout };
            using var response = await http.GetAsync($"http://localhost:{port}/healthz");
            return response.IsSuccessStatusCode ? 0 : 1;
        }
        catch (Exception)
        {
            // A refused connection, a timeout, a bad port: the container is unhealthy either way.
            return 1;
        }
    }
}
