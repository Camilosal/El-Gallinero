import { guideModules, guides, type Guide, type GuideSection } from "@/lib/guide-data";

export interface KnowledgeDocument {
  id: string;
  title: string;
  module: string;
  moduleLabel: string;
  source: "guia" | "norma_tecnica";
  summary: string;
  tags: string[];
  relatedHrefs: { href: string; label: string }[];
  body: string;
  steps: string[];
  warnings: string[];
  tips: string[];
}

export interface KnowledgeMatch {
  id: string;
  title: string;
  module: string;
  moduleLabel: string;
  source: "guia" | "norma_tecnica";
  score: number;
  summary: string;
  steps: string[];
  warnings: string[];
  tips: string[];
  bodyExcerpt: string;
  relatedHrefs: { href: string; label: string }[];
}

interface TechnicalStandardSeed {
  id: string;
  title: string;
  module: string;
  summary: string;
  tags: string[];
  relatedHrefs: { href: string; label: string }[];
  steps: string[];
  warnings: string[];
  tips: string[];
  body: string;
}

const TECHNICAL_STANDARDS: TechnicalStandardSeed[] = [
  {
    id: "std-ntc-1240-huevos",
    title: "Clasificación NTC 1240 de huevo comercial en Colombia y presentaciones de venta",
    module: "produccion",
    summary: "Pesos oficiales NTC 1240 (Jumbo, AAA, AA, A, B, C), equivalencias de cubeta (30) y docena (12), y conservación.",
    tags: ["ntc 1240", "huevo", "calibre", "jumbo", "aaa", "aa", "cubeta", "docena", "clasificacion"],
    relatedHrefs: [
      { href: "/huevos", label: "Producción de Huevos" },
      { href: "/ventas", label: "Ventas y Cartera" },
    ],
    steps: [
      "Clasificar por peso unitario según NTC 1240: Jumbo (> 78 g), AAA (67.0–77.9 g), AA (60.0–66.9 g), A (53.0–59.9 g), B (46.0–52.9 g), C (< 46.0 g).",
      "Registrar por separado huevos aptos y rotos/descarte junto a temperatura (ideal 13–18 °C) y humedad relativa de almacenamiento (70–80 %).",
      "En ventas: 1 cubeta equivale a 30 unidades y 1 docena a 12 unidades. Verificar siempre si el precio pactado es por unidad, docena o cubeta.",
    ],
    warnings: [
      "No comercializar ni mezclar huevos producidos bajo periodo de retiro de medicamentos veterinarios.",
      "No lavar huevos comerciales con agua fría por inmersión porque elimina la cutícula protectora y favorece contaminación.",
    ],
    tips: ["En codorniz o pato, asociar la postura siempre a un lote con destino postura_huevo."],
    body: "Norma Técnica Colombiana NTC 1240 calibres Jumbo AAA AA A B C descartados cubeta 30 docena 12 almacenamiento temperatura humedad",
  },
  {
    id: "std-retiro-sanidad-ica",
    title: "Control sanitario ICA, cadena de frío vacunal (2–8 °C) y días de retiro obligatorios",
    module: "sanidad",
    summary: "Reglas de inocuidad veterinaria, registro de lote ICA, cadena de frío y bloqueos automáticos durante periodo de retiro.",
    tags: ["ica", "retiro", "vacuna", "medicamento", "antibiotico", "cadena frio", "cuarentena", "gsmi"],
    relatedHrefs: [
      { href: "/sanidad", label: "Sanidad y Calendario" },
      { href: "/ubicaciones", label: "Lugares de Manejo" },
    ],
    steps: [
      "Conservar biológicos vacunales en refrigeración continua entre 2 °C y 8 °C sin congelar; registrar temperatura de nevera en cada aplicación.",
      "Documentar producto, laboratorio, lote vacunal, vencimiento, vía de administración, costo e insumos aplicados.",
      "Establecer exactamente los días de retiro indicados en la etiqueta ICA antes de liberar carne, huevos o movilizaciones.",
    ],
    warnings: [
      "Bloqueo estricto de inocuidad: mientras exista un retiro activo no se permite sacrificio/faena ni traslado o venta de animales del lugar/lote afectado.",
      "Para movilización externa de animales fuera del predio se requiere Guía Sanitaria de Movilización Interna (GSMI) ante el ICA.",
    ],
    tips: ["Se puede adjuntar foto de la etiqueta ICA con el modo etiqueta_ica para extraer lote, registro ICA y días de retiro."],
    body: "Reglamento sanitario ICA vacunas desparasitacion tratamientos retiro bloqueo carne huevo traslado cuarentena GSMI etiqueta cold chain 2-8C",
  },
  {
    id: "std-bioseguridad-poe-gab",
    title: "Bioseguridad POE GAB (Res. ICA 3651/3652) y Bienestar Animal (Res. ICA 8452/2025)",
    module: "bioseguridad",
    summary: "Protocolo POE GAB de pediluvios, desinfección, vacío sanitario, visitantes y evaluación de bienestar animal.",
    tags: ["bioseguridad", "poe gab", "3651", "3652", "8452", "bienestar", "vacio sanitario", "desinfeccion"],
    relatedHrefs: [{ href: "/sanidad", label: "Bioseguridad y POE GAB" }],
    steps: [
      "Verificar diariamente pediluvios activos, cambio de solución desinfectante, control de plagas y barreras físicas de acceso.",
      "Separar zonas limpias (almacenamiento de alimento/huevo), de producción, sucias (compostaje/mortalidad) y cuarentena.",
      "Evaluar puntaje de bienestar animal (ventilación, cama seca, densidad, agua limpia, ausencia de lesiones) y registrar score 0–100.",
    ],
    warnings: ["Respetar las fechas de vacío sanitario (sanitaryEmptyUntil) después de desinfecciones profundas antes de ingresar nuevos lotes."],
    tips: ["Capacitaciones del personal y bitácoras de visitantes con certificado vigente fortalecen auditorías ICA."],
    body: "POE GAB Resolucion ICA 3651 3652 Resolucion 8452 2025 bienestar animal desinfeccion pediluvio vacio sanitario zona limpia sucia cuarentena",
  },
  {
    id: "std-compostaje-agrosavia",
    title: "Compostaje de mortalidad y gallinaza/pollinaza/cuyinaza según fórmulas AGROSAVIA",
    module: "compostaje",
    summary: "Relaciones 3:1:1 y 7:2:2, rango termofílico (55–65 °C), humedad (50–60 %) y ciclo de volteos.",
    tags: ["compostaje", "agrosavia", "3:1:1", "7:2:2", "mortalidad", "gallinaza", "volteo", "termofila"],
    relatedHrefs: [{ href: "/gallinaza", label: "Gallinaza y Compostaje" }],
    steps: [
      "Construir la pila por capas alternas siguiendo fórmula AGROSAVIA 3:1:1 o 7:2:2 (gallinaza/pollinaza/cuyinaza : mortalidad : material vegetal seco o cascarilla).",
      "Mantener humedad entre 50 % y 60 % (prueba de puño sin escurrimiento) y alcanzar fase termofílica de 55–65 °C durante al menos 3 días para sanitizar patógenos.",
      "Registrar volteos periódicos para oxigenar la pila y documentar cosecha de abono estabilizado libre de malos olores.",
    ],
    warnings: ["Nunca disponer mortalidad en fuentes hídricas ni a cielo abierto; aislar pilas en zona sucia techada."],
    tips: ["Si la temperatura cae debajo de 45 °C antes de madurar o hay exceso de amoníaco, ajustar material carbonado seco y programar volteo."],
    body: "Compostaje AGROSAVIA 3:1:1 7:2:2 mortalidad aves cuyes conejos gallinaza abono temperatura 55 65 humedad 50 60 volteo cosecha",
  },
  {
    id: "std-ambiente-ith-nh3",
    title: "Control ambiental en galpones: Índice ITH de estrés calórico y amoníaco (NH3)",
    module: "operaciones",
    summary: "Cálculo e interpretación del ITH, umbrales críticos de temperatura, humedad relativa y NH3 ppm en cama.",
    tags: ["ith", "estres calorico", "amoniaco", "nh3", "sensor", "temperatura", "humedad", "ventilacion"],
    relatedHrefs: [{ href: "/operaciones", label: "Sensores y Cierre Diario" }],
    steps: [
      "Registrar lecturas de temperatura (°C), humedad relativa (%) y concentración de amoníaco NH3 (ppm) por galpón o módulo.",
      "El sistema calcula ITH = 1.8·T + 32 − (0.55 − 0.0055·HR)·(1.8·T − 26). ITH ≥ 72 indica alerta moderada; ITH ≥ 78 indica estrés calórico severo.",
      "Ante NH3 ≥ 20 ppm o humedad > 85 %, abrir cortinas/extractores, revisar fugas de bebederos y reacondicionar cama inmediatamente.",
    ],
    warnings: ["Con ITH ≥ 78 suspender traslados o manipulaciones estresantes en horas pico de calor y garantizar agua fresca abundante."],
    tips: ["Monitorear consumo de agua diario permite detectar fallas de confort o inicio de cuadro febril antes que caiga la postura."],
    body: "ITH temperatura humedad relativa amoniaco ppm 20 ventilacion cortinas cama estrés calorico alerta 72 78 confort ambiental",
  },
  {
    id: "std-reproduccion-incubacion",
    title: "Reproducción de conejos/cuyes e incubación artificial/natural de aves",
    module: "produccion",
    summary: "Plazos fisiológicos de gestación en conejas y cuyes, empadre, parto, destete y días de incubación en aves.",
    tags: ["conejo", "cuy", "empadre", "palpacion", "nidal", "parto", "destete", "incubacion", "ovoscopia"],
    relatedHrefs: [{ href: "/reproduccion", label: "Reproducción e Incubación" }],
    steps: [
      "Conejos: gestación promedio 31 días; palpación de diagnóstico días 12–14 post-empadre; colocación de nidal día 27; destete habitual 30–35 días.",
      "Cuyes: gestación ~67 días; parto de crías precoces con pelo y ojos abiertos; destete recomendado entre días 14 y 21 separando machos y hembras.",
      "Incubación avícola: gallina 21 días, codorniz 17 días, pato 28 días. Realizar ovoscopía de fertilidad entre días 7–10 y paso a nacedora 3 días antes de eclosión.",
    ],
    warnings: ["Evitar consanguinidad directa revisando líneas materna y paterna antes de programar empadres o lotes de incubación."],
    tips: ["Registrar peso de camada al nacer y al destete permite calcular ganancia diaria promedio por reproductora."],
    body: "Reproduccion conejos cuyes 31 dias 67 dias palpacion nidal parto destete incubacion gallina 21 codorniz 17 pato 28 ovoscopia",
  },
  {
    id: "std-zootecnia-kpis-finanzas",
    title: "KPIs zootécnicos (EPEF, FCR, CV%, HAA), prorrateo analítico y cierre diario auditable",
    module: "finanzas",
    summary: "Interpretación de EPEF, conversión alimenticia, uniformidad, prorrateos multi-especie y bloqueo de cierre diario.",
    tags: ["epef", "fcr", "conversion", "uniformidad", "prorrateo", "cierre diario", "roi", "presupuesto"],
    relatedHrefs: [
      { href: "/finanzas", label: "Finanzas y Presupuestos" },
      { href: "/operaciones", label: "Cierre Diario" },
    ],
    steps: [
      "Monitorear FCR (kg alimento / unidad producida), HAA (Huevos por Ave Alojada), uniformidad de lote (meta ≥ 80 %, CV% ≤ 10 %) y EPEF en engorde.",
      "Prorratear costos indirectos (energía, mano de obra compartida, mantenimiento) entre especies o galpones por cabezas, biomasa, kg de alimento, m² o porcentaje manual.",
      "Ejecutar el cierre diario al finalizar la jornada para consolidar la foto auditable e impedir ediciones retroactivas accidentales.",
    ],
    warnings: ["No cerrar el día hasta revisar registros de mortalidad, postura, alimentación y ventas de la fecha."],
    tips: ["Comparar ejecución real vs presupuesto y revisar cartera vencida semanalmente mejora el flujo de caja."],
    body: "EPEF FCR conversion alimenticia uniformidad CV HAA prorrateo costos indirectos cierre diario auditable presupuesto cuentas por cobrar pagar",
  },
];

