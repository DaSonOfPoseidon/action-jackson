using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using ActionJackson.Core;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Routing;

namespace ActionJackson.Api.Platform;

// Records every unhandled exception in core.server_errors, grouped by fingerprint, and then returns false
// so the ProblemDetails service writes the response. Recording can never change that response: any
// failure here is logged and swallowed.
public sealed class ServerErrorRecorder(IServiceScopeFactory scopes, ILogger<ServerErrorRecorder> logger) : IExceptionHandler
{
    // Its own limit, not the request's: the client may be gone, and a slow database must not hold a 500.
    internal static readonly TimeSpan RecordTimeout = TimeSpan.FromSeconds(2);

    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        // The client went away: that is not a server fault.
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
        {
            return false;
        }

        try
        {
            // Everything is copied out of the request now; the write below does not touch it.
            var error = Build(context, exception);
            var write = WriteAsync(error);
            try
            {
                // WaitAsync enforces the limit even when the driver ignores the token, as Npgsql does while it
                // waits for a server that accepted the connection and then went quiet.
                await write.WaitAsync(RecordTimeout, CancellationToken.None);
            }
            catch (Exception)
            {
                // The abandoned write may still fail later: observe that, so it is never unhandled.
                _ = write.ContinueWith(
                    finished => finished.Exception,
                    CancellationToken.None,
                    TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
                    TaskScheduler.Default);
                throw;
            }
        }
        catch (Exception recordingFailure)
        {
            logger.LogError(recordingFailure, "Could not record a server error ({Type}).", exception.GetType().FullName);
        }

        return false;
    }

    // A fresh scope and context: the request's own context may be broken by the very exception handled.
    private async Task WriteAsync(ServerError error)
    {
        using var timeout = new CancellationTokenSource(RecordTimeout);
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        await ServerErrorStore.UpsertAsync(db, error, timeout.Token);
    }

    private static ServerError Build(HttpContext context, Exception exception)
    {
        var handled = context.Features.Get<IExceptionHandlerPathFeature>();
        // The exception middleware clears the endpoint before calling handlers; it keeps the original.
        var endpoint = handled?.Endpoint ?? context.GetEndpoint();
        var userAgent = context.Request.Headers.UserAgent.ToString();

        return new ServerError
        {
            Source = ErrorSource.Api,
            Site = null,
            Fingerprint = ErrorFingerprint.Of(exception, ErrorFingerprint.RouteOf(endpoint)),
            Type = exception.GetType().FullName ?? exception.GetType().Name,
            Message = exception.Message,
            Stack = exception.ToString(),

            // The path only. The query string can hold tokens or emails.
            Path = handled?.Path ?? context.Request.Path.Value ?? "",
            UserAgent = userAgent.Length > 0 ? userAgent : null,
        };
    }
}

// Groups errors. The same fault gives the same fingerprint across requests and redeploys, and different
// faults give different ones. The message is never part of it: messages can carry user input, which would
// make the number of rows unbounded.
public static class ErrorFingerprint
{
    public const string Unmatched = "(unmatched)";
    private const int Frames = 5;

    public static string RouteOf(Endpoint? endpoint) =>
        (endpoint as RouteEndpoint)?.RoutePattern.RawText ?? Unmatched;

    public static string Of(Exception exception, string route)
    {
        var innermost = exception;
        while (innermost.InnerException is not null)
        {
            innermost = innermost.InnerException;
        }

        var text = new StringBuilder()
            .Append(exception.GetType().FullName).Append('\n')
            .Append(innermost.GetType().FullName).Append('\n')
            .Append(route);

        // Method names only: line numbers and file names change with every edit and would split a group.
        foreach (var frame in new StackTrace(exception, false).GetFrames().Take(Frames))
        {
            var method = frame.GetMethod();
            text.Append('\n').Append(method?.DeclaringType?.FullName ?? "?").Append('.').Append(method?.Name ?? "?");
        }

        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text.ToString())));
    }
}
