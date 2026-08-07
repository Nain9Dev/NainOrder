using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Application.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IProductRepository _productRepository;

    public OrderService(IOrderRepository orderRepository, IProductRepository productRepository)
    {
        _orderRepository = orderRepository;
        _productRepository = productRepository;
    }

    public async Task<OrderDto> CreateOrderAsync(CreateOrderRequest request)
    {
        var order = new Order(request.CustomerId);
        
        await _orderRepository.AddAsync(order);
        await _orderRepository.SaveChangesAsync();

        return MapToDto(order);
    }

    public async Task<OrderDto> AddItemToOrderAsync(Guid orderId, AddOrderItemRequest request)
    {
        var order = await _orderRepository.GetByIdAsync(orderId);
        if (order == null) throw new Exception("Order not found.");

        var product = await _productRepository.GetByIdAsync(request.ProductId);
        if (product == null) throw new Exception("Product not found.");

        if (product.StockQuantity < request.Quantity)
            throw new Exception("Insufficient stock.");

        // Deduct stock immediately
        product.RemoveStock(request.Quantity);
        await _productRepository.UpdateAsync(product);

        // Add item to order
        order.AddItem(product.Id, product.Price, request.Quantity);
        
        await _orderRepository.UpdateAsync(order);
        await _orderRepository.SaveChangesAsync();

        return MapToDto(order);
    }

    public async Task<OrderDto> GetOrderAsync(Guid orderId)
    {
        var order = await _orderRepository.GetByIdAsync(orderId);
        if (order == null) throw new Exception("Order not found.");

        return MapToDto(order);
    }

    public async Task PayOrderAsync(Guid orderId)
    {
        var order = await _orderRepository.GetByIdAsync(orderId);
        if (order == null) throw new Exception("Order not found.");

        order.MarkAsPaid();
        await _orderRepository.UpdateAsync(order);
        await _orderRepository.SaveChangesAsync();
    }

    private static OrderDto MapToDto(Order order)
    {
        var items = order.Items.Select(i => 
            new OrderItemDto(i.ProductId, i.UnitPrice, i.Quantity, i.TotalPrice)
        ).ToList();

        return new OrderDto(order.Id, order.CustomerId, order.Status.ToString(), order.TotalAmount, order.CreatedAt, items);
    }
}
