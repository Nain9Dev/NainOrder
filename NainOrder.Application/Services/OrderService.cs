using NainOrder.Application.Common;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;
using NainOrder.Domain.Enums;
using NainOrder.Domain.Exceptions;

namespace NainOrder.Application.Services;

/// <summary>
/// Orquesta el ciclo de vida del pedido. No contiene reglas de negocio propias: delega
/// cada decisión en el agregado <see cref="Order"/> y en <see cref="Product"/>, y se
/// limita a coordinar agregados, transacción y proyección a DTO.
/// </summary>
public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IProductRepository _productRepository;
    private readonly ICustomerRepository _customerRepository;
    private readonly IUnitOfWork _unitOfWork;

    public OrderService(
        IOrderRepository orderRepository,
        IProductRepository productRepository,
        ICustomerRepository customerRepository,
        IUnitOfWork unitOfWork)
    {
        _orderRepository = orderRepository;
        _productRepository = productRepository;
        _customerRepository = customerRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<OrderDto> CreateOrderAsync(CreateOrderRequest request, CancellationToken cancellationToken = default)
    {
        var customer = await _customerRepository.GetByIdAsync(request.CustomerId, cancellationToken)
                       ?? throw new Exceptions.NotFoundException("Customer", request.CustomerId);

        var order = new Order(customer.Id);

        await _orderRepository.AddAsync(order, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return MapToDto(order, customer);
    }

    public async Task<OrderDto> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        var customer = await _customerRepository.GetByIdAsync(order.CustomerId, cancellationToken);

        return MapToDto(order, customer);
    }

    public Task<PagedResult<OrderSummaryDto>> ListOrdersAsync(
        OrderQuery query, PageRequest page, CancellationToken cancellationToken = default) =>
        _orderRepository.GetPagedSummariesAsync(query, page, cancellationToken);

    public async Task<OrderDto> AddItemToOrderAsync(
        Guid orderId, AddOrderItemRequest request, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        var product = await _productRepository.GetByIdAsync(request.ProductId, cancellationToken)
                      ?? throw new Exceptions.NotFoundException("Product", request.ProductId);

        return await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            // La línea se añade antes de tocar el stock: si el producto ya estaba en el
            // pedido, el agregado rechaza la operación sin haber reservado unidades.
            order.AddItem(product.Id, product.Name, product.Sku, product.Price, request.Quantity);
            product.RemoveStock(request.Quantity);

            await _unitOfWork.SaveChangesAsync(ct);
            return await MapWithCustomerAsync(order, ct);
        }, cancellationToken);
    }

    public async Task<OrderDto> ChangeItemQuantityAsync(
        Guid orderId, Guid productId, ChangeOrderItemQuantityRequest request, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        var product = await _productRepository.GetByIdAsync(productId, cancellationToken)
                      ?? throw new Exceptions.NotFoundException("Product", productId);

        var line = order.Items.FirstOrDefault(i => i.ProductId == productId)
                   ?? throw new OrderItemNotFoundException(productId);

        var delta = request.Quantity - line.Quantity;

        // Se comprueba la disponibilidad antes de mutar nada, para que un rechazo por
        // stock no deje el agregado a medio actualizar.
        if (delta > 0 && !product.HasStockFor(delta))
            throw new InsufficientStockException(delta, product.StockQuantity);

        return await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            order.ChangeItemQuantity(productId, request.Quantity);

            if (delta > 0) product.RemoveStock(delta);
            else if (delta < 0) product.AddStock(-delta);

            await _unitOfWork.SaveChangesAsync(ct);
            return await MapWithCustomerAsync(order, ct);
        }, cancellationToken);
    }

    public async Task<OrderDto> RemoveItemFromOrderAsync(
        Guid orderId, Guid productId, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);
        var product = await _productRepository.GetByIdAsync(productId, cancellationToken);

        return await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            var releasedUnits = order.RemoveItem(productId);

            // Si el producto se hubiese borrado del catálogo, el pedido sigue siendo
            // consistente: simplemente no hay dónde reponer las unidades.
            product?.AddStock(releasedUnits);

            await _unitOfWork.SaveChangesAsync(ct);
            return await MapWithCustomerAsync(order, ct);
        }, cancellationToken);
    }

    public Task<OrderDto> PayOrderAsync(Guid orderId, CancellationToken cancellationToken = default) =>
        TransitionAsync(orderId, order => order.MarkAsPaid(), cancellationToken);

    public Task<OrderDto> ProcessOrderAsync(Guid orderId, CancellationToken cancellationToken = default) =>
        TransitionAsync(orderId, order => order.MarkAsProcessing(), cancellationToken);

    public Task<OrderDto> ShipOrderAsync(Guid orderId, CancellationToken cancellationToken = default) =>
        TransitionAsync(orderId, order => order.MarkAsShipped(), cancellationToken);

    /// <summary>
    /// Cancela el pedido y devuelve al catálogo el stock que tenía reservado. Sin esta
    /// reposición, cancelar un pedido perdería inventario de forma permanente.
    /// </summary>
    public async Task<OrderDto> CancelOrderAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);

        var productIds = order.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await _productRepository.GetByIdsAsync(productIds, cancellationToken);

        return await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            foreach (var restoration in order.Cancel())
            {
                if (products.TryGetValue(restoration.ProductId, out var product))
                    product.AddStock(restoration.Quantity);
            }

            await _unitOfWork.SaveChangesAsync(ct);
            return await MapWithCustomerAsync(order, ct);
        }, cancellationToken);
    }

    private async Task<OrderDto> TransitionAsync(Guid orderId, Action<Order> transition, CancellationToken cancellationToken)
    {
        var order = await LoadOrderAsync(orderId, cancellationToken);

        transition(order);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await MapWithCustomerAsync(order, cancellationToken);
    }

    private async Task<Order> LoadOrderAsync(Guid orderId, CancellationToken cancellationToken) =>
        await _orderRepository.GetByIdAsync(orderId, cancellationToken)
        ?? throw new Exceptions.NotFoundException("Order", orderId);

    private async Task<OrderDto> MapWithCustomerAsync(Order order, CancellationToken cancellationToken)
    {
        var customer = await _customerRepository.GetByIdAsync(order.CustomerId, cancellationToken);
        return MapToDto(order, customer);
    }

    private static OrderDto MapToDto(Order order, Customer? customer)
    {
        var items = order.Items
            .Select(i => new OrderItemDto(i.ProductId, i.ProductName, i.ProductSku, i.UnitPrice, i.Quantity, i.TotalPrice))
            .ToList();

        var nextStates = order.NextStates.Select(s => s.ToString()).ToList();

        return new OrderDto(
            order.Id,
            order.Reference,
            order.CustomerId,
            customer?.Name,
            customer?.Email,
            order.Status.ToString(),
            order.TotalAmount,
            order.TotalUnits,
            order.IsEditable,
            nextStates,
            order.CreatedAt,
            order.PaidAt,
            order.ShippedAt,
            order.CancelledAt,
            items);
    }

    /// <summary>Estados válidos publicados por el dominio, para que el cliente no los redefina.</summary>
    public static IReadOnlyList<string> KnownStatuses =>
        Enum.GetValues<OrderStatus>().Select(s => s.ToString()).ToList();
}
