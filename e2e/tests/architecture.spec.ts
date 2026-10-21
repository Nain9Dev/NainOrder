import { test, expect } from "./fixtures";

test.use({ locale: "en-GB" });

// REQ-112: a request lights the map with the server's own timings; a rejection stops where the server says.
test("a request crosses the map and shows the server's timings", async ({ page }) => {
  await page.goto("/#/arquitectura");
  await expect(page.locator("[data-reqmap]")).toBeVisible();
  // Start-up loads the customers right after the first view; let it settle so the ping is the last trace.
  await page.waitForLoadState("networkidle");

  await page.locator('[data-action="ping"]').click();

  await expect(page.locator("[data-reqmap]")).toHaveAttribute("data-state", "ok");
  for (const layer of ["api", "application", "domain", "infrastructure"]) {
    await expect(page.locator(`[data-node="${layer}"]`)).toHaveAttribute("data-lit", "true");
  }

  // The figures come from the Server-Timing header: a total and a database segment with its command count.
  await expect(page.locator('[data-metric="api"]')).toHaveText(/\d+ ms|\d+\.\d+ s/);
  await expect(page.locator('[data-metric="infrastructure"]')).toHaveText(/· \d+ SQL$/);
  await expect(page.locator("[data-caption]")).toContainText("/api/dashboard/stats · 200");
});

test("a rejection stops at the layer the server named", async ({ page }) => {
  await page.goto("/#/arquitectura");
  await expect(page.locator("[data-reqmap]")).toBeVisible();

  await page.locator('[data-action="reject"]').click();

  await expect(page.locator("[data-reqmap]")).toHaveAttribute("data-state", "rejected");
  await expect(page.locator('[data-node="application"]')).toHaveAttribute("data-rejected", "true");
  await expect(page.locator('[data-node="domain"]')).toHaveAttribute("data-lit", "false");
  await expect(page.locator("[data-caption]")).toContainText("404 not_found · rejected in Application");
});

test("a domain rule shows as rejected in Domain", async ({ page }) => {
  await page.goto("/#/arquitectura");
  await expect(page.locator("[data-reqmap]")).toBeVisible();

  // Take more units than a drop allows per buyer: the Drop aggregate says no.
  await page.evaluate(async () => {
    const { api } = await import("/assets/js/api.js");
    const products = await api.products.list();
    const drop = await api.drops.create({ productId: products[0].id, totalUnits: 5, perBuyerLimit: 1, holdSeconds: 30, opensInSeconds: 0 });
    await api.drops.take(drop.id, 3).catch(() => {});
  });

  await expect(page.locator("[data-reqmap]")).toHaveAttribute("data-state", "rejected");
  await expect(page.locator('[data-node="domain"]')).toHaveAttribute("data-rejected", "true");
  await expect(page.locator("[data-caption]")).toContainText("409 buyer_limit_reached · rejected in Domain");
});

// REQ-113: on the in-browser engine the map shows one node and claims nothing about server layers.
test("on the in-browser engine the map shows a single node", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB" });
  await context.route(/naindev\.com/, (route) => route.abort());
  await context.addInitScript(() => { (window as unknown as { __NAINORDER_FORCE_MOCK__: boolean }).__NAINORDER_FORCE_MOCK__ = true; });
  const page = await context.newPage();

  await page.goto("/#/arquitectura");
  await expect(page.locator(".reqmap--browser")).toBeVisible();
  await expect(page.locator("[data-node]")).toHaveCount(1);

  await page.locator('[data-action="ping"]').click();
  await expect(page.locator('[data-node="browser"]')).toHaveAttribute("data-lit", "true");

  await context.close();
});
