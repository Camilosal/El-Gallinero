/**
 * G1 — Matriz de armonización transversal (plan 2026-11-17, cierre Rutas 1–2).
 *
 * 1. Toda funcionalidad es descubrible por 3 vías: menú/búsqueda, guía o
 *    conocimiento del agente, y ≥1 herramienta del agente que la consulta/registra.
 * 2. Toda herramienta del agente está enrutada (dominio Jev o transversal
 *    declarada) y aparece en los manifiestos v1/MCP cuando el scope lo permite.
 * 3. Gating coherente para PEQUENO: ruta bloqueada por flag fuera del menú,
 *    con candado en búsqueda, rechazada por el agente con explicación de hito
 *    y nunca recomendada por el briefing proactivo.
 *
 * La prueba imprime la matriz de cobertura y falla ante cualquier hueco.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/species-db", () => ({
  normalizeSpecies: (value: string) => String(value || "").trim().toLowerCase() || null,
  speciesLabel: (species: string) => species,
}));

import {
  CONFIGURACION_MENU_GROUP,
  filterNavigationGroups,
  navigationGroups,
  searchEntries,
  searchNavigation,
} from "@/lib/navigation";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { TOOL_ROUTES } from "@/lib/agent/jev-routing";
import { getKnowledgeCorpus } from "@/lib/agent/knowledge";
import {
  PROGRESSIVE_ROUTE_GATES,
  buildScaleDefaultFlags,
} from "@/lib/onboarding";
import { agentToolToMcpSchema, manifestEntryToMcpTool } from "@/lib/agent/mcp";
import { hasIntegrationScope } from "@/lib/export/auth";
import { effectiveRequiresConfirmation, isHardFloorTool } from "@/lib/agent/delegation";
import { filterBriefingFindingsByFlags, type BriefingFinding } from "@/lib/agent/proactive";

/** pathname sin query para cruzar hrefs de menú con relatedHrefs del conocimiento. */
function pathnameOf(href: string): string {
  return href.split("?")[0].split("&")[0];
}

const ALL_GROUPS = [...navigationGroups, CONFIGURACION_MENU_GROUP];
const TOOL_NAMES = new Set(AGENT_TOOLS.map((tool) => tool.name));
const ROUTED_NAMES = new Set(Object.values(TOOL_ROUTES).flat());
/** Transversales declaradas: inyectadas por routeAgentTools fuera de TOOL_ROUTES. */
const TRANSVERSAL_TOOLS = new Set(["navegar_app"]);

/**
 * Matriz canónica módulo → herramientas del agente que lo consultan o registran
 * (derivada de navigationGroups; ≥1 por módulo operativo, varias donde aplica).
 */
const MODULE_TOOLS: Record<string, string[]> = {
  animales: [
    "consultar_aves",
    "consultar_lotes",
    "consultar_trazabilidad_genetica",
    "registrar_adquisicion",
    "registrar_peso",
    "registrar_mortalidad",
    "consultar_ubicaciones",
    "consultar_incubacion",
    "registrar_reproduccion",
  ],
  produccion: [
    "consultar_produccion",
    "registrar_produccion_huevos",
    "registrar_perdida_huevos",
    "registrar_venta_huevos",
    "registrar_sacrificio_carne",
    "ajustar_gallinaza",
  ],
  inventarios: ["consultar_inventario"],
  almacen: [
    "consultar_alimentos",
    "registrar_consumo_alimento",
    "gestionar_alimento",
    "registrar_movimiento_insumo",
    "consultar_activos",
    "gestionar_mantenimiento",
    "registrar_compostaje",
    "registrar_cierre_diario",
    "registrar_lectura_sensor",
  ],
  planeacion: [
    "consultar_calendario_rutinas",
    "completar_rutina_calendario",
    "consultar_plan_parvada",
    "registrar_autoconsumo",
  ],
  sanidad: [
    "consultar_sanidad",
    "registrar_control_sanitario",
    "consultar_bioseguridad",
    "registrar_bioseguridad",
  ],
  finanzas: [
    "consultar_finanzas",
    "registrar_gasto",
    "registrar_ingreso",
    "registrar_venta_animales",
    "consultar_personal_nomina",
    "registrar_pago_personal",
    "consultar_presupuestos",
    "registrar_presupuesto",
    "consultar_cuentas_pendientes",
    "registrar_pago_cuenta",
    "consultar_contactos",
    "registrar_contacto",
  ],
  analisis: [
    "consultar_resumen_granja",
    "consultar_kpis_y_alimentacion",
    "consultar_kpis_adopcion",
    "consultar_contabilidad_analitica",
    "consultar_fuentes_externas",
    "registrar_prorrateo",
  ],
  configuracion: ["consultar_parametros", "consultar_kit_campo", "navegar_app"],
};

