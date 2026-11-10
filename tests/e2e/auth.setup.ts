// eslint-disable-file
import { test, expect } from "@playwright/test";

test("autenticación guardada", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[placeholder="Ingresa tu usuario"]', "Camilosal");
  await page.fill('input[type="password"]', "Pr@yectos123");
  await page.click('button:has-text("Iniciar Sesión")');
  await expect(page).toHaveURL("/dashboard");
  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
});
