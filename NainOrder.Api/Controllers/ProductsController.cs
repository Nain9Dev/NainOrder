using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;

namespace NainOrder.Api.Controllers;

/// <summary>Catálogo de productos y gestión de su stock.</summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductsController(IProductService productService) => _productService = productService;

    /// <summary>Lista el catálogo, opcionalmente filtrado por texto libre o categoría.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ProductDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> GetAll(
        [FromQuery] string? search, [FromQuery] string? category, CancellationToken cancellationToken) =>
        Ok(await _productService.GetAllProductsAsync(search, category, cancellationToken));

    /// <summary>Devuelve las categorías existentes en el catálogo.</summary>
    [HttpGet("categories")]
    [ProducesResponseType<IReadOnlyList<string>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<string>>> GetCategories(CancellationToken cancellationToken) =>
        Ok(await _productService.GetCategoriesAsync(cancellationToken));

    /// <summary>Obtiene un producto por su identificador.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDto>> GetById(Guid id, CancellationToken cancellationToken) =>
        Ok(await _productService.GetProductAsync(id, cancellationToken));

    /// <summary>Da de alta un producto. El SKU debe ser único en todo el catálogo.</summary>
    [HttpPost]
    [ProducesResponseType<ProductDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductDto>> Create(
        [FromBody] CreateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await _productService.CreateProductAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    /// <summary>Actualiza nombre, precio, categoría y descripción de un producto.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDto>> Update(
        Guid id, [FromBody] UpdateProductRequest request, CancellationToken cancellationToken) =>
        Ok(await _productService.UpdateProductAsync(id, request, cancellationToken));

    /// <summary>Ajusta el stock en la cantidad indicada. Un delta negativo retira unidades.</summary>
    [HttpPost("{id:guid}/stock")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProductDto>> AdjustStock(
        Guid id, [FromBody] AdjustStockRequest request, CancellationToken cancellationToken) =>
        Ok(await _productService.AdjustStockAsync(id, request, cancellationToken));
}
