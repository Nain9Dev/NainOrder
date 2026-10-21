using System.Diagnostics;
using System.Globalization;
using NainOrder.Infrastructure.Persistence.Diagnostics;

namespace NainOrder.Api.Infrastructure;

/// <summary>
/// Writes a <c>Server-Timing</c> header on every response: <c>app</c> for the whole request and,
/// when the database was used, <c>db</c> with the summed duration of its commands (REQ-110). The
/// panel's request map draws these figures; it never estimates them.
/// </summary>
public sealed class ServerTimingMiddleware
{
    public const string HeaderName = "Server-Timing";

    private readonly RequestDelegate _next;

    public ServerTimingMiddleware(RequestDelegate next) => _next = next;

    public Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();

        context.Response.OnStarting(() =>
        {
            var app = Metric("app", stopwatch.Elapsed);

            // The accumulator is scoped to the request, so it is the same instance the DbContext's
            // interceptor filled. A request that never opened a scope for it simply has no db segment.
            var database = context.RequestServices.GetService<RequestDatabaseTiming>();
            var value = database is { Used: true }
                ? $"{app}, {Metric("db", database.Total)};desc=\"{database.Commands} command{(database.Commands == 1 ? "" : "s")}\""
                : app;

            context.Response.Headers.Append(HeaderName, value);
            return Task.CompletedTask;
        });

        return _next(context);
    }

    private static string Metric(string name, TimeSpan duration) =>
        $"{name};dur={duration.TotalMilliseconds.ToString("0.0", CultureInfo.InvariantCulture)}";
}
