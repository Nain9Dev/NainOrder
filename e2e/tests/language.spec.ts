import { test, expect, ROUTES } from "./fixtures";

// REQ-094: Spanish and English, remembered, defaulting to the browser's language.
test.describe("browser in English", () => {
  test.use({ locale: "en-GB" });

  test("defaults to English, switches to Spanish and remembers the choice", async ({ page }) => {
    await page.goto("/#/drop");
    await expect(page.locator(".landing__title")).toHaveText("Sell a drop without overselling");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.locator('[data-lang="es"]').click();
    await expect(page.locator(".landing__title")).toHaveText("Vende un drop sin sobreventa");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.reload();
    await expect(page.locator(".landing__title")).toHaveText("Vende un drop sin sobreventa");
  });
});

test.describe("browser in Spanish", () => {
  test.use({ locale: "es-ES" });

  test("defaults to Spanish", async ({ page }) => {
    await page.goto("/#/drop");
    await expect(page.locator(".landing__title")).toHaveText("Vende un drop sin sobreventa");
  });
});

// REQ-095 at run time: no route shows a raw key or logs a missing-translation warning.
for (const language of ["es", "en"] as const) {
  test(`every route renders in ${language} with no missing keys or errors`, async ({ page, problems }) => {
    await page.goto("/#/drop");
    await page.locator(`[data-lang="${language}"]`).click();

    for (const route of ROUTES) {
      await page.goto(`/#/${route}`);
      await expect(page.locator("#main-content")).not.toHaveAttribute("aria-busy", "true");
    }

    // A key shown instead of its text looks like `nav.drop` or `drop.status.Live`.
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\b(?:nav|shell|drop|dash|catalog|orders|panel|race|arch|share)\.[a-zA-Z]+/);
    expect(problems).toEqual([]);
  });
}
