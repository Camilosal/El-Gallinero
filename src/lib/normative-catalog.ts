export const NORMATIVE_CATALOG_VERSION = "2026.11-REV3";

export type NormativeDocumentKind = "norma" | "estandar" | "guia";

export type NormativeLegalBinding =
  | "obligatoria_legal"
  | "norma_tecnica_voluntaria"
  | "estandar_referencia"
  | "guia_tecnica";

export type NormativeVerificationStatus =
  | "pendiente"
  | "verificado"
  | "reemplazado"
  | "derogado";

export type NormativeSourceKind =
  | "documento_especifico"
  | "portal_oficial"
  | "norma_paga_referencia";

export interface NormativeCatalogItem {
  id: string;
  code: string;
  kind: NormativeDocumentKind;
  kindLabel: string;
  legalBinding: NormativeLegalBinding;
  authority: string;
  jurisdiction: string;
  title: string;
  version: string;
  applicableScope: string;
  publishedAt?: string | null;
  effectiveFrom?: string | null;
  /** Fecha real de verificación documental (null mientras siga pendiente de revisión). */
  lastVerifiedAt: string | null;
  verifiedBy: string | null;
  verificationStatus: NormativeVerificationStatus;
  verificationNote?: string;
  sourceKind: NormativeSourceKind;
  updateFrequencyLabel: string;
  species: string[];
  module: string;
  moduleLabel: string;
  appRoute: string;
  appRouteLabel: string;
  sourceUrl: string;
  sourceLabel: string;
  summary: string;
  keyReferences: string[];
  complianceChecklist: string[];
  ginaPrompts: string[];
  isCustom?: boolean;
}

export interface NormativeCatalogMeta {
  version: string;
  /** Última sincronización técnica del catálogo / caché. */
  lastSyncAt: string | null;
  /** Última comprobación técnica de disponibilidad de fuentes. */
  lastSourceCheckedAt: string | null;
  /** Alias de compatibilidad hacia la última sincronización técnica (no representa verificación jurídica). */
  lastCheckedAt: string;
  updateFrequencyLabel: string;
  totalItems: number;
  verifiedCount: number;
  pendingCount: number;
  countsByKind: Record<NormativeDocumentKind, number>;
  items: NormativeCatalogItem[];
}

