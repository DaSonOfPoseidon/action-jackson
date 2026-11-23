using System.Text.Json;
using System.Text.RegularExpressions;

namespace ActionJackson.Api.Business;

// Reads a request body as JSON the way the public endpoints need: at most 32 KB, whatever the server and
// the client's headers say, and every failure is a 4xx problem document, never an exception. A body
// the model binder would reject (and, in Development, throw on) is answered here instead, the same in
// every environment.
internal static partial class JsonBody
{
    public const int MaxBytes = 32 * 1024;

    // Strict numbers: a count of "2" or 2.5 is a wrong type, not a 2. Unknown members are skipped.
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static async Task<(T? Value, IResult? Failure)> ReadAsync<T>(HttpRequest request, CancellationToken cancellationToken)
        where T : class
    {
        var (body, failure) = await ReadBytesAsync(request, cancellationToken);
        return failure is not null ? (null, failure) : Parse<T>(body);
    }

    // The raw body, at most 32 KB, for an endpoint that also needs the exact bytes (to hash them). Parse
    // reads the same bytes as JSON.
    public static async Task<(ReadOnlyMemory<byte> Body, IResult? Failure)> ReadBytesAsync(
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        if (!request.HasJsonContentType())
        {
            return (default, Results.Problem(
                statusCode: StatusCodes.Status415UnsupportedMediaType,
                detail: "Send the request as application/json."));
        }

        if (request.ContentLength > MaxBytes)
        {
            return (default, TooLarge());
        }

        // One byte more than the limit is enough to know it is exceeded, whatever the length header said
        // (a chunked body has none).
        var buffer = new byte[MaxBytes + 1];
        var length = 0;
        while (length < buffer.Length)
        {
            var read = await request.Body.ReadAsync(buffer.AsMemory(length), cancellationToken);
            if (read == 0)
            {
                break;
            }

            length += read;
        }

        return length > MaxBytes ? (default, TooLarge()) : (buffer.AsMemory(0, length), null);
    }

    public static (T? Value, IResult? Failure) Parse<T>(ReadOnlyMemory<byte> body)
        where T : class
    {
        try
        {
            // Syntax first: after this, any JsonException is about a value of a known member, and its path
            // names only members of the contract.
            using var document = JsonDocument.Parse(body);
        }
        catch (JsonException)
        {
            return (null, Invalid("body", "The request body is not valid JSON."));
        }

        try
        {
            var value = JsonSerializer.Deserialize<T>(body.Span, Options);
            return value is null
                ? (null, Invalid("body", "A JSON object is required."))
                : (value, null);
        }
        catch (JsonException e)
        {
            var path = SafePath(e.Path);
            return path == "body"
                ? (null, Invalid("body", "A JSON object is required."))
                : (null, Invalid(path, "This value has the wrong type or format."));
        }
    }

    // The 400 for a body or value that cannot be read: one entry, keyed by the JSON path.
    private static IResult Invalid(string path, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [path] = [message] });

    private static IResult TooLarge() =>
        Results.Problem(
            statusCode: StatusCodes.Status413PayloadTooLarge,
            detail: $"The request body is larger than {MaxBytes / 1024} KB.");

    // "$.runs.cat6" becomes "runs.cat6", "$.a.b[1]" "a.b[1]". Anything else, the bare root included, is "body".
    private static string SafePath(string? path) =>
        path is not null && path.Length > 2 && path.Length <= 120 && JsonPath().IsMatch(path)
            ? path[(path[1] == '.' ? 2 : 1)..]
            : "body";

    [GeneratedRegex(@"^\$(\.[A-Za-z][A-Za-z0-9]*|\[[0-9]{1,3}\])+$", RegexOptions.CultureInvariant)]
    private static partial Regex JsonPath();
}
