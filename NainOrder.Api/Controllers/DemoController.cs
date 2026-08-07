using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;

namespace NainOrder.Api.Controllers;

/// <summary>
/// 🚀 START HERE: Endpoint de demostración para el portfolio.
/// </summary>
[ApiController]
[Route("api/[controller]")]
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
    /// Simula un flujo de compra completo (DDD + Clean Architecture). ¡Haz clic en Try it out -> Execute!
    /// </summary>
    [HttpPost("SimulateCompletePurchase")]
    public async Task<IActionResult> SimulateCompletePurchase()
    {
        var logs = new List<string>();
        try
        {
            // 1. Crear un producto
            var productRequest = new CreateProductRequest($"SKU-DEMO-{Guid.NewGuid().ToString()[..6]}", "Laptop Pro X", 1500.00m, 10);
            var product = await _productService.CreateProductAsync(productRequest);
            logs.Add($"✅ Producto '{product.Name}' creado con {product.StockQuantity} unidades de stock inicial (ID: {product.Id}).");

            // 2. Crear una orden usando el cliente por defecto
            var customerId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");
            var orderRequest = new CreateOrderRequest(customerId);
            var order = await _orderService.CreateOrderAsync(orderRequest);
            logs.Add($"✅ Pedido creado con estado '{order.Status}' para el cliente ID {customerId}.");

            // 3. Añadir items al pedido (Deduce stock automáticamente en el Dominio)
            var addRequest = new AddOrderItemRequest(product.Id, 2);
            order = await _orderService.AddItemToOrderAsync(order.Id, addRequest);
            logs.Add($"✅ 2 unidades de '{product.Name}' añadidas al pedido. Stock deducido en base de datos. Total pedido: {order.TotalAmount}€.");

            // 4. Pagar el pedido
            await _orderService.PayOrderAsync(order.Id);
            order = await _orderService.GetOrderAsync(order.Id); // Refrescar para ver el estado
            logs.Add($"✅ Pedido pagado con éxito. El nuevo estado es '{order.Status}'.");

            return Ok(new
            {
                Message = "¡Simulación de Clean Architecture completada con éxito!",
                AuditLogs = logs,
                FinalOrderState = order
            });
        }
        catch (Exception ex)
        {
            logs.Add($"❌ Error durante la simulación: {ex.Message}");
            return BadRequest(new { Logs = logs, Error = ex.Message });
        }
    }
}
