using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NainOrder.Application.Interfaces;
using NainOrder.Application.Services;

namespace NainOrder.Application;

/// <summary>Registro de los casos de uso. La API no necesita conocer sus implementaciones.</summary>
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ICustomerService, CustomerService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IDropService, DropService>();

        // Time is injected so drop expiry can be tested with a clock the test moves by hand.
        services.TryAddSingleton(TimeProvider.System);

        return services;
    }
}
