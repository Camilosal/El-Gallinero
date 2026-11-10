// eslint-disable-file
import { test, expect } from "@playwright/test";

test("autenticación guardada", async ({ page }) => {
  const username = process.env.E2E_ADMIN_USERNAME || "Camilosal";
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.DEMO_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("Define E2E_ADMIN_PASSWORD (o DEMO_ADMIN_PASSWORD) para ejecutar el flujo E2E autenticado.");
  }

  await page.goto("/login");
  await page.fill('input[placeholder="Ingresa tu usuario"]', username);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Iniciar Sesión")');
  await expect(page).toHaveURL("/dashboard");
  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
});
