using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace NainOrder.Tests.Api;

/// <summary>
/// Levanta la aplicación real —controladores, middleware, EF Core y migraciones— contra
/// un fichero SQLite propio de cada ejecución. No se sustituye ninguna pieza por un doble:
/// lo que se prueba es el mismo recorrido que atenderá una petición en producción.
/// </summary>
public sealed class NainOrderApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly string _databasePath =
        Path.Combine(Path.GetTempPath(), $"nainorder-tests-{Guid.NewGuid():N}.db");

    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureHostConfiguration(config =>
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = $"Data Source={_databasePath}"
            }));

        return base.CreateHost(builder);
    }

    public Task InitializeAsync()
    {
        // Basta con materializar el host: el arranque aplica migraciones y siembra datos.
        _ = Server;
        return Task.CompletedTask;
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();

        // Se libera el fichero antes de borrarlo; si el proveedor aún lo retiene, se ignora:
        // es un temporal y su presencia no afecta a ejecuciones posteriores.
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();

        try
        {
            if (File.Exists(_databasePath)) File.Delete(_databasePath);
        }
        catch (IOException)
        {
        }
    }
}
