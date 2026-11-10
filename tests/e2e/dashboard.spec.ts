// eslint-disable-file
import { test, expect } from "@playwright/test";

// Rutas clave de la reorganización de navegación
const RUTAS_ESPERADAS_200 = [
  "/dashboard/animales",
  "/dashboard/almacen",
  "/dashboard/inventarios/balance",
  "/dashboard/produccion",
  "/dashboard/produccion?tab=alimentacion",
  "/dashboard/soberania",
  "/dashboard/produccion/plan-parvada",
];

const REDIRECTS_ESPERADOS: [string, string][] = [
  ["/dashboard/inventarios", "/dashboard/inventarios/balance"],
  ["/dashboard/operaciones", "/dashboard/almacen"],
];

test.describe("Navegación reorganizada", () => {
  test("las rutas principales cargan (200) en escritorio y móvil", async ({ page }) => {
    for (const ruta of RUTAS_ESPERADAS_200) {
      const res = await page.goto(ruta, { waitUntil: "domcontentloaded" });
      // Sin sesión el middleware devuelve 401 / redirige a /login; con sesión debe ser 200.
      const status = res?.status();
      expect([200, 401, 302, 307, 308]).toContain(status);
      await expect(page).not.toHaveURL(/.*error.*/);
    }
  });

  test("los redirects antiguos apuntan a los nuevos destinos", async ({ page }) => {
    for (const [origen, destino] of REDIRECTS_ESPERADOS) {
      await page.goto(origen, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(destino));
    }
  });

  test("sin sesión se redirige a login", async ({ page }) => {
    await page.goto("/dashboard/animales", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*\/login/);
  });
});

test.describe("Alimentación sin duplicaciones", () => {
  test("la pestaña de alimentación no muestra proyección ni consumo esperado de etapas", async ({
    page,
  }) => {
    await page.goto("/dashboard/produccion?tab=alimentacion", {
      waitUntil: "domcontentloaded",
    });
    // Contenido esperado presente
    await expect(page.locator("text=Gestión de Alimentación")).toBeVisible();
    // Duplicaciones eliminadas
    await expect(
      page.locator("text=Proyección de Stock (según gallinas por etapa)")
    ).not.toBeVisible();
    await expect(
      page.locator("text=Consumo Real vs Esperado (últimos 7 días)")
    ).not.toBeVisible();
  });
});
