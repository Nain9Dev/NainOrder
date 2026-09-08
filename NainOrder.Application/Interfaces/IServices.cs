using NainOrder.Application.Common;
using NainOrder.Application.DTOs;

namespace NainOrder.Application.Interfaces;

public interface IOrderService
{
    Task<OrderDto> CreateOrderAsync(CreateOrderRequest request, CancellationToken cancellationToken = default);
    Task<OrderDto> GetOrderAsync(Guid orderId, CancellationToken cancellationToken = default);
    Task<PagedResult<OrderSummaryDto>> ListOrdersAsync(OrderQuery query, PageRequest page, CancellationToken cancellationToken = default);

    Task<OrderDto> AddItemToOrderAsync(Guid orderId, AddOrderItemRequest request, CancellationToken cancellationToken = default);
    Task<OrderDto> ChangeItemQuantityAsync(Guid orderId, Guid productId, ChangeOrderItemQuantityRequest request, CancellationToken cancellationToken = default);
    Task<OrderDto> RemoveItemFromOrderAsync(Guid orderId, Guid productId, CancellationToken cancellationToken = default);

    Task<OrderDto> PayOrderAsync(Guid orderId, CancellationToken cancellationToken = default);
    Task<OrderDto> ProcessOrderAsync(Guid orderId, CancellationToken cancellationToken = default);
    Task<OrderDto> ShipOrderAsync(Guid orderId, CancellationToken cancellationToken = default);
    Task<OrderDto> CancelOrderAsync(Guid orderId, CancellationToken cancellationToken = default);
}

public interface IProductService
{
    Task<ProductDto> CreateProductAsync(CreateProductRequest request, CancellationToken cancellationToken = default);
    Task<ProductDto> GetProductAsync(Guid productId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProductDto>> GetAllProductsAsync(string? search = null, string? category = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<string>> GetCategoriesAsync(CancellationToken cancellationToken = default);
    Task<ProductDto> UpdateProductAsync(Guid productId, UpdateProductRequest request, CancellationToken cancellationToken = default);
    Task<ProductDto> AdjustStockAsync(Guid productId, AdjustStockRequest request, CancellationToken cancellationToken = default);
}

public interface ICustomerService
{
    Task<CustomerDto> CreateCustomerAsync(CreateCustomerRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CustomerDto>> GetAllCustomersAsync(CancellationToken cancellationToken = default);
}

public interface IDashboardService
{
    Task<DashboardStatsDto> GetStatsAsync(CancellationToken cancellationToken = default);
}