describe("G1 · matriz de armonización: descubribilidad por 3 vías", () => {
  it("cada módulo tiene menú/búsqueda, guía o conocimiento y ≥1 herramienta del agente", () => {
    const corpus = getKnowledgeCorpus();
    const matrix: Array<Record<string, string | number | boolean>> = [];
    const gaps: string[] = [];

    for (const group of ALL_GROUPS) {
      const groupHrefs = [group.indexHref, ...group.items.map((item) => item.href)];
      const groupPathnames = new Set(groupHrefs.map(pathnameOf));

      // (a) Menú + búsqueda: el índice y cada ítem existen como entrada de búsqueda con sinónimos.
      const missingSearch = groupHrefs.filter(
        (href) => !searchEntries.some((entry) => entry.href === href && entry.keywords.length > 0),
      );
      if (missingSearch.length > 0) gaps.push(`${group.id}: sin entrada de búsqueda para ${missingSearch.join(", ")}`);

      // (b) Guía o conocimiento: ≥1 documento del corpus enlaza alguna pantalla del módulo.
      const knowledgeDocs = corpus.filter((doc) =>
        doc.relatedHrefs.some((ref) => groupPathnames.has(pathnameOf(ref.href))),
      );
      if (knowledgeDocs.length === 0) gaps.push(`${group.id}: ninguna guía ni documento de conocimiento enlaza el módulo`);

      // (c) Herramientas del agente: todas las declaradas existen y están enrutadas.
      const declaredTools = MODULE_TOOLS[group.id] ?? [];
      if (declaredTools.length === 0) gaps.push(`${group.id}: sin herramientas declaradas en la matriz canónica`);
      const missingTools = declaredTools.filter((name) => !TOOL_NAMES.has(name));
      if (missingTools.length > 0) gaps.push(`${group.id}: herramientas inexistentes ${missingTools.join(", ")}`);
      const unroutedTools = declaredTools.filter(
        (name) => TOOL_NAMES.has(name) && !ROUTED_NAMES.has(name) && !TRANSVERSAL_TOOLS.has(name),
      );
      if (unroutedTools.length > 0) gaps.push(`${group.id}: herramientas sin ruta Jev ${unroutedTools.join(", ")}`);

      matrix.push({
        modulo: group.id,
        pantallas: groupHrefs.length,
        busqueda: missingSearch.length === 0,
        docsConocimiento: knowledgeDocs.length,
        herramientas: declaredTools.length,
        completo: missingSearch.length === 0 && knowledgeDocs.length > 0 && missingTools.length === 0 && unroutedTools.length === 0,
      });
    }

    console.table(matrix);
    expect(gaps).toEqual([]);
  });
});

