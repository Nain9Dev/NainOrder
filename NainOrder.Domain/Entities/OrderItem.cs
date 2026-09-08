using NainOrder.Domain.Exceptions;

namespace NainOrder.Domain.Entities;

/// <summary>
/// Línea de pedido. Congela el precio unitario en el momento de la compra: un cambio
/// posterior de tarifa en el catálogo no debe alterar pedidos ya emitidos.
/// </summary>
public class OrderItem
{
    public const int MaxQuantity = 10_000;

    public Guid Id { get; private set; }
    public Guid OrderId { get; private set; }
    public Guid ProductId { get; private set; }

    /// <summary>Nombre del producto en el momento de la compra (snapshot para facturación e histórico).</summary>
    public string ProductName { get; private set; } = string.Empty;
    public string ProductSku { get; private set; } = string.Empty;

    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }

    public decimal TotalPrice => decimal.Round(UnitPrice * Quantity, 2, MidpointRounding.AwayFromZero);

    private OrderItem() { }

    internal OrderItem(Guid orderId, Guid productId, string productName, string productSku, decimal unitPrice, int quantity)
    {
        EnsureValidQuantity(quantity);
        if (unitPrice < 0)
            throw new InvalidDomainDataException(nameof(unitPrice), "Unit price cannot be negative.");

        Id = Guid.NewGuid();
        OrderId = orderId;
        ProductId = productId;
        ProductName = productName;
        ProductSku = productSku;
        UnitPrice = unitPrice;
        Quantity = quantity;
    }

    /// <summary>Devuelve la variación de unidades respecto a la cantidad anterior (positiva = consume más stock).</summary>
    internal int ChangeQuantity(int newQuantity)
    {
        EnsureValidQuantity(newQuantity);

        var delta = newQuantity - Quantity;
        Quantity = newQuantity;
        return delta;
    }

    private static void EnsureValidQuantity(int quantity)
    {
        if (quantity <= 0)
            throw new InvalidDomainDataException(nameof(quantity), "Quantity must be greater than zero.");
        if (quantity > MaxQuantity)
            throw new InvalidDomainDataException(nameof(quantity), $"Quantity cannot exceed {MaxQuantity} units per line.");
    }
}
