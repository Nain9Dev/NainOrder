using NainOrder.Application.DTOs;

namespace NainOrder.Application.Interfaces;

public interface IProductService
{
    Task<ProductDto> CreateProductAsync(CreateProductRequest request);
    Task<List<ProductDto>> GetAllProductsAsync();
}