export const NORMATIVE_CATALOG: NormativeCatalogItem[] = [
  {
    id: "norm-ntc-1240",
    code: "NTC 1240",
    kind: "estandar",
    kindLabel: "Norma técnica voluntaria",
    legalBinding: "norma_tecnica_voluntaria",
    authority: "ICONTEC Colombia",
    jurisdiction: "Colombia",
    title: "Clasificación por gramaje, conservación y manejo de huevo de gallina fresco",
    version: "NTC 1240 (2da actualización)",
    applicableScope:
      "Aplica específicamente a huevo fresco de gallina para consumo humano en cáscara (no aplica por extensión a huevo de codorniz ni de pato). Norma técnica voluntaria salvo adopción contractual o reglamento técnico expreso.",
    publishedAt: "2011",
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Naturaleza voluntaria validada según lineamientos SICAL; pendiente cotejo de anexos completos por especialista contra edición paga ICONTEC.",
    sourceKind: "norma_paga_referencia",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["gallina"],
    module: "produccion",
    moduleLabel: "Huevos e Inventario",
    appRoute: "/dashboard/produccion/huevos",
    appRouteLabel: "Ir a Huevos",
    sourceUrl: "https://tienda.icontec.org/",
    sourceLabel: "ICONTEC · Tienda oficial (NTC 1240) / SICAL",
    summary:
      "Referencia técnica voluntaria para clasificar huevo fresco de gallina por peso (Jumbo a C), equivalencias comerciales de cubeta (30) y docena (12), conservación en bodega y rotación Primero en Entrar, Primero en Salir (PEPS).",
    keyReferences: [
      "Calibres de referencia por peso unitario en huevo de gallina: Jumbo (> 78.0 g), AAA (67.0–77.9 g), AA (60.0–66.9 g), A (53.0–59.9 g), B (46.0–52.9 g) y C (< 46.0 g).",
      "Condiciones operativas de bodega usadas en el sistema: 13 °C–18 °C y 70–80 % HR sin cambios térmicos bruscos ni lavado por inmersión en agua fría.",
      "Empaque y salida operativa: 1 cubeta = 30 unidades, 1 docena = 12 unidades; separación de huevos rotos/sucios y despacho estricto por PEPS.",
    ],
    complianceChecklist: [
      "Registrar por separado huevos aptos y descartados en cada recolección.",
      "Verificar temperatura y humedad de cuarto frío / bodega antes de estibar cubetas.",
      "Confirmar que el lote no esté bajo periodo de retiro farmacológico antes de vender.",
    ],
    ginaPrompts: [
      "¿Cuáles son los pesos de referencia NTC 1240 para huevo de gallina y cómo registro una cubeta?",
      "¿Por qué la NTC 1240 es voluntaria y cómo aplica solo a gallina y no a codorniz/pato?",
    ],
  },
  {
    id: "norm-ica-3651-3652",
    code: "Res. ICA 3650 · 3651 · 3652/2014",
    kind: "norma",
    kindLabel: "Requisito legal obligatorio",
    legalBinding: "obligatoria_legal",
    authority: "ICA · Sanidad Avícola",
    jurisdiction: "Colombia",
    title: "Certificación de Granja Avícola Biosegura (GAB), POE y cadena de frío",
    version: "Resoluciones 3650, 3651 y 3652 de 2014",
    applicableScope:
      "Granjas avícolas comerciales de material genético (Res. 3650), postura/levante (Res. 3651) y engorde (Res. 3652) en Colombia.",
    publishedAt: "2014-11-13",
    effectiveFrom: "2014-11-13",
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Pendiente enlazar URL directa del documento consolidado vigente en ICA y validar umbrales de escala/capacidad por especialista sanitario.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["gallina", "pollo"],
    module: "bioseguridad",
    moduleLabel: "Bioseguridad POE GAB",
    appRoute: "/dashboard/sanidad/bioseguridad",
    appRouteLabel: "Ir a Bioseguridad",
    sourceUrl: "https://www.ica.gov.co/normatividad/normas-ica/resoluciones",
    sourceLabel: "ICA · Portal de Resoluciones Avícolas",
    summary:
      "Establece los Procedimientos Operativos Estandarizados (POE GAB) para granjas avícolas comerciales de postura (Res. 3651), engorde (Res. 3652) y material genético (Res. 3650): arcos sanitarios, pediluvios, vacíos sanitarios y vacunación oficial.",
    keyReferences: [
      "Vacunación oficial (p. ej. Newcastle según plan sanitario aplicable) y mantenimiento continuo de cadena de frío vacunal entre 2 °C y 8 °C.",
      "Registro de ingreso de personas y vehículos, desinfección en arco sanitario y recambio documentado de pediluvios.",
      "Separación de zona limpia, producción y zona sucia; vacío sanitario documentado entre lotes antes de repoblar.",
    ],
    complianceChecklist: [
      "Llenar chequeo diario de pediluvios, agua tratada y control de roedores.",
      "Registrar lote de vacuna, laboratorio y temperatura de nevera (2–8 °C).",
      "Mantener al día las bitácoras de visitantes y capacitación POE del personal.",
    ],
    ginaPrompts: [
      "¿Qué me exige la Res. ICA 3651 y 3652 en bioseguridad diaria y vacunación?",
      "¿Cómo documento el vacío sanitario y la cadena de frío vacunal según ICA?",
    ],
  },
  {
    id: "norm-ica-12486",
    code: "Res. ICA 12486 de 2023",
    kind: "norma",
    kindLabel: "Requisito legal obligatorio",
    legalBinding: "obligatoria_legal",
    authority: "ICA · Sanidad Cuyícola y Cunícola",
    jurisdiction: "Colombia",
    title: "Registro Sanitario de Predio Pecuario (RSPP) para especies cuyícola y cunícola",
    version: "Res. 12486 de 2023",
    applicableScope:
      "Predios dedicados a la producción de cuyes (cuyícola) y conejos (cunícola) en Colombia. No sustituye las resoluciones avícolas (Res. 3650–3652).",
    publishedAt: "2023-09-22",
    effectiveFrom: "2023-09-22",
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Alcance acotado a cuyes y conejos; pendiente enlazar PDF específico del ICA y revisión final de formularios RSPP por especialista.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["conejo", "cuy"],
    module: "bioseguridad",
    moduleLabel: "Bioseguridad y Predio (Cuyes y Conejos)",
    appRoute: "/dashboard/sanidad/bioseguridad",
    appRouteLabel: "Ir a Bioseguridad",
    sourceUrl: "https://www.ica.gov.co/normatividad/normas-ica/resoluciones",
    sourceLabel: "ICA · Resoluciones (Res. 12486/2023)",
    summary:
      "Fija los requisitos y el procedimiento para obtener el Registro Sanitario de Predio Pecuario (RSPP) de las especies cuyícola y cunícola, facilitando trazabilidad, censo por especie y aislamiento sanitario frente a otros animales del predio.",
    keyReferences: [
      "Inscripción y actualización del Registro Sanitario de Predio Pecuario (RSPP) para explotaciones de conejos y cuyes con ubicación e inventario actualizado.",
      "Aislamiento físico efectivo entre módulos cunícolas/cuyícolas y galpones avícolas u otras especies domésticas en granjas mixtas.",
      "Soportes sanitarios y ubicación municipal DIVIPOLA disponibles para trazabilidad y movilización.",
    ],
    complianceChecklist: [
      "Confirmar separación física de módulos cunícolas/cuyícolas frente a corrales avícolas.",
      "Mantener actualizado el municipio DIVIPOLA y el censo activo de conejos y cuyes.",
      "Conservar radicado o número de registro RSPP del predio en Configuración.",
    ],
    ginaPrompts: [
      "¿A qué especies aplica la Resolución ICA 12486 de 2023 y qué exige para el RSPP?",
      "¿Cómo separo en la granja los módulos de cuyes y conejos respecto a las aves?",
    ],
  },
  {
    id: "norm-bienestar-205-8452",
    code: "MADR 205/2022 · ICA 16409/2024 · ICA 8452/2025",
    kind: "norma",
    kindLabel: "Requisito legal obligatorio",
    legalBinding: "obligatoria_legal",
    authority: "MinAgricultura e ICA",
    jurisdiction: "Colombia",
    title: "Bienestar animal en producción cunícola/cuyícola (MADR 205) y certificación primaria (ICA)",
    version: "MADR 205/2022 · ICA 16409/2024 · Mod. ICA 8452/2025",
    applicableScope:
      "Res. MADR 205/2022 aplica específicamente a producción de conejos y cuyes; Res. ICA 16409/2024 y Res. ICA 8452/2025 regulan la certificación en Bienestar Animal para producción primaria pecuaria.",
    publishedAt: "2022 / 2024 / 2025",
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Pendiente desagregar cada resolución con su enlace oficial directo y validar matrices de puntuación por especie con médico veterinario.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["todas", "gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "bioseguridad",
    moduleLabel: "Bienestar Animal",
    appRoute: "/dashboard/sanidad/bioseguridad",
    appRouteLabel: "Evaluar Bienestar",
    sourceUrl: "https://www.minagricultura.gov.co/Normatividad/Paginas/Resoluciones.aspx",
    sourceLabel: "MADR / ICA · Resoluciones de Bienestar Animal",
    summary:
      "Integra las directrices de bienestar animal en listas de chequeo medibles: acceso continuo a agua fresca, densidad por especie, cama seca, confort térmico (ITH/NH3) y ausencia de lesiones.",
    keyReferences: [
      "Cama seca y friable; referencia operativa de amoníaco NH3 < 20 ppm a la altura de los animales.",
      "Disponibilidad permanente de agua limpia y espacio mínimo calibrado según especie (aves vs. conejos/cuyes bajo MADR 205/2022).",
      "Evaluación periódica de puntaje POE (0–100) con acciones correctivas cuando algún criterio cae por debajo del umbral.",
    ],
    complianceChecklist: [
      "Aplicar evaluación de bienestar animal por galpón o módulo mínimo cada mes.",
      "Revisar densidad (aves/m² o conejos-cuyes/poza) antes de cada recepción o destete.",
      "Documentar ajustes en cortinas, bebederos o cama cuando haya alertas ITH/NH3.",
    ],
    ginaPrompts: [
      "¿Qué diferencia hay entre la Res. MADR 205/2022 y las Res. ICA 16409/2024 y 8452/2025?",
      "¿Qué hago si un galpón marca alerta de cama húmeda, densidad o NH3 alto?",
    ],
  },
  {
    id: "norm-invima-pramsac-gsmi",
    code: "PRAMSAC · INVIMA · GSMI",
    kind: "norma",
    kindLabel: "Requisito legal obligatorio",
    legalBinding: "obligatoria_legal",
    authority: "INVIMA / ICA Inocuidad",
    jurisdiction: "Colombia",
    title: "Control de residuos farmacológicos, tiempos de retiro y Guía de Movilización (GSMI)",
    version: "Referencia PRAMSAC / Vademécum ICA",
    applicableScope:
      "Tratamientos veterinarios con periodo de retiro declarado en etiqueta oficial y movilización de animales en pie fuera del predio.",
    publishedAt: null,
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Pendiente vincular resoluciones LMR específicas (MinSalud/INVIMA) y enlace directo a la plataforma GSMI del ICA.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["todas", "gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "sanidad",
    moduleLabel: "Sanidad y Retiros",
    appRoute: "/dashboard/sanidad/control",
    appRouteLabel: "Ir a Sanidad",
    sourceUrl: "https://www.invima.gov.co/",
    sourceLabel: "INVIMA / ICA · Inocuidad y Retiros",
    summary:
      "Apoya el control de trazas antibióticas o antiparasitarias registrando los días de carencia indicados en cada etiqueta/registro ICA y conservando el soporte GSMI para movilización fuera del predio.",
    keyReferences: [
      "Cada tratamiento registrado en la app activa el conteo de días de retiro en carne y huevo según el registro cargado.",
      "Evitar usar fármacos contraindicados en postura (como Enrofloxacina o Sulfaclozina según ficha técnica ICA) en lotes cuyo huevo sea para consumo humano.",
      "Movilización de animales vivos fuera de la granja requiere Guía Sanitaria de Movilización Interna (GSMI) vigente ante el ICA.",
    ],
    complianceChecklist: [
      "Registrar producto con su registro ICA exacto y confirmar fecha de liberación en etiqueta.",
      "No programar faena, venta ni traslado mientras aparezca bloqueo sanitario activo en la app.",
      "Adjuntar número de GSMI en ventas o traslados externos que abandonen la finca.",
    ],
    ginaPrompts: [
      "¿Qué medicamentos están contraindicados en ponedoras según su registro ICA?",
      "¿Cómo calcula y bloquea la app los días de retiro sanitario en carne y huevos?",
    ],
  },
  {
    id: "norm-ica-30292-agrosavia",
    code: "AGROSAVIA Compostaje · Antecedente ICA 30292/2017",
    kind: "guia",
    kindLabel: "Guía técnica (antecedente derogado)",
    legalBinding: "guia_tecnica",
    authority: "AGROSAVIA / ICA (histórico Newcastle)",
    jurisdiction: "Colombia",
    title: "Compostaje técnico de mortalidad y excretas (3:1:1 y 7:2:2) y trazabilidad sanitaria de gallinaza",
    version: "Manuales AGROSAVIA · Nota sobre Res. ICA 30292/2017",
    applicableScope:
      "Guía operativa de compostaje aeróbico para excretas y mortalidad en granja. Nota normativa: la Res. ICA 30292/2017 sobre Newcastle (que regulaba movilización de gallinaza sanitizada) fue derogada tras la declaratoria sanitaria (Res. ICA 094488/2021).",
    publishedAt: "2017",
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "reemplazado",
    verificationNote:
      "Res. ICA 30292/2017 derogada/reemplazada en el marco de Newcastle (Res. ICA 094488/2021); las proporciones 3:1:1 y 7:2:2 provienen de guías técnicas AGROSAVIA y permanecen pendientes de enlace directo al manual oficial.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["todas", "gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "compostaje",
    moduleLabel: "Gallinaza y Compostaje",
    appRoute: "/dashboard/operaciones/compostaje",
    appRouteLabel: "Ir a Compostaje",
    sourceUrl: "https://www.agrosavia.co/",
    sourceLabel: "AGROSAVIA · Publicaciones de Compostaje",
    summary:
      "Reúne parámetros técnicos de mezcla C/N, humedad y temperatura termofílica usados en campo para transformar gallinaza, pollinaza, cuyinaza y mortalidad en bioabono estabilizado antes de su uso o comercialización.",
    keyReferences: [
      "Proporciones técnicas de mezcla referenciadas (3:1:1 o 7:2:2: excreta : mortalidad : material vegetal seco como cascarilla o aserrín).",
      "Referencia termofílica recomendada: 55 °C a 65 °C sostenida por al menos 3 días continuos y humedad óptima 50–60 % para reducción de patógenos.",
      "Evitar venta o aplicación agrícola de gallinaza fresca sin estabilización térmica documentada.",
    ],
    complianceChecklist: [
      "Pesar ingredientes de la pila y registrar la fórmula usada al abrir compostaje.",
      "Medir temperatura interna y humedad antes de cada volteo programado.",
      "Liberar el abono únicamente al completar maduración y confirmar < 40 °C sin olor.",
    ],
    ginaPrompts: [
      "¿Cuál es la proporción 3:1:1 o 7:2:2 para compostar mortalidad y gallinaza?",
      "¿Por qué se separa la guía técnica AGROSAVIA del antecedente de la Res. ICA 30292/2017?",
    ],
  },
  {
    id: "std-fedna-nrc-nutricion",
    code: "Tablas FEDNA / NRC Nutrición Animal",
    kind: "estandar",
    kindLabel: "Estándar de referencia",
    legalBinding: "estandar_referencia",
    authority: "FEDNA / National Research Council",
    jurisdiction: "Internacional",
    title: "Requerimientos nutricionales de proteína, energía metabolizable, calcio y fósforo",
    version: "FEDNA / NRC Poultry & Small Stock",
    applicableScope:
      "Referencia técnica orientativa por especie y fase productiva; debe ajustarse al concentrado comercial, forraje disponible y altitud local.",
    publishedAt: null,
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Pendiente validar cada tabla nutricional por especie/fase contra la edición vigente de FEDNA y NRC.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "alimentacion",
    moduleLabel: "Alimentación y Raciones",
    appRoute: "/dashboard/produccion/alimentacion",
    appRouteLabel: "Ir a Alimentación",
    sourceUrl: "https://www.fundacionfedna.org/",
    sourceLabel: "FEDNA · Tablas Nutricionales",
    summary:
      "Referencia técnica internacional de aporte proteico, kcal/kg de energía metabolizable, relación Ca/P y consumo diario esperado por especie y fase productiva para planificar bultos de 40 kg.",
    keyReferences: [
      "Postura pico gallina (18–45 sem): 17.5 % PC, 2.780 kcal/kg, 3.9 % Ca, consumo ref. 110–118 g/ave/día; Codorniz postura: 21.0 % PC y 3.0 % Ca (23–28 g/día).",
      "Engorde pollo: Pre-inicio 22.0 % PC / 3.000 kcal; Finalizador 19.0 % PC / 3.180 kcal; Pato levante 16.5 % PC / 2.950 kcal.",
      "Cuyes requieren suplementación de Vitamina C (mín. 200 mg/kg en dieta o forraje fresco); Conejos ceba: 15.5 % PC + fibra efectiva.",
    ],
    complianceChecklist: [
      "Comparar ficha técnica del concentrado comprado (bulto 40 kg) contra etapa del lote.",
      "Recalcular días de cobertura de bodega y ajustar ración cuando ITH supera 72.",
      "Validar aporte de calcio grueso en ponedoras al pasar de semana 40 de postura.",
    ],
    ginaPrompts: [
      "¿Cuánta proteína, energía y calcio requiere una gallina en pico de postura vs un pollo finalizador?",
      "¿Cuántos gramos por animal al día debe comer mi lote según FEDNA y el clima actual?",
    ],
  },
  {
    id: "guia-aviagen-cobb-engorde",
    code: "Guías Ross 308 / Cobb 500 (Engorde)",
    kind: "guia",
    kindLabel: "Guía de manejo",
    legalBinding: "guia_tecnica",
    authority: "Aviagen / Cobb-Vantress",
    jurisdiction: "Internacional",
    title: "Curvas objetivo de peso, FCR, EPEF y manejo de recepción en pollo de engorde",
    version: "Manuales Broiler de referencia",
    applicableScope:
      "Líneas genéticas de pollo de engorde (Ross 308 / Cobb 500); ajustar metas de crecimiento en granjas ubicadas por encima de 1.800 msnm.",
    publishedAt: null,
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Pendiente enlazar URL directa al manual oficial PDF de objetivos de rendimiento por estirpe.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["pollo"],
    module: "produccion",
    moduleLabel: "Pollo de Engorde y Peso",
    appRoute: "/dashboard/produccion/peso",
    appRouteLabel: "Ir a Pesajes",
    sourceUrl: "https://en.aviagen.com/",
    sourceLabel: "Aviagen / Cobb · Guías Broiler",
    summary:
      "Define pesos semanales de referencia, meta de peso día 7 (>= 4.2x peso inicial), índice de uniformidad (CV <= 10 %), conversión alimenticia (FCR) y Factor Europeo de Eficiencia Productiva (EPEF).",
    keyReferences: [
      "Meta día 7: alcanzar al menos 185–195 g (4.2 a 4.5 veces el peso del pollito de 1 día); precalentar cama a 30–32 °C antes de la llegada.",
      "Curvas de referencia semana 1 a 6: ~190 g (sem 1), ~510 g (sem 2), ~980 g (sem 3), ~1.580 g (sem 4), ~2.260 g (sem 5) y ~2.950 g (sem 6).",
      "Meta de uniformidad CV% <= 10 % y EPEF competitivo >= 320 en granjas comerciales.",
    ],
    complianceChecklist: [
      "Pesar muestra representativa (mín. 30 aves o 2 % del lote) semanalmente en el mismo horario.",
      "Comparar FCR real vs estándar para detectar desperdicio en comederos o estrés térmico.",
      "Planificar cosecha o raleo de machos cuando el peso promedio llegue a meta comercial.",
    ],
    ginaPrompts: [
      "¿Cuánto debe pesar un pollo Ross 308 o Cobb 500 en las semanas 3, 5 y 6?",
      "¿Cómo interpreto el FCR, la uniformidad CV% y el EPEF de mis lotes de engorde?",
    ],
  },
  {
    id: "guia-hyline-isa-postura",
    code: "Guías Hy-Line Brown / ISA Brown / Lohmann",
    kind: "guia",
    kindLabel: "Guía de manejo",
    legalBinding: "guia_tecnica",
    authority: "Hy-Line / Hendrix Genetics",
    jurisdiction: "Internacional",
    title: "Manejo de levante, fotoperiodo estimulatorio, curva de postura y HAA en ponedoras",
    version: "Manuales de manejo ponedoras",
    applicableScope:
      "Gallinas ponedoras comerciales (Hy-Line, ISA Brown, Lohmann) y referencia general para manejo lumínico en codorniz.",
    publishedAt: null,
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Pendiente enlazar URL directa a fichas técnicas oficiales por línea genética.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["gallina", "codorniz"],
    module: "produccion",
    moduleLabel: "Gallinas y Postura",
    appRoute: "/dashboard/produccion/gallinas",
    appRouteLabel: "Ir a Gallinas",
    sourceUrl: "https://www.hyline.com/",
    sourceLabel: "Hy-Line / Hendrix · Postura",
    summary:
      "Parámetros de peso corporal en levante para sostener pico de postura, estímulo lumínico gradual (14–16 h luz), Huevos por Ave Alojada (HAA) y vida útil productiva.",
    keyReferences: [
      "Uniformidad de peso >= 80 % (+/- 10 % respecto al peso estándar de la semana) en semanas 6, 12 y 16 antes de iniciar postura.",
      "Estímulo de luz artificial gradual al alcanzar peso corporal meta (~1.45 kg en sem 17–18) sin disminuir las horas de luz durante producción.",
      "Seguimiento de % postura diaria, masa de huevo y Huevos por Ave Alojada (HAA acumulado).",
    ],
    complianceChecklist: [
      "Controlar peso corporal en levante para evitar madurez sexual prematura con huevos pequeños.",
      "Revisar reloj de iluminación en galpón para mantener fotoperiodo estable de 15–16 horas.",
      "Monitorear caídas súbitas de postura >= 5 % en 48 h junto con consumo de agua.",
    ],
    ginaPrompts: [
      "¿Qué peso corporal y uniformidad exige la guía de ponedoras antes del inicio de postura?",
      "¿Cómo debo manejar las horas de luz (fotoperiodo) para sostener el pico de postura?",
    ],
  },
  {
    id: "guia-inia-fao-cuyes-conejos",
    code: "Manuales INIA / FAO · Cuyes y Conejos",
    kind: "guia",
    kindLabel: "Guía de manejo",
    legalBinding: "guia_tecnica",
    authority: "INIA / FAO Producción Animal",
    jurisdiction: "Internacional",
    title: "Reproducción controlada, gestación, nidal, destete y manejo sanitario en mamíferos menores",
    version: "Manuales técnicos FAO / INIA",
    applicableScope:
      "Cunicultura (conejos) y cuyicultura (cuyes/curíes) en sistemas familiares y comerciales.",
    publishedAt: null,
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Pendiente enlazar URL directa a las publicaciones técnicas específicas de FAO/INIA.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión documental programada",
    species: ["conejo", "cuy"],
    module: "produccion",
    moduleLabel: "Reproducción e Incubación",
    appRoute: "/dashboard/produccion/incubacion",
    appRouteLabel: "Ir a Reproducción",
    sourceUrl: "https://www.fao.org/publications",
    sourceLabel: "FAO / INIA · Cunicultura y Cuyicultura",
    summary:
      "Establece los intervalos fisiológicos de empadre, diagnóstico de gestación, preparación de nidal, destete oportuno, prevención de consanguinidad y suministro de forraje verde oreado.",
    keyReferences: [
      "Conejos: gestación promedio 31 días; palpación abdominal días 12–14 post-monta; instalación de nidal desinfectado día 27; destete 30–35 días.",
      "Cuyes / Curíes: gestación promedio 67 días (rango 63–70 d); crías precoces; destete recomendado días 14–21 separando machos y hembras en pozas.",
      "Forraje verde pre-oreado + agua fresca y prevención estricta de cruces entre líneas emparentadas.",
    ],
    complianceChecklist: [
      "Verificar árbol reproductivo / parentesco antes de programar cada nuevo empadre.",
      "Pesar gazapos o crías de cuy al nacimiento y al destete para seleccionar reemplazos.",
      "Revisar signos tempranos de sarna, timpanismo o pododermatitis en jaulas y pozas.",
    ],
    ginaPrompts: [
      "¿Cuáles son los días clave de palpación, nidal y destete en conejos y en cuyes?",
      "¿Qué cuidados exige el forraje y la vitamina C para evitar pérdidas en cuyes?",
    ],
  },
  {
    id: "std-ith-nh3-ambiente",
    code: "Estándar ITH & NH3 · Confort Térmico",
    kind: "estandar",
    kindLabel: "Estándar de referencia",
    legalBinding: "estandar_referencia",
    authority: "Zootecnia Ambiental / Open-Meteo",
    jurisdiction: "Internacional",
    title: "Índice de Temperatura y Humedad (ITH), estrés calórico, riesgo de frío y límite de amoníaco",
    version: "Modelo ITH + Open-Meteo",
    applicableScope:
      "Monitoreo bioclimático orientativo por municipio DIVIPOLA y lecturas internas de galpón o poza.",
    publishedAt: null,
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Fórmula bioclimática estándar integrada con API Open-Meteo; pendiente validación empírica local de umbrales por piso térmico.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Sincronización climática cada 3 horas",
    species: ["todas", "gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "operaciones",
    moduleLabel: "Clima y Sensores",
    appRoute: "/dashboard/analisis/fuentes-externas",
    appRouteLabel: "Ver Clima e ITH",
    sourceUrl: "https://open-meteo.com/en/docs",
    sourceLabel: "Open-Meteo API Docs / Zootecnia Ambiental",
    summary:
      "Fórmula bioclimática para anticipar bajas de consumo voluntario de alimento por calor o exceso de gasto calórico por frío, calibrada con altitud DIVIPOLA y lecturas de amoníaco NH3 en galpón.",
    keyReferences: [
      "Fórmula ITH = 1.8·T + 32 − (0.55 − 0.0055·HR)·(1.8·T − 26). Confort: ITH < 72; Alerta moderada: 72 <= ITH < 78; Estrés calórico severo: ITH >= 78.",
      "Factor nutricional orientativo por calor: cuando T° > 27 °C o ITH >= 72 cae el consumo voluntario entre 4 % y 14 %, recomendando alimentar en horas frescas.",
      "Amoníaco en cama: mantener NH3 < 15–20 ppm; niveles >= 20 ppm irritan vías respiratorias.",
    ],
    complianceChecklist: [
      "Consultar pronóstico ITH a 7 días para anticipar manejo de cortinas y ventiladores.",
      "Mover distribución principal de ración a madrugada/tarde en días de ITH >= 72.",
      "Revisar ventilación mínima nocturna en pisos fríos (> 2.200 msnm) para evitar corrientes.",
    ],
    ginaPrompts: [
      "¿Cómo se calcula e interpreta el índice ITH y qué hago si sube de 72 o 78?",
      "¿Qué ajuste debo hacer en alimento y cortinas según el pronóstico climático de mi municipio?",
    ],
  },
  {
    id: "norm-dian-finagro-agro",
    code: "Estatuto DIAN Agro · Líneas Finagro",
    kind: "norma",
    kindLabel: "Requisito legal y fiscal",
    legalBinding: "obligatoria_legal",
    authority: "DIAN / Banco Agrario / Finagro",
    jurisdiction: "Colombia",
    title: "Topes UVT de retención agropecuaria, soporte de egresos y líneas de fomento agropecuario",
    version: "Referencia tributaria Colombia 2026",
    applicableScope:
      "Productores y compradores agropecuarios en Colombia; los valores en pesos deben verificarse contra el Estatuto Tributario vigente y resolución anual de UVT DIAN antes de declarar impuestos.",
    publishedAt: null,
    effectiveFrom: null,
    lastVerifiedAt: null,
    verifiedBy: null,
    verificationStatus: "pendiente",
    verificationNote:
      "Pendiente enlazar resolución oficial anual UVT DIAN y validar tratamiento fiscal según régimen (SIMPLE / ordinario / no responsable) con contador.",
    sourceKind: "portal_oficial",
    updateFrequencyLabel: "Revisión anual UVT / semanal IBR",
    species: ["todas"],
    module: "finanzas",
    moduleLabel: "Finanzas y Presupuestos",
    appRoute: "/dashboard/finanzas",
    appRouteLabel: "Ir a Finanzas",
    sourceUrl: "https://www.dian.gov.co/",
    sourceLabel: "DIAN / Finagro · Normativa Agro",
    summary:
      "Parámetros tributarios de referencia en Colombia para compras agropecuarias sin procesamiento industrial, control documental de egresos y líneas Finagro referenciadas a IBR E.A.",
    keyReferences: [
      "Referencia de tope en compras agropecuarias directas sin procesamiento industrial (92 UVT) frente a compras generales (27 UVT), sujeto a régimen fiscal del comprador.",
      "Contabilidad analítica anti-subsidio cruzado: separar costos directos por especie y prorratear indirectos para reportes financieros.",
      "Líneas Finagro de capital de trabajo e inversión con tasa referenciada a IBR E.A. según clasificación de productor.",
    ],
    complianceChecklist: [
      "Asociar comprador y proveedor con NIT/CC/RUT y conservar soporte de egresos.",
      "Revisar el punto de equilibrio unitario por especie antes de fijar precios mayoristas.",
      "Validar con contador o entidad financiera los reportes exportados antes de trámites oficiales.",
    ],
    ginaPrompts: [
      "¿Qué parámetros tributarios de referencia muestra la app para compras agropecuarias?",
      "¿Cómo me ayuda la app a separar costos por especie y preparar reportes para crédito Finagro?",
    ],
  },
];

export function getNormativeCatalogWithSyncMeta(
  lastSyncIso?: string | null,
  customItems: NormativeCatalogItem[] = [],
  lastSourceCheckedIso?: string | null,
): NormativeCatalogMeta {
  const normalizedSyncAt =
    lastSyncIso && /^\d{4}-\d{2}-\d{2}/.test(lastSyncIso)
      ? lastSyncIso.slice(0, 10)
      : null;
  const normalizedCheckedAt =
    lastSourceCheckedIso && /^\d{4}-\d{2}-\d{2}/.test(lastSourceCheckedIso)
      ? lastSourceCheckedIso.slice(0, 10)
      : normalizedSyncAt;

  const normalizedCustom: NormativeCatalogItem[] = customItems.map((item) => ({
    ...item,
    legalBinding: item.legalBinding ?? (item.kind === "norma" ? "obligatoria_legal" : item.kind === "estandar" ? "estandar_referencia" : "guia_tecnica"),
    jurisdiction: item.jurisdiction || "Colombia",
    applicableScope: item.applicableScope || "Definido por protocolo propio de la granja.",
    lastVerifiedAt: item.lastVerifiedAt ?? null,
    verifiedBy: item.verifiedBy ?? (item.lastVerifiedAt ? "Registro propio de granja" : null),
    verificationStatus: item.verificationStatus ?? (item.lastVerifiedAt ? "verificado" : "pendiente"),
    sourceKind: item.sourceKind ?? "documento_especifico",
    isCustom: true,
  }));

  // Nunca sobrescribir lastVerifiedAt ni verificationStatus al sincronizar caché o consultar la lista.
  const baseItems: NormativeCatalogItem[] = NORMATIVE_CATALOG.map((item) => ({ ...item }));
  const items = [...normalizedCustom, ...baseItems];

  const countsByKind: Record<NormativeDocumentKind, number> = {
    norma: items.filter((i) => i.kind === "norma").length,
    estandar: items.filter((i) => i.kind === "estandar").length,
    guia: items.filter((i) => i.kind === "guia").length,
  };

  const verifiedCount = items.filter((i) => i.verificationStatus === "verificado").length;
  const pendingCount = items.filter((i) => i.verificationStatus === "pendiente").length;

  return {
    version: NORMATIVE_CATALOG_VERSION,
    lastSyncAt: normalizedSyncAt,
    lastSourceCheckedAt: normalizedCheckedAt,
    lastCheckedAt: normalizedSyncAt ?? "",
    updateFrequencyLabel: "Sincronización semanal (7 días) · Revisión documental independiente",
    totalItems: items.length,
    verifiedCount,
    pendingCount,
    countsByKind,
    items,
  };
}
