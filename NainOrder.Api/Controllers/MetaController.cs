using Microsoft.AspNetCore.Mvc;
using NainOrder.Domain.Entities;
using NainOrder.Domain.Enums;

namespace NainOrder.Api.Controllers;

/// <summary>Metadatos del dominio publicados para que el cliente no duplique reglas de negocio.</summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class MetaController : ControllerBase
{
    /// <summary>
    /// Máquina de estados del pedido tal y como la define el dominio. El cliente pinta
    /// los botones a partir de esta respuesta, así que una regla nueva en el dominio se
    /// refleja en la interfaz sin tocar el front.
    /// </summary>
    [HttpGet("order-state-machine")]
    [ProducesResponseType<OrderStateMachineDto>(StatusCodes.Status200OK)]
    public ActionResult<OrderStateMachineDto> GetOrderStateMachine()
    {
        var states = Enum.GetValues<OrderStatus>()
            .Select(status => new OrderStateDto(
                status.ToString(),
                (int)status,
                Order.TransitionsFrom(status).Select(next => next.ToString()).ToList(),
                Order.TransitionsFrom(status).Count == 0))
            .ToList();

        return Ok(new OrderStateMachineDto(nameof(OrderStatus.PendingPayment), states));
    }
}

/// <summary>Descripción completa de la máquina de estados del pedido.</summary>
public record OrderStateMachineDto(string InitialState, IReadOnlyList<OrderStateDto> States);

/// <summary>Un estado y las transiciones que admite.</summary>
public record OrderStateDto(string Name, int Value, IReadOnlyList<string> Transitions, bool IsTerminal);
