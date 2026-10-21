import { test, expect, startDrop } from "./fixtures";

test.use({ locale: "en-GB" });

const number = async (page: import("@playwright/test").Page, selector: string) =>
  Number((await page.locator(selector).innerText()).replace(/\D/g, ""));

// REQ-091: the buyer sees what a buyer needs and nothing of the organizer's tools.
test("the buyer view shows the count, one action and no organizer tools", async ({ page }) => {
  await startDrop(page, "buyer");

  await expect(page.locator("[data-available]")).toBeVisible();
  await expect(page.locator('[data-action="take"]')).toBeVisible();
  await expect(page.locator("[data-grid]")).toHaveCount(0);
  await expect(page.locator('[data-action="crowd"]')).toHaveCount(0);
});

// REQ-092: the organizer sees the units, the figures, the next expiry and can release a crowd.
test("the organizer view shows the grid, the figures and releases a crowd", async ({ page }) => {
  await startDrop(page, "organizer");

  await expect(page.locator("[data-grid] .drop__cell")).toHaveCount(48);
  await expect(page.locator("[data-next]")).toBeVisible();
  await expect(page.locator("[data-qr] svg")).toBeVisible();

  await page.locator('[data-action="crowd"]').click();

  // The crowd's 40 buyers each hold one unit; what the panel shows must still add up to 48.
  await expect.poll(async () => number(page, '[data-stats] [data-tone="win"] .numeric')).toBe(8);
  const stats = page.locator("[data-stats] .numeric");
  const [available, held, sold] = await stats.allInnerTexts().then((values) => values.map(Number));
  expect(available + held + sold).toBe(48);
  expect(held).toBe(40);
});

// REQ-093: switching role keeps the same drop.
test("switching between buyer and organizer keeps the same drop", async ({ page }) => {
  await startDrop(page, "buyer");
  const product = await page.locator("[data-name]").innerText();

  await page.locator('[data-role="organizer"]').click();
  await expect(page.locator(".organizer")).toBeVisible();
  await expect(page.locator("[data-name]")).toHaveText(product);

  await page.locator('[data-role="buyer"]').click();
  await expect(page.locator(".buyer")).toBeVisible();
  await expect(page.locator("[data-name]")).toHaveText(product);
});

// A purchase turns a hold into a sale the organizer sees.
test("a buyer's purchase appears as a sold unit for the organizer", async ({ page }) => {
  await startDrop(page, "buyer");

  await page.locator('[data-action="take"]').click();
  await expect(page.locator("[data-hold]")).toBeVisible();
  await page.locator('[data-action="confirm"]').click();
  await expect(page.locator("[data-hold]")).toBeHidden();

  await page.locator('[data-role="organizer"]').click();
  await expect(page.locator('[data-stats] div:nth-child(3) .numeric')).toHaveText("1");
});
