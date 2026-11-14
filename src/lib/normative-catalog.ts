export const NORMATIVE_CATALOG_VERSION = "2026.11-REV2";

export type NormativeDocumentKind = "norma" | "estandar" | "guia";

export interface NormativeCatalogItem {
  id: string;
  code: string;
  kind: NormativeDocumentKind;
  kindLabel: string;
  authority: string;
  title: string;
  version: string;
  lastVerifiedAt: string;
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
  lastCheckedAt: string;
  updateFrequencyLabel: string;
  totalItems: number;
  countsByKind: Record<NormativeDocumentKind, number>;
  items: NormativeCatalogItem[];
}

export const NORMATIVE_CATALOG: NormativeCatalogItem[] = [
  {
    id: "norm-ntc-1240",
    code: "NTC 1240",
    kind: "norma",
    kindLabel: "Norma obligatoria",
    authority: "ICONTEC Colombia",
    title: "Clasificación por gramaje, conservación y salida PEPS de huevo comercial",
    version: "Actualización NTC 1240 (vigente 2026)",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
    species: ["gallina", "codorniz", "pato"],
    module: "produccion",
    moduleLabel: "Huevos e Inventario",
    appRoute: "/dashboard/produccion/huevos",
    appRouteLabel: "Ir a Huevos",
    sourceUrl: "https://www.icontec.org/",
    sourceLabel: "ICONTEC · Norma NTC 1240",
    summary:
      "Define los calibres oficiales de peso unitario (Jumbo a C), equivalencias de empaque en cubeta (30) y docena (12), temperatura y humedad de bodega y rotación Primero en Entrar, Primero en Salir (PEPS).",
    keyReferences: [
      "Calibres NTC 1240 por peso: Jumbo (> 78.0 g), AAA (67.0–77.9 g), AA (60.0–66.9 g), A (53.0–59.9 g), B (46.0–52.9 g) y C (< 46.0 g).",
      "Bodega de almacenamiento: conservar entre 13 °C y 18 °C con 70–80 % de humedad relativa sin cambios bruscos ni lavado por inmersión en agua fría.",
      "Empaque y salida: 1 cubeta = 30 unidades, 1 docena = 12 unidades; separación previa de huevos rotos/sucios y despacho estricto por PEPS.",
    ],
    complianceChecklist: [
      "Registrar por separado huevos aptos y descartados en cada recolección.",
      "Verificar temperatura y humedad de cuarto frío / bodega antes de estibar cubetas.",
      "Confirmar que el lote no esté bajo periodo de retiro farmacológico antes de vender.",
    ],
    ginaPrompts: [
      "¿Cuáles son los pesos mínimos de clasificación NTC 1240 y cómo se registra una cubeta?",
      "¿Qué temperatura y humedad exige la NTC 1240 en la bodega de huevo?",
    ],
  },
  {
    id: "norm-ica-3651-3652",
    code: "Res. ICA 3650 · 3651 · 3652/2014",
    kind: "norma",
    kindLabel: "Norma obligatoria",
    authority: "ICA · Sanidad Avícola",
    title: "Certificación de Granja Avícola Biosegura (GAB), POE y cadena de frío",
    version: "Vigente 2026 (compilado GAB)",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
    species: ["gallina", "pollo", "codorniz", "pato"],
    module: "bioseguridad",
    moduleLabel: "Bioseguridad POE GAB",
    appRoute: "/dashboard/sanidad/bioseguridad",
    appRouteLabel: "Ir a Bioseguridad",
    sourceUrl: "https://www.ica.gov.co/normatividad/normas-ica/resoluciones",
    sourceLabel: "ICA · Resoluciones Avícolas",
    summary:
      "Establece los Procedimientos Operativos Estandarizados (POE GAB) para granjas de postura (Res. 3651), engorde (Res. 3652) y material genético (Res. 3650): arcos sanitarios, pediluvios, vacíos sanitarios y vacunación oficial.",
    keyReferences: [
      "Vacunación obligatoria contra Newcastle (cepa LaSota/B1 o vectorizada según plan) y mantenimiento continuo de cadena de frío vacunal entre 2 °C y 8 °C.",
      "Registro obligatorio de ingreso de personas y vehículos, desinfección en arco sanitario y recambio documentado de pediluvios.",
      "Separación estricta de zona limpia, producción y zona sucia; vacío sanitario documentado entre lotes antes de repoblar.",
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
    kindLabel: "Norma obligatoria",
    authority: "ICA · Pequeña y Mediana Escala",
    title: "Medidas graduales de bioseguridad y registro sanitario en predios avícolas",
    version: "Res. 12486/2023 (vigente 2026)",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
    species: ["gallina", "pollo", "codorniz", "pato"],
    module: "bioseguridad",
    moduleLabel: "Bioseguridad y Predio",
    appRoute: "/dashboard/sanidad/bioseguridad",
    appRouteLabel: "Ir a Bioseguridad",
    sourceUrl: "https://www.ica.gov.co/normatividad/normas-ica/resoluciones",
    sourceLabel: "ICA · Res. 12486/2023",
    summary:
      "Adecúa los requisitos de infraestructura, mallas antipájaro, aislamiento por especie y manejo de residuos a la escala real del pequeño y mediano productor colombiano sin sacrificar trazabilidad sanitaria.",
    keyReferences: [
      "Malla antipájaro en perímetros abiertos de galpón y protección de fuentes de agua frente a aves silvestres migratorias.",
      "Aislamiento físico efectivo entre aves domésticas y especies mamíferas menores (cuyes, conejos o porcinos).",
      "Inscripción o actualización del Registro Sanitario de Predio Avícola (RSPA) con georreferenciación y censo por especie.",
    ],
    complianceChecklist: [
      "Verificar integridad de mallas antipájaro y tapas de tanques de agua semanalmente.",
      "Confirmar separación física de galpones avícolas y módulos cunícolas/cuyícolas.",
      "Mantener actualizado el municipio DIVIPOLA y el censo activo por lugar.",
    ],
    ginaPrompts: [
      "¿Cómo aplica la Resolución ICA 12486 a un pequeño o mediano productor avícola?",
      "¿Qué verifico hoy para cumplir con aislamiento de aves silvestres y RSPA?",
    ],
  },
  {
    id: "norm-bienestar-205-8452",
    code: "MADR 205/2022 · ICA 16409/2024 · ICA 8452/2025",
    kind: "norma",
    kindLabel: "Norma obligatoria",
    authority: "MinAgricultura e ICA",
    title: "Condiciones prácticas de bienestar animal multi-especie en producción",
    version: "Actualización ICA 8452/2025",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
    species: ["todas", "gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "bioseguridad",
    moduleLabel: "Bienestar Animal",
    appRoute: "/dashboard/sanidad/bioseguridad",
    appRouteLabel: "Evaluar Bienestar",
    sourceUrl: "https://www.minagricultura.gov.co/Normatividad/Paginas/Resoluciones.aspx",
    sourceLabel: "MADR · Bienestar Animal",
    summary:
      "Integra las Cinco Libertades en listas de chequeo medibles por especie: acceso continuo a agua fresca, espacio mínimo por animal, cama seca, control térmico ITH/amoníaco y ausencia de lesiones.",
    keyReferences: [
      "Cama seca y friable sin apelmazamiento; concentración máxima recomendada de amoníaco NH3 < 20 ppm a la altura de los animales.",
      "Disponibilidad permanente de agua limpia y bebederos calibrados según edad y densidad de carga del corral o jaula.",
      "Evaluación periódica de puntaje POE (0–100) con acciones correctivas inmediatas si cualquier criterio cae por debajo del umbral.",
    ],
    complianceChecklist: [
      "Aplicar evaluación de bienestar animal por galpón o módulo mínimo cada mes.",
      "Revisar densidad (aves/m² o conejos-cuyes/poza) antes de cada recepción o destete.",
      "Documentar ajustes en cortinas, bebederos o cama cuando haya alertas ITH/NH3.",
    ],
    ginaPrompts: [
      "¿Qué criterios evalúa el puntaje de bienestar animal ICA 8452/2025 en mi granja?",
      "¿Qué hago si un galpón marca alerta de cama húmeda, densidad o NH3 alto?",
    ],
  },
  {
    id: "norm-invima-pramsac-gsmi",
    code: "PRAMSAC · INVIMA · GSMI",
    kind: "norma",
    kindLabel: "Norma obligatoria",
    authority: "INVIMA / ICA Inocuidad",
    title: "Control de residuos farmacológicos, tiempos de retiro y Guía de Movilización (GSMI)",
    version: "Programa PRAMSAC 2026",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Diario (Vademécum ICA)",
    species: ["todas", "gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "sanidad",
    moduleLabel: "Sanidad y Retiros",
    appRoute: "/dashboard/sanidad/control",
    appRouteLabel: "Ir a Sanidad",
    sourceUrl: "https://www.invima.gov.co/",
    sourceLabel: "INVIMA · Inocuidad",
    summary:
      "Garantiza alimentos libres de trazas antibióticas o antiparasitarias mediante bloqueo estricto durante los días de carencia de cada registro ICA y soporte sanitario para movilización fuera del predio.",
    keyReferences: [
      "Cada tratamiento veterinario activa el conteo de días de retiro en carne y huevo del Vademécum ICA (ej. Oxitetraciclina LA 21 d carne / 14 d huevo; Ivermectina 28 d carne).",
      "Prohibición absoluta de usar fármacos contraindicados en postura (como Enrofloxacina o Sulfaclozina) en lotes cuyo huevo sea para consumo humano.",
      "Movilización de animales vivos fuera de la granja requiere Guía Sanitaria de Movilización Interna (GSMI) vigente ante oficina ICA.",
    ],
    complianceChecklist: [
      "Registrar producto con su registro ICA exacto y confirmar fecha de liberación.",
      "No programar faena, venta ni traslado mientras aparezca bloqueo sanitario activo.",
      "Adjuntar número de GSMI en ventas o traslados externos que abandonen la finca.",
    ],
    ginaPrompts: [
      "¿Qué medicamentos están prohibidos en gallinas ponedoras según el Vademécum ICA?",
      "¿Cómo calcula y bloquea la app los días de retiro sanitario en carne y huevos?",
    ],
  },
  {
    id: "norm-ica-30292-agrosavia",
    code: "Res. ICA 30292/2017 · AGROSAVIA",
    kind: "norma",
    kindLabel: "Norma obligatoria",
    authority: "ICA / AGROSAVIA",
    title: "Sanitización térmica y compostaje técnico de mortalidad y excretas (3:1:1 y 7:2:2)",
    version: "Manual AGROSAVIA vigente",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
    species: ["todas", "gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "compostaje",
    moduleLabel: "Gallinaza y Compostaje",
    appRoute: "/dashboard/operaciones/compostaje",
    appRouteLabel: "Ir a Compostaje",
    sourceUrl: "https://www.agrosavia.co/",
    sourceLabel: "AGROSAVIA · Compostaje",
    summary:
      "Establece los parámetros térmicos, de humedad y mezcla C/N para transformar gallinaza, pollinaza, cuyinaza y mortalidad de granja en bioabono inocuo apto para comercialización o uso agrícola.",
    keyReferences: [
      "Proporciones recomendadas en pila: 3:1:1 o 7:2:2 (excreta avícola/cunícola : mortalidad : material vegetal seco como cascarilla de arroz o aserrín).",
      "Fase termofílica obligatoria de 55 °C a 65 °C sostenida por al menos 3 días continuos para inactivar Salmonella, E. coli y virus; humedad óptima 50–60 %.",
      "Prohibida la venta o uso agrícola de gallinaza fresca sin sanitización térmica documentada (ciclo de 8 semanas con volteos periódicos).",
    ],
    complianceChecklist: [
      "Pesar ingredientes de la pila y registrar la fórmula usada al abrir compostaje.",
      "Medir temperatura interna y humedad antes de cada volteo programado.",
      "Liberar el abono únicamente al completar maduración y confirmar < 40 °C sin olor.",
    ],
    ginaPrompts: [
      "¿Cuál es la proporción exacta AGROSAVIA 3:1:1 o 7:2:2 para compostar mortalidad?",
      "¿Qué temperatura y días de sanitización exige la Res. ICA 30292 para liberar gallinaza?",
    ],
  },
  {
    id: "std-fedna-nrc-nutricion",
    code: "Tablas FEDNA / NRC Nutrición Animal",
    kind: "estandar",
    kindLabel: "Estándar técnico",
    authority: "FEDNA / National Research Council",
    title: "Requerimientos nutricionales de proteína, energía metabolizable, calcio y fósforo",
    version: "FEDNA 2025 / NRC Poultry & Small Stock",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "alimentacion",
    moduleLabel: "Alimentación y Raciones",
    appRoute: "/dashboard/produccion/alimentacion",
    appRouteLabel: "Ir a Alimentación",
    sourceUrl: "https://www.fundacionfedna.org/",
    sourceLabel: "FEDNA · Tablas Nutricionales",
    summary:
      "Referencia técnica internacional de aporte proteico, kcal/kg de energía metabolizable, relación Ca/P y consumo diario esperado por especie y fase productiva, base para validar bultos de 40 kg.",
    keyReferences: [
      "Postura pico gallina (18–45 sem): 17.5 % PC, 2.780 kcal/kg, 3.9 % Ca, consumo ref. 110–118 g/ave/día; Codorniz postura: 21.0 % PC y 3.0 % Ca (23–28 g/día).",
      "Engorde pollo: Pre-inicio 22.0 % PC / 3.000 kcal; Finalizador 19.0 % PC / 3.180 kcal; Pato levante 16.5 % PC / 2.950 kcal.",
      "Cuyes requieren suplementación obligatoria de Vitamina C (mín. 200 mg/kg en dieta o forraje fresco diario); Conejos ceba: 15.5 % PC + fibra efectiva.",
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
    authority: "Aviagen / Cobb-Vantress",
    title: "Curvas objetivo de peso, FCR, EPEF y manejo de recepción en pollo de engorde",
    version: "Manuales Broiler vigentes 2026",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
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
      "Meta de uniformidad CV% <= 10 % y EPEF competitivo >= 320 en granjas comerciales; vigilar ventana óptima de sacrificio/cosecha.",
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
    authority: "Hy-Line / Hendrix Genetics",
    title: "Manejo de levante, fotoperiodo estimulatorio, curva de postura y HAA en ponedoras",
    version: "Edición 2025–2026",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
    species: ["gallina", "codorniz"],
    module: "produccion",
    moduleLabel: "Gallinas y Postura",
    appRoute: "/dashboard/produccion/gallinas",
    appRouteLabel: "Ir a Gallinas",
    sourceUrl: "https://www.hyline.com/",
    sourceLabel: "Hy-Line / Hendrix · Postura",
    summary:
      "Parámetros de peso corporal en levante para garantizar pico sostenido > 92 %, estímulo lumínico gradual (14–16 h luz), meta de Huevos por Ave Alojada (HAA) y vida útil productiva.",
    keyReferences: [
      "Uniformidad de peso >= 80 % (+/- 10 % respecto al peso estándar de la semana) en semanas 6, 12 y 16 antes de iniciar postura.",
      "Estímulo de luz artificial gradual al alcanzar peso corporal meta (~1.45 kg en sem 17–18) sin disminuir nunca las horas de luz durante producción.",
      "Seguimiento de % postura diaria, masa de huevo y Huevos por Ave Alojada (HAA acumulado), ajustando nutrición pre-postura y calcio vespertino.",
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
    authority: "INIA / FAO Producción Animal",
    title: "Reproducción controlada, gestación, nidal, destete y manejo sanitario en mamíferos menores",
    version: "Compendio Técnico 2026",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (cada 7 días)",
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
      "Forraje verde pre-oreado (nunca mojado ni recién cortado fermentado) + agua fresca y prevención estricta de cruces entre líneas emparentadas.",
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
    kindLabel: "Estándar técnico",
    authority: "IDEAM / Zootecnia Ambiental",
    title: "Índice de Temperatura y Humedad (ITH), estrés calórico, riesgo de frío y límite de amoníaco",
    version: "Modelo ITH 2026 + Open-Meteo",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Cada 3 horas (clima)",
    species: ["todas", "gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    module: "operaciones",
    moduleLabel: "Clima y Sensores",
    appRoute: "/dashboard/analisis/fuentes-externas",
    appRouteLabel: "Ver Clima e ITH",
    sourceUrl: "https://open-meteo.com/",
    sourceLabel: "Open-Meteo / Zootecnia Ambiental",
    summary:
      "Fórmula bioclimática para anticipar bajas de consumo voluntario de alimento por calor o exceso de gasto calórico por frío, calibrada con altitud DIVIPOLA y lecturas de amoníaco NH3 en galpón.",
    keyReferences: [
      "Fórmula ITH = 1.8·T + 32 − (0.55 − 0.0055·HR)·(1.8·T − 26). Confort: ITH < 72; Alerta moderada: 72 <= ITH < 78; Estrés calórico severo: ITH >= 78.",
      "Factor nutricional por calor: cuando T° > 27 °C o ITH >= 72 cae el consumo voluntario entre 4 % y 14 %, recomendando alimentar en horas frescas.",
      "Amoníaco en cama: mantener NH3 < 15–20 ppm; niveles >= 20 ppm irritan vías respiratorias y predisponen a E. coli y ascitis.",
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
    kindLabel: "Norma obligatoria",
    authority: "DIAN / Banco Agrario / Finagro",
    title: "Topes UVT de retención agropecuaria, facturación soporte y líneas de fomento agropecuario",
    version: "Vigencia fiscal 2026",
    lastVerifiedAt: "2026-11-14",
    updateFrequencyLabel: "Semanal (UVT/IBR) · 12h SIPSA",
    species: ["todas"],
    module: "finanzas",
    moduleLabel: "Finanzas y Presupuestos",
    appRoute: "/dashboard/finanzas",
    appRouteLabel: "Ir a Finanzas",
    sourceUrl: "https://www.dian.gov.co/",
    sourceLabel: "DIAN / Finagro · Normativa Agro",
    summary:
      "Parámetros tributarios vigentes en Colombia para compras agropecuarias directas sin retención hasta 92 UVT, compras generales 27 UVT, tratamiento de bienes excluidos/exentos de IVA y tasas IBR de crédito rural.",
    keyReferences: [
      "Tope retención en compras de productos agrícolas/pecuarios sin procesamiento industrial: 92 UVT vigentes (compras generales: 27 UVT).",
      "Contabilidad analítica anti-subsidio cruzado: separar costos directos por especie y prorratear indirectos (energía, mano de obra) para reportes bancarios.",
      "Líneas Finagro de capital de trabajo e inversión con tasa referenciada a IBR E.A. para Pequeño Productor y Mediano Productor.",
    ],
    complianceChecklist: [
      "Asociar comprador y proveedor con NIT/CC/RUT y conservar soporte de egresos.",
      "Revisar el punto de equilibrio unitario por especie antes de fijar precios mayoristas.",
      "Exportar estado financiero y flujo de caja en Excel/PDF para contador o solicitud Finagro.",
    ],
    ginaPrompts: [
      "¿Qué topes UVT DIAN aplican hoy a compras agropecuarias y generales en Colombia?",
      "¿Cómo me ayuda la app a separar costos por especie y preparar reportes para crédito Finagro?",
    ],
  },
];

export function getNormativeCatalogWithSyncMeta(
  lastVerifiedIso?: string,
  customItems: NormativeCatalogItem[] = [],
): NormativeCatalogMeta {
  const checkedDate =
    lastVerifiedIso && /^\d{4}-\d{2}-\d{2}/.test(lastVerifiedIso)
      ? lastVerifiedIso.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const normalizedCustom = customItems.map((item) => ({
    ...item,
    isCustom: true,
  }));

  const baseItems = NORMATIVE_CATALOG.map((item) => ({
    ...item,
    lastVerifiedAt: checkedDate,
  }));

  const items = [...normalizedCustom, ...baseItems];

  const countsByKind: Record<NormativeDocumentKind, number> = {
    norma: items.filter((i) => i.kind === "norma").length,
    estandar: items.filter((i) => i.kind === "estandar").length,
    guia: items.filter((i) => i.kind === "guia").length,
  };

  return {
    version: NORMATIVE_CATALOG_VERSION,
    lastCheckedAt: checkedDate,
    updateFrequencyLabel: "Semanal (cada 7 días)",
    totalItems: items.length,
    countsByKind,
    items,
  };
}
