using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.Common;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;

namespace NainOrder.Api.Controllers;

/// <summary>Ciclo de vida completo del pedido: cesta, cobro, preparación y envío.</summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrdersController(IOrderService orderService) => _orderService = orderService;

    /// <summary>Listado paginado de pedidos con filtros por estado, cliente y referencia.</summary>
    [HttpGet]
    [ProducesResponseType<PagedResult<OrderSummaryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<OrderSummaryDto>>> List(
        [FromQuery] string? status,
        [FromQuery] Guid? customerId,
        [FromQuery] string? search,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken) =>
        Ok(await _orderService.ListOrdersAsync(
            new OrderQuery(status, customerId, search),
            new PageRequest(page, pageSize),
            cancellationToken));

    /// <summary>Obtiene un pedido con todas sus líneas y las transiciones que admite ahora.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDto>> GetById(Guid id, CancellationToken cancellationToken) =>
        Ok(await _orderService.GetOrderAsync(id, cancellationToken));

    /// <summary>Abre un pedido vacío en estado PendingPayment para un cliente existente.</summary>
    [HttpPost]
    [ProducesResponseType<OrderDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrderDto>> Create(
        [FromBody] CreateOrderRequest request, CancellationToken cancellationToken)
    {
        var order = await _orderService.CreateOrderAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }

    /// <summary>Añade una línea al pedido y reserva el stock correspondiente.</summary>
    [HttpPost("{id:guid}/items")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> AddItem(
        Guid id, [FromBody] AddOrderItemRequest request, CancellationToken cancellationToken) =>
        Ok(await _orderService.AddItemToOrderAsync(id, request, cancellationToken));

    /// <summary>Cambia la cantidad de una línea, ajustando el stock por la diferencia exacta.</summary>
    [HttpPut("{id:guid}/items/{productId:guid}")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> ChangeItemQuantity(
        Guid id, Guid productId, [FromBody] ChangeOrderItemQuantityRequest request, CancellationToken cancellationToken) =>
        Ok(await _orderService.ChangeItemQuantityAsync(id, productId, request, cancellationToken));

    /// <summary>Elimina una línea del pedido y devuelve sus unidades al catálogo.</summary>
    [HttpDelete("{id:guid}/items/{productId:guid}")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> RemoveItem(
        Guid id, Guid productId, CancellationToken cancellationToken) =>
        Ok(await _orderService.RemoveItemFromOrderAsync(id, productId, cancellationToken));

    /// <summary>Cobra el pedido. Requiere al menos una línea.</summary>
    [HttpPost("{id:guid}/pay")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> Pay(Guid id, CancellationToken cancellationToken) =>
        Ok(await _orderService.PayOrderAsync(id, cancellationToken));

    /// <summary>Pasa el pedido a preparación en almacén.</summary>
    [HttpPost("{id:guid}/process")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> Process(Guid id, CancellationToken cancellationToken) =>
        Ok(await _orderService.ProcessOrderAsync(id, cancellationToken));

    /// <summary>Marca el pedido como enviado. Es un estado final.</summary>
    [HttpPost("{id:guid}/ship")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> Ship(Guid id, CancellationToken cancellationToken) =>
        Ok(await _orderService.ShipOrderAsync(id, cancellationToken));

    /// <summary>Cancela el pedido y repone en el catálogo todo el stock que tenía reservado.</summary>
    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> Cancel(Guid id, CancellationToken cancellationToken) =>
        Ok(await _orderService.CancelOrderAsync(id, cancellationToken));
}
