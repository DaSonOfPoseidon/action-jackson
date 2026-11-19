using System.Net;

namespace ActionJackson.Api.Tests;

public class HealthCheckCommandTests
{
    [Fact]
    public async Task Ok_status_returns_0()
    {
        var handler = new FakeHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)));

        Assert.Equal(0, await HealthCheckCommand.RunAsync("8080", handler));
        Assert.Equal("http://localhost:8080/healthz", handler.LastUri?.ToString());
    }

    [Fact]
    public async Task Error_status_returns_1()
    {
        var handler = new FakeHandler((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)));

        Assert.Equal(1, await HealthCheckCommand.RunAsync("8080", handler));
    }

    [Fact]
    public async Task Connection_failure_returns_1()
    {
        var handler = new FakeHandler((_, _) => throw new HttpRequestException("refused"));

        Assert.Equal(1, await HealthCheckCommand.RunAsync("8080", handler));
    }

    [Fact]
    public async Task Timeout_returns_1()
    {
        var handler = new FakeHandler((_, _) => throw new TaskCanceledException("timeout"));

        Assert.Equal(1, await HealthCheckCommand.RunAsync("8080", handler));
    }

    [Fact]
    public async Task Hung_server_times_out_and_returns_1()
    {
        // Never completes until the request is cancelled, like a server that accepts and then hangs.
        var handler = new FakeHandler(async (_, cancellation) =>
        {
            await Task.Delay(Timeout.Infinite, cancellation);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        Assert.Equal(1, await HealthCheckCommand.RunAsync("8080", handler));
    }

    private sealed class FakeHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond)
        : HttpMessageHandler
    {
        public Uri? LastUri { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
        {
            LastUri = request.RequestUri;
            return respond(request, cancellation);
        }
    }
}
