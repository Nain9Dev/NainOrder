using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.DTOs;
using NainOrder.Application.Exceptions;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Exceptions;
using NainOrder.Infrastructure.Persistence.Seeding;

namespace NainOrder.Api.Controllers;

/// <summary>Escenario guiado que recorre el flujo completo de compra en una sola llamada.</summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class DemoController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly IOrderService _orderService;
    private readonly IServiceScopeFactory _scopeFactory;

    public DemoController(
        IProductService productService, IOrderService orderService, IServiceScopeFactory scopeFactory)
    {
        _productService = productService;
        _orderService = orderService;
        _scopeFactory = scopeFactory;
    }

    /// <summary>
    /// Ejecuta alta de producto, apertura de pedido, reserva de stock, cobro, preparación
    /// y envío, devolviendo la traza paso a paso con el tiempo empleado en cada uno.
    /// </summary>
    [HttpPost("simulate-purchase")]
    [ProducesResponseType<SimulationResultDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SimulationResultDto>> SimulateCompletePurchase(CancellationToken cancellationToken)
    {
        var steps = new List<SimulationStepDto>();
        var stopwatch = Stopwatch.StartNew();

        var suffix = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

        var product = await TrackAsync(steps, "Products.Create", "Domain valida SKU, precio y stock inicial",
            () => _productService.CreateProductAsync(
                new CreateProductRequest($"NO-DEMO-{suffix}", "Estación de trabajo Demo", 1499.00m, 10,
                                         "Demo", "Producto generado por el escenario guiado."),
                cancellationToken));

        var order = await TrackAsync(steps, "Orders.Create", "Order nace en PendingPayment con referencia legible",
            () => _orderService.CreateOrderAsync(
                new CreateOrderRequest(DatabaseSeeder.DemoCustomerId), cancellationToken));

        order = await TrackAsync(steps, "Orders.AddItem", "El agregado congela el precio y Product descuenta stock",
            () => _orderService.AddItemToOrderAsync(
                order.Id, new AddOrderItemRequest(product.Id, 2), cancellationToken));

        order = await TrackAsync(steps, "Orders.Pay", "Transición PendingPayment -> Paid validada por el dominio",
            () => _orderService.PayOrderAsync(order.Id, cancellationToken));

        order = await TrackAsync(steps, "Orders.Process", "Transición Paid -> Processing",
            () => _orderService.ProcessOrderAsync(order.Id, cancellationToken));

        order = await TrackAsync(steps, "Orders.Ship", "Transición Processing -> Shipped, estado final",
            () => _orderService.ShipOrderAsync(order.Id, cancellationToken));

        var refreshedProduct = await _productService.GetProductAsync(product.Id, cancellationToken);
        stopwatch.Stop();

        return Ok(new SimulationResultDto(
            "Flujo completo ejecutado sobre el dominio real, sin atajos ni datos simulados.",
            stopwatch.ElapsedMilliseconds,
            steps,
            order,
            refreshedProduct));
    }

    /// <summary>
    /// Runs the "a unit can never be sold twice" claim on demand: <c>buyers</c> independent buyers
    /// race for <c>units</c> in stock, each in its own order, scope and transaction, released at the
    /// same instant. The verdict is computed from the persisted product, not from the answers.
    /// </summary>
    [HttpPost("stock-race")]
    [ProducesResponseType<StockRaceResultDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<StockRaceResultDto>> RunStockRace(
        StockRaceRequest request, CancellationToken cancellationToken)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

        var product = await _productService.CreateProductAsync(
            new CreateProductRequest($"NO-RACE-{suffix}", "Last-unit sneaker", 129.90m, request.Units,
                                     "Demo", "Throwaway product created by the stock race."),
            cancellationToken);

        var orderIds = new List<Guid>(request.Buyers);
        for (var i = 0; i < request.Buyers; i++)
        {
            var order = await _orderService.CreateOrderAsync(
                new CreateOrderRequest(DatabaseSeeder.DemoCustomerId), cancellationToken);
            orderIds.Add(order.Id);
        }

        var startGun = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var stopwatch = Stopwatch.StartNew();

        var attempts = orderIds
            .Select((orderId, index) => Task.Run(
                () => BuyAsync(index + 1, orderId, product.Id, startGun.Task, cancellationToken),
                cancellationToken))
            .ToList();

        startGun.SetResult();
        var results = await Task.WhenAll(attempts);
        stopwatch.Stop();

        // Read through a fresh scope: this request's DbContext still tracks the product as created,
        // so it would answer with a stale copy instead of what the buyers actually persisted.
        using var verdictScope = _scopeFactory.CreateScope();
        var remaining = (await verdictScope.ServiceProvider.GetRequiredService<IProductService>()
            .GetProductAsync(product.Id, cancellationToken)).StockQuantity;
        var sold = results.Count(r => r.Outcome == "won");

        return Ok(new StockRaceResultDto(
            product.Name,
            request.Units,
            request.Buyers,
            sold,
            request.Buyers - sold,
            remaining,
            Balanced: sold <= request.Units && remaining >= 0 && sold + remaining == request.Units,
            stopwatch.ElapsedMilliseconds,
            results.OrderBy(r => r.Buyer).ToList()));
    }

    private async Task<StockRaceBuyerDto> BuyAsync(
        int buyer, Guid orderId, Guid productId, Task startGun, CancellationToken cancellationToken)
    {
        await startGun;

        // A concurrency conflict means another buyer's write landed first, not that the stock ran
        // out, so a well-behaved client retries. Every conflict is caused by a distinct successful
        // reservation and at most 32 units exist, hence 40 attempts always reach a final answer.
        const int maxAttempts = 40;
        var code = "concurrency_conflict";

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            // A fresh scope per attempt gives each its own DbContext and transaction, like separate requests.
            using var scope = _scopeFactory.CreateScope();
            var orders = scope.ServiceProvider.GetRequiredService<IOrderService>();

            try
            {
                await orders.AddItemToOrderAsync(orderId, new AddOrderItemRequest(productId, 1), cancellationToken);
                return new StockRaceBuyerDto(buyer, "won", null, attempt);
            }
            catch (AppException e)
            {
                code = e.Code;
            }
            catch (DomainException e)
            {
                code = e.Code;
            }

            if (code != "concurrency_conflict") return new StockRaceBuyerDto(buyer, "rejected", code, attempt);
        }

        return new StockRaceBuyerDto(buyer, "rejected", code, maxAttempts);
    }

    private static async Task<T> TrackAsync<T>(
        List<SimulationStepDto> steps, string operation, string explanation, Func<Task<T>> action)
    {
        var stepWatch = Stopwatch.StartNew();
        var result = await action();
        stepWatch.Stop();

        steps.Add(new SimulationStepDto(steps.Count + 1, operation, explanation, stepWatch.ElapsedMilliseconds));
        return result;
    }
}

