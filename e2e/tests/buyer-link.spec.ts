import jsQR from "jsqr";
import { PNG } from "pngjs";
import { test, expect, startDrop } from "./fixtures";

test.use({ locale: "en-GB" });

// REQ-104 and REQ-105: the QR code is the buyer link, exactly, as an independent decoder reads it.
test("the QR code decodes to the buyer link", async ({ page, baseURL }) => {
  const id = await startDrop(page, "organizer");

  const link = await page.locator("[data-link]").inputValue();
  expect(link).toBe(`${baseURL}/#/d/${id}`);

  const image = PNG.sync.read(await page.locator("[data-qr]").screenshot());
  const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);

  expect(decoded?.data).toBe(link);
});

// REQ-103: the buyer link opens the buyer page alone, and remembers the visitor.
test("the buyer link shows the buyer page alone and remembers the visitor", async ({ page, browser }) => {
  const id = await startDrop(page, "organizer");

  // A different visitor, as a phone that scanned the code: a fresh context with no history.
  const phone = await browser.newContext({ locale: "en-GB" });
  await phone.route(/naindev\.com/, (route) => route.abort());
  const visitor = await phone.newPage();

  await visitor.goto(`/#/d/${id}`);
  await expect(visitor.locator(".buyer")).toBeVisible();
  await expect(visitor.locator(".sidebar")).toBeHidden();
  await expect(visitor.locator(".topbar")).toBeHidden();
  await expect(visitor.locator("[data-role]")).toHaveCount(0);

  await visitor.locator('[data-action="take"]').click();
  await expect(visitor.locator("[data-hold]")).toBeVisible();

  // Same browser, later visit: the token persisted, so the hold is still theirs.
  await visitor.reload();
  await expect(visitor.locator("[data-hold]")).toBeVisible();

  await phone.close();
});

// REQ-104: copy puts the buyer link on the clipboard.
test("copy puts the buyer link on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startDrop(page, "organizer");

  const link = await page.locator("[data-link]").inputValue();
  await page.locator('[data-action="copy"]').click();

  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
});

test("a buyer link to a drop that does not exist says so", async ({ page }) => {
  await page.goto("/#/d/00000000-0000-0000-0000-000000000000");

  await expect(page.locator(".empty__title")).toHaveText("This drop no longer exists");
  await expect(page.locator(".sidebar")).toBeHidden();
});
