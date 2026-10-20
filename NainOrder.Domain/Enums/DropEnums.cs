namespace NainOrder.Domain.Enums;

/// <summary>Where a drop stands on the clock and its counters. Derived, never stored.</summary>
public enum DropStatus
{
    Scheduled = 1,
    Live = 2,
    SoldOut = 3
}

public enum HoldState
{
    Active = 1,
    Confirmed = 2,
    Expired = 3
}
