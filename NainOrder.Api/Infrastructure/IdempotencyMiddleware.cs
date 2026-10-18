using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace NainOrder.Api.Infrastructure;

/// <summary>
/// Proporciona semántica de idempotencia para operaciones mutables (POST, PUT, PATCH)
/// mediante la cabecera 'Idempotency-Key'. Si una petición con la misma clave ya fue completada,
/// devuelve la respuesta en caché sin reejecutar la lógica de negocio ni crear registros duplicados.
/// </summary>
public sealed class IdempotencyMiddleware
{
    public const string HeaderName = "Idempotency-Key";
    public const string AltHeaderName = "X-Idempotency-Key";
    public const int MaxKeyLength = 128;

    private readonly RequestDelegate _next;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(24);
    private static readonly TimeSpan InFlightLockDuration = TimeSpan.FromMinutes(1);

    public IdempotencyMiddleware(RequestDelegate next, IMemoryCache cache)
    {
        _next = next;
        _cache = cache;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!HttpMethods.IsPost(context.Request.Method) &&
            !HttpMethods.IsPut(context.Request.Method) &&
            !HttpMethods.IsPatch(context.Request.Method))
        {
            await _next(context);
            return;
        }

        string? idempotencyKey = context.Request.Headers[HeaderName].FirstOrDefault()
                                 ?? context.Request.Headers[AltHeaderName].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(idempotencyKey))
        {
            await _next(context);
            return;
        }

        idempotencyKey = idempotencyKey.Trim();
        if (idempotencyKey.Length > MaxKeyLength)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Invalid Idempotency-Key",
                Detail = $"The Idempotency-Key length cannot exceed {MaxKeyLength} characters.",
                Extensions = { ["code"] = "invalid_idempotency_key" }
            });
            return;
        }

        var cacheKey = $"idempotency:{idempotencyKey}";

        if (_cache.TryGetValue(cacheKey, out IdempotencyRecord? cachedRecord) && cachedRecord is not null)
        {
            if (!cachedRecord.IsCompleted)
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Idempotent request in progress",
                    Detail = "A request with the same Idempotency-Key is currently being processed. Please retry shortly.",
                    Extensions = { ["code"] = "idempotency_conflict" }
                });
                return;
            }

            context.Response.StatusCode = cachedRecord.StatusCode;
            context.Response.ContentType = cachedRecord.ContentType;
            context.Response.Headers[HeaderName] = idempotencyKey;
            context.Response.Headers["X-Cache-Lookup"] = "HIT";
            await context.Response.Body.WriteAsync(cachedRecord.Body);
            return;
        }

        // Marcar clave como en curso para proteger contra peticiones concurrentes idénticas
        var inFlight = new IdempotencyRecord(false, 0, string.Empty, []);
        _cache.Set(cacheKey, inFlight, InFlightLockDuration);

        var originalBodyStream = context.Response.Body;
        using var memoryStream = new MemoryStream();
        context.Response.Body = memoryStream;

        try
        {
            await _next(context);

            memoryStream.Position = 0;
            var responseBytes = memoryStream.ToArray();

            // Solo cachear respuestas satisfactorias (2xx)
            if (context.Response.StatusCode >= 200 && context.Response.StatusCode < 300)
            {
                var completedRecord = new IdempotencyRecord(
                    IsCompleted: true,
                    StatusCode: context.Response.StatusCode,
                    ContentType: context.Response.ContentType ?? "application/json",
                    Body: responseBytes
                );
                _cache.Set(cacheKey, completedRecord, CacheDuration);
            }
            else
            {
                _cache.Remove(cacheKey);
            }

            memoryStream.Position = 0;
            await memoryStream.CopyToAsync(originalBodyStream);
        }
        catch
        {
            _cache.Remove(cacheKey);
            throw;
        }
        finally
        {
            context.Response.Body = originalBodyStream;
        }
    }

    private sealed record IdempotencyRecord(bool IsCompleted, int StatusCode, string ContentType, byte[] Body);
}
