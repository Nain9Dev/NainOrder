using System.ComponentModel.DataAnnotations;

namespace NainOrder.Application.DTOs;

/// <summary>
/// Creates a drop from a catalogue product. <c>OpensInSeconds</c> is relative so the client's
/// clock never decides when a drop opens.
/// </summary>
public record CreateDropRequest(
    [Required] Guid ProductId,
    [Range(1, 1_000)] int TotalUnits,
    [Range(1, 1_000)] int PerBuyerLimit,
    [Range(5, 3_600)] int HoldSeconds,
    [Range(0, 604_800)] int OpensInSeconds = 0);

public record TakeUnitsRequest([Range(1, 1_000)] int Quantity);

public record HoldDto(Guid Id, int Quantity, DateTime ExpiresAt, string State, Guid? OrderId);

/// <summary>
/// Live state of a drop. Every figure is computed by the server at <c>ServerTime</c>; the panel
/// draws it and derives nothing.
/// </summary>
public record DropDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string ProductSku,
    decimal UnitPrice,
    int TotalUnits,
    int Available,
    int Held,
    int Sold,
    string Status,
    DateTime OpensAt,
    int PerBuyerLimit,
    int HoldSeconds,
    DateTime ServerTime,
    IReadOnlyList<HoldDto> MyHolds);
