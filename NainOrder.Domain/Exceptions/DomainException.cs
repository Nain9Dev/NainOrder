namespace NainOrder.Domain.Exceptions;

/// <summary>
/// Excepción base para toda violación de una regla de negocio del dominio.
/// Permite que las capas superiores distingan un fallo de negocio (esperable, 4xx)
/// de un fallo técnico (inesperado, 5xx) sin acoplarse a tipos de infraestructura.
/// </summary>
public abstract class DomainException : Exception
{
    /// <summary>Código estable y legible por máquina. No se traduce ni cambia entre versiones.</summary>
    public abstract string Code { get; }

    protected DomainException(string message) : base(message) { }
}

/// <summary>Un argumento no cumple la invariante exigida por la entidad.</summary>
public sealed class InvalidDomainDataException : DomainException
{
    public override string Code => "invalid_data";

    public string ParameterName { get; }

    public InvalidDomainDataException(string parameterName, string message) : base(message)
        => ParameterName = parameterName;
}

/// <summary>No hay stock suficiente para satisfacer la operación solicitada.</summary>
public sealed class InsufficientStockException : DomainException
{
    public override string Code => "insufficient_stock";

    public int Requested { get; }
    public int Available { get; }

    public InsufficientStockException(int requested, int available)
        : base($"Insufficient stock: {requested} requested but only {available} available.")
    {
        Requested = requested;
        Available = available;
    }
}

/// <summary>La transición de estado solicitada no está permitida por la máquina de estados del pedido.</summary>
public sealed class InvalidOrderStateException : DomainException
{
    public override string Code => "invalid_order_state";

    public string CurrentStatus { get; }
    public string AttemptedTransition { get; }

    public InvalidOrderStateException(string currentStatus, string attemptedTransition, string message)
        : base(message)
    {
        CurrentStatus = currentStatus;
        AttemptedTransition = attemptedTransition;
    }
}

/// <summary>La línea de pedido ya existe y la regla de negocio no permite duplicados.</summary>
public sealed class DuplicateOrderItemException : DomainException
{
    public override string Code => "duplicate_order_item";

    public Guid ProductId { get; }

    public DuplicateOrderItemException(Guid productId)
        : base("Product is already in the order. Change its quantity instead of adding it twice.")
        => ProductId = productId;
}

/// <summary>La línea de pedido referenciada no pertenece al pedido.</summary>
public sealed class OrderItemNotFoundException : DomainException
{
    public override string Code => "order_item_not_found";

    public Guid ProductId { get; }

    public OrderItemNotFoundException(Guid productId)
        : base($"Product {productId} is not part of this order.")
        => ProductId = productId;
}
