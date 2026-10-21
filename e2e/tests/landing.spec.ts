import { test, expect } from "./fixtures";

// REQ-090: the landing tells the story without words and offers one action per role.
test("the landing plays the story and offers one action per role", async ({ page }) => {
  await page.goto("/#/drop");

  await expect(page.locator(".story")).toBeVisible();
  await expect(page.locator(".story__caption")).toHaveCount(4);
  await expect(page.locator('[data-start="buyer"]')).toBeVisible();
  await expect(page.locator('[data-start="organizer"]')).toBeVisible();

  const animations = await page.evaluate(() => document.querySelector(".story")!.getAnimations({ subtree: true }).length);
  expect(animations).toBeGreaterThan(0);
});

// REQ-096: with reduced motion the story shows its end state, still.
test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the story does not animate and shows only its last caption", async ({ page }) => {
    await page.goto("/#/drop");
    await expect(page.locator(".story")).toBeVisible();

    const animations = await page.evaluate(() => document.querySelector(".story")!.getAnimations({ subtree: true }).length);
    expect(animations).toBe(0);

    const opacities = await page
      .locator(".story__caption")
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity));
    expect(opacities).toEqual(["0", "0", "0", "1"]);
  });
});
