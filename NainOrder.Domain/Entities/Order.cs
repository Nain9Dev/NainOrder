using NainOrder.Domain.Enums;
using NainOrder.Domain.Exceptions;

namespace NainOrder.Domain.Entities;

/// <summary>
/// Raíz de agregado del pedido. Encapsula la máquina de estados y sus líneas: los items
/// solo pueden mutarse a través de esta clase, nunca desde la colección expuesta.
/// </summary>
public class Order
{
    /// <summary>
    /// Transiciones permitidas. Es la única fuente de verdad de la máquina de estados:
    /// la API la publica tal cual para que el cliente no tenga que duplicar la regla.
    /// </summary>
    private static readonly IReadOnlyDictionary<OrderStatus, OrderStatus[]> AllowedTransitions =
        new Dictionary<OrderStatus, OrderStatus[]>
        {
            [OrderStatus.PendingPayment] = [OrderStatus.Paid, OrderStatus.Cancelled],
            [OrderStatus.Paid] = [OrderStatus.Processing, OrderStatus.Cancelled],
            [OrderStatus.Processing] = [OrderStatus.Shipped, OrderStatus.Cancelled],
            [OrderStatus.Shipped] = [],
            [OrderStatus.Cancelled] = []
        };

    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }

    /// <summary>Referencia legible del pedido, pensada para usarse en soporte y facturación.</summary>
    public string Reference { get; private set; } = string.Empty;

    public OrderStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? PaidAt { get; private set; }
    public DateTime? ShippedAt { get; private set; }
    public DateTime? CancelledAt { get; private set; }

    private readonly List<OrderItem> _items = new();
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    /// <summary>
    /// Totales materializados. Se recalculan en cada mutación de la cesta en lugar de
    /// derivarse en cada lectura: así los listados y las métricas pueden agregarlos y
    /// ordenarlos en base de datos sin cargar las líneas de cada pedido.
    /// </summary>
    public decimal TotalAmount { get; private set; }
    public int TotalUnits { get; private set; }

    /// <summary>Un pedido solo admite cambios en su cesta mientras no se haya cobrado.</summary>
    public bool IsEditable => Status == OrderStatus.PendingPayment;

    private Order() { }

    public Order(Guid customerId)
    {
        if (customerId == Guid.Empty)
            throw new InvalidDomainDataException(nameof(customerId), "A customer is required to open an order.");

        Id = Guid.NewGuid();
        CustomerId = customerId;
        Status = OrderStatus.PendingPayment;
        CreatedAt = DateTime.UtcNow;
        Reference = BuildReference(Id, CreatedAt);
    }

    public static IReadOnlyCollection<OrderStatus> TransitionsFrom(OrderStatus status) =>
        AllowedTransitions.TryGetValue(status, out var next) ? next : [];

    public IReadOnlyCollection<OrderStatus> NextStates => TransitionsFrom(Status);

    public void AddItem(Guid productId, string productName, string productSku, decimal unitPrice, int quantity)
    {
        EnsureEditable("AddItem");

        if (_items.Any(i => i.ProductId == productId))
            throw new DuplicateOrderItemException(productId);

        _items.Add(new OrderItem(Id, productId, productName, productSku, unitPrice, quantity));
        RecalculateTotals();
    }

    /// <summary>
    /// Ajusta la cantidad de una línea existente y devuelve la variación de unidades,
    /// para que la capa de aplicación reponga o consuma exactamente el stock afectado.
    /// </summary>
    public int ChangeItemQuantity(Guid productId, int newQuantity)
    {
        EnsureEditable("ChangeItemQuantity");

        var item = _items.FirstOrDefault(i => i.ProductId == productId)
                   ?? throw new OrderItemNotFoundException(productId);

        var delta = item.ChangeQuantity(newQuantity);
        RecalculateTotals();
        return delta;
    }

    /// <summary>Elimina una línea y devuelve las unidades que deben reponerse en el catálogo.</summary>
    public int RemoveItem(Guid productId)
    {
        EnsureEditable("RemoveItem");

        var item = _items.FirstOrDefault(i => i.ProductId == productId)
                   ?? throw new OrderItemNotFoundException(productId);

        _items.Remove(item);
        RecalculateTotals();
        return item.Quantity;
    }

    public void MarkAsPaid()
    {
        EnsureTransition(OrderStatus.Paid, "MarkAsPaid");

        if (_items.Count == 0)
            throw new InvalidOrderStateException(Status.ToString(), "MarkAsPaid",
                "An empty order cannot be paid. Add at least one item first.");

        Status = OrderStatus.Paid;
        PaidAt = DateTime.UtcNow;
    }

    public void MarkAsProcessing()
    {
        EnsureTransition(OrderStatus.Processing, "MarkAsProcessing");
        Status = OrderStatus.Processing;
    }

    public void MarkAsShipped()
    {
        EnsureTransition(OrderStatus.Shipped, "MarkAsShipped");
        Status = OrderStatus.Shipped;
        ShippedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Cancela el pedido y devuelve las unidades reservadas por producto para que la
    /// capa de aplicación las reponga en el catálogo.
    /// </summary>
    public IReadOnlyCollection<StockRestoration> Cancel()
    {
        EnsureTransition(OrderStatus.Cancelled, "Cancel");

        Status = OrderStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;

        return _items.Select(i => new StockRestoration(i.ProductId, i.Quantity)).ToList();
    }

    private void RecalculateTotals()
    {
        TotalAmount = decimal.Round(_items.Sum(i => i.TotalPrice), 2, MidpointRounding.AwayFromZero);
        TotalUnits = _items.Sum(i => i.Quantity);
    }

    private void EnsureEditable(string operation)
    {
        if (!IsEditable)
            throw new InvalidOrderStateException(Status.ToString(), operation,
                $"Cannot modify the basket of an order in state '{Status}'. Only pending-payment orders are editable.");
    }

    private void EnsureTransition(OrderStatus target, string operation)
    {
        if (!TransitionsFrom(Status).Contains(target))
            throw new InvalidOrderStateException(Status.ToString(), operation,
                $"Transition '{Status}' -> '{target}' is not allowed.");
    }

    private static string BuildReference(Guid id, DateTime createdAt) =>
        $"NO-{createdAt:yyyyMMdd}-{id.ToString("N")[..6].ToUpperInvariant()}";
}

/// <summary>Unidades de un producto que deben devolverse al catálogo tras cancelar un pedido.</summary>
public readonly record struct StockRestoration(Guid ProductId, int Quantity);
