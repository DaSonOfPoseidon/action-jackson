using System.Diagnostics;
using System.Threading.Channels;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using Microsoft.Extensions.Options;

namespace ActionJackson.Api.Platform;

public sealed class RequestMetricsOptions
{
    public const string Section = "RequestMetrics";

    // Rows waiting for the writer. When it is full, new rows are dropped (and counted), never awaited.
    public int ChannelCapacity { get; set; } = 10_000;

    // How long the writer lets rows pile up before it writes them.
    public TimeSpan FlushInterval { get; set; } = TimeSpan.FromSeconds(2);

    public int BatchSize { get; set; } = 500;
}

// The hand-off between the request path and the writer: a bounded channel that drops when full, so a
// slow or dead database can never slow a request down or grow memory.
public sealed class RequestMetricsQueue
{
    private readonly Channel<RequestMetric> channel;
    private long dropped;

    public RequestMetricsQueue(IOptions<RequestMetricsOptions> options)
    {
        var capacity = Math.Max(1, options.Value.ChannelCapacity);
        channel = Channel.CreateBounded<RequestMetric>(
            new BoundedChannelOptions(capacity)
            {
                FullMode = BoundedChannelFullMode.DropWrite,
                SingleReader = true,
                SingleWriter = false,
            },
            _ => Interlocked.Increment(ref dropped));
    }

    // Rows lost to a full channel since the host started.
    public long Dropped => Interlocked.Read(ref dropped);

    public ChannelReader<RequestMetric> Reader => channel.Reader;

    // Never blocks. A row that does not fit is dropped and counted.
    public void Enqueue(RequestMetric metric) => channel.Writer.TryWrite(metric);

    // Rows dropped since the last call, and zeroes the count.
    internal long TakeDropped() => Interlocked.Exchange(ref dropped, 0);
}

// Times every request and queues one row for it. It never touches the database.
public sealed class RequestMetricsMiddleware(RequestDelegate next, RequestMetricsQueue queue)
{
    // numeric(10,2) holds up to 99,999,999.99.
    internal const decimal MaxDurationMs = 99_999_999.99m;
    internal const int MaxRoute = 512;
    private const string Healthz = "/healthz";
    private const string Other = "OTHER";

    public async Task InvokeAsync(HttpContext context)
    {
        var at = DateTimeOffset.UtcNow;
        var started = Stopwatch.GetTimestamp();
        int? thrownStatus = null;
        try
        {
            await next(context);
        }
        catch (Exception e)
        {
            // The outer exception handler decides the real response; this is what it will be.
            thrownStatus = e is OperationCanceledException && context.RequestAborted.IsCancellationRequested
                ? 499
                : StatusCodes.Status500InternalServerError;
            throw;
        }
        finally
        {
            Record(context, at, Stopwatch.GetElapsedTime(started), thrownStatus);
        }
    }

    private void Record(HttpContext context, DateTimeOffset at, TimeSpan elapsed, int? thrownStatus)
    {
        try
        {
            // The route template, never the raw path, so the number of distinct routes stays bounded.
            var route = ErrorFingerprint.RouteOf(context.GetEndpoint());

            // Monitoring polls /healthz constantly; routing is case-insensitive, so match the template.
            if (string.Equals(route, Healthz, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var status = thrownStatus ?? context.Response.StatusCode;
            queue.Enqueue(new RequestMetric
            {
                At = at,
                Method = Method(context.Request.Method),
                Route = route.Length > MaxRoute ? route[..MaxRoute] : route,
                Status = (short)Math.Clamp(status, 100, 599),
                DurationMs = Duration(elapsed),
            });
        }
        catch (Exception)
        {
            // Metrics must never fail a request.
        }
    }

    // A known method, or OTHER: the method is client input and would otherwise be a free-form value.
    private static string Method(string method) =>
        IsKnown(method) ? HttpMethods.GetCanonicalizedValue(method) : Other;

    private static bool IsKnown(string method) =>
        HttpMethods.IsGet(method) || HttpMethods.IsPost(method) || HttpMethods.IsPut(method)
        || HttpMethods.IsDelete(method) || HttpMethods.IsPatch(method) || HttpMethods.IsHead(method)
        || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method) || HttpMethods.IsConnect(method);

    internal static decimal Duration(TimeSpan elapsed) =>
        Math.Min(MaxDurationMs, Math.Round((decimal)elapsed.TotalMilliseconds, 2, MidpointRounding.AwayFromZero));
}

// Writes queued rows in batches, off the request path. A batch that fails is logged and dropped: no
// retry storm, and the host keeps running.
public sealed class RequestMetricsWriter(
    RequestMetricsQueue queue,
    IServiceScopeFactory scopes,
    IOptions<RequestMetricsOptions> options,
    ILogger<RequestMetricsWriter> logger) : BackgroundService
{
    // One failed or slow batch is cut off after this long.
    private static readonly TimeSpan BatchTimeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan DropReportEvery = TimeSpan.FromMinutes(1);

    private long lastDropReport = Stopwatch.GetTimestamp();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        var batchSize = Math.Max(1, settings.BatchSize);
        try
        {
            while (await queue.Reader.WaitToReadAsync(stoppingToken))
            {
                // Let rows pile up for one interval, unless a batch is already waiting.
                if (queue.Reader.Count < batchSize)
                {
                    await Task.Delay(settings.FlushInterval, stoppingToken);
                }

                await FlushAvailableAsync(batchSize, stoppingToken);
                ReportDrops();
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down: StopAsync drains what is left.
        }
    }

    // Stops the loop, then writes what is left, bounded by the host's shutdown timeout.
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        try
        {
            await FlushAvailableAsync(Math.Max(1, options.Value.BatchSize), cancellationToken);
            ReportDrops();
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Shutdown ended before the last request metrics were written.");
        }
    }

    private async Task FlushAvailableAsync(int batchSize, CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            var batch = new List<RequestMetric>(Math.Min(batchSize, 64));
            while (batch.Count < batchSize && queue.Reader.TryRead(out var metric))
            {
                batch.Add(metric);
            }

            if (batch.Count == 0)
            {
                return;
            }

            await WriteAsync(batch, cancellationToken);
        }
    }

    private async Task WriteAsync(List<RequestMetric> batch, CancellationToken cancellationToken)
    {
        var write = SaveAsync(batch, cancellationToken);
        try
        {
            // WaitAsync enforces the limit even when the driver ignores the token.
            await write.WaitAsync(BatchTimeout, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            Observe(write);
            throw;
        }
        catch (Exception e)
        {
            Observe(write);
            logger.LogError(e, "Could not write {Count} request metrics; they are dropped.", batch.Count);
        }
    }

    private async Task SaveAsync(List<RequestMetric> batch, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(BatchTimeout);
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        db.RequestMetrics.AddRange(batch);
        await db.SaveChangesAsync(timeout.Token);
    }

    // An abandoned write may still fail later: observe that, so it is never an unhandled error.
    private static void Observe(Task write) =>
        _ = write.ContinueWith(
            finished => finished.Exception,
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);

    // At most one line a minute, however many rows were dropped.
    private void ReportDrops()
    {
        if (Stopwatch.GetElapsedTime(lastDropReport) < DropReportEvery)
        {
            return;
        }

        var dropped = queue.TakeDropped();
        lastDropReport = Stopwatch.GetTimestamp();
        if (dropped > 0)
        {
            logger.LogWarning("The request metrics queue was full: {Dropped} rows were dropped in the last minute.", dropped);
        }
    }
}