/// <summary>Parameters of a stock race: how many buyers compete for how many units.</summary>
public record StockRaceRequest(
    [Range(2, 64)] int Buyers,
    [Range(1, 32)] int Units);

/// <summary>
/// Outcome of one buyer: <c>won</c> a unit, or was <c>rejected</c> with a stable error code.
/// <c>Attempts</c> counts tries; more than one means the buyer lost a race and retried.
/// </summary>
public record StockRaceBuyerDto(int Buyer, string Outcome, string? Code, int Attempts);

/// <summary>Verdict of a stock race. <c>Balanced</c> is computed from the persisted product.</summary>
public record StockRaceResultDto(
    string Product,
    int Units,
    int Buyers,
    int Sold,
    int Rejected,
    int Remaining,
    bool Balanced,
    long ElapsedMilliseconds,
    IReadOnlyList<StockRaceBuyerDto> Results);

/// <summary>Resultado del escenario guiado.</summary>
public record SimulationResultDto(
    string Message,
    long ElapsedMilliseconds,
    IReadOnlyList<SimulationStepDto> Steps,
    OrderDto FinalOrder,
    ProductDto FinalProduct);

/// <summary>Paso individual del escenario, con la regla de negocio que ejercita.</summary>
public record SimulationStepDto(int Order, string Operation, string Explanation, long ElapsedMilliseconds);
