using NainOrder.Application.Common;
using NainOrder.Application.DTOs;
using NainOrder.Application.Exceptions;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Application.Services;

/// <summary>
/// Orchestrates drops. Every rule lives in <see cref="Drop"/>; this class loads the aggregate,
/// supplies the clock, owns the transaction and projects to DTOs.
/// </summary>
public sealed class DropService : IDropService
{
    private readonly IDropRepository _drops;
    private readonly IProductRepository _products;
    private readonly IOrderRepository _orders;
    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _clock;

    public DropService(
        IDropRepository drops, IProductRepository products, IOrderRepository orders,
        IUnitOfWork unitOfWork, TimeProvider clock)
    {
        _drops = drops;
        _products = products;
        _orders = orders;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;

    public async Task<DropDto> CreateAsync(CreateDropRequest request, CancellationToken cancellationToken = default)
    {
        var product = await _products.GetByIdAsync(request.ProductId, cancellationToken)
                      ?? throw new NotFoundException("Product", request.ProductId);

        var drop = new Drop(
            product.Id, product.Name, product.Sku, product.Price,
            request.TotalUnits, Now.AddSeconds(request.OpensInSeconds), request.PerBuyerLimit, request.HoldSeconds);

        await _drops.AddAsync(drop, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return MapToDto(drop, null);
    }

    public async Task<DropDto> GetAsync(Guid dropId, string? buyerToken, CancellationToken cancellationToken = default) =>
        MapToDto(await LoadAsync(dropId, cancellationToken), buyerToken);

    public async Task<IReadOnlyList<DropDto>> ListAsync(CancellationToken cancellationToken = default) =>
        (await _drops.GetRecentAsync(20, cancellationToken)).Select(d => MapToDto(d, null)).ToList();

    public async Task<HoldDto> TakeAsync(
        Guid dropId, string buyerToken, TakeUnitsRequest request, CancellationToken cancellationToken = default)
    {
        var drop = await LoadAsync(dropId, cancellationToken);

        return await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            var hold = drop.Take(buyerToken, request.Quantity, Now);
            await _unitOfWork.SaveChangesAsync(ct);
            return MapHold(hold);
        }, cancellationToken);
    }

    public async Task<OrderDto> ConfirmAsync(
        Guid dropId, Guid holdId, string buyerToken, CancellationToken cancellationToken = default)
    {
        var drop = await LoadAsync(dropId, cancellationToken);

        return await _unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            var hold = drop.Holds.FirstOrDefault(h => h.Id == holdId && h.BuyerToken == buyerToken);

            // The order is built first so the hold can record it; nothing is persisted unless
            // Confirm accepts, because the whole transaction rolls back on a rejection.
            var order = new Order(DropDefaults.AnonymousBuyerId);
            order.AddItem(drop.ProductId, drop.ProductName, drop.ProductSku, drop.UnitPrice, hold?.Quantity ?? 1);
            order.MarkAsPaid();

            drop.Confirm(holdId, buyerToken, Now, order.Id);

            await _orders.AddAsync(order, ct);
            await _unitOfWork.SaveChangesAsync(ct);
            return MapOrder(order);
        }, cancellationToken);
    }

    public async Task<int> ExpireDueHoldsAsync(CancellationToken cancellationToken = default)
    {
        var now = Now;
        var due = await _drops.GetWithDueHoldsAsync(now, cancellationToken);
        if (due.Count == 0) return 0;

        var expired = due.Sum(d => d.ExpireHolds(now));
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return expired;
    }

    private async Task<Drop> LoadAsync(Guid dropId, CancellationToken cancellationToken) =>
        await _drops.GetByIdAsync(dropId, cancellationToken) ?? throw new NotFoundException("Drop", dropId);

    private DropDto MapToDto(Drop drop, string? buyerToken)
    {
        var now = Now;
        var mine = buyerToken is null
            ? []
            : drop.Holds.Where(h => h.BuyerToken == buyerToken).OrderBy(h => h.CreatedAt).Select(MapHold).ToList();

        return new DropDto(
            drop.Id, drop.ProductId, drop.ProductName, drop.ProductSku, drop.UnitPrice,
            drop.TotalUnits, drop.AvailableAt(now), drop.HeldAt(now), drop.SoldUnits,
            drop.StatusAt(now).ToString(), drop.OpensAt, drop.PerBuyerLimit, drop.HoldSeconds, now,
            drop.NextHoldExpiryAt(now), mine);
    }

    private static HoldDto MapHold(Hold hold) =>
        new(hold.Id, hold.Quantity, hold.ExpiresAt, hold.State.ToString(), hold.OrderId);

    private static OrderDto MapOrder(Order order) => new(
        order.Id, order.Reference, order.CustomerId, null, null, order.Status.ToString(),
        order.TotalAmount, order.TotalUnits, order.IsEditable,
        order.NextStates.Select(s => s.ToString()).ToList(),
        order.CreatedAt, order.PaidAt, order.ShippedAt, order.CancelledAt,
        order.Items.Select(i => new OrderItemDto(i.ProductId, i.ProductName, i.ProductSku, i.UnitPrice, i.Quantity, i.TotalPrice)).ToList());
}
