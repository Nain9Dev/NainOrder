using NainOrder.Domain.Enums;
using NainOrder.Domain.Primitives;

namespace NainOrder.Domain.Entities;

/// <summary>
/// A short reservation of drop units for one buyer. It only changes through its
/// <see cref="Drop"/>, which is the authority on the drop's unit count.
/// </summary>
public class Hold : Entity<Guid>
{
    public Guid DropId { get; private set; }
    public string BuyerToken { get; private set; } = null!;
    public int Quantity { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public HoldState State { get; private set; }

    /// <summary>The paid order a confirmed hold became.</summary>
    public Guid? OrderId { get; private set; }

    private Hold() { }

    internal Hold(Guid dropId, string buyerToken, int quantity, DateTime now, int holdSeconds)
        : base(Guid.NewGuid())
    {
        DropId = dropId;
        BuyerToken = buyerToken;
        Quantity = quantity;
        CreatedAt = now;
        ExpiresAt = now.AddSeconds(holdSeconds);
        State = HoldState.Active;
    }

    /// <summary>True while the hold still reserves units at <paramref name="now"/>.</summary>
    internal bool IsLiveAt(DateTime now) => State == HoldState.Active && ExpiresAt > now;

    internal void Confirm(Guid orderId)
    {
        State = HoldState.Confirmed;
        OrderId = orderId;
    }

    internal void Expire() => State = HoldState.Expired;
}
