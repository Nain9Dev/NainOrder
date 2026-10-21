using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NainOrder.Application.Interfaces;
using NainOrder.Infrastructure.Persistence;
using NainOrder.Infrastructure.Persistence.Diagnostics;
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
        // The timing accumulator is scoped: one per request, shared by the interceptor that fills
        // it and by the API middleware that reports it. Building the options per scope is what
        // lets the interceptor be scoped too.
        services.AddScoped<RequestDatabaseTiming>();
        services.AddScoped<DatabaseTimingInterceptor>();
        services.AddDbContext<NainOrderDbContext>((provider, options) => options
            .UseSqlite(connectionString)
            .AddInterceptors(provider.GetRequiredService<DatabaseTimingInterceptor>()));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<IDropRepository, DropRepository>();
        services.AddScoped<IAnalyticsRepository, AnalyticsRepository>();

        return services;
    }
}
