namespace NainOrder.Application.DTOs;

public record CreateProductRequest(string Sku, string Name, decimal Price, int InitialStock);

public record ProductDto(Guid Id, string Sku, string Name, decimal Price, int StockQuantity);
