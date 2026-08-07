using NainOrder.Application.DTOs;

namespace NainOrder.Application.Interfaces;

public interface IOrderService
{
    Task<OrderDto> CreateOrderAsync(CreateOrderRequest request);
    Task<OrderDto> AddItemToOrderAsync(Guid orderId, AddOrderItemRequest request);
    Task<OrderDto> GetOrderAsync(Guid orderId);
    Task PayOrderAsync(Guid orderId);
}
