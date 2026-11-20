import {
  callJevSystemOne,
  isJevRoutingEnabled,
  jevRerankCandidates,
  type JevEnvironment,
  type JevQuestion,
} from "./jev-routing";
import { OCR_MODES, type OcrExtractionMode } from "@/lib/attachments-shared";
import type { BugReportCategory, BugReportSeverity } from "@/lib/bug-report";
import type { IcaVademecumItem } from "@/lib/external-sources/wave2-standards-sanitary-ica";
import { normalizeText } from "@/lib/text";

export type FarmSpeciesKey = "gallina" | "pollo" | "codorniz" | "pato" | "conejo" | "cuy";

export interface OcrJevSuggestions {
  detectedMode: OcrExtractionMode;
  modeAutoDetected: boolean;
  suggestedExpenseCategory?: string;
  suggestedSpecies?: string;
  matchedIcaItem?: {
    id: string;
    commercialName: string;
    icaRegistration: string;
    withdrawalDaysEggs: number;
    withdrawalDaysMeat: number;
    contraindicatedInLayingHens: boolean;
  };
  usedJev: boolean;
}

export interface BugTriageGuidance {
  isExpectedRule: boolean;
  ruleKey?: "retiro_ica" | "peps_stock" | "plan_semilla" | "modulo_progresivo";
  title: string;
  message: string;
  guideHref: string;
  guideLabel: string;
}

export interface BugTriageResult {
  suggestedCategory: BugReportCategory;
  suggestedSeverity: BugReportSeverity;
  suggestedTags: string[];
  guidance?: BugTriageGuidance;
  usedJev: boolean;
}

export type ContactLeadIntent =
  | "implementacion_llave_en_mano"
  | "escala_mediano"
  | "soporte_tecnico"
  | "pqr_datos"
  | "consulta_general";

export interface ContactLeadRouting {
  intent: ContactLeadIntent;
  intentLabel: string;
  estimatedScale: "pequeno" | "mediano" | "sin_definir";
  needsUrgentFollowup: boolean;
  usedJev: boolean;
}

export interface SearchSuggestionCandidate {
  id: string;
  title: string;
  summary: string;
  href: string;
  group?: string;
  lockedByFlag?: string;
}

export interface OnboardingSuggestionResult {
  escala: "PEQUENO" | "MEDIANO";
  species: FarmSpeciesKey[];
  wantsFormalReports: boolean;
  unitCountHints: Partial<Record<FarmSpeciesKey, number>>;
  summary: string;
  usedJev: boolean;
}

function getNoul(answers: Record<string, Record<string, unknown>>, key: string): number {
  const val = answers[key]?.noul;
  return typeof val === "number" && Number.isFinite(val) ? val : 0;
}

