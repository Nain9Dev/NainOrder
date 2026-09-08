using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NainOrder.Application.Interfaces;
using NainOrder.Infrastructure.Persistence;
using NainOrder.Infrastructure.Persistence.Repositories;

namespace NainOrder.Infrastructure;

/// <summary>
/// Registro de la capa de infraestructura. Mantener aquí el cableado evita que la API
/// conozca los tipos concretos de persistencia: solo depende de las abstracciones.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<NainOrderDbContext>(options => options.UseSqlite(connectionString));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<IAnalyticsRepository, AnalyticsRepository>();

        return services;
    }
}
