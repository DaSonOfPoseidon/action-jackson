using System.Diagnostics;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace ActionJackson.Api.Platform;

// Every error response is an RFC 9457 problem document (application/problem+json) with a traceId.
public static class ProblemDetailsSetup
{
    // The only text a 500 carries. The exception's message, type and stack never reach the client, in any
    // environment: they can hold paths, SQL or user input.
    public const string ServerErrorDetail = "An unexpected error occurred. Quote the traceId when you report it.";

    public static IServiceCollection AddPlatformProblemDetails(this IServiceCollection services)
    {
        services.AddProblemDetails(options => options.CustomizeProblemDetails = Customize);

        // The framework's writer declines a request whose Accept header excludes JSON (a browser tab that
        // asks for text/html), which would leave the error with no body. This one runs after it and writes
        // the same document anyway.
        services.AddSingleton<IProblemDetailsWriter, AnyAcceptProblemDetailsWriter>();
        return services;
    }

    internal static void Customize(ProblemDetailsContext context)
    {
        var problem = context.ProblemDetails;
        problem.Extensions["traceId"] = Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;

        // Unhandled exception: a fixed sentence, and nothing about the exception.
        if (context.Exception is not null || problem.Status == StatusCodes.Status500InternalServerError)
        {
            problem.Detail = ServerErrorDetail;
        }
    }
}

internal sealed class AnyAcceptProblemDetailsWriter(IOptions<ProblemDetailsOptions> options, IOptions<JsonOptions> json)
    : IProblemDetailsWriter
{
    public bool CanWrite(ProblemDetailsContext context) => true;

    public ValueTask WriteAsync(ProblemDetailsContext context)
    {
        var response = context.HttpContext.Response;
        var problem = context.ProblemDetails;
        problem.Status ??= response.StatusCode;
        problem.Title ??= ReasonPhrases.GetReasonPhrase(problem.Status.Value);
        options.Value.CustomizeProblemDetails?.Invoke(context);

        response.StatusCode = problem.Status.Value;
        return new ValueTask(response.WriteAsJsonAsync(
            problem,
            json.Value.SerializerOptions,
            contentType: "application/problem+json"));
    }
}
