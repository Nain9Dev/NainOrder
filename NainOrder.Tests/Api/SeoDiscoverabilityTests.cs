using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace NainOrder.Tests.Api;

/// <summary>
/// REQ-064: the public page declares what search engines and AI crawlers need (one canonical URL,
/// a description of sensible length, Open Graph, Twitter card and JSON-LD) and the three
/// discovery files are served from the site root, not swallowed by the SPA fallback.
/// </summary>
public class SeoDiscoverabilityTests : IClassFixture<NainOrderApiFactory>
{
    private const string Canonical = "https://order.naindev.com/";
    private const string AuthorId = "https://www.naindev.com/#person";
    private const string Repository = "https://github.com/Nain9Dev/NainOrder";

    private static readonly string Root = Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "../../../../NainOrder.Api/wwwroot"));

    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(1);

    private readonly HttpClient _client;

    public SeoDiscoverabilityTests(NainOrderApiFactory factory) => _client = factory.CreateClient();

    private static string Html() => File.ReadAllText(Path.Combine(Root, "index.html"));

    private static List<string> MetaContents(string html, string attribute, string key) =>
        Regex.Matches(html, "<meta\\s+[^>]*>", RegexOptions.IgnoreCase, RegexTimeout)
            .Select(m => m.Value)
            .Where(tag => Regex.IsMatch(tag, $"{attribute}=\"{Regex.Escape(key)}\"", RegexOptions.IgnoreCase, RegexTimeout))
            .Select(tag => Regex.Match(tag, "content=\"([^\"]*)\"", RegexOptions.IgnoreCase, RegexTimeout).Groups[1].Value)
            .ToList();

    private static string Meta(string html, string attribute, string key)
    {
        var values = MetaContents(html, attribute, key);
        Assert.True(values.Count == 1, $"Expected exactly one <meta {attribute}=\"{key}\">, found {values.Count}.");
        return values[0];
    }

    [Fact]
    public void The_page_declares_exactly_one_canonical_link_equal_to_the_host_root()
    {
        var links = Regex.Matches(Html(), "<link\\s+[^>]*rel=\"canonical\"[^>]*>", RegexOptions.IgnoreCase, RegexTimeout);

        Assert.Single(links);
        Assert.Contains($"href=\"{Canonical}\"", links[0].Value, StringComparison.Ordinal);
    }

    [Fact]
    public void The_description_is_a_single_tag_of_70_to_160_characters()
    {
        var description = Meta(Html(), "name", "description");

        Assert.InRange(description.Length, 70, 160);
    }

    [Fact]
    public void Open_Graph_and_Twitter_cards_describe_the_page_and_agree_with_the_canonical_url()
    {
        var html = Html();

        Assert.Equal("website", Meta(html, "property", "og:type"));
        Assert.Equal("NainOrder", Meta(html, "property", "og:site_name"));
        Assert.False(string.IsNullOrWhiteSpace(Meta(html, "property", "og:title")));
        Assert.False(string.IsNullOrWhiteSpace(Meta(html, "property", "og:description")));
        Assert.Equal(Canonical, Meta(html, "property", "og:url"));
        Assert.StartsWith("https://", Meta(html, "property", "og:image"), StringComparison.Ordinal);
        Assert.Equal("1200", Meta(html, "property", "og:image:width"));
        Assert.Equal("630", Meta(html, "property", "og:image:height"));

        Assert.Equal("summary_large_image", Meta(html, "name", "twitter:card"));
        Assert.False(string.IsNullOrWhiteSpace(Meta(html, "name", "twitter:title")));
        Assert.False(string.IsNullOrWhiteSpace(Meta(html, "name", "twitter:description")));
        Assert.Equal(Meta(html, "property", "og:image"), Meta(html, "name", "twitter:image"));
    }

    [Fact]
    public void The_page_links_its_author()
    {
        Assert.Matches("<link\\s+rel=\"author\"\\s+href=\"https://www.naindev.com/\"", Html());
    }

    [Fact]
    public void The_JSON_LD_describes_the_application_and_names_the_author_by_id()
    {
        var blocks = Regex.Matches(Html(), "<script type=\"application/ld\\+json\">(.*?)</script>",
            RegexOptions.Singleline, RegexTimeout);
        Assert.Single(blocks);

        var data = JsonDocument.Parse(blocks[0].Groups[1].Value).RootElement;

        Assert.Equal("SoftwareApplication", data.GetProperty("@type").GetString());
        Assert.Equal("NainOrder", data.GetProperty("name").GetString());
        Assert.Equal(Canonical, data.GetProperty("url").GetString());
        Assert.Equal("Web", data.GetProperty("operatingSystem").GetString());
        Assert.True(data.GetProperty("isAccessibleForFree").GetBoolean());
        Assert.Equal(Meta(Html(), "name", "description"), data.GetProperty("description").GetString());
        Assert.Equal(AuthorId, data.GetProperty("author").GetProperty("@id").GetString());
        Assert.Contains(Repository, data.GetProperty("sameAs").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public void The_discovery_files_are_served_from_the_root_and_not_by_the_spa_fallback()
    {
        foreach (var file in new[] { "robots.txt", "sitemap.xml", "llms.txt" })
            Assert.True(File.Exists(Path.Combine(Root, file)), $"{file} is missing from wwwroot.");

        var robots = File.ReadAllText(Path.Combine(Root, "robots.txt"));
        Assert.Contains("User-agent: *", robots, StringComparison.Ordinal);
        Assert.Contains("Allow: /", robots, StringComparison.Ordinal);
        Assert.DoesNotContain("Disallow: /", robots, StringComparison.Ordinal);
        Assert.Contains($"Sitemap: {Canonical}sitemap.xml", robots, StringComparison.Ordinal);

        var sitemap = XDocument.Parse(File.ReadAllText(Path.Combine(Root, "sitemap.xml")));
        var loc = sitemap.Descendants().Single(e => e.Name.LocalName == "loc").Value;
        Assert.Equal(Canonical, loc);

        var llms = File.ReadAllText(Path.Combine(Root, "llms.txt"));
        Assert.StartsWith("# NainOrder", llms, StringComparison.Ordinal);
        Assert.Contains(Repository, llms, StringComparison.Ordinal);
        Assert.Contains("https://www.naindev.com/", llms, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("/robots.txt", "text/plain")]
    [InlineData("/sitemap.xml", "xml")]
    [InlineData("/llms.txt", "text/plain")]
    public async Task The_application_serves_each_discovery_file_with_its_own_content_type(string path, string mediaType)
    {
        var response = await _client.GetAsync(path);

        response.EnsureSuccessStatusCode();
        Assert.Contains(mediaType, response.Content.Headers.ContentType!.MediaType, StringComparison.Ordinal);
        Assert.DoesNotContain("<html", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }
}
