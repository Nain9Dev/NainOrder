namespace NainOrder.Domain.Entities;

public class OrderItem
{
    public Guid Id { get; private set; }
    public Guid OrderId { get; private set; }
    public Guid ProductId { get; private set; }
    
    // Almacenamos el precio en el momento de la compra
    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }

    public decimal TotalPrice => UnitPrice * Quantity;

    private OrderItem() { }

    internal OrderItem(Guid orderId, Guid productId, decimal unitPrice, int quantity)
    {
        if (quantity <= 0) throw new ArgumentException("Quantity must be greater than zero", nameof(quantity));
        if (unitPrice < 0) throw new ArgumentException("Unit price cannot be negative", nameof(unitPrice));

        OrderId = orderId;
        ProductId = productId;
        UnitPrice = unitPrice;
        Quantity = quantity;
    }
}
