using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.Exceptions;
using NainOrder.Domain.Exceptions;

namespace NainOrder.Api.Infrastructure;

/// <summary>
/// Traduce cualquier excepción no controlada a una respuesta RFC 7807 uniforme.
/// <para>
/// Centralizarlo aquí permite que los controladores queden libres de <c>try/catch</c> y,
/// sobre todo, evita el antipatrón de capturar <see cref="Exception"/> y devolver 400:
/// un fallo técnico debe seguir siendo un 500 y quedar registrado con su traza.
/// </para>
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(
        IProblemDetailsService problemDetailsService,
        IHostEnvironment environment,
        ILogger<GlobalExceptionHandler> logger)
    {
        _problemDetailsService = problemDetailsService;
        _environment = environment;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, code, title) = Classify(exception);

        if (status >= StatusCodes.Status500InternalServerError)
            _logger.LogError(exception, "Unhandled failure on {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        else
            _logger.LogInformation("Rejected {Method} {Path}: {Code} - {Message}",
                httpContext.Request.Method, httpContext.Request.Path, code, exception.Message);

        httpContext.Response.StatusCode = status;

        var problemDetails = new ProblemDetails
        {
            Status = status,
            Title = title,
            Type = $"https://httpstatuses.io/{status}",
            // Un 500 nunca revela detalles internos fuera de desarrollo.
            Detail = status >= StatusCodes.Status500InternalServerError && !_environment.IsDevelopment()
                ? "An unexpected error occurred. The incident has been logged."
                : exception.Message
        };

        problemDetails.Extensions["code"] = code;

        foreach (var (key, value) in DescribeContext(exception))
            problemDetails.Extensions[key] = value;

        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = problemDetails
        });
    }

    private static (int Status, string Code, string Title) Classify(Exception exception) => exception switch
    {
        NotFoundException e => (StatusCodes.Status404NotFound, e.Code, "Resource not found"),
        OrderItemNotFoundException e => (StatusCodes.Status404NotFound, e.Code, "Order line not found"),

        ConflictException e => (StatusCodes.Status409Conflict, e.Code, "Conflict"),
        InsufficientStockException e => (StatusCodes.Status409Conflict, e.Code, "Insufficient stock"),
        InvalidOrderStateException e => (StatusCodes.Status409Conflict, e.Code, "Invalid order state"),
        DuplicateOrderItemException e => (StatusCodes.Status409Conflict, e.Code, "Duplicate order line"),

        InvalidDomainDataException e => (StatusCodes.Status400BadRequest, e.Code, "Invalid request data"),
        DomainException e => (StatusCodes.Status400BadRequest, e.Code, "Business rule violation"),

        // 499 no está en StatusCodes: es la convención de nginx para "el cliente cortó".
        OperationCanceledException => (StatusCodesExtra.ClientClosedRequest, "request_cancelled", "Request cancelled"),

        _ => (StatusCodes.Status500InternalServerError, "internal_error", "Internal server error")
    };

    /// <summary>Expone los datos accionables del fallo para que el cliente pueda reaccionar sin parsear texto.</summary>
    private static IEnumerable<KeyValuePair<string, object?>> DescribeContext(Exception exception)
    {
        switch (exception)
        {
            case InsufficientStockException e:
                yield return new("requested", e.Requested);
                yield return new("available", e.Available);
                break;

            case InvalidOrderStateException e:
                yield return new("currentStatus", e.CurrentStatus);
                yield return new("attemptedTransition", e.AttemptedTransition);
                break;

            case InvalidDomainDataException e:
                yield return new("parameter", e.ParameterName);
                break;

            case NotFoundException e:
                yield return new("resource", e.Resource);
                break;
        }
    }
}

/// <summary>Códigos de estado usados por la API que no existen en <see cref="StatusCodes"/>.</summary>
file static class StatusCodesExtra
{
    public const int ClientClosedRequest = 499;
}
