import type { Page } from "@playwright/test";
import { test, expect, startDrop } from "./fixtures";

test.use({ locale: "en-GB" });

/** Waits until the service worker is active and controls the page, so the shell is in the cache. */
const waitForServiceWorker = async (page: Page) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
};

// REQ-100: the manifest the page links is served.
test("the page links a manifest that is served", async ({ page, request }) => {
  await page.goto("/#/drop");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");

  const response = await request.get(`/${href!.replace(/^\.\//, "")}`);
  expect(response.ok()).toBe(true);
  expect((await response.json()).display).toBe("standalone");
});

// REQ-101: a reload with no network opens the interface from the cache and says so.
test("offline, the shell opens from the cache and says it is offline", async ({ page, context }) => {
  await page.goto("/#/drop");
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.reload();

  await expect(page.locator(".nav")).toBeVisible();
  await expect(page.locator("[data-offline-notice]")).toBeVisible();
  await expect(page.locator("[data-health]")).toContainText("unavailable");

  await context.setOffline(false);
  await expect(page.locator("[data-offline-notice]")).toBeHidden();
});

// REQ-101: the API is never served from a cache, and purchases are visibly unavailable.
test("going offline mid-session disables purchases and the API is never faked", async ({ page, context }) => {
  await startDrop(page, "buyer");
  await waitForServiceWorker(page);
  await expect(page.locator('[data-action="take"]')).toBeVisible();

  await context.setOffline(true);

  await expect(page.locator("[data-offline-notice]")).toBeVisible();
  const pointerEvents = await page.locator('[data-action="take"]').evaluate((node) => getComputedStyle(node).pointerEvents);
  expect(pointerEvents).toBe("none");

  // A request to the API fails instead of returning stale units.
  const reachable = await page.evaluate(() => fetch("/api/drops").then(() => true, () => false));
  expect(reachable).toBe(false);

  await context.setOffline(false);
  await expect(page.locator("[data-offline-notice]")).toBeHidden();
});
