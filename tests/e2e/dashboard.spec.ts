// eslint-disable-file
import { test, expect } from "@playwright/test";

// Rutas clave de la reorganización de navegación (requieren sesión)
const RUTAS_ESPERADAS_200 = [
  "/dashboard/animales",
  "/dashboard/almacen",
  "/dashboard/inventarios/balance",
  "/dashboard/produccion",
  "/dashboard/produccion?tab=alimentacion",
  "/dashboard/planeacion",
  "/dashboard/produccion/plan-parvada",
  "/dashboard/soberania",
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
    // /dashboard/inventarios -> /dashboard/inventarios/balance
    await page.goto("/dashboard/inventarios", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/inventarios\/balance/);

    // /dashboard/operaciones -> /dashboard/almacen
    await page.goto("/dashboard/operaciones", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/dashboard\/almacen/);
  });

  test("el grupo Planeación carga como índice de presentación", async ({
    page,
  }) => {
    await page.goto("/dashboard/planeacion", {
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
    await page.goto("/dashboard/produccion?tab=alimentacion", {
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
