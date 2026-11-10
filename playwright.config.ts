import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? undefined : 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testDir: "./tests/e2e",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium desktop",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile chrome",
      use: {
        ...devices["Pixel 5"],
        storageState: "tests/e2e/.auth/user.json",
      },
      dependencies: ["setup"],
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
