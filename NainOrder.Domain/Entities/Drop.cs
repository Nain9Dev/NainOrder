using NainOrder.Domain.Enums;
using NainOrder.Domain.Exceptions;
using NainOrder.Domain.Primitives;

namespace NainOrder.Domain.Entities;

/// <summary>
/// A limited sale of a fixed number of units. The drop owns its units for as long as it is live
/// ([ADR-0008]): it never borrows <see cref="Product.StockQuantity"/>, so "exactly N units" cannot
/// be disturbed by the catalogue. Time always comes from the caller, which keeps the aggregate
/// deterministic and expiry testable without sleeping.
/// </summary>
public class Drop : AggregateRoot<Guid>
{
    public const int MaxUnits = 1_000;
    public const int MinHoldSeconds = 5;
    public const int MaxHoldSeconds = 3_600;

    public Guid ProductId { get; private set; }
    public string ProductName { get; private set; } = null!;
    public string ProductSku { get; private set; } = null!;
    public decimal UnitPrice { get; private set; }
    public int TotalUnits { get; private set; }
    public DateTime OpensAt { get; private set; }
    public int PerBuyerLimit { get; private set; }
    public int HoldSeconds { get; private set; }
    public DateTime CreatedAt { get; private set; }

    /// <summary>Optimistic concurrency token, bumped on every mutation (same pattern as ADR-0007).</summary>
    public int Version { get; private set; }

    private readonly List<Hold> _holds = new();
    public IReadOnlyCollection<Hold> Holds => _holds.AsReadOnly();

    private Drop() { }

    public Drop(Guid productId, string productName, string productSku, decimal unitPrice,
                int totalUnits, DateTime opensAt, int perBuyerLimit, int holdSeconds)
        : base(Guid.NewGuid())
    {
        if (string.IsNullOrWhiteSpace(productName))
            throw new InvalidDomainDataException(nameof(productName), "Product name is required.");
        if (unitPrice < 0)
            throw new InvalidDomainDataException(nameof(unitPrice), "Price cannot be negative.");
        if (totalUnits is < 1 or > MaxUnits)
            throw new InvalidDomainDataException(nameof(totalUnits), $"A drop holds 1 to {MaxUnits} units.");
        if (perBuyerLimit < 1 || perBuyerLimit > totalUnits)
            throw new InvalidDomainDataException(nameof(perBuyerLimit), "The per-buyer limit must be between 1 and the drop's units.");
        if (holdSeconds is < MinHoldSeconds or > MaxHoldSeconds)
            throw new InvalidDomainDataException(nameof(holdSeconds), $"A hold lasts {MinHoldSeconds} to {MaxHoldSeconds} seconds.");

        ProductId = productId;
        ProductName = productName.Trim();
        ProductSku = productSku.Trim().ToUpperInvariant();
        UnitPrice = decimal.Round(unitPrice, 2, MidpointRounding.AwayFromZero);
        TotalUnits = totalUnits;
        OpensAt = opensAt;
        PerBuyerLimit = perBuyerLimit;
        HoldSeconds = holdSeconds;
        CreatedAt = DateTime.UtcNow;
        Version = 1;
    }

    public int SoldUnits => _holds.Where(h => h.State == HoldState.Confirmed).Sum(h => h.Quantity);

    public int HeldAt(DateTime now) => _holds.Where(h => h.IsLiveAt(now)).Sum(h => h.Quantity);

    /// <summary>
    /// Units still on offer. An unswept hold whose window has passed does not count, so
    /// correctness never depends on a background job having run (REQ-083).
    /// </summary>
    public int AvailableAt(DateTime now) => TotalUnits - SoldUnits - HeldAt(now);

    public DropStatus StatusAt(DateTime now) =>
        now < OpensAt ? DropStatus.Scheduled
        : AvailableAt(now) == 0 ? DropStatus.SoldOut
        : DropStatus.Live;

    /// <summary>Reserves units for a buyer (REQ-081, REQ-082, REQ-088).</summary>
    public Hold Take(string buyerToken, int quantity, DateTime now)
    {
        if (string.IsNullOrWhiteSpace(buyerToken))
            throw new InvalidDomainDataException(nameof(buyerToken), "A buyer token is required.");
        if (quantity < 1)
            throw new InvalidDomainDataException(nameof(quantity), "Must take a positive quantity.");
        if (now < OpensAt)
            throw new DropNotLiveException(OpensAt);

        var owned = _holds
            .Where(h => h.BuyerToken == buyerToken && (h.IsLiveAt(now) || h.State == HoldState.Confirmed))
            .Sum(h => h.Quantity);
        if (owned + quantity > PerBuyerLimit)
            throw new BuyerLimitReachedException(PerBuyerLimit, owned);

        var available = AvailableAt(now);
        if (quantity > available)
            throw new InsufficientStockException(quantity, available);

        var hold = new Hold(Id, buyerToken, quantity, now, HoldSeconds);
        _holds.Add(hold);
        Version++;
        return hold;
    }

    /// <summary>Turns an unexpired hold into a sale (REQ-084).</summary>
    public Hold Confirm(Guid holdId, string buyerToken, DateTime now, Guid orderId)
    {
        // A hold that belongs to someone else is indistinguishable from one that does not exist.
        var hold = _holds.FirstOrDefault(h => h.Id == holdId && h.BuyerToken == buyerToken)
                   ?? throw new HoldNotFoundException(holdId);

        if (hold.State == HoldState.Confirmed)
            throw new HoldNotActiveException(holdId);
        if (hold.State == HoldState.Expired || hold.ExpiresAt <= now)
            throw new HoldExpiredException(holdId);

        hold.Confirm(orderId);
        Version++;
        return hold;
    }

    /// <summary>Marks holds whose window has ended as expired and reports how many (REQ-083).</summary>
    public int ExpireHolds(DateTime now)
    {
        var due = _holds.Where(h => h.State == HoldState.Active && h.ExpiresAt <= now).ToList();
        foreach (var hold in due) hold.Expire();

        if (due.Count > 0) Version++;
        return due.Count;
    }
}