describe("G1 · toda herramienta está enrutada y expuesta en v1/MCP", () => {
  it("cada AgentTool pertenece a un dominio Jev o es transversal declarada", () => {
    const orphans = AGENT_TOOLS.filter(
      (tool) => !ROUTED_NAMES.has(tool.name) && !TRANSVERSAL_TOOLS.has(tool.name),
    ).map((tool) => tool.name);
    expect(orphans).toEqual([]);
  });

  it("el manifiesto v1 con agent:read + agent:write expone el 100 % de las herramientas con su piso duro", () => {
    const scopes = ["agent:read", "agent:write"];
    const policy = {}; // política por defecto: confirmación según requiresConfirmation de cada herramienta
    const manifest = AGENT_TOOLS.filter((tool) =>
      hasIntegrationScope(scopes, tool.kind === "read" ? "agent:read" : "agent:write"),
    ).map((tool) => ({
      name: tool.name,
      description: tool.description,
      kind: tool.kind,
      requiredScope: tool.kind === "read" ? "agent:read" : "agent:write",
      requiresConfirmation: tool.kind === "write" && effectiveRequiresConfirmation(tool.name, policy),
      hardFloor: isHardFloorTool(tool.name),
      jevDomains: Object.entries(TOOL_ROUTES)
        .filter(([, names]) => names.includes(tool.name))
        .map(([domain]) => domain),
      parameters: tool.parameters,
    }));

    expect(manifest).toHaveLength(AGENT_TOOLS.length);
    for (const entry of manifest) {
      const tool = AGENT_TOOLS.find((item) => item.name === entry.name)!;
      expect(entry.requiredScope).toBe(tool.kind === "read" ? "agent:read" : "agent:write");
      if (tool.kind === "write") {
        expect(entry.requiresConfirmation).toBe(effectiveRequiresConfirmation(tool.name, policy));
      } else {
        expect(entry.requiresConfirmation).toBe(false);
      }
      // Toda herramienta no transversal declara al menos un dominio Jev en el manifiesto.
      if (!TRANSVERSAL_TOOLS.has(entry.name)) expect(entry.jevDomains.length).toBeGreaterThan(0);
    }
  });

  it("con solo agent:read el manifiesto v1 excluye toda escritura", () => {
    const readOnly = AGENT_TOOLS.filter((tool) => hasIntegrationScope(["agent:read"], tool.kind === "read" ? "agent:read" : "agent:write"));
    expect(readOnly.length).toBeGreaterThan(0);
    expect(readOnly.every((tool) => tool.kind === "read")).toBe(true);
    expect(readOnly.length).toBeLessThan(AGENT_TOOLS.length);
  });

  it("el servidor MCP deriva sus tools del mismo manifiesto sin perder el aviso de confirmación", () => {
    const policy = {};
    const mcpTools = AGENT_TOOLS.map((tool) => {
      const entry = {
        name: tool.name,
        description: tool.description,
        kind: tool.kind,
        requiredScope: tool.kind === "read" ? "agent:read" : "agent:write",
        requiresConfirmation: tool.kind === "write" && effectiveRequiresConfirmation(tool.name, policy),
        hardFloor: isHardFloorTool(tool.name),
        jevDomains: [],
        parameters: tool.parameters,
      };
      return manifestEntryToMcpTool(entry);
    });

    expect(mcpTools.map((tool) => tool.name).sort()).toEqual(AGENT_TOOLS.map((tool) => tool.name).sort());
    for (const tool of AGENT_TOOLS) {
      const schema = agentToolToMcpSchema(tool);
      expect(schema.inputSchema).toEqual(tool.parameters);
      expect(schema.annotations?.readOnlyHint).toBe(tool.kind === "read");
      const mcp = mcpTools.find((item) => item.name === tool.name)!;
      if (tool.kind === "write" && effectiveRequiresConfirmation(tool.name, policy)) {
        expect(mcp.description).toContain("pendiente");
        expect(mcp.description).toContain("confirmarse");
      }
      if (tool.kind === "write" && !effectiveRequiresConfirmation(tool.name, policy)) {
        expect(mcp.description).toContain("auditada");
      }
    }
  });
});

