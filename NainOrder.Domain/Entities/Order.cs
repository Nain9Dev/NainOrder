using NainOrder.Domain.Enums;

namespace NainOrder.Domain.Entities;

public class Order
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ShippedAt { get; private set; }
    
    private readonly List<OrderItem> _items = new();
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    public decimal TotalAmount => _items.Sum(i => i.TotalPrice);

    private Order() { }

    public Order(Guid customerId)
    {
        Id = Guid.NewGuid();
        CustomerId = customerId;
        Status = OrderStatus.PendingPayment;
        CreatedAt = DateTime.UtcNow;
    }

    public void AddItem(Guid productId, decimal unitPrice, int quantity)
    {
        if (Status != OrderStatus.PendingPayment)
            throw new InvalidOperationException("Cannot add items to an order that is not pending payment.");

        var existingItem = _items.FirstOrDefault(i => i.ProductId == productId);
        if (existingItem != null)
        {
            // Podríamos actualizar la cantidad si ya existe, pero 
            // por simplicidad o regla de negocio, podemos añadir uno nuevo o lanzar excepción.
            // Aquí lo añadiremos como un nuevo item o se podría sumar la cantidad.
            throw new InvalidOperationException("Product is already in the order.");
        }

        var item = new OrderItem(Id, productId, unitPrice, quantity);
        _items.Add(item);
    }

    public void MarkAsPaid()
    {
        if (Status != OrderStatus.PendingPayment)
            throw new InvalidOperationException("Order is not in a valid state to be paid.");
        
        Status = OrderStatus.Paid;
    }

    public void MarkAsProcessing()
    {
        if (Status != OrderStatus.Paid)
            throw new InvalidOperationException("Order must be paid before processing.");
        
        Status = OrderStatus.Processing;
    }

    public void MarkAsShipped()
    {
        if (Status != OrderStatus.Processing)
            throw new InvalidOperationException("Order must be processing before it can be shipped.");
        
        Status = OrderStatus.Shipped;
        ShippedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status == OrderStatus.Shipped)
            throw new InvalidOperationException("Cannot cancel a shipped order.");

        Status = OrderStatus.Cancelled;
    }
}
