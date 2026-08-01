import { defineConfig, devices } from "@playwright/test";

const desktop = { viewport: { width: 1280, height: 900 } };
const mobile = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: { command: "npm run build && npm run preview", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI, timeout: 120_000 },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], ...desktop } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"], ...desktop } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"], ...desktop } },
    { name: "chromium-mobile", use: { browserName: "chromium", ...mobile } },
    { name: "firefox-mobile", use: { browserName: "firefox", ...mobile } },
    { name: "webkit-mobile", use: { browserName: "webkit", ...mobile } },
  ],
});
