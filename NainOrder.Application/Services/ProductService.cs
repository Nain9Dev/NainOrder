using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Application.Services;

public class ProductService : IProductService
{
    private readonly IProductRepository _productRepository;

    public ProductService(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<ProductDto> CreateProductAsync(CreateProductRequest request)
    {
        var product = new Product(request.Sku, request.Name, request.Price, request.InitialStock);
        
        await _productRepository.AddAsync(product);
        await _productRepository.SaveChangesAsync();

        return new ProductDto(product.Id, product.Sku, product.Name, product.Price, product.StockQuantity);
    }

    public async Task<List<ProductDto>> GetAllProductsAsync()
    {
        var products = await _productRepository.GetAllAsync();
        
        return products.Select(p => 
            new ProductDto(p.Id, p.Sku, p.Name, p.Price, p.StockQuantity)
        ).ToList();
    }
}
