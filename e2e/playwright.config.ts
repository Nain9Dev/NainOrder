import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 8180);
const BASE_URL = `http://localhost:${PORT}`;

// A throwaway database per run: the suite never touches a developer's nainorder.db.
const database = path.join(os.tmpdir(), `nainorder-e2e-${process.pid}.db`);

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // CI uses Playwright's own Chromium; locally PW_CHANNEL=msedge reuses an installed browser.
    channel: process.env.PW_CHANNEL || undefined,
    // The third-party ecosystem bar and brand CSS are not part of the product under test.
    serviceWorkers: "allow"
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 820 } } }
  ],

  webServer: {
    command: `dotnet run --project ../NainOrder.Api -c Release --no-launch-profile --urls ${BASE_URL}`,
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ASPNETCORE_ENVIRONMENT: "Development",
      ConnectionStrings__DefaultConnection: `Data Source=${database}`
    }
  }
});
