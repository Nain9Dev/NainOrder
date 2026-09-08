using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;

namespace NainOrder.Api.Controllers;

/// <summary>Clientes que pueden emitir pedidos.</summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class CustomersController : ControllerBase
{
    private readonly ICustomerService _customerService;

    public CustomersController(ICustomerService customerService) => _customerService = customerService;

    /// <summary>Lista todos los clientes ordenados por nombre.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<CustomerDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CustomerDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await _customerService.GetAllCustomersAsync(cancellationToken));

    /// <summary>Da de alta un cliente. El email debe ser único.</summary>
    [HttpPost]
    [ProducesResponseType<CustomerDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CustomerDto>> Create(
        [FromBody] CreateCustomerRequest request, CancellationToken cancellationToken)
    {
        var customer = await _customerService.CreateCustomerAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { id = customer.Id }, customer);
    }
}
