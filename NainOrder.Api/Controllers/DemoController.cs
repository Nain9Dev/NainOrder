using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;
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

    public DemoController(IProductService productService, IOrderService orderService)
    {
        _productService = productService;
        _orderService = orderService;
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

    private static async Task<T> TrackAsync<T>(
        ICollection<SimulationStepDto> steps, string operation, string explanation, Func<Task<T>> action)
    {
        var stepWatch = Stopwatch.StartNew();
        var result = await action();
        stepWatch.Stop();

        steps.Add(new SimulationStepDto(steps.Count + 1, operation, explanation, stepWatch.ElapsedMilliseconds));
        return result;
    }
}

/// <summary>Resultado del escenario guiado.</summary>
public record SimulationResultDto(
    string Message,
    long ElapsedMilliseconds,
    IReadOnlyList<SimulationStepDto> Steps,
    OrderDto FinalOrder,
    ProductDto FinalProduct);

/// <summary>Paso individual del escenario, con la regla de negocio que ejercita.</summary>
public record SimulationStepDto(int Order, string Operation, string Explanation, long ElapsedMilliseconds);
