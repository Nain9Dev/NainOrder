using System.ComponentModel.DataAnnotations;

namespace NainOrder.Application.DTOs;

public record CreateOrderRequest(
    [Required] Guid CustomerId);

public record AddOrderItemRequest(
    [Required] Guid ProductId,
    [Range(1, 10_000)] int Quantity);

public record ChangeOrderItemQuantityRequest(
    [Range(1, 10_000)] int Quantity);

public record OrderItemDto(
    Guid ProductId,
    string ProductName,
    string ProductSku,
    decimal UnitPrice,
    int Quantity,
    decimal TotalPrice);

public record OrderDto(
    Guid Id,
    string Reference,
    Guid CustomerId,
    string? CustomerName,
    string? CustomerEmail,
    string Status,
    decimal TotalAmount,
    int TotalUnits,
    bool IsEditable,
    IReadOnlyList<string> NextStates,
    DateTime CreatedAt,
    DateTime? PaidAt,
    DateTime? ShippedAt,
    DateTime? CancelledAt,
    IReadOnlyList<OrderItemDto> Items);

/// <summary>Proyección ligera para listados: evita traer las líneas de cada pedido.</summary>
public record OrderSummaryDto(
    Guid Id,
    string Reference,
    Guid CustomerId,
    string? CustomerName,
    string Status,
    decimal TotalAmount,
    int TotalUnits,
    int LineCount,
    DateTime CreatedAt);

/// <summary>Filtros del listado de pedidos. Se normalizan en la capa de aplicación.</summary>
public record OrderQuery(string? Status = null, Guid? CustomerId = null, string? Search = null);
