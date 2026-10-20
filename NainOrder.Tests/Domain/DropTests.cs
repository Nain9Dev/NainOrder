using FsCheck.Xunit;
using NainOrder.Domain.Entities;
using NainOrder.Domain.Enums;
using NainOrder.Domain.Exceptions;

namespace NainOrder.Tests.Domain;

/// <summary>
/// REQ-080 to REQ-086 and REQ-088 on the aggregate alone, with an explicit clock so expiry
/// is tested without sleeping.
/// </summary>
public class DropTests
{
    private static readonly DateTime Opens = new(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc);
    private static DateTime At(int seconds) => Opens.AddSeconds(seconds);

    private static Drop NewDrop(int units = 10, int perBuyer = 2, int holdSeconds = 60, DateTime? opensAt = null) =>
        new(Guid.NewGuid(), "Last-unit sneaker", "NO-DROP-001", 129.90m, units, opensAt ?? Opens, perBuyer, holdSeconds);

    [Fact]
    public void A_drop_is_scheduled_until_it_opens_and_live_afterwards()
    {
        var drop = NewDrop();

        Assert.Equal(DropStatus.Scheduled, drop.StatusAt(Opens.AddSeconds(-1)));
        Assert.Equal(DropStatus.Live, drop.StatusAt(Opens));
    }

    [Fact]
    public void Taking_from_a_drop_that_is_not_live_is_rejected()
    {
        var drop = NewDrop();

        var error = Assert.Throws<DropNotLiveException>(() => drop.Take("buyer-a", 1, At(-5)));

        Assert.Equal("drop_not_live", error.Code);
        Assert.Equal(10, drop.AvailableAt(At(-5)));
    }

    [Fact]
    public void Taking_units_creates_a_hold_that_reduces_availability()
    {
        var drop = NewDrop();

        var hold = drop.Take("buyer-a", 2, At(1));

        Assert.Equal(HoldState.Active, hold.State);
        Assert.Equal(2, hold.Quantity);
        Assert.Equal(At(1).AddSeconds(60), hold.ExpiresAt);
        Assert.Equal(8, drop.AvailableAt(At(2)));
        Assert.Equal(2, drop.HeldAt(At(2)));
    }

    [Fact]
    public void A_buyer_cannot_exceed_the_per_buyer_limit_across_holds()
    {
        var drop = NewDrop(perBuyer: 2);
        drop.Take("buyer-a", 1, At(1));

        var error = Assert.Throws<BuyerLimitReachedException>(() => drop.Take("buyer-a", 2, At(2)));

        Assert.Equal("buyer_limit_reached", error.Code);
        Assert.Equal(9, drop.AvailableAt(At(2)));
    }

    [Fact]
    public void Asking_for_more_than_is_available_is_rejected_and_leaves_the_drop_untouched()
    {
        var drop = NewDrop(units: 3, perBuyer: 3);
        drop.Take("buyer-a", 2, At(1));

        var error = Assert.Throws<InsufficientStockException>(() => drop.Take("buyer-b", 2, At(2)));

        Assert.Equal(1, error.Available);
        Assert.Equal(1, drop.AvailableAt(At(2)));
    }

    [Fact]
    public void An_unconfirmed_hold_returns_its_units_when_its_window_ends()
    {
        var drop = NewDrop(units: 3, perBuyer: 3, holdSeconds: 60);
        drop.Take("buyer-a", 3, At(0));
        Assert.Equal(DropStatus.SoldOut, drop.StatusAt(At(30)));

        // Lazy correctness: the units are free by the clock even before anything sweeps the hold.
        Assert.Equal(3, drop.AvailableAt(At(61)));
        Assert.Equal(DropStatus.Live, drop.StatusAt(At(61)));
    }

    [Fact]
    public void Sweeping_marks_expired_holds_and_reports_how_many()
    {
        var drop = NewDrop(units: 5, perBuyer: 5, holdSeconds: 60);
        var hold = drop.Take("buyer-a", 2, At(0));
        drop.Take("buyer-b", 1, At(50));

        var swept = drop.ExpireHolds(At(70));

        Assert.Equal(1, swept);
        Assert.Equal(HoldState.Expired, hold.State);
        Assert.Equal(4, drop.AvailableAt(At(70)));
    }

