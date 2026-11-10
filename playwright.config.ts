import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? undefined : 1,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4327",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: "npm run start",
        port: 4327,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
