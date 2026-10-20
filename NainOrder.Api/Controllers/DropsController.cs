using Microsoft.AspNetCore.Mvc;
using NainOrder.Application.DTOs;
using NainOrder.Application.Interfaces;

namespace NainOrder.Api.Controllers;

/// <summary>Limited-stock drops: a fixed number of units sold to a crowd with short expiring holds.</summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class DropsController : ControllerBase
{
    private const string BuyerTokenHeader = "X-Buyer-Token";

    private readonly IDropService _dropService;

    public DropsController(IDropService dropService) => _dropService = dropService;

    /// <summary>Most recent drops.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<DropDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DropDto>>> List(CancellationToken cancellationToken) =>
        Ok(await _dropService.ListAsync(cancellationToken));

    /// <summary>Live state of a drop. With <c>X-Buyer-Token</c>, also the caller's own holds.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType<DropDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DropDto>> GetById(Guid id, CancellationToken cancellationToken) =>
        Ok(await _dropService.GetAsync(id, BuyerToken(), cancellationToken));

    /// <summary>Creates a drop for a catalogue product. It opens after <c>opensInSeconds</c>.</summary>
    [HttpPost]
    [ProducesResponseType<DropDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DropDto>> Create(CreateDropRequest request, CancellationToken cancellationToken)
    {
        var drop = await _dropService.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = drop.Id }, drop);
    }

    /// <summary>Takes units from a live drop: an expiring hold for the caller's buyer token.</summary>
    [HttpPost("{id:guid}/holds")]
    [ProducesResponseType<HoldDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<HoldDto>> Take(
        Guid id, TakeUnitsRequest request, CancellationToken cancellationToken)
    {
        if (BuyerToken() is not { } token) return MissingToken();
        return Ok(await _dropService.TakeAsync(id, token, request, cancellationToken));
    }

    /// <summary>Confirms an unexpired hold; it becomes a paid order.</summary>
    [HttpPost("{id:guid}/holds/{holdId:guid}/confirm")]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OrderDto>> Confirm(Guid id, Guid holdId, CancellationToken cancellationToken)
    {
        if (BuyerToken() is not { } token) return MissingToken();
        return Ok(await _dropService.ConfirmAsync(id, holdId, token, cancellationToken));
    }

    private string? BuyerToken()
    {
        var value = Request.Headers[BuyerTokenHeader].ToString().Trim();
        return value.Length is > 0 and <= 64 ? value : null;
    }

    private ObjectResult MissingToken() => Problem(
        statusCode: StatusCodes.Status400BadRequest,
        title: "Buyer token required",
        detail: $"Send a visitor token of 1 to 64 characters in the {BuyerTokenHeader} header.",
        extensions: new Dictionary<string, object?> { ["code"] = "buyer_token_required" });
}
