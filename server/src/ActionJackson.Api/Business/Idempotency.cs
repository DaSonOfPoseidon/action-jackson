using System.Security.Cryptography;
using System.Text;
using ActionJackson.Core;
using ActionJackson.Data;
using ActionJackson.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace ActionJackson.Api.Business;

// The optional Idempotency-Key of a write that must not happen twice (a booking retried by the browser, or
// by the edge's offline outbox). The first 201 is stored as a receipt in core.edge_receipts, in the same
// transaction as the write; a retry with the same key and the same request gets that answer back instead of
// a second booking. The key is untrusted input: a UUID or a 400.
internal static class Idempotency
{
    public const string KeyHeader = "Idempotency-Key";
    public const string ReplayedHeader = "Idempotent-Replayed";

    // The receipt's primary key (see the Initial migration of core).
    internal const string ReceiptKeyConstraint = "pk_edge_receipts";

    // The key of the request: null with no header, a failure for anything that is not one UUID in its
    // hyphenated form (a second header, an empty value, braces, no hyphens). The key is kept lower-case, so
    // 0F8F... and 0f8f... are one key.
    public static (string? Key, IResult? Failure) ReadKey(HttpRequest request)
    {
        var values = request.Headers[KeyHeader];
        if (values.Count == 0)
        {
            return (null, null);
        }

        var text = values.Count == 1 ? values[0] : null;
        if (text is { Length: 36 } && Guid.TryParseExact(text, "D", out var key))
        {
            return (key.ToString("D"), null);
        }

        return (null, Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [KeyHeader] = ["The Idempotency-Key header must be one UUID."],
        }));
    }

    // SHA-256, in lower-case hex, of the endpoint and the raw request body (not the parsed JSON, so a
    // changed byte is a different request).
    public static string Hash(string endpoint, ReadOnlySpan<byte> body)
    {
        var endpointBytes = Encoding.UTF8.GetBytes(endpoint);
        var input = new byte[endpointBytes.Length + 1 + body.Length];
        endpointBytes.CopyTo(input, 0);
        input[endpointBytes.Length] = 0;
        body.CopyTo(input.AsSpan(endpointBytes.Length + 1));
        return Convert.ToHexStringLower(SHA256.HashData(input));
    }

    public static Task<EdgeReceipt?> FindAsync(CoreDbContext core, string key, CancellationToken cancellationToken) =>
        core.EdgeReceipts.AsNoTracking().SingleOrDefaultAsync(receipt => receipt.IdempotencyKey == key, cancellationToken);

    // The receipt of a request that carried this key: the stored answer when it was made by this site, for
    // this endpoint and this body, and a 422 when the key was used for anything else.
    public static IResult Answer(EdgeReceipt receipt, Site site, string endpoint, string hash, HttpResponse response)
    {
        if (receipt.Site != site
            || !string.Equals(receipt.Endpoint, endpoint, StringComparison.Ordinal)
            || !string.Equals(receipt.RequestHash, hash, StringComparison.Ordinal))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status422UnprocessableEntity,
                detail: "This idempotency key was used for a different request.");
        }

        response.Headers[ReplayedHeader] = "true";
        return Results.Text(receipt.ResponseBody, "application/json", Encoding.UTF8, receipt.ResponseStatus);
    }

    // A request that lost the race to insert its receipt: its transaction has been rolled back, and the
    // winner's receipt is in the table.
    public static bool IsReceiptKeyViolation(Exception error) => UniqueNumber.IsUniqueViolation(error, ReceiptKeyConstraint);
}
