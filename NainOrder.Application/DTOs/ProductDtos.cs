using System.ComponentModel.DataAnnotations;

namespace NainOrder.Application.DTOs;

public record CreateProductRequest(
    [Required, StringLength(50, MinimumLength = 2)] string Sku,
    [Required, StringLength(200, MinimumLength = 2)] string Name,
    [Range(typeof(decimal), "0", "1000000")] decimal Price,
    [Range(0, 1_000_000)] int InitialStock,
    [StringLength(60)] string? Category = null,
    [StringLength(500)] string? Description = null);

public record UpdateProductRequest(
    [Required, StringLength(200, MinimumLength = 2)] string Name,
    [Range(typeof(decimal), "0", "1000000")] decimal Price,
    [StringLength(60)] string? Category = null,
    [StringLength(500)] string? Description = null);

public record AdjustStockRequest(
    [Range(-1_000_000, 1_000_000)] int Delta);

/// <summary>Umbral por debajo del cual el catálogo marca un producto como stock bajo.</summary>
public static class StockLevels
{
    public const int LowStockThreshold = 5;

    public static string Classify(int quantity) => quantity switch
    {
        <= 0 => "out_of_stock",
        <= LowStockThreshold => "low_stock",
        _ => "in_stock"
    };
}

public record ProductDto(
    Guid Id,
    string Sku,
    string Name,
    string Category,
    string Description,
    decimal Price,
    int StockQuantity,
    string StockStatus);