    [Fact]
    public void Confirming_a_hold_in_time_sells_the_units_for_good()
    {
        var drop = NewDrop(units: 5, perBuyer: 5);
        var hold = drop.Take("buyer-a", 2, At(0));
        var orderId = Guid.NewGuid();

        drop.Confirm(hold.Id, "buyer-a", At(10), orderId);

        Assert.Equal(HoldState.Confirmed, hold.State);
        Assert.Equal(orderId, hold.OrderId);
        Assert.Equal(2, drop.SoldUnits);
        // A confirmed hold never expires.
        Assert.Equal(3, drop.AvailableAt(At(10_000)));
    }

    [Fact]
    public void Confirming_after_the_window_is_rejected()
    {
        var drop = NewDrop();
        var hold = drop.Take("buyer-a", 1, At(0));

        var error = Assert.Throws<HoldExpiredException>(() => drop.Confirm(hold.Id, "buyer-a", At(61), Guid.NewGuid()));

        Assert.Equal("hold_expired", error.Code);
        Assert.Equal(0, drop.SoldUnits);
    }

    [Fact]
    public void Only_the_owner_can_confirm_a_hold()
    {
        var drop = NewDrop();
        var hold = drop.Take("buyer-a", 1, At(0));

        Assert.Throws<HoldNotFoundException>(() => drop.Confirm(hold.Id, "buyer-b", At(5), Guid.NewGuid()));
    }

    [Fact]
    public void A_hold_cannot_be_confirmed_twice()
    {
        var drop = NewDrop();
        var hold = drop.Take("buyer-a", 1, At(0));
        drop.Confirm(hold.Id, "buyer-a", At(5), Guid.NewGuid());

        var error = Assert.Throws<HoldNotActiveException>(() => drop.Confirm(hold.Id, "buyer-a", At(6), Guid.NewGuid()));

        Assert.Equal("hold_not_active", error.Code);
        Assert.Equal(1, drop.SoldUnits);
    }

    [Fact]
    public void Expired_units_do_not_count_against_the_buyer_limit()
    {
        var drop = NewDrop(perBuyer: 1, holdSeconds: 60);
        drop.Take("buyer-a", 1, At(0));

        var second = drop.Take("buyer-a", 1, At(61));

        Assert.Equal(HoldState.Active, second.State);
    }

    [Fact]
    public void A_drop_rejects_invalid_configuration()
    {
        Assert.Throws<InvalidDomainDataException>(() => NewDrop(units: 0));
        Assert.Throws<InvalidDomainDataException>(() => NewDrop(units: 5, perBuyer: 6));
        Assert.Throws<InvalidDomainDataException>(() => NewDrop(perBuyer: 0));
        Assert.Throws<InvalidDomainDataException>(() => NewDrop(holdSeconds: 1));
    }

    [Fact]
    public void Every_mutation_moves_the_concurrency_token_forward()
    {
        var drop = NewDrop();
        var version = drop.Version;

        var hold = drop.Take("buyer-a", 1, At(0));
        Assert.True(drop.Version > version);

        version = drop.Version;
        drop.Confirm(hold.Id, "buyer-a", At(1), Guid.NewGuid());
        Assert.True(drop.Version > version);
    }

    /// <summary>REQ-085: whatever the sequence, held plus sold never exceeds the units of the drop.</summary>
    [Property]
    public void Held_plus_sold_never_exceeds_the_units_of_the_drop(int[] seeds)
    {
        var drop = NewDrop(units: 20, perBuyer: 4, holdSeconds: 30);
        var holds = new List<(Hold Hold, string Buyer)>();
        var clock = 0;

        foreach (var seed in seeds.Take(60))
        {
            var step = Math.Abs(seed % 1000);
            clock += step % 15;
            var now = At(clock);
            var buyer = $"buyer-{step % 7}";

            try
            {
                switch (step % 3)
                {
                    case 0:
                        holds.Add((drop.Take(buyer, step % 4 + 1, now), buyer));
                        break;
                    case 1 when holds.Count > 0:
                        var pick = holds[step % holds.Count];
                        drop.Confirm(pick.Hold.Id, pick.Buyer, now, Guid.NewGuid());
                        break;
                    default:
                        drop.ExpireHolds(now);
                        break;
                }
            }
            catch (DomainException)
            {
                // A rejected operation is correct behaviour; only the invariant is under test.
            }

            Assert.True(drop.HeldAt(now) + drop.SoldUnits <= drop.TotalUnits);
            Assert.True(drop.AvailableAt(now) >= 0);
        }
    }
}