describe("G1 · gating coherente para PEQUENO en menú, búsqueda, agente y briefing", () => {
  const pequenoFlags = buildScaleDefaultFlags("PEQUENO");
  const medianoFlags = buildScaleDefaultFlags("MEDIANO");

  it("las rutas bloqueadas por flag no aparecen en el menú de un PEQUENO", () => {
    const menu = filterNavigationGroups(pequenoFlags);
    const menuHrefs = new Set(menu.flatMap((group) => [group.indexHref, ...group.items.map((item) => item.href)]));
    for (const rule of PROGRESSIVE_ROUTE_GATES) {
      expect(menuHrefs.has(rule.prefix)).toBe(false);
    }
    // Con MEDIANO todas las rutas gated vuelven al menú.
    const menuMediano = filterNavigationGroups(medianoFlags);
    const medianoHrefs = new Set(menuMediano.flatMap((group) => [group.indexHref, ...group.items.map((item) => item.href)]));
    for (const rule of PROGRESSIVE_ROUTE_GATES) {
      const inMenu = searchEntries.some((entry) => entry.href === rule.prefix) &&
        ALL_GROUPS.some((group) => [group.indexHref, ...group.items.map((item) => item.href)].includes(rule.prefix));
      if (inMenu) expect(medianoHrefs.has(rule.prefix)).toBe(true);
    }
  });

  it("la búsqueda devuelve las rutas bloqueadas con candado (lockedByFlag) y su hito", () => {
    for (const rule of PROGRESSIVE_ROUTE_GATES) {
      const entry = searchEntries.find((item) => item.href === rule.prefix);
      if (!entry) continue; // p. ej. subpestañas sin entrada propia
      const results = searchNavigation(entry.label, 12, pequenoFlags);
      const locked = results.find((item) => item.href === rule.prefix);
      expect(locked, `la búsqueda de "${entry.label}" debe devolver ${rule.prefix}`).toBeTruthy();
      expect(locked!.lockedByFlag).toBe(rule.flag);
    }
  });

  it("navegar_app rechaza la ruta bloqueada con explicación de hito y la desbloquea para MEDIANO", async () => {
    const tool = AGENT_TOOLS.find((item) => item.name === "navegar_app")!;
    const ctxFor = (flags: Record<string, boolean>) => ({
      api: {
        get: vi.fn(async (path: string) => {
          expect(path).toBe("/api/onboarding");
          return { flags };
        }),
        post: vi.fn(),
        put: vi.fn(),
      },
      userId: "test-user",
      userName: "Test User",
    }) as any;

    const pequeno = await tool.execute({ consulta: "bioseguridad" }, ctxFor(pequenoFlags)) as any;
    const locked = pequeno.resultados.find((item: any) => item.href === "/sanidad/bioseguridad");
    expect(locked).toBeTruthy();
    expect(locked.lockedByFlag).toBe("auditoria_poe_gab_ica");
    expect(locked.motivoDesbloqueo).toBeTruthy();
    expect(pequeno.nota).toContain("hito de desbloqueo");

    const mediano = await tool.execute({ consulta: "bioseguridad" }, ctxFor(medianoFlags)) as any;
    const unlocked = mediano.resultados.find((item: any) => item.href === "/sanidad/bioseguridad");
    expect(unlocked).toBeTruthy();
    expect(unlocked.lockedByFlag).toBeNull();
    expect(unlocked.motivoDesbloqueo).toBeNull();
  });

  it("el briefing proactivo nunca recomienda rutas bloqueadas para la escala de la granja", () => {
    const findings: BriefingFinding[] = [
      { code: "presupuesto_desviado", severity: "warning", title: "Presupuesto desviado", detail: "…", href: "/finanzas/presupuestos" },
      { code: "mantenimiento_vencido", severity: "warning", title: "Mantenimiento vencido", detail: "…", href: "/operaciones/mantenimiento" },
      { code: "cierre_pendiente", severity: "info", title: "Cierre pendiente", detail: "…", href: "/operaciones/cierre" },
      { code: "mortalidad_anormal", severity: "critical", title: "Mortalidad anormal", detail: "…", href: "/produccion/mortalidad" },
      { code: "racha_en_riesgo", severity: "info", title: "Racha en riesgo", detail: "…" },
    ];

    const pequeno = filterBriefingFindingsByFlags(findings, pequenoFlags);
    expect(pequeno.map((finding) => finding.code)).toEqual(["mortalidad_anormal", "racha_en_riesgo"]);

    const mediano = filterBriefingFindingsByFlags(findings, medianoFlags);
    expect(mediano).toHaveLength(findings.length);

    // Sin estado de onboarding disponible no se bloquea nada (fallback seguro ya cubierto por triggers).
    expect(filterBriefingFindingsByFlags(findings, null)).toHaveLength(findings.length);
  });
});