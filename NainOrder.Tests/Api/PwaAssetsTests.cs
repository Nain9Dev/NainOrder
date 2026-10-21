using System.Buffers.Binary;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NainOrder.Tests.Api;

/// <summary>
/// REQ-100 and REQ-101 (the part that can be checked without a browser): the web manifest is
/// complete, its icons exist at the declared size, and the service worker's precache list names
/// every static file the panel needs and nothing that is missing.
/// </summary>
public class PwaAssetsTests
{
    private static readonly string Root = Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "../../../../NainOrder.Api/wwwroot"));

    private static readonly string[] AssetDirectories = ["assets/js", "assets/css", "assets/i18n"];

    private static JsonElement Manifest() =>
        JsonDocument.Parse(File.ReadAllText(Path.Combine(Root, "manifest.webmanifest"))).RootElement;

    [Fact]
    public void The_manifest_declares_what_a_browser_needs_to_install_the_panel()
    {
        var manifest = Manifest();

        Assert.False(string.IsNullOrWhiteSpace(manifest.GetProperty("name").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(manifest.GetProperty("short_name").GetString()));
        Assert.Equal("standalone", manifest.GetProperty("display").GetString());
        Assert.Equal("./", manifest.GetProperty("start_url").GetString());
        Assert.Matches("^#[0-9a-fA-F]{6}$", manifest.GetProperty("theme_color").GetString()!);
        Assert.Matches("^#[0-9a-fA-F]{6}$", manifest.GetProperty("background_color").GetString()!);
    }

    [Fact]
    public void The_manifest_has_192_and_512_icons_and_one_of_them_is_maskable()
    {
        var icons = Manifest().GetProperty("icons").EnumerateArray().ToList();

        Assert.Contains(icons, i => i.GetProperty("sizes").GetString() == "192x192");
        Assert.Contains(icons, i => i.GetProperty("sizes").GetString() == "512x512");
        Assert.Contains(icons, i => i.GetProperty("purpose").GetString()!.Contains("maskable"));
    }

    [Fact]
    public void Every_icon_exists_and_is_a_png_of_the_declared_size()
    {
        foreach (var icon in Manifest().GetProperty("icons").EnumerateArray())
        {
            var path = Path.Combine(Root, icon.GetProperty("src").GetString()!.TrimStart('.', '/'));
            Assert.True(File.Exists(path), $"Icon missing: {path}");

            var header = File.ReadAllBytes(path).AsSpan(0, 24);
            Assert.Equal(new byte[] { 0x89, 0x50, 0x4E, 0x47 }, header[..4].ToArray());

            var declared = icon.GetProperty("sizes").GetString()!.Split('x').Select(int.Parse).ToArray();
            Assert.Equal(declared[0], BinaryPrimitives.ReadInt32BigEndian(header[16..20]));
            Assert.Equal(declared[1], BinaryPrimitives.ReadInt32BigEndian(header[20..24]));
        }
    }

    private static List<string> Precache()
    {
        var source = File.ReadAllText(Path.Combine(Root, "sw.js"));
        var block = Regex.Match(source, @"const PRECACHE = \[(.*?)\];", RegexOptions.Singleline, TimeSpan.FromSeconds(1));
        Assert.True(block.Success, "sw.js must declare `const PRECACHE = [...]`.");

        return Regex.Matches(block.Groups[1].Value, "\"([^\"]+)\"", RegexOptions.None, TimeSpan.FromSeconds(1))
            .Select(m => m.Groups[1].Value)
            .ToList();
    }

    private static string Relative(string path) => path.TrimStart('.', '/');

    [Fact]
    public void Every_precache_entry_points_at_a_file_that_exists()
    {
        foreach (var entry in Precache())
        {
            var relative = Relative(entry);
            var path = relative.Length == 0 ? Path.Combine(Root, "index.html") : Path.Combine(Root, relative);
            Assert.True(File.Exists(path), $"Precache entry has no file: {entry}");
        }
    }

    [Fact]
    public void Every_static_asset_of_the_panel_is_precached()
    {
        var cached = Precache().Select(Relative).ToHashSet();

        var assets = AssetDirectories
            .SelectMany(dir => Directory.EnumerateFiles(Path.Combine(Root, dir), "*", SearchOption.AllDirectories))
            .Select(file => Path.GetRelativePath(Root, file).Replace('\\', '/'));

        foreach (var asset in assets)
            Assert.True(cached.Contains(asset), $"Not in the precache list (the panel would break offline): {asset}");
    }

    [Fact]
    public void The_service_worker_never_handles_the_api_or_non_get_requests()
    {
        var source = File.ReadAllText(Path.Combine(Root, "sw.js"));

        Assert.Contains("\"/api\"", source);
        Assert.Contains("request.method !== \"GET\"", source);
    }

    [Fact]
    public void The_page_links_the_manifest_and_declares_its_colours_and_touch_icon()
    {
        var html = File.ReadAllText(Path.Combine(Root, "index.html"));

        Assert.Contains("rel=\"manifest\"", html);
        Assert.Contains("rel=\"apple-touch-icon\"", html);
        Assert.Contains("name=\"theme-color\"", html);
    }
}
