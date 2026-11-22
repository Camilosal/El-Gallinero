import { describe, expect, it, vi } from "vitest";
import {
  classifyContactLeadWithJev,
  classifyOcrDocumentWithJev,
  disambiguateSearchWithJev,
  suggestOnboardingFromTextWithJev,
  triageBugReportWithJev,
} from "@/lib/agent/jev-capabilities";
import { ICA_VETERINARY_VADEMECUM } from "@/lib/external-sources/wave2-standards-sanitary-ica";

const env = { ASSISTANT_JEV_ROUTING: "true", TYPESAFE_API_KEY: "test-key" };
const disabledEnv = { ASSISTANT_JEV_ROUTING: "false" };

function jevAnswer(answers: Record<string, unknown>, model = "jev-latest", status = 200) {
  return new Response(JSON.stringify({ model, answers }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Capacidades JEV distribuidas fuera del agente", () => {
  it("1. OCR auto-detecta factura y sugiere categoría + especie", async () => {
    const fetcher = vi.fn(async () =>
      jevAnswer({
        mode_factura: { type: "noul", noul: 0.93 },
        mode_ica: { type: "noul", noul: 0.04 },
        mode_pago: { type: "noul", noul: 0.03 },
        mode_rut: { type: "noul", noul: 0.02 },
        cat_alimento: { type: "noul", noul: 0.95 },
        cat_sanidad: { type: "noul", noul: 0.08 },
        cat_equipos: { type: "noul", noul: 0.02 },
        cat_servicios: { type: "noul", noul: 0.04 },
      }),
    );

    const res = await classifyOcrDocumentWithJev({
      requestedMode: "auto",
      text: "Factura FE-910 Italcol 12 bultos de 40kg concentrado ponedora Total $1.104.000",
      env,
      fetcher: fetcher as typeof fetch,
    });

    expect(res.detectedMode).toBe("factura_compra");
    expect(res.modeAutoDetected).toBe(true);
    expect(res.suggestedExpenseCategory).toBe("alimento");
    expect(res.suggestedSpecies).toBe("gallina");
    expect(res.usedJev).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("1b. OCR etiqueta_ica compara contra vademécum ICA usando rerank", async () => {
    const fetcher = vi.fn(async () =>
      jevAnswer({
        best_match: { type: "choice", choice: "opt_0", probabilities: { opt_0: 0.92 } },
        is_confident: { type: "noul", noul: 0.91 },
      }),
    );

    const res = await classifyOcrDocumentWithJev({
      requestedMode: "etiqueta_ica",
      text: "Frasco Enrofloxacina 10% Reg. ICA 5120-MV solución oral aves",
      vademecumItems: ICA_VETERINARY_VADEMECUM,
      env,
      fetcher: fetcher as typeof fetch,
    });

    expect(res.detectedMode).toBe("etiqueta_ica");
    expect(res.matchedIcaItem?.id).toBe("ica-enro-10");
    expect(res.matchedIcaItem?.icaRegistration).toContain("5120-MV");
  });

  it("2. Triaje de fallas detecta regla de retiro ICA y entrega orientación al usuario", async () => {
    const fetcher = vi.fn(async () =>
      jevAnswer({
        rule_retiro: { type: "noul", noul: 0.91 },
        rule_peps: { type: "noul", noul: 0.1 },
        rule_plan: { type: "noul", noul: 0.05 },
        rule_progresivo: { type: "noul", noul: 0.04 },
        cat_calculo: { type: "noul", noul: 0.1 },
        cat_guardado: { type: "noul", noul: 0.15 },
        cat_acceso: { type: "noul", noul: 0.08 },
        sev_critica: { type: "noul", noul: 0.3 },
      }),
    );

    const res = await triageBugReportWithJev({
      title: "No me deja despachar cubetas hoy",
      description: "Ayer puse antibiótico al galpón 2 y hoy la app no deja vender los huevos de ese lote.",
      userCategory: "ui",
      userSeverity: "alta",
      env,
      fetcher: fetcher as typeof fetch,
    });

    expect(res.usedJev).toBe(true);
    expect(res.suggestedCategory).toBe("norma_dato");
    expect(res.guidance?.isExpectedRule).toBe(true);
    expect(res.guidance?.ruleKey).toBe("retiro_ica");
    expect(res.guidance?.guideHref).toBe("/guia/control-sanitario");
    expect(res.suggestedTags).toContain("regla-retiro_ica");
  });

  it("3. Contacto público clasifica intención, escala estimada y urgencia", async () => {
    const fetcher = vi.fn(async () =>
      jevAnswer({
        intent_llave: { type: "noul", noul: 0.89 },
        intent_mediano: { type: "noul", noul: 0.85 },
        intent_soporte: { type: "noul", noul: 0.05 },
        intent_pqr: { type: "noul", noul: 0.02 },
        es_mediano: { type: "noul", noul: 0.92 },
        es_urgente: { type: "noul", noul: 0.84 },
      }),
    );

    const res = await classifyContactLeadWithJev({
      reason: "llave_en_mano",
      farm: "Avícola San José",
      message: "Tenemos 1800 ponedoras en 3 galpones y necesitamos migración urgente esta semana.",
      env,
      fetcher: fetcher as typeof fetch,
    });

    expect(res.usedJev).toBe(true);
    expect(res.intent).toBe("implementacion_llave_en_mano");
    expect(res.estimatedScale).toBe("mediano");
    expect(res.needsUrgentFollowup).toBe(true);
  });

  it("4. Búsqueda semántica promueve el mejor candidato con JEV", async () => {
    const candidates = [
      {
        id: "c1",
        title: "Control Sanitario",
        summary: "Vacunas, tratamientos y días de carencia",
        href: "/sanidad/control",
      },
      {
        id: "c2",
        title: "Balance Financiero",
        summary: "Ingresos y egresos mensuales",
        href: "/finanzas/balance",
      },
    ];
    const fetcher = vi.fn(async () =>
      jevAnswer({
        best_match: { type: "choice", choice: "opt_0", probabilities: { opt_0: 0.94 } },
        is_confident: { type: "noul", noul: 0.9 },
      }),
    );

    const res = await disambiguateSearchWithJev({
      query: "donde apunto la inyección de las gallinas",
      candidates,
      env,
      fetcher: fetcher as typeof fetch,
    });

    expect(res.usedJev).toBe(true);
    expect(res.suggestions[0]?.id).toBe("c1");
  });

  it("5. Onboarding Día 1 preconfigura escala, especies y cantidades aún sin JEV activo", async () => {
    const offlineRes = await suggestOnboardingFromTextWithJev({
      description: "Tengo 350 gallinas ponedoras, 200 pollos de engorde y necesito reportes para crédito del banco",
      env: disabledEnv,
    });

    expect(offlineRes.usedJev).toBe(false);
    expect(offlineRes.escala).toBe("MEDIANO");
    expect(offlineRes.species).toEqual(expect.arrayContaining(["gallina", "pollo"]));
    expect(offlineRes.unitCountHints.gallina).toBe(350);
    expect(offlineRes.unitCountHints.pollo).toBe(200);
    expect(offlineRes.wantsFormalReports).toBe(true);

    const fetcher = vi.fn(async () =>
      jevAnswer({
        sp_gallina: { type: "noul", noul: 0.91 },
        sp_pollo: { type: "noul", noul: 0.05 },
        sp_codorniz: { type: "noul", noul: 0.03 },
        sp_pato: { type: "noul", noul: 0.02 },
        sp_conejo: { type: "noul", noul: 0.02 },
        sp_cuy: { type: "noul", noul: 0.88 },
        es_mediano: { type: "noul", noul: 0.15 },
        reportes_formales: { type: "noul", noul: 0.2 },
      }),
    );

    const jevRes = await suggestOnboardingFromTextWithJev({
      description: "Granja familiar con aves de huevo y unos curíes en jaula",
      env,
      fetcher: fetcher as typeof fetch,
    });

    expect(jevRes.usedJev).toBe(true);
    expect(jevRes.escala).toBe("PEQUENO");
    expect(jevRes.species).toEqual(expect.arrayContaining(["gallina", "cuy"]));
  });
});
