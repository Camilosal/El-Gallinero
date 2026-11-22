import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  filterNavigationGroups,
  searchEntries,
  searchNavigation,
} from "@/lib/navigation";
import { buildScaleDefaultFlags } from "@/lib/onboarding";
import { resolveDashboardBreadcrumb } from "@/lib/breadcrumbs";

/**
 * Candado anti-regresión de la armonización (Task E1 del plan de cierre
 * de Rutas 1–2): toda página real bajo src/app/(app)/ debe ser descubrible
 * por menús/buscador (searchEntries) o ser una ruta legacy que redirige a
 * su vista canónica (REDIRECT_MAP). Una página nueva sin entrada ni
 * redirect documentado hace fallar esta prueba.
 */

const APP_DIR = path.join(process.cwd(), "src/app/(app)");

function listAppRoutes(dir: string, base = ""): string[] {
  const routes: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
    const childBase = `${base}${segment}`;
    const childDir = path.join(dir, entry.name);
    if (fs.existsSync(path.join(childDir, "page.tsx"))) {
      routes.push(childBase || "/");
    }
    routes.push(...listAppRoutes(childDir, childBase));
  }
  return routes;
}

// Rutas legacy que redirigen a su vista canónica (verificadas contra el código).
const REDIRECT_MAP: Record<string, string> = {
  "/produccion/huevos": "/produccion?tab=huevos",
  "/produccion/gallinas": "/produccion?tab=animales&subtab=gallinas",
  "/produccion/pollos": "/produccion?tab=animales&subtab=pollos",
  "/produccion/alimentacion": "/produccion?tab=alimentacion",
  "/produccion/incubacion": "/produccion?tab=incubacion",
  "/produccion/sacrificio": "/produccion?tab=carne",
  "/operaciones/gallinaza": "/produccion?tab=gallinaza",
  "/inventarios": "/inventarios/balance",
  "/operaciones": "/almacen",
};

// Rutas dinámicas cubiertas por su listado padre (detalle alcanzable desde ahí).
const DYNAMIC_PARENT: Record<string, string> = {
  "/manual/[slug]": "/manual",
  "/produccion/gallinas/[id]": "/produccion?tab=animales",
  "/ubicaciones/[id]": "/ubicaciones",
};

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("E1 · Cobertura total de páginas en menús y buscador", () => {
  const routes = listAppRoutes(APP_DIR);
  const entryHrefs = new Set(searchEntries.map((entry) => entry.href));

  it("toda ruta estática tiene entrada de búsqueda o redirect legacy documentado", () => {
    const uncovered: string[] = [];
    for (const route of routes) {
      if (route.includes("[")) continue; // dinámicas: cubiertas por DYNAMIC_PARENT
      if (entryHrefs.has(route)) continue;
      if (REDIRECT_MAP[route]) continue;
      uncovered.push(route);
    }
    expect(uncovered, `Páginas sin entrada de navegación ni redirect: ${uncovered.join(", ")}`).toEqual([]);
  });

  it("cada redirect legacy apunta realmente a su vista canónica y esta es buscable", () => {
    for (const [legacy, canonical] of Object.entries(REDIRECT_MAP)) {
      const source = readRepoFile(`src/app/(app)${legacy}/page.tsx`);
      expect(source, `${legacy} debe redirigir a ${canonical}`).toContain(`redirect("${canonical}")`);
      expect(entryHrefs.has(canonical), `${canonical} debe existir en searchEntries`).toBe(true);
    }
  });

  it("las rutas dinámicas están cubiertas por su listado padre", () => {
    for (const [dynamic, parent] of Object.entries(DYNAMIC_PARENT)) {
      expect(routes).toContain(dynamic);
      expect(entryHrefs.has(parent), `${parent} debe cubrir ${dynamic}`).toBe(true);
    }
  });

  it("el menú de la app consume filterNavigationGroups(flags), nunca la lista cruda con flags", () => {
    const sidebar = readRepoFile("src/components/Sidebar.tsx");
    expect(sidebar).toContain("filterNavigationGroups(flags, role)");
    const search = readRepoFile("src/components/GlobalSearch.tsx");
    expect(search).toContain("searchNavigation(query, 12, flags, role)");
    expect(search).toContain("lockedByFlag");
    // El hito de desbloqueo se renderiza junto al candado (no solo "Por desbloquear").
    expect(search).toContain("autoTriggerDescription");
  });

  it("gating coherente para PEQUENO: fuera del menú, con candado e hito en búsqueda", () => {
    const flags = buildScaleDefaultFlags("PEQUENO");
    const groups = filterNavigationGroups(flags);
    const menuHrefs = groups.flatMap((group) => group.items.map((item) => item.href));
    expect(menuHrefs).not.toContain("/sanidad/bioseguridad");

    const results = searchNavigation("bioseguridad", 12, flags);
    const locked = results.find((entry) => entry.href === "/sanidad/bioseguridad");
    expect(locked?.lockedByFlag).toBe("auditoria_poe_gab_ica");
  });

  it("breadcrumbs correctos para las rutas nuevas de la ola", () => {
    const adopcion = resolveDashboardBreadcrumb("/analisis/adopcion");
    expect(adopcion[adopcion.length - 1].label).toBe("Adopción y hábitos");
    expect(adopcion.some((item) => item.href === "/analisis")).toBe(true);

    const peso = resolveDashboardBreadcrumb("/produccion/peso");
    expect(peso[peso.length - 1].label).toBe("Control de peso y biometría");
  });
});

describe("E2 · Sinónimos de campo y lenguaje de baja apropiación", () => {
  const anchors: Array<[string, string]> = [
    ["cuadernillo", "/inicio"],
    ["anotar", "/inicio"],
    ["captura rapida", "/inicio"],
    ["plata del día", "/finanzas/ventas"],
    ["se me murieron", "/produccion/mortalidad"],
    ["la comida se acaba", "/inventarios/alimentacion"],
    ["vacuna que toca", "/sanidad/calendario"],
    ["el huevo está pequeño", "/produccion?tab=huevos"],
    ["factura del concentrado", "/finanzas/egresos"],
    ["telegram", "/configuracion/modulos"],
    ["mcp", "/exportar?tab=conectores"],
    ["conectar mi agente", "/exportar?tab=conectores"],
    ["adopcion", "/analisis/adopcion"],
    ["control de peso", "/produccion/peso"],
  ];

  for (const [query, expectedHref] of anchors) {
    it(`"${query}" devuelve ${expectedHref} en top-3`, () => {
      const results = searchNavigation(query, 3);
      expect(
        results.some((entry) => entry.href === expectedHref),
        `Top-3 para "${query}": ${results.map((entry) => entry.href).join(", ")}`,
      ).toBe(true);
    });
  }
});