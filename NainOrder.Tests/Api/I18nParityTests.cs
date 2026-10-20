using System.Text.Json;

namespace NainOrder.Tests.Api;

/// <summary>
/// REQ-094 and REQ-095: every user-visible string exists in both languages. The panel has no
/// build step, so this test is what turns a forgotten translation into a failing build.
/// </summary>
public class I18nParityTests
{
    private static readonly string Directory = Path.GetFullPath(Path.Combine(
        AppContext.BaseDirectory, "../../../../NainOrder.Api/wwwroot/assets/i18n"));

    /// <summary>The parts of a language, merged the way the panel merges them. A key in two parts is a defect.</summary>
    private static Dictionary<string, string> Load(string locale)
    {
        var merged = new Dictionary<string, string>();

        foreach (var file in new[] { $"{locale}.json", $"{locale}.views.json" })
        {
            var part = JsonSerializer.Deserialize<Dictionary<string, string>>(
                File.ReadAllText(Path.Combine(Directory, file)))!;

            foreach (var (key, value) in part)
                Assert.True(merged.TryAdd(key, value), $"{file}: key '{key}' is already defined in another part.");
        }

        return merged;
    }

    [Fact]
    public void Spanish_and_English_define_exactly_the_same_keys()
    {
        var es = Load("es").Keys.ToHashSet();
        var en = Load("en").Keys.ToHashSet();

        Assert.True(es.SetEquals(en),
            $"Only in es: [{string.Join(", ", es.Except(en))}]. Only in en: [{string.Join(", ", en.Except(es))}].");
    }

    [Theory]
    [InlineData("es")]
    [InlineData("en")]
    public void No_string_is_empty(string locale) =>
        Assert.All(Load(locale), pair => Assert.False(string.IsNullOrWhiteSpace(pair.Value), $"{locale}:{pair.Key} is empty"));

    [Fact]
    public void Placeholders_match_between_languages()
    {
        var es = Load("es");
        var en = Load("en");

        foreach (var (key, spanish) in es)
        {
            var spanishTokens = Tokens(spanish);
            var englishTokens = Tokens(en[key]);
            Assert.True(spanishTokens.SetEquals(englishTokens), $"Placeholders differ in '{key}'.");
        }
    }

    private static HashSet<string> Tokens(string text) =>
        System.Text.RegularExpressions.Regex.Matches(text, @"\{(\w+)\}", System.Text.RegularExpressions.RegexOptions.None, TimeSpan.FromSeconds(1))
            .Select(m => m.Groups[1].Value).ToHashSet();
}
