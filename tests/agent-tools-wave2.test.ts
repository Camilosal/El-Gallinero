import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/species-db", () => ({
  normalizeSpecies: (value: string) => {
    const species = String(value || "").trim().toLowerCase();
    if (species === "cuy" || species === "cuyes") return "cuy";
    return ["gallina", "gallo", "pollo", "codorniz", "pato", "conejo"].includes(species) ? species : null;
  },
  speciesLabel: (species: string) => species,
}));

import { AGENT_TOOLS } from "@/lib/agent/tools";
import { InternalApiError } from "@/lib/agent/internal-api";
import { TOOL_ROUTES, routeAgentTools } from "@/lib/agent/jev-routing";
import { buildScaleDefaultFlags } from "@/lib/onboarding";
import type { LlmToolDefinition } from "@/lib/agent/llm";

function findTool(name: string) {
  const tool = AGENT_TOOLS.find((item) => item.name === name);
  if (!tool) throw new Error(`No existe la herramienta ${name}`);
  return tool;
}

function context(
  get: (path: string) => Promise<unknown>,
  post: (path: string, body: unknown) => Promise<unknown> = async () => ({ ok: true }),
  put: (path: string, body: unknown) => Promise<unknown> = async () => ({ ok: true }),
) {
  return {
    api: { get: vi.fn(get), post: vi.fn(post), put: vi.fn(put) },
    userId: "test-user",
    userName: "Test User",
  } as any;
}

const personalSeed = {
  profiles: [
    {
      id: "staff-1",
      fullName: "Juan Pérez",
      documentId: "10203040",
      workerKind: "apoyo",
      contractType: "jornal",
      payPeriod: "dia",
      baseRateCop: "60000.00",
      applySocialSecurity: true,
      includeTransportAllowance: true,
      roleLabel: "Galponero",
      defaultSpecies: "gallina",
      isActive: true,
    },
    {
      id: "staff-2",
      fullName: "María Gómez",
      documentId: null,
      workerKind: "productor",
      contractType: "propio",
      payPeriod: "dia",
      baseRateCop: "0.00",
      applySocialSecurity: false,
      includeTransportAllowance: false,
      roleLabel: null,
      defaultSpecies: null,
      isActive: true,
    },
  ],
  monthSummary: {
    monthStart: "2026-11-01",
    ownerImputedMonthCop: 150000,
    ownerCashMonthCop: 0,
    supportCashMonthCop: 600000,
    pendingPayablesMonthCop: 120000,
  },
};

