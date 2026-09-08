using FsCheck.Xunit;
using NainOrder.Domain.Entities;
using NainOrder.Domain.Exceptions;

namespace NainOrder.Tests.Domain;

/// <summary>
/// Comprobación basada en propiedades: en lugar de unos pocos ejemplos escogidos a mano,
/// FsCheck genera cientos de combinaciones y busca activamente el contraejemplo que
/// rompa la invariante. Es la forma de ganar confianza en reglas aritméticas como el
/// stock o los totales, donde el fallo suele estar en el caso límite que nadie escribe.
/// </summary>
public class DomainInvariantProperties
{
    // Los valores generados se acotan a rangos con sentido de negocio; probar con
    // enteros arbitrarios comprobaría el desbordamiento de int, no la regla del dominio.
    private static int Units(int seed, int max = 500) => Math.Abs(seed % max) + 1;
    private static decimal Price(int seed) => Math.Abs(seed % 100_000) / 100m;

    private static Product NewProduct(int stock) =>
        new("NO-TEST-001", "Producto de prueba", 100m, stock);

    [Property]
    public void Stock_never_goes_negative_whatever_the_sequence_of_removals(int[] seeds)
    {
        var product = NewProduct(1_000);

        foreach (var seed in seeds.Take(40))
        {
            var quantity = Units(seed, 300);

            try
            {
                product.RemoveStock(quantity);
            }
            catch (InsufficientStockException)
            {
                // Rechazar la operación es el comportamiento correcto: lo que se comprueba
                // es que el rechazo deja el stock intacto y nunca por debajo de cero.
            }

            Assert.True(product.StockQuantity >= 0);
        }
    }

    [Property]
    public void Adding_and_removing_the_same_amount_leaves_the_stock_unchanged(int seed, int initial)
    {
        var startingStock = Math.Abs(initial % 10_000);
        var quantity = Units(seed);

        var product = NewProduct(startingStock);

        product.AddStock(quantity);
        product.RemoveStock(quantity);

        Assert.Equal(startingStock, product.StockQuantity);
    }

    [Property]
    public void A_rejected_removal_does_not_touch_the_stock(int seed, int initial)
    {
        var startingStock = Math.Abs(initial % 1_000);
        var product = NewProduct(startingStock);

        // Se pide siempre más de lo disponible, así que la operación debe fallar.
        var excessive = startingStock + Units(seed);

        Assert.Throws<InsufficientStockException>(() => product.RemoveStock(excessive));
        Assert.Equal(startingStock, product.StockQuantity);
    }

    [Property]
    public void Every_mutation_moves_the_concurrency_token_forward(int seed)
    {
        var product = NewProduct(1_000);
        var before = product.Version;

        product.AddStock(Units(seed));

        Assert.True(product.Version > before);
    }

    [Property]
    public void The_order_total_always_equals_the_sum_of_its_lines(int[] seeds)
    {
        var order = new Order(Guid.NewGuid());
        var expected = 0m;

        foreach (var (seed, index) in seeds.Take(15).Select((value, index) => (value, index)))
        {
            var quantity = Units(seed, 50);
            var unitPrice = Price(seed);

            order.AddItem(Guid.NewGuid(), $"Producto {index}", $"NO-P-{index:000}", unitPrice, quantity);
            expected += unitPrice * quantity;
        }

        Assert.Equal(decimal.Round(expected, 2, MidpointRounding.AwayFromZero), order.TotalAmount);
        Assert.Equal(order.Items.Sum(item => item.Quantity), order.TotalUnits);
    }

    [Property]
    public void Removing_every_line_brings_the_total_back_to_zero(int[] seeds)
    {
        var order = new Order(Guid.NewGuid());
        var productIds = new List<Guid>();

        foreach (var seed in seeds.Take(12))
        {
            var productId = Guid.NewGuid();
            productIds.Add(productId);
            order.AddItem(productId, "Producto", "NO-P-001", Price(seed), Units(seed, 20));
        }

        foreach (var productId in productIds)
            order.RemoveItem(productId);

        Assert.Equal(0m, order.TotalAmount);
        Assert.Equal(0, order.TotalUnits);
        Assert.Empty(order.Items);
    }

    [Property]
    public void Prices_are_always_stored_rounded_to_two_decimals(int seed)
    {
        var raw = Math.Abs(seed % 1_000_000) / 1000m;
        var product = new Product("NO-TEST-002", "Producto", raw, 1);

        Assert.Equal(decimal.Round(raw, 2, MidpointRounding.AwayFromZero), product.Price);
    }

    [Property]
    public void A_customer_email_is_always_normalised_to_lowercase(int seed)
    {
        var localPart = $"User{Math.Abs(seed % 9999)}";
        var customer = new Customer("  Nombre Apellido  ", $"  {localPart}@Example.COM  ");

        Assert.Equal($"{localPart.ToLowerInvariant()}@example.com", customer.Email);
        Assert.Equal("Nombre Apellido", customer.Name);
    }
}
