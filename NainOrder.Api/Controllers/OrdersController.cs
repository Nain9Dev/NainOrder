using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;

namespace NainOrder.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    public OrdersController(IOrderService orderService)
    {
        _orderService = orderService;
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(Guid id)
    {
        try
        {
            var order = await _orderService.GetOrderAsync(id);
            return Ok(order);
        }
        catch (Exception ex)
        {
            return NotFound(new { Error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        try
        {
            var order = await _orderService.CreateOrderAsync(request);
            return Ok(order);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/items")]
    public async Task<IActionResult> AddItem(Guid id, [FromBody] AddOrderItemRequest request)
    {
        try
        {
            var order = await _orderService.AddItemToOrderAsync(id, request);
            return Ok(order);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/pay")]
    public async Task<IActionResult> PayOrder(Guid id)
    {
        try
        {
            await _orderService.PayOrderAsync(id);
            return Ok(new { Message = "Order paid successfully." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }
}
