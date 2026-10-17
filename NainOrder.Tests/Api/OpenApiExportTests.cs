using System.Text.Json;
using Xunit;

namespace NainOrder.Tests.Api;

public class OpenApiExportTests : IClassFixture<NainOrderApiFactory>
{
    private readonly HttpClient _client;

    public OpenApiExportTests(NainOrderApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task ExportOpenApiSchema()
    {
        var response = await _client.GetAsync("/swagger/v1/swagger.json");
        Assert.True(response.IsSuccessStatusCode, "Swagger endpoint must return 200 OK in testing environment");

        var rawJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(rawJson);
        var formattedJson = JsonSerializer.Serialize(doc.RootElement, new JsonSerializerOptions { WriteIndented = true });

        var docsPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../docs/openapi.json"));
        var dir = Path.GetDirectoryName(docsPath);
        if (dir != null && Directory.Exists(dir))
        {
            await File.WriteAllTextAsync(docsPath, formattedJson);
        }
    }
}