function cleanSpaces(text: unknown): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function normalizeSearchText(text: unknown): string {
  return cleanSpaces(text)
    .toLocaleLowerCase("es-CO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const DOMAIN_SYNONYMS: Array<[RegExp, string[]]> = [
  [/\b(cubeta|cubetas|docena|jumbo|aaa|aa|calibre|clasificar|huevos?)\b/, ["ntc", "1240", "huevo", "postura", "venta"]],
  [/\b(vacuna|vacunacion|antibiotico|medicamento|remedio|desparasitar|purgar)\b/, ["sanidad", "ica", "retiro", "control", "cadena", "frio"]],
  [/\b(calor|frio|bochorno|ventilacion|cortina|amoniaco|olor|cama)\b/, ["ith", "nh3", "sensor", "temperatura", "humedad"]],
  [/\b(muerto|muerte|baja|mortalidad|compost|cadaver|abono|gallinaza|pollinaza)\b/, ["compostaje", "agrosavia", "3:1:1", "mortalidad", "gallinaza"]],
  [/\b(coneja|conejos|gazapo|cuy|cuyes|prenez|parto|empadre|nidal)\b/, ["reproduccion", "destete", "palpacion", "gestacion"]],
  [/\b(incubar|incubadora|pollito|eclosion|nacedora|ovoscopia|llueca|clueca)\b/, ["incubacion", "fertilidad", "eclosion"]],
  [/\b(factura|recibo|nequi|daviplata|rut|foto|etiqueta|ocr|pdf)\b/, ["ocr", "adjunto", "soporte", "comprobante"]],
  [/\b(rutina|tarea|pendiente|turno|jornada|cerrar|cierre)\b/, ["calendario", "rutina", "cierre", "diario"]],
  [/\b(mover|traslado|cambio|corral|galpon|cuarentena|vacio)\b/, ["ubicaciones", "movimiento", "traslado", "bioseguridad"]],
  [/\b(sacrificio|faena|beneficio|canal|carne|despiece)\b/, ["sacrificio", "carne", "autoconsumo", "retiro"]],
  [/\b(fcr|conversion|epef|uniformidad|rentabilidad|margen|prorrateo|presupuesto)\b/, ["kpis", "analitica", "finanzas", "prorrateo", "presupuesto"]],
];

function stemSpanishToken(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith("ciones")) return `${token.slice(0, -6)}cion`;
  if (token.endsWith("ces")) return `${token.slice(0, -3)}z`;
  if (token.endsWith("es") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

export function tokenizeQuery(query: string): string[] {
  const norm = normalizeSearchText(query);
  const rawTokens = norm
    .split(/[^a-z0-9:]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const expanded = new Set<string>();
  for (const token of rawTokens) {
    expanded.add(token);
    expanded.add(stemSpanishToken(token));
  }
  for (const [pattern, extras] of DOMAIN_SYNONYMS) {
    if (pattern.test(norm)) {
      for (const extra of extras) {
        expanded.add(extra);
        expanded.add(stemSpanishToken(extra));
      }
    }
  }
  return Array.from(expanded);
}

function guideToDocument(guide: Guide, moduleLabels: Map<string, string>): KnowledgeDocument {
  const steps: string[] = [];
  const warnings: string[] = [];
  const tips: string[] = [];
  const bodyParts: string[] = [guide.summary];

  for (const section of guide.sections as GuideSection[]) {
    if (section.title) bodyParts.push(section.title);
    if (section.text) bodyParts.push(section.text);
    if (Array.isArray(section.items)) {
      for (const item of section.items) bodyParts.push(item);
      if (section.type === "steps") steps.push(...section.items);
      else if (section.type === "warning") warnings.push(...section.items);
      else if (section.type === "tip") tips.push(...section.items);
    }
    if (section.type === "warning" && section.text) warnings.push(section.text);
    if (section.type === "tip" && section.text) tips.push(section.text);
    if (Array.isArray(section.nodes)) {
      bodyParts.push(section.nodes.map((n) => n.label).join(" -> "));
    }
  }

  return {
    id: `guia:${guide.slug}`,
    title: guide.title,
    module: guide.module,
    moduleLabel: moduleLabels.get(guide.module) || guide.module,
    source: "guia",
    summary: guide.summary,
    tags: guide.tags || [],
    relatedHrefs: guide.relatedHrefs || [],
    body: cleanSpaces(bodyParts.join(" · ")),
    steps,
    warnings,
    tips,
  };
}

let cachedCorpus: KnowledgeDocument[] | null = null;

export function getKnowledgeCorpus(): KnowledgeDocument[] {
  if (cachedCorpus) return cachedCorpus;
  const moduleLabels = new Map(guideModules.map((m) => [m.id, m.label]));
  const guideDocs = guides.map((g) => guideToDocument(g, moduleLabels));
  const stdDocs: KnowledgeDocument[] = TECHNICAL_STANDARDS.map((std) => ({
    id: std.id,
    title: std.title,
    module: std.module,
    moduleLabel: moduleLabels.get(std.module) || std.module,
    source: "norma_tecnica",
    summary: std.summary,
    tags: std.tags,
    relatedHrefs: std.relatedHrefs,
    body: std.body,
    steps: std.steps,
    warnings: std.warnings,
    tips: std.tips,
  }));
  cachedCorpus = [...stdDocs, ...guideDocs];
  return cachedCorpus;
}

export function getKnowledgeDigest(): string {
  return [
    "NTC 1240 huevo: Jumbo (>78g), AAA (67-77.9g), AA (60-66.9g), A (53-59.9g), B (46-52.9g), C (<46g); cubeta=30, docena=12; conservar 13-18°C.",
    "Sanidad ICA y Retiro: cadena de frío vacunas 2-8°C; retiro de medicamento bloquea faena, venta y traslado; GSMI requerida para movilización externa.",
    "Bioseguridad POE GAB (Res. ICA 3651/3652) y Bienestar (Res. 8452/2025): zonas limpia/producción/sucia/cuarentena y respeto de vacío sanitario.",
    "Ambiente y Compostaje: ITH >=72 alerta moderada, >=78 estrés calórico severo; NH3 >=20 ppm crítico; compost AGROSAVIA 3:1:1 o 7:2:2 a 55-65°C y 50-60% humedad.",
    "Ciclos fisiológicos: coneja 31d (palpación d12-14, nidal d27, destete 30-35d); cuy 67d (destete 14-21d); incubación gallina 21d, codorniz 17d, pato 28d.",
    `Manual operativo sincronizado: ${guides.length} guías reales de pantallas/flujos + ${TECHNICAL_STANDARDS.length} estándares técnicos (consultar con consultar_conocimiento cuando el usuario pregunte cómo hacer algo en la app o pida un protocolo detallado).`,
  ].join("\n- ");
}

export interface SearchKnowledgeOptions {
  modulo?: string;
  limit?: number;
  rerankFn?: (
    query: string,
    candidates: Array<{ id: string; title: string; summary: string }>,
  ) => Promise<string | null>;
}

export async function searchFarmKnowledge(
  query: string,
  options: SearchKnowledgeOptions = {},
): Promise<{
  totalIndexed: number;
  rerankedByJev: boolean;
  matches: KnowledgeMatch[];
}> {
  const corpus = getKnowledgeCorpus();
  const limit = Math.min(6, Math.max(1, Number(options.limit) || 3));
  const moduleFilter = normalizeSearchText(options.modulo);
  const queryNorm = normalizeSearchText(query);
  const tokens = tokenizeQuery(query);

  const scored: Array<{ doc: KnowledgeDocument; score: number }> = [];

  for (const doc of corpus) {
    if (moduleFilter && !normalizeSearchText(doc.module).includes(moduleFilter) && !normalizeSearchText(doc.moduleLabel).includes(moduleFilter)) {
      continue;
    }

    const titleNorm = normalizeSearchText(doc.title);
    const summaryNorm = normalizeSearchText(doc.summary);
    const tagsNorm = doc.tags.map((t) => normalizeSearchText(t));
    const bodyNorm = normalizeSearchText(`${doc.body} ${doc.steps.join(" ")} ${doc.warnings.join(" ")}`);
    const modNorm = normalizeSearchText(`${doc.module} ${doc.moduleLabel}`);

    let score = 0;

    if (queryNorm.length >= 4) {
      if (titleNorm.includes(queryNorm)) score += 28;
      if (summaryNorm.includes(queryNorm)) score += 16;
      if (bodyNorm.includes(queryNorm)) score += 10;
    }

    for (const token of tokens) {
      if (titleNorm.includes(token)) score += 7;
      if (tagsNorm.some((tag) => tag.includes(token))) score += 6;
      if (summaryNorm.includes(token)) score += 4;
      if (modNorm.includes(token)) score += 3;
      if (bodyNorm.includes(token)) score += 1.5;
    }

    if (doc.source === "norma_tecnica" && score > 0) score += 2;
    if (score > 0) scored.push({ doc, score });
  }

  scored.sort((a, b) => b.score - a.score);
  let ranked = scored.slice(0, 8);
  let rerankedByJev = false;

  if (options.rerankFn && ranked.length > 1) {
    try {
      const winnerId = await options.rerankFn(
        query,
        ranked.slice(0, 5).map((item) => ({
          id: item.doc.id,
          title: item.doc.title,
          summary: item.doc.summary,
        })),
      );
      if (winnerId) {
        const idx = ranked.findIndex((item) => item.doc.id === winnerId);
        if (idx >= 0) {
          const [picked] = ranked.splice(idx, 1);
          ranked = [picked, ...ranked];
          rerankedByJev = true;
        }
      }
    } catch {
      // Fallback limpio al ranking híbrido léxico-estructural
    }
  }

  const finalSlice = ranked.slice(0, limit);
  return {
    totalIndexed: corpus.length,
    rerankedByJev,
    matches: finalSlice.map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      module: doc.module,
      moduleLabel: doc.moduleLabel,
      source: doc.source,
      score: Number(score.toFixed(1)),
      summary: doc.summary,
      steps: doc.steps.slice(0, 12),
      warnings: doc.warnings.slice(0, 8),
      tips: doc.tips.slice(0, 8),
      bodyExcerpt: doc.body.slice(0, 900),
      relatedHrefs: doc.relatedHrefs,
    })),
  };
}
