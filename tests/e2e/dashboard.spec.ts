// eslint-disable-file
import { test, expect } from "@playwright/test";

// Rutas clave de la reorganización de navegación (requieren sesión)
const RUTAS_ESPERADAS_200 = [
  "/animales",
  "/almacen",
  "/inventarios/balance",
  "/produccion",
  "/produccion?tab=alimentacion",
  "/planeacion",
  "/produccion/plan-parvada",
  "/soberania",
];

test.describe("Navegación reorganizada (autenticado)", () => {
  test("las rutas principales cargan (200) en escritorio y móvil", async ({
    page,
  }) => {
    for (const ruta of RUTAS_ESPERADAS_200) {
      const res = await page.goto(ruta, { waitUntil: "domcontentloaded" });
      const status = res?.status();
      expect([200]).toContain(status);
      await expect(page).not.toHaveURL(/.*error.*/);
    }
  });

  test("los redirects antiguos apuntan a los nuevos destinos", async ({
    page,
  }) => {
    // /inventarios -> /inventarios/balance
    await page.goto("/inventarios", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/inventarios\/balance/);

    // /operaciones -> /almacen
    await page.goto("/operaciones", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/almacen/);
  });

  test("el grupo Planeación carga como índice de presentación", async ({
    page,
  }) => {
    await page.goto("/planeacion", {
      waitUntil: "networkidle",
    });
    // La página debe cargar con título de Planeación
    await expect(page.locator("h1, h2")).toContainText(["Planeación"]);
  });
});

test.describe("Alimentación sin duplicaciones (autenticado)", () => {
  test("la pestaña de alimentación no muestra proyección ni consumo esperado de etapas", async ({
    page,
  }) => {
    await page.goto("/produccion?tab=alimentacion", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("text=Gestión de Alimentación")).toBeVisible();
    await expect(
      page.locator("text=Proyección de Stock (según gallinas por etapa)")
    ).not.toBeVisible();
    await expect(
      page.locator("text=Consumo Real vs Esperado (últimos 7 días)")
    ).not.toBeVisible();
  });
});
