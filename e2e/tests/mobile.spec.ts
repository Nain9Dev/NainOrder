import { test, expect, startDrop, ROUTES } from "./fixtures";

// REQ-102: usable at 360 px: no horizontal scroll, touch targets of at least 44 px.
test.use({ locale: "en-GB", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

const overflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);

for (const route of ROUTES) {
  test(`#/${route} does not scroll sideways at 360 px`, async ({ page }) => {
    await page.goto(`/#/${route}`);
    await expect(page.locator("#main-content")).not.toHaveAttribute("aria-busy", "true");
    await page.waitForTimeout(300); // let the view paint its first data

    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
}

test("the buyer page and the organizer view fit and have large touch targets", async ({ page, browser }) => {
  const id = await startDrop(page, "organizer");
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  const visitor = await browser.newContext({ locale: "en-GB", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  await visitor.route(/naindev\.com/, (route) => route.abort());
  const phone = await visitor.newPage();

  await phone.goto(`/#/d/${id}`);
  await expect(phone.locator(".buyer")).toBeVisible();
  expect(await overflow(phone)).toBeLessThanOrEqual(0);

  const take = await phone.locator('[data-action="take"]').boundingBox();
  expect(take!.height).toBeGreaterThanOrEqual(44);

  await visitor.close();
});

test("primary buttons reach 44 px on a touch screen", async ({ page }) => {
  await page.goto("/#/drop");

  for (const selector of ['[data-start="buyer"]', '[data-start="organizer"]', '[data-lang="en"]']) {
    const box = await page.locator(selector).boundingBox();
    expect(box!.height, selector).toBeGreaterThanOrEqual(44);
  }
});
