import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

// The dashboard is the first data screen of the panel. Both engines must open it populated, with
// no manual step, on the day the visitor opens it.

const DEMO_DB_KEY = "nainorder.demo_db";

const kpi = (page: Page, modifier: string) => page.locator(`.kpi--${modifier} .kpi__value`);

const expectPopulated = async (page: Page) => {
  await page.goto("/#/panel");
  await expect(page.locator("#main-content")).not.toHaveAttribute("aria-busy", "true");

  // Recent orders are listed, not the empty state.
  await expect(page.locator(".table [data-order]").first()).toBeVisible();
  await expect(page.locator(".empty")).toHaveCount(0);

  // Every state of the machine has at least one order.
  const counts = await page.locator(".dist__value, [data-dist-count]").allTextContents();
  if (counts.length) expect(counts.every((text) => Number(text.trim()) > 0)).toBe(true);

  // Confirmed revenue is a figure, and the chart has data inside the 14-day window.
  await expect(kpi(page, "revenue")).not.toHaveText(/^0[,.]00/);
  await expect(page.locator(".chart__empty")).toHaveCount(0);
  await expect(page.locator(".rank__row").first()).toBeVisible();
};

// REQ-120: against the API, the sample orders are there on first paint.
test("against the API the dashboard opens populated", async ({ page, problems }) => {
  await expectPopulated(page);
  expect(problems).toEqual([]);
});

test.describe("in-browser engine", () => {
  // REQ-122: the engine dates its sample orders relative to today, so the chart never decays.
  test("the sample orders fall inside the timeline window", async ({ browser }) => {
    const context = await browser.newContext({ locale: "es-ES" });
    await context.route(/naindev\.com/, (route) => route.abort());
    await context.addInitScript(() => { (window as unknown as { __NAINORDER_FORCE_MOCK__: boolean }).__NAINORDER_FORCE_MOCK__ = true; });
    const page = await context.newPage();

    await expectPopulated(page);

    const timeline = await page.evaluate(async () => {
      const engine = await import("/assets/js/mock-backend.js");
      const stats = await engine.mockDispatch("GET", "/dashboard/stats", {});
      return stats.revenueTimeline as { date: string; amount: number; orders: number }[];
    });
    const ordersInWindow = timeline.reduce((sum, point) => sum + point.orders, 0);
    expect(ordersInWindow).toBeGreaterThanOrEqual(5);
    expect(timeline.filter((point) => point.amount > 0).length).toBeGreaterThanOrEqual(3);

    await context.close();
  });

  // REQ-122: a database stored by an earlier engine, with no orders, is replaced.
  test("a stale stored database is replaced by the sample set", async ({ browser }) => {
    const context = await browser.newContext({ locale: "es-ES" });
    await context.route(/naindev\.com/, (route) => route.abort());
    await context.addInitScript((key) => {
      (window as unknown as { __NAINORDER_FORCE_MOCK__: boolean }).__NAINORDER_FORCE_MOCK__ = true;
      localStorage.setItem(key, JSON.stringify({ products: [], customers: [], orders: [] }));
    }, DEMO_DB_KEY);
    const page = await context.newPage();

    await expectPopulated(page);

    await context.close();
  });
});
