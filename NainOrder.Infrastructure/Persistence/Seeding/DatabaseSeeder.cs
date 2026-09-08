using Microsoft.EntityFrameworkCore;
using NainOrder.Domain.Entities;

namespace NainOrder.Infrastructure.Persistence.Seeding;

/// <summary>
/// Carga inicial de la demo. Es idempotente: solo inserta lo que falta, de modo que
/// puede ejecutarse en cada arranque sin duplicar datos ni pisar los del usuario.
/// </summary>
public static class DatabaseSeeder
{
    /// <summary>
    /// Cliente por defecto. El identificador es fijo para que la demo sea reproducible
    /// y coincida con el ejemplo que Swagger propone por defecto.
    /// </summary>
    public static readonly Guid DemoCustomerId = Guid.Parse("3fa85f64-5717-4562-b3fc-2c963f66afa6");

    private static readonly (string Sku, string Name, string Category, decimal Price, int Stock, string Description)[] CatalogSeed =
    [
        ("NO-LAP-001", "Laptop Pro X15",        "Portátiles",   1899.00m, 12, "Chasis de magnesio, 32 GB RAM y pantalla OLED de 15,6 pulgadas."),
        ("NO-LAP-002", "Ultrabook Air 13",      "Portátiles",   1249.00m,  8, "1,1 kg, 18 horas de autonomía y refrigeración pasiva silenciosa."),
        ("NO-MON-001", "Monitor UltraWide 34",  "Monitores",     749.50m,  5, "Panel curvo 3440x1440 a 165 Hz con calibración de fábrica."),
        ("NO-MON-002", "Monitor 4K 27",         "Monitores",     429.00m, 20, "IPS 4K con 99% sRGB y entrada USB-C de 90 W."),
        ("NO-KEY-001", "Teclado Mecánico TKL",  "Periféricos",   139.90m, 34, "Switches lineales lubricados, estructura junta y USB-C desmontable."),
        ("NO-MOU-001", "Ratón Ergonómico Pro",  "Periféricos",    89.90m, 41, "Sensor de 26.000 DPI, vertical a 30 grados y batería de 70 días."),
        ("NO-AUD-001", "Auriculares Studio NC", "Audio",         299.00m,  3, "Cancelación activa adaptativa y códec de alta resolución."),
        ("NO-AUD-002", "Micrófono Cardioide",   "Audio",         179.00m, 15, "Cápsula de condensador de 25 mm con salida directa de monitorización."),
        ("NO-NET-001", "Router Wi-Fi 7 Mesh",   "Redes",         349.00m,  9, "Tri-banda 2,4/5/6 GHz con backhaul dedicado y puerto 2,5 GbE."),
        ("NO-STO-001", "SSD NVMe 2 TB",         "Almacenamiento", 219.00m, 27, "PCIe 4.0 con 7.400 MB/s de lectura y disipador integrado."),
        ("NO-STO-002", "NAS 4 Bahías",          "Almacenamiento", 649.00m,  4, "Cuatro bahías hot-swap, 2,5 GbE y cifrado AES por volumen."),
        ("NO-ACC-001", "Dock USB-C 12 en 1",    "Periféricos",    169.00m,  0, "Triple salida de vídeo, Ethernet 2,5 GbE y 100 W de carga.")
    ];

    private static readonly (string Name, string Email)[] CustomerSeed =
    [
        ("Marta Iglesias", "marta.iglesias@example.com"),
        ("Diego Serrano", "diego.serrano@example.com"),
        ("Nuria Cabrera", "nuria.cabrera@example.com")
    ];

    public static async Task SeedAsync(NainOrderDbContext context, CancellationToken cancellationToken = default)
    {
        var changed = await SeedDemoCustomerAsync(context, cancellationToken);
        changed |= await SeedCustomersAsync(context, cancellationToken);
        changed |= await SeedCatalogAsync(context, cancellationToken);

        if (changed) await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task<bool> SeedDemoCustomerAsync(NainOrderDbContext context, CancellationToken cancellationToken)
    {
        if (await context.Customers.AnyAsync(c => c.Id == DemoCustomerId, cancellationToken))
            return false;

        var customer = new Customer("Cliente Demo", "demo@naindev.com");

        // El agregado genera su propio Id; para fijar el identificador reproducible de la
        // demo se ajusta la propiedad shadow-free vía EF, sin abrir un setter público
        // que rompería el encapsulamiento del dominio en producción.
        var entry = context.Customers.Add(customer);
        entry.Property(nameof(Customer.Id)).CurrentValue = DemoCustomerId;

        return true;
    }

    private static async Task<bool> SeedCustomersAsync(NainOrderDbContext context, CancellationToken cancellationToken)
    {
        var existing = await context.Customers
            .Select(c => c.Email)
            .ToListAsync(cancellationToken);

        var missing = CustomerSeed
            .Where(c => !existing.Contains(c.Email))
            .Select(c => new Customer(c.Name, c.Email))
            .ToList();

        if (missing.Count == 0) return false;

        await context.Customers.AddRangeAsync(missing, cancellationToken);
        return true;
    }

    private static async Task<bool> SeedCatalogAsync(NainOrderDbContext context, CancellationToken cancellationToken)
    {
        var existing = await context.Products
            .Select(p => p.Sku)
            .ToListAsync(cancellationToken);

        var missing = CatalogSeed
            .Where(p => !existing.Contains(p.Sku))
            .Select(p => new Product(p.Sku, p.Name, p.Price, p.Stock, p.Category, p.Description))
            .ToList();

        if (missing.Count == 0) return false;

        await context.Products.AddRangeAsync(missing, cancellationToken);
        return true;
    }
}
