using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using NainOrder.Api.Infrastructure;
using NainOrder.Application;
using NainOrder.Infrastructure;
using NainOrder.Infrastructure.Persistence;
using NainOrder.Infrastructure.Persistence.Seeding;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
                       ?? "Data Source=nainorder.db";

// --- Composición: la API solo conoce las extensiones públicas de cada capa ---
builder.Services.AddApplication();
builder.Services.AddInfrastructure(connectionString);

builder.Services.AddControllers();

// Errores uniformes RFC 7807 en toda la superficie de la API.
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Instance = $"{context.HttpContext.Request.Method} {context.HttpContext.Request.Path}";
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
    });
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// La SPA se sirve sin build previo, así que la compresión la aplica el servidor.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        ["application/json", "image/svg+xml", "application/manifest+json"]);
});

// Demo pública sin autenticación: un límite por IP evita que una instancia gratuita
// se agote por abuso o por un bucle accidental del cliente.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(RateLimitPolicies.Api, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

// Render y cualquier PaaS terminan TLS por delante: sin esto la app vería http y una IP interna.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (allowedOrigins.Length > 0)
{
    builder.Services.AddCors(options => options.AddPolicy(CorsPolicies.Default, policy => policy
        .WithOrigins(allowedOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()));
}

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "NainOrder API",
        Version = "v1",
        Description = "Motor de pedidos con Clean Architecture, DDD táctico y CQRS en el lado de lectura."
    });

    var xmlPath = Path.Combine(AppContext.BaseDirectory, $"{typeof(Program).Assembly.GetName().Name}.xml");
    if (File.Exists(xmlPath)) options.IncludeXmlComments(xmlPath);
});

var app = builder.Build();

await InitializeDatabaseAsync(app);

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseResponseCompression();

// La SPA vive en wwwroot y se sirve desde el mismo origen que la API: sin CORS,
// sin proceso de build y sin dependencias de Node en el despliegue.
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        var headers = context.Context.Response.Headers;
        var isHtml = context.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase);

        // El HTML debe revalidarse siempre; el resto puede cachearse un rato.
        headers.CacheControl = isHtml || app.Environment.IsDevelopment()
            ? "no-cache, no-store, must-revalidate"
            : "public, max-age=3600";
    }
});

if (allowedOrigins.Length > 0) app.UseCors(CorsPolicies.Default);

app.UseRateLimiter();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "NainOrder API v1");
    options.RoutePrefix = "swagger";
    options.DocumentTitle = "NainOrder API";
});

app.MapControllers().RequireRateLimiting(RateLimitPolicies.Api);

app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "NainOrder.Api",
    utc = DateTime.UtcNow
})).ExcludeFromDescription();

// Una ruta bajo /api o /swagger que llega hasta aquí es un endpoint inexistente. Debe
// responder 404 con el mismo contrato de error que el resto de la API: devolverle el
// HTML de la SPA rompería a cualquier cliente que espere JSON.
app.MapFallback("/api/{**path}", (HttpContext context) => ApiEndpointNotFound(context))
   .ExcludeFromDescription();

app.MapFallback("/swagger/{**path}", (HttpContext context) => ApiEndpointNotFound(context))
   .ExcludeFromDescription();

// El resto de rutas no resueltas pertenecen al enrutado de la SPA.
app.MapFallbackToFile("index.html");

app.Run();

// Respuesta 404 para rutas de API inexistentes, con el mismo formato RFC 7807 que emite
// el manejador global de excepciones.
static IResult ApiEndpointNotFound(HttpContext context) => Results.Problem(
    statusCode: StatusCodes.Status404NotFound,
    title: "Endpoint not found",
    type: "https://httpstatuses.io/404",
    detail: $"No endpoint matches {context.Request.Method} {context.Request.Path}.",
    extensions: new Dictionary<string, object?>
    {
        ["code"] = "endpoint_not_found",
        ["traceId"] = context.TraceIdentifier
    });

// Aplica migraciones y carga los datos de demostración en el arranque: la instancia de
// despliegue usa almacenamiento efímero y debe quedar utilizable sin pasos manuales.
static async Task InitializeDatabaseAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();

    var context = scope.ServiceProvider.GetRequiredService<NainOrderDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        await context.Database.MigrateAsync();
        await DatabaseSeeder.SeedAsync(context);
        logger.LogInformation("Database ready at {ConnectionString}", context.Database.GetConnectionString());
    }
    catch (Exception ex)
    {
        logger.LogCritical(ex, "Database initialization failed. The API cannot serve requests.");
        throw;
    }
}

/// <summary>Nombres de las políticas de limitación de tráfico.</summary>
internal static class RateLimitPolicies
{
    public const string Api = "api";
}

/// <summary>Nombres de las políticas CORS.</summary>
internal static class CorsPolicies
{
    public const string Default = "default";
}

/// <summary>Punto de entrada expuesto para que los tests de integración puedan referenciarlo.</summary>
public partial class Program;
