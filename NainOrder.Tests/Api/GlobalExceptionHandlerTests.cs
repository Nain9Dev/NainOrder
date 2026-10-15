using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using NainOrder.Api.Infrastructure;
using NainOrder.Domain.Exceptions;

namespace NainOrder.Tests.Api;

public class GlobalExceptionHandlerTests
{
    private class FakeHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;
        public string ApplicationName { get; set; } = "NainOrder.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private class CaptureProblemDetailsService : IProblemDetailsService
    {
        public ProblemDetailsContext? LastContext { get; private set; }

        public ValueTask<bool> TryWriteAsync(ProblemDetailsContext context)
        {
            LastContext = context;
            return ValueTask.FromResult(true);
        }

        public ValueTask WriteAsync(ProblemDetailsContext context)
        {
            LastContext = context;
            return ValueTask.CompletedTask;
        }
    }

    [Fact]
    public async Task Unexpected_exception_in_production_is_sanitized_to_generic_500()
    {
        var capture = new CaptureProblemDetailsService();
        var env = new FakeHostEnvironment { EnvironmentName = Environments.Production };
        var handler = new GlobalExceptionHandler(capture, env, NullLogger<GlobalExceptionHandler>.Instance);

        var httpContext = new DefaultHttpContext();
        var secretException = new InvalidOperationException("Sensitive internal database connection failure");

        var handled = await handler.TryHandleAsync(httpContext, secretException, CancellationToken.None);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status500InternalServerError, httpContext.Response.StatusCode);
        Assert.NotNull(capture.LastContext);

        var details = capture.LastContext.ProblemDetails;
        Assert.Equal(StatusCodes.Status500InternalServerError, details.Status);
        Assert.Equal("internal_error", details.Extensions["code"]);
        Assert.Equal("An unexpected error occurred. The incident has been logged.", details.Detail);
        Assert.DoesNotContain("Sensitive internal", details.Detail);
    }

    [Fact]
    public async Task Business_exception_maps_to_4xx_with_machine_readable_context()
    {
        var capture = new CaptureProblemDetailsService();
        var env = new FakeHostEnvironment { EnvironmentName = Environments.Production };
        var handler = new GlobalExceptionHandler(capture, env, NullLogger<GlobalExceptionHandler>.Instance);

        var httpContext = new DefaultHttpContext();
        var stockException = new InsufficientStockException(10, 3);

        var handled = await handler.TryHandleAsync(httpContext, stockException, CancellationToken.None);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status409Conflict, httpContext.Response.StatusCode);
        Assert.NotNull(capture.LastContext);

        var details = capture.LastContext.ProblemDetails;
        Assert.Equal(StatusCodes.Status409Conflict, details.Status);
        Assert.Equal("insufficient_stock", details.Extensions["code"]);
        Assert.Equal(10, details.Extensions["requested"]);
        Assert.Equal(3, details.Extensions["available"]);
    }
}
