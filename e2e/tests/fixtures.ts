import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared fixtures. Every test starts from a fresh browser context, with the third-party
 * ecosystem bar and brand stylesheet blocked: they are not part of the product under test and
 * would make runs depend on a network the suite does not control.
 */
export const test = base.extend<{ problems: string[] }>({
  context: async ({ context }, use) => {
    await context.route(/naindev\.com/, (route) => route.abort());
    await use(context);
  },

  /** Console errors, page errors and missing-translation warnings seen during the test. */
  problems: async ({ page }, use) => {
    const seen: string[] = [];
    page.on("pageerror", (error) => seen.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      const text = message.text();
      const ignorable = /Failed to load resource|net::ERR_/.test(text); // 4xx/5xx and blocked hosts
      if (text.includes("[i18n]") || (message.type() === "error" && !ignorable)) seen.push(text);
    });
    await use(seen);
  }
});

export { expect };

export type Role = "buyer" | "organizer";

/** Opens the landing and starts a drop as the given role, returning the drop id from its buyer link. */
export const startDrop = async (page: Page, role: Role): Promise<string> => {
  await page.goto("/#/drop");
  await page.locator(`[data-start="${role}"]`).click();
  await page.locator(role === "buyer" ? ".buyer" : ".organizer").waitFor();

  if (role === "buyer") await page.locator('[data-role="organizer"]').click();
  await page.locator("[data-link]").waitFor();
  const link = await page.locator("[data-link]").inputValue();
  if (role === "buyer") await page.locator('[data-role="buyer"]').click();

  return link.split("/d/")[1];
};

/** Every route of the panel that a visitor can reach from the menu. */
export const ROUTES = ["drop", "panel", "catalogo", "pedidos", "carrera", "arquitectura"] as const;