describe("B1 · consultar_personal_nomina", () => {
  it("resume perfiles y nómina del mes con nota de honestidad", async () => {
    const tool = findTool("consultar_personal_nomina");
    expect(tool.kind).toBe("read");
    const ctx = context(async (path) => {
      expect(path).toBe("/api/finanzas/personal");
      return personalSeed;
    });
    const result = (await tool.execute({}, ctx)) as any;
    expect(result.personal).toHaveLength(2);
    expect(result.personal[0]).toMatchObject({
      nombre: "Juan Pérez",
      tipo: "apoyo",
      tarifaBaseCOP: 60000,
      seguridadSocial: true,
      auxilioTransporte: true,
    });
    expect(result.personal[1].tipo).toContain("productor");
    expect(result.resumenMes.pendingPayablesMonthCop).toBe(120000);
    expect(result.nota).toContain("no asesoría");
    expect(result.liquidaciones).toBeUndefined();
  });

  it("incluye liquidaciones recientes cuando se pide, con ventana de días", async () => {
    const tool = findTool("consultar_personal_nomina");
    const paths: string[] = [];
    const ctx = context(async (path) => {
      paths.push(path);
      if (path === "/api/finanzas/personal") return personalSeed;
      return {
        entries: [
          {
            date: "2026-11-10",
            staffName: "Juan Pérez",
            unitsWorked: "2",
            grossPayCop: "120000",
            netPayableCop: "110000",
            totalEmployerCostCop: "150000",
            paymentStatus: "pagado",
            accountingMode: "cash_expense",
            locationName: "Galpón Norte",
          },
        ],
      };
    });
    const result = (await tool.execute({ incluir_liquidaciones: true, dias: 15 }, ctx)) as any;
    expect(paths[1]).toMatch(/^\/api\/finanzas\/personal\/liquidaciones\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
    expect(result.liquidaciones[0]).toMatchObject({
      persona: "Juan Pérez",
      unidades: 2,
      netoCOP: 110000,
      modo: "efectivo",
      lugar: "Galpón Norte",
    });
  });
});

describe("B1 · registrar_pago_personal", () => {
  it("exige confirmación y prepara el pago resolviendo a la persona por nombre", async () => {
    const tool = findTool("registrar_pago_personal");
    expect(tool.kind).toBe("write");
    expect(tool.requiresConfirmation).toBe(true);
    const ctx = context(async () => personalSeed);
    const prepared = await tool.prepare!(
      { persona: "juan pérez", fecha: "2026-11-15", unidades: 2, bonificaciones: 10000 },
      ctx,
    );
    expect(prepared.args).toMatchObject({
      staffId: "staff-1",
      date: "2026-11-15",
      unitsWorked: 2,
      bonusesCop: 10000,
      accountingMode: "cash_expense",
      isCredit: false,
    });
    expect(prepared.summary).toContain("Juan Pérez");
    expect(prepared.summary).toContain("130.000");

    const post = vi.fn(async () => ({ id: "liq-1" }));
    const execCtx = context(async () => personalSeed, post);
    await tool.execute(prepared.args, execCtx);
    expect(post).toHaveBeenCalledWith("/api/finanzas/personal/liquidaciones", prepared.args);
  });

  it("modo imputado no saca caja y modo crédito genera cuenta por pagar con vencimiento", async () => {
    const tool = findTool("registrar_pago_personal");
    const ctx = context(async () => personalSeed);
    const imputado = await tool.prepare!({ persona: "María", modo: "imputado" }, ctx);
    expect(imputado.args).toMatchObject({ accountingMode: "imputed_economic", isCredit: false });
    expect(imputado.summary).toContain("imputado");

    const credito = await tool.prepare!(
      { persona: "Juan", modo: "credito", vencimiento: "2026-12-01" },
      ctx,
    );
    expect(credito.args).toMatchObject({ accountingMode: "cash_expense", isCredit: true, dueDate: "2026-12-01" });
  });

  it("rechaza persona inexistente, ambigua o unidades inválidas", async () => {
    const tool = findTool("registrar_pago_personal");
    const ctx = context(async () => personalSeed);
    await expect(tool.prepare!({ persona: "No Existe" }, ctx)).rejects.toThrow("No encontré personal activo");
    await expect(tool.prepare!({ persona: "a" }, ctx)).rejects.toThrow(); // coincide con varias o ninguna
    await expect(tool.prepare!({ persona: "Juan", unidades: 0 }, ctx)).rejects.toThrow();
    const ambiguo = context(async () => ({
      profiles: [
        { ...personalSeed.profiles[0], id: "s-a", fullName: "Juan Pérez" },
        { ...personalSeed.profiles[0], id: "s-b", fullName: "Juan Gómez" },
      ],
    }));
    await expect(tool.prepare!({ persona: "Juan" }, ambiguo)).rejects.toThrow("coincide con 2 personas");
  });
});

describe("B1 · registrar_presupuesto", () => {
  it("exige confirmación y valida período y rubros antes de crear", async () => {
    const tool = findTool("registrar_presupuesto");
    expect(tool.requiresConfirmation).toBe(true);
    const ctx = context(async () => ({}));
    const prepared = await tool.prepare!(
      {
        nombre: "Presupuesto 2027",
        desde: "2027-01-01",
        hasta: "2027-12-31",
        rubros: [
          { categoria: "alimento", meta_mensual: 800000 },
          { categoria: "medicamentos", meta_mensual: 100000, unidad: "COP" },
        ],
      },
      ctx,
    );
    expect(prepared.args).toMatchObject({
      name: "Presupuesto 2027",
      periodStart: "2027-01-01",
      periodEnd: "2027-12-31",
      type: "mixto",
    });
    expect(prepared.args.items).toHaveLength(2);
    expect((prepared.args.items as any[])[0]).toMatchObject({ category: "alimento", monthlyTarget: 800000 });
    expect(prepared.summary).toContain("900.000");

    const post = vi.fn(async () => ({ id: "bud-1" }));
    await tool.execute(prepared.args, context(async () => ({}), post));
    expect(post).toHaveBeenCalledWith("/api/presupuestos", prepared.args);
  });

  it("rechaza argumentos inválidos", async () => {
    const tool = findTool("registrar_presupuesto");
    const ctx = context(async () => ({}));
    const base = { nombre: "Presupuesto X", desde: "2027-01-01", hasta: "2027-12-31", rubros: [{ categoria: "alimento", meta_mensual: 1 }] };
    await expect(tool.prepare!({ ...base, desde: "2027-12-31", hasta: "2027-01-01" }, ctx)).rejects.toThrow("posterior");
    await expect(tool.prepare!({ ...base, rubros: [] }, ctx)).rejects.toThrow("al menos un rubro");
    await expect(tool.prepare!({ ...base, rubros: [{ categoria: "alimento", meta_mensual: -5 }] }, ctx)).rejects.toThrow();
    await expect(tool.prepare!({ ...base, nombre: "" }, ctx)).rejects.toThrow("nombre");
  });
});

describe("B1 · consultar_fuentes_externas", () => {
  const stateSeed = {
    activeZone: { city: "Medellín", department: "Antioquia", thermalFloor: "templado", altitudeMeters: 1495, coverageLabel: "local" },
    snapshots: [
      { sourceKey: "open_meteo", summary: "ITH 74 hoy, calor moderado", fetchedAt: "2026-11-17T06:00:00Z", isExpired: false, coverageLabel: "Medellín" },
      { sourceKey: "dane_sipsa_trm", summary: "Huevo AA $420/unidad", fetchedAt: "2026-11-16T06:00:00Z", isExpired: false },
    ],
    taxContext: { year: 2026, uvtCop: 52326, retentionPurchasesThresholdCop: 1412802, retentionAgroThresholdCop: 4709340 },
    colombianHolidays: [{ date: "2026-12-08", name: "Inmaculada Concepción" }, { date: "2026-01-01", name: "Año Nuevo (pasado)" }],
    epidemiologicalAlerts: [{ id: "ica-1", title: "Newcastle en zona norte" }],
    ideamHydroAlerts: { alerts: [{ id: "ideam-1", level: "amarilla", river: "Río Cauca" }] },
  };

  it("resume todas las fuentes con zona y descargo de datos públicos", async () => {
    const tool = findTool("consultar_fuentes_externas");
    expect(tool.kind).toBe("read");
    const ctx = context(async (path) => {
      expect(path).toBe("/api/configuracion/fuentes-externas");
      return stateSeed;
    });
    const result = (await tool.execute({}, ctx)) as any;
    expect(result.zona.municipio).toBe("Medellín");
    expect(result.fuentes).toHaveLength(6);
    expect(result.fuentes.find((f: any) => f.fuente === "clima").resumen).toContain("ITH");
    expect(result.fuentes.find((f: any) => f.fuente === "macro_banrep").resumen).toContain("Sin datos");
    expect(result.contextoTributario.uvtCOP).toBe(52326);
    expect(result.alertasEpidemiologicasICA).toHaveLength(1);
    expect(result.alertasHidrologicasIDEAM).toHaveLength(1);
    expect(result.nota).toContain("fuentes públicas");
  });

  it("filtra por subconjunto de fuentes y omite festivos pasados", async () => {
    const tool = findTool("consultar_fuentes_externas");
    const ctx = context(async () => stateSeed);
    const result = (await tool.execute({ fuentes: ["clima", "impuestos"] }, ctx)) as any;
    expect(result.fuentes.map((f: any) => f.fuente)).toEqual(["clima", "impuestos"]);
    expect(result.alertasEpidemiologicasICA).toBeUndefined();
    expect(result.contextoTributario.proximosFestivos.every((h: any) => String(h.date) >= new Date().toISOString().slice(0, 10))).toBe(true);
  });
});

describe("B1 · consultar_plan_parvada", () => {
  it("devuelve diagnóstico en vivo, planes y proyección con nota biológica", async () => {
    const tool = findTool("consultar_plan_parvada");
    const ctx = context(async (path) => {
      expect(path).toBe("/api/produccion/plan-parvada");
      return {
        live: { posturaPct: 82, edadPromedioSemanas: 34 },
        plans: [{ id: "plan-1", name: "Postura 2026", progressPct: 60 }],
        projection: { semanas: [{ semana: 1, huevos: 900 }] },
      };
    });
    const result = (await tool.execute({}, ctx)) as any;
    expect(result.diagnosticoEnVivo.posturaPct).toBe(82);
    expect(result.planes).toHaveLength(1);
    expect(result.proyeccionSemanal.semanas[0].huevos).toBe(900);
    expect(result.nota).toContain("estimación biológica");
  });
});

describe("B1 · consultar_kpis_adopcion", () => {
  it("rechaza roles operativos con mensaje claro", async () => {
    const tool = findTool("consultar_kpis_adopcion");
    const ctx = context(async (path) => {
      expect(path).toBe("/api/auth/me");
      return { id: "u-1", role: "operario" };
    });
    const result = (await tool.execute({}, ctx)) as any;
    expect(result.rechazado).toBe(true);
    expect(result.mensaje).toContain("/analisis/adopcion");
  });

  it("entrega KPIs, metas y tablero a propietario/admin", async () => {
    const tool = findTool("consultar_kpis_adopcion");
    const paths: string[] = [];
    const ctx = context(async (path) => {
      paths.push(path);
      if (path === "/api/auth/me") return { id: "u-1", role: "propietario" };
      return { capturaMedianaSegundos: 95, adherenciaSemanalPct: 88 };
    });
    const result = (await tool.execute({}, ctx)) as any;
    expect(paths).toContain("/api/analisis/kpis-adopcion");
    expect(result.capturaMedianaSegundos).toBe(95);
    expect(result.metas.adherenciaSemanal).toContain("85%");
    expect(result.tablero).toBe("/analisis/adopcion");
  });
});

describe("B1 · registrar_perdida_huevos", () => {
  it("es escritura rutinaria automática y descuenta del inventario PEPS", async () => {
    const tool = findTool("registrar_perdida_huevos");
    expect(tool.kind).toBe("write");
    expect(tool.requiresConfirmation).toBe(false);
    const post = vi.fn(async () => ({ id: "loss-1", remaining: 118 }));
    const ctx = context(async () => ({}), post);
    const result = (await tool.execute(
      { cantidad: 4, razon: "rotos", fecha: "2026-11-16", calibre: "aa", notas: "canasta caída" },
      ctx,
    )) as any;
    expect(post).toHaveBeenCalledWith("/api/perdidas-huevos", {
      date: "2026-11-16",
      quantity: 4,
      size: "aa",
      reason: "rotos",
      notes: "canasta caída",
    });
    expect(result.nota).toContain("PEPS");
  });

  it("rechaza cantidad no entera, menor a 1 o razón vacía", async () => {
    const tool = findTool("registrar_perdida_huevos");
    const ctx = context(async () => ({}));
    await expect(tool.execute({ cantidad: 0, razon: "rotos" }, ctx)).rejects.toThrow();
    await expect(tool.execute({ cantidad: 1.5, razon: "rotos" }, ctx)).rejects.toThrow();
    await expect(tool.execute({ cantidad: 2, razon: "  " }, ctx)).rejects.toThrow("razón");
  });
});

describe("B1 · consultar_adjuntos", () => {
  it("consulta metadatos con filtros y reporta solo texto OCR ya extraído", async () => {
    const tool = findTool("consultar_adjuntos");
    const paths: string[] = [];
    const ctx = context(async (path) => {
      paths.push(path);
      return [
        { id: "att-1", entityType: "transaccion", entityId: "tx-1", category: "factura", fileName: "factura-concentrado.pdf", mimeType: "application/pdf", sizeBytes: 204800, createdAt: "2026-11-10", extractedText: "Proveedor: Alimento S.A. Total $850.000", extractedData: { total: 850000 }, notes: null },
        { id: "att-2", entityType: "norma", entityId: "n-1", category: "norma", fileName: "resolucion-ica.pdf", mimeType: "application/pdf", sizeBytes: 1024, createdAt: "2026-10-01", extractedText: null, extractedData: null, notes: "ICA 2023" },
      ];
    });
    const result = (await tool.execute({ categoria: "factura", buscar: "concentrado" }, ctx)) as any;
    expect(paths[0]).toContain("/api/adjuntos?metaOnly=1");
    expect(paths[0]).toContain("category=factura");
    expect(result.total).toBe(1);
    expect(result.adjuntos[0]).toMatchObject({ archivo: "factura-concentrado.pdf", tamanoKB: 200 });
    expect(result.adjuntos[0].textoExtraido).toContain("850.000");
    expect(result.nota).toContain("no inventes");

    const sinFiltro = (await tool.execute({}, ctx)) as any;
    expect(sinFiltro.adjuntos[1].textoExtraido).toBeNull();
  });
});

describe("B1 · consultar_kit_campo", () => {
  it("resume semanas, acta y entregables PDF de la Ruta 2", async () => {
    const tool = findTool("consultar_kit_campo");
    const ctx = context(async (path) => {
      expect(path).toBe("/api/operaciones/entregables-ruta2?tipo=acta-entrega&format=json");
      return {
        farm: { name: "La Esperanza" },
        roadmap: [{ semana: 1, titulo: "Arranque" }, { semana: 4, titulo: "Marcha blanca" }],
        handoverAct: { estado: "pendiente", criterios: ["captura < 2 min"] },
      };
    });
    const result = (await tool.execute({}, ctx)) as any;
    expect(result.granja.name).toBe("La Esperanza");
    expect(result.semanas).toHaveLength(2);
    expect(result.actaEntrega.estado).toBe("pendiente");
    expect(result.entregablesPdf).toHaveLength(4);
    expect(result.nota).toContain("/analisis/adopcion");
  });

  it("rechaza con mensaje claro cuando el rol no tiene acceso (403)", async () => {
    const tool = findTool("consultar_kit_campo");
    const ctx = context(async () => {
      throw new InternalApiError("Forbidden", 403, { error: "sin permiso" });
    });
    const result = (await tool.execute({}, ctx)) as any;
    expect(result.rechazado).toBe(true);
    expect(result.mensaje).toContain("/configuracion/kit-campo");
  });
});

describe("B2 · navegar_app (deep-links exactos)", () => {
  it("devuelve el href exacto de la guía de linaje", async () => {
    const tool = findTool("navegar_app");
    expect(tool.kind).toBe("read");
    expect(tool.requiresConfirmation).toBe(false);
    const ctx = context(async (path) => {
      expect(path).toBe("/api/onboarding");
      return { flags: {} };
    });
    const result = (await tool.execute({ consulta: "linaje" }, ctx)) as any;
    expect(result.resultados.some((r: any) => r.href === "/manual/trazabilidad-genetica")).toBe(true);
    expect(result.resultados[0]).toHaveProperty("label");
    expect(result.resultados[0]).toHaveProperty("group");
  });

  it("marca rutas bloqueadas para escala PEQUENO con el hito de desbloqueo", async () => {
    const tool = findTool("navegar_app");
    const flags = buildScaleDefaultFlags("PEQUENO");
    const ctx = context(async () => ({ flags }));
    const result = (await tool.execute({ consulta: "bioseguridad" }, ctx)) as any;
    const locked = result.resultados.find((r: any) => r.lockedByFlag);
    expect(locked).toBeTruthy();
    expect(locked.motivoDesbloqueo).toBeTruthy();
    expect(locked.motivoDesbloqueo.length).toBeGreaterThan(10);
  });

  it("no inventa rutas: consulta vacía devuelve error y sin coincidencias lo dice", async () => {
    const tool = findTool("navegar_app");
    const ctx = context(async () => ({ flags: {} }));
    const vacio = (await tool.execute({ consulta: "  " }, ctx)) as any;
    expect(vacio.error).toBeTruthy();
    const sinMatch = (await tool.execute({ consulta: "zzzzqqqxx" }, ctx)) as any;
    expect(sinMatch.resultados).toHaveLength(0);
    expect(sinMatch.nota).toContain("No inventes rutas");
  });

  it("sigue funcionando aunque el estado de onboarding no esté disponible", async () => {
    const tool = findTool("navegar_app");
    const ctx = context(async () => {
      throw new InternalApiError("No autenticado", 401, {});
    });
    const result = (await tool.execute({ consulta: "ventas" }, ctx)) as any;
    expect(result.resultados.some((r: any) => r.href.startsWith("/finanzas"))).toBe(true);
  });
});

describe("B1/B2 · cobertura de routing Jev", () => {
  const TRANSVERSAL = new Set(["navegar_app", "consultar_conocimiento", "consultar_memoria_granja", "recordar_dato_granja"]);

  it("toda herramienta del agente pertenece a un dominio Jev o es transversal declarada", () => {
    const routed = new Set<string>(Object.values(TOOL_ROUTES).flat());
    const missing = AGENT_TOOLS.map((t) => t.name).filter((name) => !routed.has(name) && !TRANSVERSAL.has(name));
    expect(missing).toEqual([]);
  });

  it("navegar_app sobrevive al routing de intención única como extra transversal", async () => {
    const tool = (name: string): LlmToolDefinition => ({
      type: "function",
      function: { name, description: name, parameters: { type: "object" } },
    });
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "jev-latest",
          answers: {
            intent: { type: "choice", choice: "finanzas", probabilities: { finanzas: 0.97 } },
            is_one_clear_request: { type: "noul", noul: 0.98 },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await routeAgentTools(
      "¿Cuánto vendí esta semana?",
      [tool("consultar_finanzas"), tool("registrar_venta_huevos"), tool("consultar_aves"), tool("navegar_app")],
      { ASSISTANT_JEV_ROUTING: "true", TYPESAFE_API_KEY: "test-key" },
      fetcher as typeof fetch,
    );
    expect(result.mode).toBe("routed");
    const names = result.tools.map((t) => t.function.name);
    expect(names).toContain("navegar_app");
    expect(names).toContain("consultar_finanzas");
    expect(names).not.toContain("consultar_aves");
  });
});
