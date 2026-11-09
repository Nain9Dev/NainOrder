# next-seo-discoverability — Plan

1. `SeoDiscoverabilityTests` reads `wwwroot/index.html` and the three discovery files and asserts
   REQ-064; a `WebApplicationFactory` check proves the real application serves each file with its
   own content type instead of the SPA fallback (`UseStaticFiles` runs before `MapFallbackToFile`).
2. Add the metadata and JSON-LD to the `<head>` of `wwwroot/index.html`.
3. Add `robots.txt`, `sitemap.xml` and `llms.txt` to `wwwroot`.

No change in Domain, Application, Infrastructure or the controllers.
