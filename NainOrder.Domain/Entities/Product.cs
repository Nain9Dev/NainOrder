namespace NainOrder.Domain.Entities;

public class Product
{
    public Guid Id { get; private set; }
    public string Sku { get; private set; }
    public string Name { get; private set; }
    public decimal Price { get; private set; }
    public int StockQuantity { get; private set; }

    private Product() { }

    public Product(string sku, string name, decimal price, int initialStock)
    {
        if (string.IsNullOrWhiteSpace(sku)) throw new ArgumentException("SKU is required", nameof(sku));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required", nameof(name));
        if (price < 0) throw new ArgumentException("Price cannot be negative", nameof(price));
        if (initialStock < 0) throw new ArgumentException("Stock cannot be negative", nameof(initialStock));

        Id = Guid.NewGuid();
        Sku = sku;
        Name = name;
        Price = price;
        StockQuantity = initialStock;
    }

    public void UpdatePrice(decimal newPrice)
    {
        if (newPrice < 0) throw new ArgumentException("Price cannot be negative", nameof(newPrice));
        Price = newPrice;
    }

    public void AddStock(int quantity)
    {
        if (quantity <= 0) throw new ArgumentException("Must add a positive quantity", nameof(quantity));
        StockQuantity += quantity;
    }

    public void RemoveStock(int quantity)
    {
        if (quantity <= 0) throw new ArgumentException("Must remove a positive quantity", nameof(quantity));
        if (StockQuantity - quantity < 0) throw new InvalidOperationException("Insufficient stock");
        StockQuantity -= quantity;
    }
}
