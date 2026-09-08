using NainOrder.Application.DTOs;
using NainOrder.Application.Exceptions;
using NainOrder.Application.Interfaces;
using NainOrder.Domain.Entities;

namespace NainOrder.Application.Services;

public class ProductService : IProductService
{
    private readonly IProductRepository _productRepository;
    private readonly IUnitOfWork _unitOfWork;

    public ProductService(IProductRepository productRepository, IUnitOfWork unitOfWork)
    {
        _productRepository = productRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task<ProductDto> CreateProductAsync(CreateProductRequest request, CancellationToken cancellationToken = default)
    {
        var sku = request.Sku.Trim().ToUpperInvariant();

        // El índice único de la base de datos sigue siendo la garantía final; esta
        // comprobación existe para devolver un 409 legible en lugar de un error de motor.
        if (await _productRepository.SkuExistsAsync(sku, cancellationToken))
            throw new ConflictException("duplicate_sku", $"A product with SKU '{sku}' already exists.");

        var product = new Product(request.Sku, request.Name, request.Price, request.InitialStock,
                                  request.Category, request.Description);

        await _productRepository.AddAsync(product, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return MapToDto(product);
    }

    public async Task<ProductDto> GetProductAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var product = await LoadAsync(productId, cancellationToken);
        return MapToDto(product);
    }

    public async Task<IReadOnlyList<ProductDto>> GetAllProductsAsync(
        string? search = null, string? category = null, CancellationToken cancellationToken = default)
    {
        var products = await _productRepository.GetAllAsync(search, category, cancellationToken);
        return products.Select(MapToDto).ToList();
    }

    public Task<IReadOnlyList<string>> GetCategoriesAsync(CancellationToken cancellationToken = default) =>
        _productRepository.GetCategoriesAsync(cancellationToken);

    public async Task<ProductDto> UpdateProductAsync(
        Guid productId, UpdateProductRequest request, CancellationToken cancellationToken = default)
    {
        var product = await LoadAsync(productId, cancellationToken);

        product.UpdateDetails(request.Name, request.Category, request.Description);
        product.UpdatePrice(request.Price);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return MapToDto(product);
    }

    public async Task<ProductDto> AdjustStockAsync(
        Guid productId, AdjustStockRequest request, CancellationToken cancellationToken = default)
    {
        var product = await LoadAsync(productId, cancellationToken);

        if (request.Delta > 0) product.AddStock(request.Delta);
        else if (request.Delta < 0) product.RemoveStock(-request.Delta);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return MapToDto(product);
    }

    private async Task<Product> LoadAsync(Guid productId, CancellationToken cancellationToken) =>
        await _productRepository.GetByIdAsync(productId, cancellationToken)
        ?? throw new NotFoundException("Product", productId);

    private static ProductDto MapToDto(Product p) => new(
        p.Id, p.Sku, p.Name, p.Category, p.Description, p.Price, p.StockQuantity,
        StockLevels.Classify(p.StockQuantity));
}
