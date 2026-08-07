namespace NainOrder.Application.DTOs;

public record CreateOrderRequest(Guid CustomerId);

public record AddOrderItemRequest(Guid ProductId, int Quantity);

public record OrderItemDto(Guid ProductId, decimal UnitPrice, int Quantity, decimal TotalPrice);

public record OrderDto(Guid Id, Guid CustomerId, string Status, decimal TotalAmount, DateTime CreatedAt, List<OrderItemDto> Items);
