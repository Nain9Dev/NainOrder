using NainOrder.Domain.Exceptions;

namespace NainOrder.Domain.Entities;

/// <summary>
/// Artículo del catálogo. Es la única autoridad sobre su propio stock: nadie fuera de
/// esta clase puede modificar <see cref="StockQuantity"/>, de modo que la invariante
/// "el stock nunca es negativo" no puede violarse desde ninguna capa superior.
/// </summary>
public class Product
{
    public const int MaxSkuLength = 50;
    public const int MaxNameLength = 200;
    public const int MaxCategoryLength = 60;
    public const int MaxDescriptionLength = 500;

    public Guid Id { get; private set; }
    public string Sku { get; private set; } = null!;
    public string Name { get; private set; } = null!;
    public string Category { get; private set; } = DefaultCategory;
    public string Description { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public int StockQuantity { get; private set; }

    /// <summary>
    /// Token de concurrencia optimista. Se incrementa en cada mutación para que dos
    /// peticiones simultáneas no puedan vender la misma unidad de stock dos veces.
    /// </summary>
    public int Version { get; private set; }

    public const string DefaultCategory = "General";

    private Product() { }

    public Product(string sku, string name, decimal price, int initialStock,
                   string? category = null, string? description = null)
    {
        Sku = NormalizeRequired(sku, nameof(sku), MaxSkuLength).ToUpperInvariant();
        Name = NormalizeRequired(name, nameof(name), MaxNameLength);
        Category = NormalizeOptional(category, nameof(category), MaxCategoryLength, DefaultCategory);
        Description = NormalizeOptional(description, nameof(description), MaxDescriptionLength, string.Empty);

        if (price < 0)
            throw new InvalidDomainDataException(nameof(price), "Price cannot be negative.");
        if (initialStock < 0)
            throw new InvalidDomainDataException(nameof(initialStock), "Stock cannot be negative.");

        Id = Guid.NewGuid();
        Price = decimal.Round(price, 2, MidpointRounding.AwayFromZero);
        StockQuantity = initialStock;
        Version = 1;
    }

    public void UpdatePrice(decimal newPrice)
    {
        if (newPrice < 0)
            throw new InvalidDomainDataException(nameof(newPrice), "Price cannot be negative.");

        Price = decimal.Round(newPrice, 2, MidpointRounding.AwayFromZero);
        Version++;
    }

    public void UpdateDetails(string name, string? category, string? description)
    {
        Name = NormalizeRequired(name, nameof(name), MaxNameLength);
        Category = NormalizeOptional(category, nameof(category), MaxCategoryLength, DefaultCategory);
        Description = NormalizeOptional(description, nameof(description), MaxDescriptionLength, string.Empty);
        Version++;
    }

    public void AddStock(int quantity)
    {
        if (quantity <= 0)
            throw new InvalidDomainDataException(nameof(quantity), "Must add a positive quantity.");

        StockQuantity += quantity;
        Version++;
    }

    public void RemoveStock(int quantity)
    {
        if (quantity <= 0)
            throw new InvalidDomainDataException(nameof(quantity), "Must remove a positive quantity.");
        if (StockQuantity - quantity < 0)
            throw new InsufficientStockException(quantity, StockQuantity);

        StockQuantity -= quantity;
        Version++;
    }

    /// <summary>Indica si hay stock suficiente sin provocar la excepción, para consultas previas.</summary>
    public bool HasStockFor(int quantity) => quantity > 0 && StockQuantity >= quantity;

    private static string NormalizeRequired(string value, string parameterName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidDomainDataException(parameterName, $"{parameterName} is required.");

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new InvalidDomainDataException(parameterName, $"{parameterName} cannot exceed {maxLength} characters.");

        return trimmed;
    }

    private static string NormalizeOptional(string? value, string parameterName, int maxLength, string fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new InvalidDomainDataException(parameterName, $"{parameterName} cannot exceed {maxLength} characters.");

        return trimmed;
    }
}
