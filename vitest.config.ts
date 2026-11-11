import { defineConfig } from "vitest/config";
import path from "path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
const configuredDatabaseUrl = process.env.DATABASE_URL;
if (configuredDatabaseUrl) {
  const configuredDatabase = decodeURIComponent(new URL(configuredDatabaseUrl).pathname.replace(/^\//, ""));
  if (configuredDatabase === "el_gallinero") {
    throw new Error("Vitest blocked: DATABASE_URL points to the production database. Use an isolated test database.");
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    sequence: { concurrent: false },
    testTimeout: 30000,
  },
});