async function askJevSafely(params: {
  state: Record<string, unknown>;
  questions: Record<string, JevQuestion>;
  env?: JevEnvironment;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ ok: boolean; answers: Record<string, Record<string, unknown>> }> {
  if (!isJevRoutingEnabled(params.env)) {
    return { ok: false, answers: {} };
  }
  try {
    const res = await callJevSystemOne({
      state: params.state,
      questions: params.questions,
      env: params.env,
      fetcher: params.fetcher,
      timeoutMs: params.timeoutMs ?? 2500,
    });
    if (!res?.answers || typeof res.answers !== "object") {
      return { ok: false, answers: {} };
    }
    return { ok: true, answers: res.answers };
  } catch {
    return { ok: false, answers: {} };
  }
}

// ─── 1. OCR: Auto-detección de modo, categoría de gasto y match ICA ───

function inferOcrModeDeterministic(text: string, fileName?: string): OcrExtractionMode {
  const hay = normalizeText(`${text} ${fileName || ""}`);
  if (/(reg\.?\s*ica|tiempo\s+de\s+retiro|retiro|carencia|vacuna|frasco|dosis|antibiotico|newcastle|gumboro)/.test(hay)) {
    return "etiqueta_ica";
  }
  if (/(nequi|daviplata|pse|bancolombia|comprobante|transferencia|envio exitoso|aprobado|ref\.?\s*pago)/.test(hay)) {
    return "comprobante_pago";
  }
  if (/(rut\b|razon social|regimen|camara de comercio|matricula mercantil|cedula|representante legal)/.test(hay)) {
    return "rut_contacto";
  }
  return "factura_compra";
}

function inferExpenseCategoryDeterministic(text: string): {
  category?: string;
  species?: string;
} {
  const hay = normalizeText(text);
  let category: string | undefined;
  if (/(concentrado|bulto|maiz|sorgo|soya|purina|italcol|solla|contegral|alimento|balanceado|forraje|alfalfa)/.test(hay)) {
    category = "alimento";
  } else if (/(vacuna|antibiotico|veterinar|desparasit|desinfect|vitamina|ica|medicamento|enroflox|amoxicil|ivermect)/.test(hay)) {
    category = "sanidad";
  } else if (/(bebedero|comedero|jaula|malla|bomba|incubadora|lampara|nido|cortina|construccion|herramienta|equipo)/.test(hay)) {
    category = "equipos";
  } else if (/(cubeta|empaque|viruta|cascarilla|guante|bolsa|insumo|cal|jabon)/.test(hay)) {
    category = "insumos";
  } else if (/(energia|agua|gas|flete|transporte|jornal|mano de obra|salario|arriendo|internet)/.test(hay)) {
    category = "servicios";
  }

  let species: string | undefined;
  if (/(ponedora|postura|huevo|gallina)/.test(hay)) species = "gallina";
  else if (/(engorde|broiler|pollito|pollo)/.test(hay)) species = "pollo";
  else if (/(codorniz|coturniz)/.test(hay)) species = "codorniz";
  else if (/(pato|anade)/.test(hay)) species = "pato";
  else if (/(conejo|cunicultura)/.test(hay)) species = "conejo";
  else if (/(cuy|curi|cobayo)/.test(hay)) species = "cuy";

  return { category, species };
}

function scoreIcaCandidateTokens(text: string, item: IcaVademecumItem): number {
  const hay = normalizeText(text);
  if (!hay) return 0;
  let score = 0;
  const regNorm = normalizeText(item.icaRegistration.replace(/reg\.?\s*ica/gi, ""));
  if (regNorm && hay.includes(regNorm)) score += 100;

  const words = normalizeText(`${item.commercialName} ${item.activeIngredient}`)
    .split(" ")
    .filter((w) => w.length >= 4);
  for (const w of words) {
    if (hay.includes(w)) score += 12;
  }
  return score;
}

export async function classifyOcrDocumentWithJev(params: {
  requestedMode: OcrExtractionMode | "auto";
  text: string;
  fileName?: string;
  vademecumItems?: IcaVademecumItem[];
  env?: JevEnvironment;
  fetcher?: typeof fetch;
}): Promise<OcrJevSuggestions> {
  const modeAutoDetected = params.requestedMode === "auto";
  let detectedMode: OcrExtractionMode = modeAutoDetected
    ? inferOcrModeDeterministic(params.text, params.fileName)
    : (params.requestedMode as OcrExtractionMode);
  let usedJev = false;

  const trimmed = `${params.fileName ? `Archivo: ${params.fileName}\n` : ""}${params.text}`.trim().slice(0, 1800);

  if (trimmed.length >= 6 && isJevRoutingEnabled(params.env)) {
    const questions: Record<string, JevQuestion> = {};
    if (modeAutoDetected) {
      questions.mode_factura = {
        type: "noul",
        instructions: "Does the document text look like a purchase invoice or receipt for feed/supplies in Colombia?",
      };
      questions.mode_ica = {
        type: "noul",
        instructions: "Does the text describe a veterinary drug/vaccine label with ICA registration, dose or withdrawal period?",
      };
      questions.mode_pago = {
        type: "noul",
        instructions: "Does the text represent a bank transfer or mobile payment receipt (Nequi, Daviplata, PSE, Bancolombia)?",
      };
      questions.mode_rut = {
        type: "noul",
        instructions: "Does the text represent a Colombian RUT tax ID certificate or contact identity/supplier profile?",
      };
    }

    if (modeAutoDetected || detectedMode === "factura_compra") {
      questions.cat_alimento = {
        type: "noul",
        instructions: "Is this expense about animal feed, concentrates, corn, forage, or grains?",
      };
      questions.cat_sanidad = {
        type: "noul",
        instructions: "Is this expense about vaccines, medicines, vitamins, disinfectants, or veterinary services?",
      };
      questions.cat_equipos = {
        type: "noul",
        instructions: "Is this expense about equipment, cages, feeders, drinkers, incubators, or farm infrastructure?",
      };
      questions.cat_servicios = {
        type: "noul",
        instructions: "Is this expense about utilities, transport/freight, labor wages, or rent?",
      };
    }

    if (Object.keys(questions).length > 0) {
      const jev = await askJevSafely({
        state: { ocrText: trimmed, requestedMode: params.requestedMode },
        questions,
        env: params.env,
        fetcher: params.fetcher,
      });

      if (jev.ok) {
        usedJev = true;
        if (modeAutoDetected) {
          const candidates: Array<{ mode: OcrExtractionMode; score: number }> = [
            { mode: "factura_compra", score: getNoul(jev.answers, "mode_factura") },
            { mode: "etiqueta_ica", score: getNoul(jev.answers, "mode_ica") },
            { mode: "comprobante_pago", score: getNoul(jev.answers, "mode_pago") },
            { mode: "rut_contacto", score: getNoul(jev.answers, "mode_rut") },
          ];
          candidates.sort((a, b) => b.score - a.score);
          if (candidates[0] && candidates[0].score >= 0.65 && OCR_MODES.includes(candidates[0].mode)) {
            detectedMode = candidates[0].mode;
          }
        }

        if (detectedMode === "factura_compra") {
          const catScores: Array<{ category: string; score: number }> = [
            { category: "alimento", score: getNoul(jev.answers, "cat_alimento") },
            { category: "sanidad", score: getNoul(jev.answers, "cat_sanidad") },
            { category: "equipos", score: getNoul(jev.answers, "cat_equipos") },
            { category: "servicios", score: getNoul(jev.answers, "cat_servicios") },
          ].sort((a, b) => b.score - a.score);

          const det = inferExpenseCategoryDeterministic(trimmed);
          const suggestedExpenseCategory =
            catScores[0] && catScores[0].score >= 0.65 ? catScores[0].category : det.category;

          return {
            detectedMode,
            modeAutoDetected,
            suggestedExpenseCategory,
            suggestedSpecies: det.species,
            usedJev,
          };
        }
      }
    }
  }

  if (detectedMode === "factura_compra") {
    const det = inferExpenseCategoryDeterministic(trimmed);
    return {
      detectedMode,
      modeAutoDetected,
      suggestedExpenseCategory: det.category,
      suggestedSpecies: det.species,
      usedJev,
    };
  }

  if (detectedMode === "etiqueta_ica" && params.vademecumItems?.length && trimmed.length >= 4) {
    const ranked = params.vademecumItems
      .map((item) => ({ item, score: scoreIcaCandidateTokens(trimmed, item) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    let chosen: IcaVademecumItem | undefined = ranked[0]?.item;
    if (ranked.length > 1 && isJevRoutingEnabled(params.env)) {
      const topCandidates = ranked.slice(0, 6).map(({ item }) => ({
        id: item.id,
        title: `${item.commercialName} (${item.icaRegistration})`,
        summary: `${item.activeIngredient}. Especies: ${item.species.join(", ")}. Retiro huevo ${item.withdrawalDaysEggs}d, carne ${item.withdrawalDaysMeat}d.`,
      }));
      const winnerId = await jevRerankCandidates({
        query: trimmed.slice(0, 400),
        candidates: topCandidates,
        env: params.env,
        fetcher: params.fetcher,
      });
      if (winnerId) {
        usedJev = true;
        chosen = ranked.find((r) => r.item.id === winnerId)?.item ?? chosen;
      }
    }

    if (chosen) {
      return {
        detectedMode,
        modeAutoDetected,
        matchedIcaItem: {
          id: chosen.id,
          commercialName: chosen.commercialName,
          icaRegistration: chosen.icaRegistration,
          withdrawalDaysEggs: chosen.withdrawalDaysEggs,
          withdrawalDaysMeat: chosen.withdrawalDaysMeat,
          contraindicatedInLayingHens: chosen.contraindicatedInLayingHens,
        },
        usedJev,
      };
    }
  }

  return {
    detectedMode,
    modeAutoDetected,
    usedJev,
  };
}

// ─── 2. Soporte / Fallas: Detección de reglas esperadas y pre-clasificación ───

const RULE_GUIDANCE_MAP: Record<
  NonNullable<BugTriageGuidance["ruleKey"]>,
  Omit<BugTriageGuidance, "isExpectedRule" | "ruleKey">
> = {
  retiro_ica: {
    title: "Bloqueo sanitario por tiempo de retiro (carencia)",
    message:
      "Si aplicaste recientemente un medicamento o vacuna con días de carencia, el sistema bloquea la venta o salida comercial de huevos/carne durante esos días para cumplir el control sanitario ICA.",
    guideHref: "/guia/control-sanitario",
    guideLabel: "Ver guía de carencia y tratamientos",
  },
  peps_stock: {
    title: "Control de inventario PEPS (Primero en entrar, primero en salir)",
    message:
      "Las ventas y consumos validan existencias reales por lote/clasificación o bultos disponibles en bodega para evitar saldos negativos.",
    guideHref: "/guia/inventario-huevos",
    guideLabel: "Ver cómo funciona el inventario PEPS",
  },
  plan_semilla: {
    title: "Límite o alcance del plan actual",
    message:
      "Los roles controlan el acceso a módulos; el plan Gratis, Productor o Agregador define los cupos de uso aplicables. Algunas capacidades aún requieren activación progresiva o no están disponibles en la aplicación.",
    guideHref: "/planes",
    guideLabel: "Comparar planes y alcances",
  },
  modulo_progresivo: {
    title: "Activación progresiva según tu escala y operación",
    message:
      "Para mantener la pantalla limpia en campo, ciertos módulos avanzados aparecen cuando tu granja registra su escala mediana o alcanza los primeros hitos operativos (o activándolos en Configuración).",
    guideHref: "/guia/escala-y-modulos",
    guideLabel: "Ver guía de escala y módulos",
  },
};

function inferBugHeuristic(text: string, userCategory: BugReportCategory, userSeverity: BugReportSeverity): BugTriageResult {
  const hay = normalizeText(text);
  let ruleKey: BugTriageGuidance["ruleKey"] | undefined;

  if (/(no.*deja.*vender.*huevo|carencia|retiro|medicamento.*bloque|vacuna.*huevo|tiempo de retiro)/.test(hay)) {
    ruleKey = "retiro_ica";
  } else if (/(peps|sin stock|no hay inventario|no alcanza.*bulto|saldo negativo|no deja sacar.*huevo)/.test(hay)) {
    ruleKey = "peps_stock";
  } else if (/(plan semilla|prueba de 30|upgrade|bloqueado por plan|limite de aves)/.test(hay)) {
    ruleKey = "plan_semilla";
  } else if (/(no me aparece.*modulo|no veo.*seccion|progresiv|oculto.*menu|no sale.*cierre|escala)/.test(hay)) {
    ruleKey = "modulo_progresivo";
  }

  let suggestedCategory = userCategory;
  if (ruleKey === "retiro_ica" || ruleKey === "peps_stock") {
    suggestedCategory = "norma_dato";
  } else if (/(calcul|formula|fcr|porcentaje|margen|punto de equilibrio|peso)/.test(hay)) {
    suggestedCategory = "calculo";
  } else if (/(no guarda|error 500|cola offline|sincroniz|se borro)/.test(hay)) {
    suggestedCategory = "guardado";
  } else if (/(login|sesion|permiso|403|401|no puedo entrar|rol)/.test(hay)) {
    suggestedCategory = "acceso";
  } else if (/(ojala|sugerencia|agregar|nuevo boton|mejorar)/.test(hay)) {
    suggestedCategory = "mejora";
  }

  let suggestedSeverity = userSeverity;
  if (/(bloquea todo|no puedo trabajar|se perdio|datos perdidos|pantalla en blanco|error 500)/.test(hay)) {
    suggestedSeverity = "critica";
  }

  const tags = [`cat-${suggestedCategory}`, `sev-${suggestedSeverity}`];
  if (ruleKey) tags.push(`regla-${ruleKey}`);

  return {
    suggestedCategory,
    suggestedSeverity,
    suggestedTags: tags,
    guidance: ruleKey
      ? { isExpectedRule: true, ruleKey, ...RULE_GUIDANCE_MAP[ruleKey] }
      : undefined,
    usedJev: false,
  };
}

export async function triageBugReportWithJev(params: {
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  originModule?: string;
  userCategory: BugReportCategory;
  userSeverity: BugReportSeverity;
  env?: JevEnvironment;
  fetcher?: typeof fetch;
}): Promise<BugTriageResult> {
  const combinedText = [
    params.title,
    params.description,
    params.stepsToReproduce ? `Pasos: ${params.stepsToReproduce}` : "",
    params.expectedBehavior ? `Esperado: ${params.expectedBehavior}` : "",
    params.originModule ? `Módulo: ${params.originModule}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1800);

  const heuristic = inferBugHeuristic(combinedText, params.userCategory, params.userSeverity);
  if (!isJevRoutingEnabled(params.env) || combinedText.length < 10) {
    return heuristic;
  }

  const jev = await askJevSafely({
    state: { bugReport: combinedText },
    questions: {
      rule_retiro: {
        type: "noul",
        instructions:
          "Is the user complaining that the app blocks selling eggs/meat or consuming products right after applying a veterinary medicine or vaccine (withdrawal period)?",
      },
      rule_peps: {
        type: "noul",
        instructions:
          "Is the user complaining that the app blocks a sale or feed deduction because inventory stock (PEPS batches or bags) shows insufficient quantity?",
      },
      rule_plan: {
        type: "noul",
        instructions:
          "Is the user asking why a usage quota is limited by their commercial plan, or why a module is unavailable because of their role or progressive activation?",
      },
      rule_progresivo: {
        type: "noul",
        instructions:
          "Is the user saying a module or menu option is missing because it is hidden by farm scale or progressive onboarding activation?",
      },
      cat_calculo: {
        type: "noul",
        instructions: "Does the report describe a wrong math calculation, KPI, weight standard, margin, or financial balance?",
      },
      cat_guardado: {
        type: "noul",
        instructions: "Does the report describe data failing to save, offline sync failures, or server 500 errors?",
      },
      cat_acceso: {
        type: "noul",
        instructions: "Does the report describe login, password, role permission, or authorization issues?",
      },
      sev_critica: {
        type: "noul",
        instructions: "Does this issue completely block farm daily recording, crash the screen, or cause data loss?",
      },
    },
    env: params.env,
    fetcher: params.fetcher,
  });

  if (!jev.ok) return heuristic;

  const ruleCandidates: Array<{ key: NonNullable<BugTriageGuidance["ruleKey"]>; score: number }> = (
    [
      { key: "retiro_ica", score: getNoul(jev.answers, "rule_retiro") },
      { key: "peps_stock", score: getNoul(jev.answers, "rule_peps") },
      { key: "plan_semilla", score: getNoul(jev.answers, "rule_plan") },
      { key: "modulo_progresivo", score: getNoul(jev.answers, "rule_progresivo") },
    ] satisfies Array<{ key: NonNullable<BugTriageGuidance["ruleKey"]>; score: number }>
  ).sort((a, b) => b.score - a.score);

  const detectedRuleKey =
    ruleCandidates[0] && ruleCandidates[0].score >= 0.78
      ? ruleCandidates[0].key
      : heuristic.guidance?.ruleKey;

  let suggestedCategory = heuristic.suggestedCategory;
  if (detectedRuleKey === "retiro_ica" || detectedRuleKey === "peps_stock") {
    suggestedCategory = "norma_dato";
  } else if (getNoul(jev.answers, "cat_guardado") >= 0.78) {
    suggestedCategory = "guardado";
  } else if (getNoul(jev.answers, "cat_calculo") >= 0.78) {
    suggestedCategory = "calculo";
  } else if (getNoul(jev.answers, "cat_acceso") >= 0.78) {
    suggestedCategory = "acceso";
  }

  const suggestedSeverity: BugReportSeverity =
    getNoul(jev.answers, "sev_critica") >= 0.85 ? "critica" : heuristic.suggestedSeverity;

  const suggestedTags = Array.from(
    new Set([
      `cat-${suggestedCategory}`,
      `sev-${suggestedSeverity}`,
      ...(detectedRuleKey ? [`regla-${detectedRuleKey}`] : []),
    ]),
  );

  return {
    suggestedCategory,
    suggestedSeverity,
    suggestedTags,
    guidance: detectedRuleKey
      ? { isExpectedRule: true, ruleKey: detectedRuleKey, ...RULE_GUIDANCE_MAP[detectedRuleKey] }
      : undefined,
    usedJev: true,
  };
}

// ─── 3. Contacto público: Enrutamiento comercial / soporte / PQR ───

const LEAD_INTENT_LABELS: Record<ContactLeadIntent, string> = {
  implementacion_llave_en_mano: "Implementación llave en mano",
  escala_mediano: "Granja mediana / Multi-galpón",
  soporte_tecnico: "Soporte técnico o acceso",
  pqr_datos: "PQR o datos personales (Ley 1581)",
  consulta_general: "Consulta general",
};

function inferContactLeadHeuristic(params: {
  reason: string;
  farm?: string;
  message: string;
}): ContactLeadRouting {
  const hay = normalizeText(`${params.reason} ${params.farm || ""} ${params.message}`);
  let intent: ContactLeadIntent = "consulta_general";
  if (/(llave en mano|acompanamiento|migracion|implantacion)/.test(hay) || params.reason === "llave_en_mano") {
    intent = "implementacion_llave_en_mano";
  } else if (/(pqr|datos personales|ley 1581|habeas|retracto|eliminacion de cuenta|reclamo)/.test(hay) || params.reason === "pqr") {
    intent = "pqr_datos";
  } else if (/(error|no puedo entrar|falla|soporte|ayuda tecnica|clave|recuperar)/.test(hay) || params.reason === "soporte") {
    intent = "soporte_tecnico";
  } else if (/(mediano|varios galpones|varias fincas|dian|socio|comercial|1000|2000|5000)/.test(hay) || params.reason === "demo") {
    intent = "escala_mediano";
  }

  let estimatedScale: ContactLeadRouting["estimatedScale"] = "sin_definir";
  const countMatch = hay.match(/(\d{2,6})\s*(aves|gallinas|pollos|ponedoras|codornices|animales)/);
  if (countMatch) {
    const qty = Number(countMatch[1]);
    estimatedScale = qty >= 500 ? "mediano" : "pequeno";
  } else if (/(varios galpones|multi-galpon|empresa|asociacion|cooperativa|comercial)/.test(hay)) {
    estimatedScale = "mediano";
  } else if (/(familiar|traspatio|pequena|pocas|casa)/.test(hay)) {
    estimatedScale = "pequeno";
  }

  const needsUrgentFollowup =
    intent === "pqr_datos" ||
    /(urgente|hoy|bloquead|no funciona|no puedo|perdida|cotizacion inmediata)/.test(hay);

  return {
    intent,
    intentLabel: LEAD_INTENT_LABELS[intent],
    estimatedScale,
    needsUrgentFollowup,
    usedJev: false,
  };
}

export async function classifyContactLeadWithJev(params: {
  reason: string;
  farm?: string;
  message: string;
  env?: JevEnvironment;
  fetcher?: typeof fetch;
}): Promise<ContactLeadRouting> {
  const heuristic = inferContactLeadHeuristic(params);
  if (!isJevRoutingEnabled(params.env) || params.message.trim().length < 8) {
    return heuristic;
  }

  const jev = await askJevSafely({
    state: {
      reason: params.reason,
      farm: params.farm || "",
      message: params.message.slice(0, 1500),
    },
    questions: {
      intent_llave: {
        type: "noul",
        instructions: "Is the contact asking for turnkey implementation, assisted migration, or paid onboarding setup?",
      },
      intent_mediano: {
        type: "noul",
        instructions: "Does the contact operate a medium or commercial-scale multi-barn farm needing demo, DIAN reports, or team roles?",
      },
      intent_soporte: {
        type: "noul",
        instructions: "Is the contact reporting a technical issue, login problem, or requesting customer support?",
      },
      intent_pqr: {
        type: "noul",
        instructions: "Is this a formal complaint, refund request, or personal data privacy request (Ley 1581 / habeas data)?",
      },
      es_mediano: {
        type: "noul",
        instructions: "Does the message imply 500+ birds/animals or multiple production barns?",
      },
      es_urgente: {
        type: "noul",
        instructions: "Does this message require urgent same-day follow-up due to a blocker, legal PQR, or immediate buying readiness?",
      },
    },
    env: params.env,
    fetcher: params.fetcher,
  });

  if (!jev.ok) return heuristic;

  const scores: Array<{ intent: ContactLeadIntent; score: number }> = (
    [
      { intent: "implementacion_llave_en_mano", score: getNoul(jev.answers, "intent_llave") },
      { intent: "escala_mediano", score: getNoul(jev.answers, "intent_mediano") },
      { intent: "soporte_tecnico", score: getNoul(jev.answers, "intent_soporte") },
      { intent: "pqr_datos", score: getNoul(jev.answers, "intent_pqr") },
    ] satisfies Array<{ intent: ContactLeadIntent; score: number }>
  ).sort((a, b) => b.score - a.score);

  const intent = scores[0] && scores[0].score >= 0.72 ? scores[0].intent : heuristic.intent;
  const estimatedScale: ContactLeadRouting["estimatedScale"] =
    getNoul(jev.answers, "es_mediano") >= 0.75
      ? "mediano"
      : heuristic.estimatedScale;
  const needsUrgentFollowup =
    getNoul(jev.answers, "es_urgente") >= 0.78 || heuristic.needsUrgentFollowup;

  return {
    intent,
    intentLabel: LEAD_INTENT_LABELS[intent],
    estimatedScale,
    needsUrgentFollowup,
    usedJev: true,
  };
}

// ─── 4. Búsqueda global y manual: Desambiguación semántica ───

export async function disambiguateSearchWithJev(params: {
  query: string;
  candidates: SearchSuggestionCandidate[];
  env?: JevEnvironment;
  fetcher?: typeof fetch;
}): Promise<{ suggestions: SearchSuggestionCandidate[]; usedJev: boolean }> {
  const pool = params.candidates.slice(0, 6);
  if (pool.length === 0) {
    return { suggestions: [], usedJev: false };
  }

  let usedJev = false;
  let ordered = pool;

  if (isJevRoutingEnabled(params.env)) {
    const winnerId = await jevRerankCandidates({
      query: params.query.slice(0, 240),
      candidates: pool.map((c) => ({ id: c.id, title: c.title, summary: c.summary })),
      env: params.env,
      fetcher: params.fetcher,
    });
    if (winnerId) {
      usedJev = true;
      const winner = pool.find((c) => c.id === winnerId);
      if (winner) {
        ordered = [winner, ...pool.filter((c) => c.id !== winnerId)];
      }
    }
  }

  return {
    suggestions: ordered.slice(0, 3),
    usedJev,
  };
}

// ─── 5. Onboarding Día 1: Preconfiguración desde descripción en lenguaje natural ───

const ALL_SPECIES: FarmSpeciesKey[] = ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"];

const SPECIES_KEYWORDS: Record<FarmSpeciesKey, RegExp> = {
  gallina: /\b(gallina|gallinas|ponedora|ponedoras|postura|huevos?)\b/,
  pollo: /\b(pollo|pollos|pollitos?|engorde|broiler|carne de ave)\b/,
  codorniz: /\b(codorniz|codornices|coturniz)\b/,
  pato: /\b(pato|patos|pata|patas|anade)\b/,
  conejo: /\b(conejo|conejos|coneja|conejas|cunicultura|gazapos?)\b/,
  cuy: /\b(cuy|cuyes|curi|curies|cobayo)\b/,
};

function parseOnboardingHeuristic(description: string): OnboardingSuggestionResult {
  const hay = normalizeText(description);
  const species = ALL_SPECIES.filter((sp) => SPECIES_KEYWORDS[sp].test(hay));
  const unitCountHints: Partial<Record<FarmSpeciesKey, number>> = {};

  for (const sp of ALL_SPECIES) {
    const keywordSource = SPECIES_KEYWORDS[sp].source;
    const regex = new RegExp(`(\\d{1,6})\\s*(?:${keywordSource})`, "i");
    const match = hay.match(regex);
    if (match?.[1]) {
      const qty = Number(match[1]);
      if (Number.isFinite(qty) && qty > 0) {
        unitCountHints[sp] = qty;
        if (!species.includes(sp)) species.push(sp);
      }
    }
  }

  const totalMentioned = Object.values(unitCountHints).reduce((sum, n) => sum + (n ?? 0), 0);
  const escala: "PEQUENO" | "MEDIANO" =
    totalMentioned >= 500 ||
    /\b(mediano|grande|comercial|varios galpones|multi-galpon|tecnificad|empleados|socios)\b/.test(hay)
      ? "MEDIANO"
      : "PEQUENO";

  const wantsFormalReports =
    escala === "MEDIANO" ||
    /\b(dian|credito|banco|contabilidad|finagro|soporte contable|presupuesto|socio)\b/.test(hay);

  const finalSpecies: FarmSpeciesKey[] = species.length > 0 ? species : ["gallina"];

  return {
    escala,
    species: finalSpecies,
    wantsFormalReports,
    unitCountHints,
    summary: `Sugerencia: escala ${escala === "MEDIANO" ? "Mediana" : "Pequeña"} · ${finalSpecies.join(", ")}`,
    usedJev: false,
  };
}

export async function suggestOnboardingFromTextWithJev(params: {
  description: string;
  env?: JevEnvironment;
  fetcher?: typeof fetch;
}): Promise<OnboardingSuggestionResult> {
  const text = params.description.trim().slice(0, 800);
  const heuristic = parseOnboardingHeuristic(text);
  if (!text || !isJevRoutingEnabled(params.env)) {
    return heuristic;
  }

  const jev = await askJevSafely({
    state: { farmDescription: text },
    questions: {
      sp_gallina: { type: "noul", instructions: "Does the farm raise laying hens or produce chicken eggs?" },
      sp_pollo: { type: "noul", instructions: "Does the farm raise broiler or meat chickens?" },
      sp_codorniz: { type: "noul", instructions: "Does the farm raise quails (codornices)?" },
      sp_pato: { type: "noul", instructions: "Does the farm raise ducks (patos)?" },
      sp_conejo: { type: "noul", instructions: "Does the farm raise rabbits (conejos)?" },
      sp_cuy: { type: "noul", instructions: "Does the farm raise guinea pigs (cuyes/curíes)?" },
      es_mediano: {
        type: "noul",
        instructions: "Does the description indicate a medium or commercial farm (500+ birds, multiple barns, or multiple workers)?",
      },
      reportes_formales: {
        type: "noul",
        instructions: "Does the user mention needing accounting, DIAN tax support, bank credit, or formal financial reports?",
      },
    },
    env: params.env,
    fetcher: params.fetcher,
  });

  if (!jev.ok) return heuristic;

  const detectedByJev = ALL_SPECIES.filter(
    (sp) => getNoul(jev.answers, `sp_${sp}`) >= 0.72,
  );
  const mergedSpecies = Array.from(new Set([...detectedByJev, ...heuristic.species]));
  const finalSpecies: FarmSpeciesKey[] = mergedSpecies.length > 0 ? mergedSpecies : ["gallina"];

  const escala: "PEQUENO" | "MEDIANO" =
    getNoul(jev.answers, "es_mediano") >= 0.75 || heuristic.escala === "MEDIANO"
      ? "MEDIANO"
      : "PEQUENO";

  const wantsFormalReports =
    getNoul(jev.answers, "reportes_formales") >= 0.75 || heuristic.wantsFormalReports;

  return {
    escala,
    species: finalSpecies,
    wantsFormalReports,
    unitCountHints: heuristic.unitCountHints,
    summary: `Sugerencia: escala ${escala === "MEDIANO" ? "Mediana" : "Pequeña"} · ${finalSpecies.join(", ")}`,
    usedJev: true,
  };
}
