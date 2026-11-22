import type { FarmPurposeKey } from "./onboarding";
import type { QuickCaptureMode } from "./quick-capture-events";
import type { SchoolCurriculumRouteId } from "./school-curriculum";
import { readCachedActiveFarmMeta } from "./active-farm-client";

export type NudgeTone = "emerald" | "amber" | "sky" | "slate";

export type NudgeReasonCode =
  | "objetivo_declarado"
  | "necesidad_explicita"
  | "evento_operativo"
  | "especie_etapa"
  | "rotacion_base";

export interface BehavioralNudgeItem {
  id: string;
  principle: string;
  message: string;
  tone: NudgeTone;
  actionLabel?: string;
  actionHref?: string;
  quickCaptureMode?: QuickCaptureMode;
  purposes?: readonly FarmPurposeKey[];
  species?: readonly string[];
  appGuideSlug?: string;
  schoolRouteId?: SchoolCurriculumRouteId;
}

export interface BehavioralNudgeGroup {
  key: string;
  label: string;
  nudges: readonly BehavioralNudgeItem[];
}

export const BEHAVIORAL_NUDGE_GROUPS: Record<string, BehavioralNudgeGroup> = {
  inicio: {
    key: "inicio",
    label: "Inicio · Rutina diaria",
    nudges: [
      {
        id: "ini-1",
        principle: "Regla de los 2 minutos",
        tone: "emerald",
        message: "Registrar huevos y alimento apenas salgas del galpón toma menos de 2 minutos y evita que el 20 % del dato diario se pierda al final de la tarde.",
        actionLabel: "Registro rápido",
        quickCaptureMode: "huevos",
      },
      {
        id: "ini-2",
        principle: "Continuidad de racha",
        tone: "amber",
        message: "Siete días seguidos con tus 4 registros esenciales completados bastan para que el tablero proyecte quiebre de bultos y punto de equilibrio sin supuestos.",
        actionLabel: "Ver cierre diario",
        actionHref: "/operaciones/cierre",
      },
      {
        id: "ini-3",
        principle: "Atención temprana",
        tone: "sky",
        message: "Antes de definir raciones o despachos de hoy, revisa clima ITH y alertas activas: un golpe de calor reduce el consumo antes de caer la postura.",
        actionLabel: "Clima y entorno",
        actionHref: "/analisis/fuentes-externas",
      },
      {
        id: "ini-4",
        principle: "Caja vs. libreta",
        tone: "slate",
        message: "Cada huevo roto o entregado en casa que no se anota distorsiona tu costo unitario real; inclúyelo hoy en tu parte diario.",
        actionLabel: "Registrar venta o consumo",
        quickCaptureMode: "venta",
      },
    ],
  },

  escanear: {
    key: "escanear",
    label: "Escáner QR de campo",
    nudges: [
      {
        id: "qr-1",
        principle: "Cero fricción",
        tone: "emerald",
        message: "Pega la placa QR plastificada a la altura de la puerta de cada galpón o jaula: escanear abre la ficha exacta sin buscar nombres en listas largas.",
        actionLabel: "Imprimir plancha QR",
        actionHref: "/configuracion/kit-campo",
      },
      {
        id: "qr-2",
        principle: "Identidad trazable",
        tone: "sky",
        message: "Cuando escaneas una estación sin conexión, el parte queda firmado localmente y sube apenas detecte señal en la casa o el pueblo.",
      },
      {
        id: "qr-3",
        principle: "Control de rondas",
        tone: "amber",
        message: "Hacer la lectura QR en la ronda de la mañana estandariza quién verificó agua, nidales y ventilación en cada alojamiento.",
      },
      {
        id: "qr-4",
        principle: "Auditoría rápida",
        tone: "slate",
        message: "Si recibes visitas técnicas o verificación ICA, mostrar la ficha del lote directamente desde el QR respalda la trazabilidad en segundos.",
      },
    ],
  },

  animales: {
    key: "animales",
    label: "Animales y lotes",
    nudges: [
      {
        id: "ani-1",
        principle: "Inventario vivo real",
        tone: "emerald",
        message: "Mantener el saldo vivo exacto por lote evita dosificar vacunas o bultos de concentrado de más para aves que ya salieron o tuvieron bajas.",
        actionLabel: "Registrar entrada",
        actionHref: "/produccion/adquisiciones",
      },
      {
        id: "ani-2",
        principle: "Prevención de consanguinidad",
        tone: "amber",
        message: "Registrar padre, madre o línea genética en adquisiciones te avisa a tiempo antes de cruzar pie de cría emparentado en reproductores.",
      },
      {
        id: "ani-3",
        principle: "Uniformidad es postura",
        tone: "sky",
        message: "Un lote con CV % menor al 10 % inicia postura parejo; pesar una muestra semanal cuesta 5 minutos y predice el pico de producción.",
        actionLabel: "Control de peso",
        actionHref: "/produccion/peso",
      },
      {
        id: "ani-4",
        principle: "Edad productiva",
        tone: "slate",
        message: "Separar animales improductivos o pasados de ciclo reduce el costo diario de alimento sin sacrificar el volumen real de huevos.",
      },
    ],
  },

  produccion_huevos: {
    key: "produccion_huevos",
    label: "Producción · Huevos NTC 1240",
    nudges: [
      {
        id: "hue-1",
        principle: "Valor por calibre",
        tone: "emerald",
        message: "Clasificar en Jumbo, AAA, AA, A y B según NTC 1240 evita regalar gramos en cubeta genérica y revela dónde está tu mejor margen por kilo de alimento.",
        actionLabel: "Registrar postura",
        quickCaptureMode: "huevos",
      },
      {
        id: "hue-2",
        principle: "Señal de cáscara",
        tone: "amber",
        message: "Si los huevos rotos o en fárfara superan el 2 % en dos días seguidos, revisa calcio en dieta, estrés térmico y frecuencia de recolección.",
      },
      {
        id: "hue-3",
        principle: "Salida PEPS",
        tone: "sky",
        message: "Despachar primero las cubetas más antiguas (PEPS) y vigilar temperatura de bodega protege la frescura y evita devoluciones de clientes.",
        actionLabel: "Inventario PEPS",
        actionHref: "/inventarios/huevos",
      },
      {
        id: "hue-4",
        principle: "Recolección en picos",
        tone: "slate",
        message: "Hacer al menos dos recolecciones al día (media mañana y media tarde) disminuye suciedad, picaje y quiebre dentro del nidal.",
      },
    ],
  },

  produccion_carne: {
    key: "produccion_carne",
    label: "Producción · Carne y beneficio",
    nudges: [
      {
        id: "car-1",
        principle: "Momento ideal de salida",
        tone: "amber",
        message: "Después del día óptimo de cada raza, cada kilo extra ganado consume mucho más concentrado y reduce la ganancia: revisa cuánta comida gasta por kilo antes de retener lotes.",
        actionLabel: "Ver curvas de crecimiento",
        actionHref: "/analisis/razas",
      },
      {
        id: "car-2",
        principle: "Bloqueo por carencia",
        tone: "emerald",
        message: "Nunca programes sacrificio sin revisar días de retiro farmacológico activos: el sistema bloquea automáticamente lotes con carencia vigente.",
        actionLabel: "Revisar sanidad",
        actionHref: "/sanidad/alertas",
      },
      {
        id: "car-3",
        principle: "Rendimiento en canal",
        tone: "sky",
        message: "Comparar peso vivo vs. peso en canal revela cuánto pierdes en ayuno, desplume o merma y ayuda a fijar precio justo por kilo limpio.",
      },
      {
        id: "car-4",
        principle: "Ayuno controlado",
        tone: "slate",
        message: "Retirar alimento solidificado con la ventana recomendada antes del beneficio mantiene agua limpia, mejora inocuidad y reduce decomisos.",
      },
    ],
  },

  produccion_gallinaza: {
    key: "produccion_gallinaza",
    label: "Producción · Gallinaza y subproductos",
    nudges: [
      {
        id: "gal-1",
        principle: "Ingreso oculto",
        tone: "emerald",
        message: "Valorizar cada bulto de gallinaza estabilizada reduce tu costo neto por huevo y por kilo de carne en la contabilidad de la granja.",
      },
      {
        id: "gal-2",
        principle: "Sanitización térmica",
        tone: "amber",
        message: "La gallinaza fresca quema raíces y dispersa patógenos; pasarla por compostaje a 55–65 °C multiplica su precio comercial y cumple ICA.",
        actionLabel: "Ir a compostaje",
        actionHref: "/operaciones/compostaje",
      },
      {
        id: "gal-3",
        principle: "Cama seca",
        tone: "sky",
        message: "Medir humedad y amoníaco al retirar cama previene lesiones podales en lotes siguientes y evita sobrecostos de cal o viruta.",
      },
      {
        id: "gal-4",
        principle: "Trazabilidad de despacho",
        tone: "slate",
        message: "Anotar destino (venta externa o abonado de huerta propia) mantiene cuadrado el balance ambiental y patrimonial del predio.",
      },
    ],
  },

  alimentacion: {
    key: "alimentacion",
    label: "Nutrición y alimentación",
    nudges: [
      {
        id: "ali-1",
        principle: "70 % del costo total",
        tone: "amber",
        message: "El concentrado representa cerca del 70 % del costo productivo: ajustar comederos al nivel del dorso del ave reduce desperdicio silencioso.",
        actionLabel: "Registrar ración",
        quickCaptureMode: "alimentacion",
      },
      {
        id: "ali-2",
        principle: "Compra anticipada",
        tone: "emerald",
        message: "Revisa los días de cobertura antes de quedar por debajo de 5 días de stock: comprar de afán encarece el flete y obliga a cambiar marca de golpe.",
        actionLabel: "Ver inventario alimento",
        actionHref: "/inventarios/alimentacion",
      },
      {
        id: "ali-3",
        principle: "Dieta combinada",
        tone: "sky",
        message: "En conejos y cuyes, balancear forraje oreado + concentrado evita timpanismo y baja el costo por kilo ganado manteniendo la proteína (%PC).",
      },
      {
        id: "ali-4",
        principle: "Real vs. tabla",
        tone: "slate",
        message: "Si el consumo real supera en más de 10 % la tabla de etapa, revisa fugas por roedores, comederos rotos o estrés por frío nocturno.",
      },
    ],
  },

  mortalidad: {
    key: "mortalidad",
    label: "Control de mortalidad y bajas",
    nudges: [
      {
        id: "mor-1",
        principle: "Regla de alarma",
        tone: "amber",
        message: "Registrar la causa exacta de cada baja (no solo la cantidad) permite detectar a tiempo brotes respiratorios, depredadores o aplastamiento.",
        actionLabel: "Registrar novedad",
        quickCaptureMode: "mortalidad",
      },
      {
        id: "mor-2",
        principle: "Bioseguridad inmediata",
        tone: "emerald",
        message: "Retirar bajas en la primera ronda del día y llevarlas a la pila térmica 7:2:2 o compostera corta vectores y olores alrededor del galpón.",
        actionLabel: "Compostaje térmico",
        actionHref: "/operaciones/compostaje",
      },
      {
        id: "mor-3",
        principle: "Ajuste automático de meta",
        tone: "sky",
        message: "Descontar bajas al instante recalcula el porcentaje real de postura de tu lote y evita pensar que las gallinas bajaron rendimiento cuando en realidad hay menos aves.",
      },
      {
        id: "mor-4",
        principle: "Necropsia de campo",
        tone: "slate",
        message: "Ante más de dos bajas seguidas con síntomas parecidos, adjunta foto y consulta normas sanitarias o a tu médico veterinario.",
      },
    ],
  },

  ubicaciones: {
    key: "ubicaciones",
    label: "Lugares de manejo y galpones",
    nudges: [
      {
        id: "ubi-1",
        principle: "Densidad y bienestar",
        tone: "emerald",
        message: "Respetar m²/ave y aves por nido/bebedero mejora conversión alimenticia y reduce mortalidad por picaje o hacinamiento.",
      },
      {
        id: "ubi-2",
        principle: "Vacío sanitario",
        tone: "amber",
        message: "Antes de trasladar un lote nuevo a un galpón o jaula, cumple limpieza, desinfección y descanso sanitario documentado.",
      },
      {
        id: "ubi-3",
        principle: "Rentabilidad por espacio",
        tone: "sky",
        message: "Comparar desempeño por lugar revela qué galpón sufre más calor, humedad o corrientes de aire para priorizar adecuaciones.",
      },
      {
        id: "ubi-4",
        principle: "Zona DIVIPOLA precisa",
        tone: "slate",
        message: "Tener la ubicación vinculada al municipio oficial permite recibir pronóstico ITH y precios mayoristas ajustados a tu región.",
      },
    ],
  },

  sanidad: {
    key: "sanidad",
    label: "Sanidad, retiros y bioseguridad ICA",
    nudges: [
      {
        id: "san-1",
        principle: "Cero residuos",
        tone: "amber",
        message: "Anotar cada dosis con sus días de carencia protege a tus clientes y previene sanciones sanitarias antes de vender huevo o carne.",
        actionLabel: "Ver alertas activas",
        actionHref: "/sanidad/alertas",
      },
      {
        id: "san-2",
        principle: "Prevención cuesta menos",
        tone: "emerald",
        message: "Cumplir el calendario de refuerzos a tiempo cuesta una fracción mínima frente a perder una semana de postura o mortalidad aguda.",
        actionLabel: "Calendario sanitario",
        actionHref: "/sanidad/calendario",
      },
      {
        id: "san-3",
        principle: "Arco y pediluvio",
        tone: "sky",
        message: "Registrar desinfección de ingreso y control de visitantes cumple las resoluciones ICA 3650–3652 y deja soporte listo ante auditorías.",
        actionLabel: "Bioseguridad POE",
        actionHref: "/sanidad/bioseguridad",
      },
      {
        id: "san-4",
        principle: "Cadena de frío",
        tone: "slate",
        message: "Verifica temperatura del biológico y fecha de vencimiento antes de aplicar; si falta registro ICA, revisa el vademécum en normas.",
      },
    ],
  },

  finanzas: {
    key: "finanzas",
    label: "Finanzas y punto de equilibrio",
    nudges: [
      {
        id: "fin-1",
        principle: "Anti-subsidio cruzado",
        tone: "emerald",
        message: "Separar ingresos y egresos por especie/lote evita que el margen de las ponedoras tape pérdidas ocultas en engorde o subproductos.",
        actionLabel: "Contabilidad analítica",
        actionHref: "/analisis/reportes?tab=analitica",
      },
      {
        id: "fin-2",
        principle: "Precio sobre costo real",
        tone: "amber",
        message: "Nunca cierres una venta sin contrastarla contra tu punto de equilibrio unitario; vender barato acelera las pérdidas cuando sube el bulto.",
        actionLabel: "Registrar venta",
        quickCaptureMode: "venta",
      },
      {
        id: "fin-3",
        principle: "Cartera vigilada",
        tone: "sky",
        message: "Anotar las entregas fiadas en Cuentas por Cobrar con fecha límite evita que el capital de trabajo se quede inmovilizado en clientes morosos.",
        actionLabel: "Revisar cuentas",
        actionHref: "/finanzas/cuentas",
      },
      {
        id: "fin-4",
        principle: "Todo gasto menor suma",
        tone: "slate",
        message: "Cal, empaques, bombillos y acarreos pequeños pueden sumar hasta 8 % del costo mensual; regístralos apenas pagues.",
        actionLabel: "Registrar egreso",
        quickCaptureMode: "gasto",
      },
    ],
  },

  inventarios: {
    key: "inventarios",
    label: "Inventarios y patrimonio",
    nudges: [
      {
        id: "inv-1",
        principle: "Lo que no se cuenta se fuga",
        tone: "amber",
        message: "Conciliar conteo físico semanal contra el saldo teórico del sistema detecta errores de pesado, mermas o retiros sin soporte.",
      },
      {
        id: "inv-2",
        principle: "Rotación PEPS",
        tone: "emerald",
        message: "Mover primero el huevo o alimento más antiguo protege calidad nutricional y evita descartes por vencimiento.",
      },
      {
        id: "inv-3",
        principle: "Patrimonio vivo",
        tone: "sky",
        message: "Tu inventario no es solo bodega: el valor biológico de aves en postura y engorde hace parte clave para bancos o balances DIAN.",
      },
      {
        id: "inv-4",
        principle: "Stock mínimo crítico",
        tone: "slate",
        message: "Mantén desinfectante, yodo y vitaminas de choque por encima del mínimo para no improvisar compras de urgencia en fin de semana.",
      },
    ],
  },

  almacen_operaciones: {
    key: "almacen_operaciones",
    label: "Almacén, mantenimiento y cierre",
    nudges: [
      {
        id: "alm-1",
        principle: "Cierre antifraude",
        tone: "emerald",
        message: "Cerrar la jornada antes de apagar luces congela el saldo auditado de huevos, dinero y alimento evitando correcciones ambiguas después.",
        actionLabel: "Ir a Cierre Diario",
        actionHref: "/operaciones/cierre",
      },
      {
        id: "alm-2",
        principle: "Preventivo vs. varada",
        tone: "amber",
        message: "Revisar bebederos, mallas, cortinas y termostatos antes de dañarse cuesta menos que reponer aves ahogadas o enfriadas.",
        actionLabel: "Ver mantenimiento",
        actionHref: "/operaciones/mantenimiento",
      },
      {
        id: "alm-3",
        principle: "Compostaje medido",
        tone: "sky",
        message: "Voltear la pila cuando supere o baje la banda térmica acelera la sanitización y evita olores y moscas alrededor del galpón.",
        actionLabel: "Ver pilas",
        actionHref: "/operaciones/compostaje",
      },
      {
        id: "alm-4",
        principle: "Vida útil de equipos",
        tone: "slate",
        message: "Anotar serial, fecha de compra y garantía de incubadoras o motobombas facilita cobrar garantías y calcular depreciación real.",
      },
    ],
  },

  planeacion: {
    key: "planeacion",
    label: "Planeación y rutinas",
    nudges: [
      {
        id: "pla-1",
        principle: "Reemplazo sin baches",
        tone: "emerald",
        message: "Planificar la entrada de pollitas de levante con 18–20 semanas de anticipación evita quedarte sin cubetas cuando sale el lote viejo.",
        actionLabel: "Plan de Parvada",
        actionHref: "/produccion/plan-parvada",
      },
      {
        id: "pla-2",
        principle: "Listas que reducen olvidos",
        tone: "sky",
        message: "Apoyarse en rutinas diarias y calendario visible libera carga mental del equipo y asegura continuidad cuando cambia el operario de turno.",
        actionLabel: "Ver calendario",
        actionHref: "/planeacion/calendario",
      },
      {
        id: "pla-3",
        principle: "Soberanía del hogar",
        tone: "amber",
        message: "Cuantificar huevos, carne y abono consumidos en la finca muestra cuánto dinero ahorra la granja en el presupuesto familiar.",
        actionLabel: "Soberanía alimentaria",
        actionHref: "/soberania",
      },
      {
        id: "pla-4",
        principle: "Horizonte 30 días",
        tone: "slate",
        message: "Mirar una vez a la semana los vencimientos próximos de vacunas, mantenimiento y pagos evita apagar incendios de última hora.",
      },
    ],
  },

  analisis: {
    key: "analisis",
    label: "Análisis, KPIs y entorno",
    nudges: [
      {
        id: "ana-1",
        principle: "Dato sobre corazonada",
        tone: "emerald",
        message: "Revisar postura, comida gastada por kilo ganado y costo por cubeta cada semana detecta lotes improductivos mucho antes de que falte plata.",
        actionLabel: "Abrir KPIs",
        actionHref: "/analisis/kpis",
      },
      {
        id: "ana-2",
        principle: "Contexto externo",
        tone: "sky",
        message: "Comparar tu precio en granja frente al promedio SIPSA y vigilar alertas ICA locales te da poder real de negociación frente a intermediarios.",
        actionLabel: "Clima y mercado",
        actionHref: "/analisis/fuentes-externas",
      },
      {
        id: "ana-3",
        principle: "Respaldo normativo a mano",
        tone: "amber",
        message: "Antes de cambiar calibres NTC 1240 o protocolos de retiro ICA, verifica la norma vigente en el catálogo y consulta dudas con Gina.",
        actionLabel: "Normas y guías",
        actionHref: "/analisis/normas",
      },
      {
        id: "ana-4",
        principle: "Reportes listos para soportar tu finca",
        tone: "slate",
        message: "Descargar el reporte mensual de ganancias con gastos compartidos bien repartidos deja todo listo para contador, impuestos o crédito agropecuario.",
        actionLabel: "Ver reportes",
        actionHref: "/analisis/reportes",
      },
      {
        id: "ana-5",
        principle: "Dinero en caja vs. lo que vale tu granja",
        tone: "emerald",
        message: "Comprar equipos y bultos baja el efectivo hoy, pero suma a tus bienes y solo se descuenta al usarse; no confundas falta de efectivo temporal con pérdida real.",
        actionLabel: "Ver KPIs",
        actionHref: "/analisis/kpis",
      },
    ],
  },

  configuracion: {
    key: "configuracion",
    label: "Configuración, catálogos y diagnóstico",
    nudges: [
      {
        id: "cfg-1",
        principle: "Un cambio, toda la granja",
        tone: "emerald",
        message: "Ajustar aquí tallas, razas, metas o estándares de peso alinea alertas, gráficas y reportes en todos los módulos sin duplicar trabajo.",
      },
      {
        id: "cfg-2",
        principle: "Escala progresiva",
        tone: "sky",
        message: "Activa módulos avanzados solo cuando tu operación los necesite; empezar simple multiplica el uso diario en galpón.",
        actionLabel: "Módulos progresivos",
        actionHref: "/configuracion/modulos",
      },
      {
        id: "cfg-3",
        principle: "Ubicación oficial",
        tone: "amber",
        message: "Elegir tu municipio DIVIPOLA carga clima local, altitud y referentes regionales de mercado automáticamente.",
      },
      {
        id: "cfg-4",
        principle: "Mejora continua",
        tone: "slate",
        message: "Si algo se comporta extraño en cualquier módulo, usa 'Reportar falla': el sistema etiqueta pantalla, red y contexto automáticamente.",
        actionLabel: "Historial de fallas",
        actionHref: "/configuracion/fallas",
      },
    ],
  },

  guia: {
    key: "guia",
    label: "Guía de uso y soporte",
    nudges: [
      {
        id: "gui-1",
        principle: "Aprender haciendo",
        tone: "emerald",
        message: "Cada guía enlaza directo a la pantalla real de tu granja: lee los 3 primeros pasos y aplica de una vez con un registro real.",
      },
      {
        id: "gui-2",
        principle: "Consulta en campo",
        tone: "sky",
        message: "Puedes abrir las normas ICA y estándares NTC 1240 directo desde Análisis → Normas y guías aplicables con adjuntos en PDF.",
        actionLabel: "Normas aplicables",
        actionHref: "/analisis/normas",
      },
      {
        id: "gui-3",
        principle: "Modo offline",
        tone: "amber",
        message: "Si estás en zona sin cobertura, el espejo offline y el registro rápido conservan tus partes hasta recuperar señal.",
      },
      {
        id: "gui-4",
        principle: "Atajo de búsqueda",
        tone: "slate",
        message: "Desde la barra superior (Ctrl+K) saltas al instante a cualquier guía, norma, especie o formulario sin navegar menú por menú.",
      },
    ],
  },
};

export function resolvePageNudgeGroup(
  pathname: string,
  searchQuery = "",
): BehavioralNudgeGroup {
  const cleanPath = (pathname || "/inicio").split("?")[0].replace(/\/+$/, "") || "/inicio";
  const params = new URLSearchParams(searchQuery.startsWith("?") ? searchQuery.slice(1) : searchQuery);
  const tab = (params.get("tab") || "").toLowerCase();

  if (cleanPath === "/inicio") return BEHAVIORAL_NUDGE_GROUPS.inicio;
  if (cleanPath.startsWith("/escanear")) return BEHAVIORAL_NUDGE_GROUPS.escanear;

  if (cleanPath.startsWith("/produccion")) {
    if (cleanPath.includes("/mortalidad")) return BEHAVIORAL_NUDGE_GROUPS.mortalidad;
    if (cleanPath.includes("/plan-parvada")) return BEHAVIORAL_NUDGE_GROUPS.planeacion;
    if (cleanPath.includes("/sacrificio") || cleanPath.includes("/carne") || tab === "carne") {
      return BEHAVIORAL_NUDGE_GROUPS.produccion_carne;
    }
    if (cleanPath.includes("/huevos") || tab === "huevos") {
      return BEHAVIORAL_NUDGE_GROUPS.produccion_huevos;
    }
    if (tab === "gallinaza") return BEHAVIORAL_NUDGE_GROUPS.produccion_gallinaza;
    if (tab === "alimentacion") return BEHAVIORAL_NUDGE_GROUPS.alimentacion;
    if (
      cleanPath.includes("/adquisiciones") ||
      cleanPath.includes("/peso") ||
      cleanPath.includes("/gallinas") ||
      cleanPath.includes("/pollos") ||
      cleanPath.includes("/incubacion") ||
      tab === "animales" ||
      tab === "incubacion" ||
      tab === "reproduccion"
    ) {
      return BEHAVIORAL_NUDGE_GROUPS.animales;
    }
    return BEHAVIORAL_NUDGE_GROUPS.produccion_huevos;
  }

  if (cleanPath.startsWith("/animales")) return BEHAVIORAL_NUDGE_GROUPS.animales;
  if (cleanPath.startsWith("/ubicaciones")) return BEHAVIORAL_NUDGE_GROUPS.ubicaciones;
  if (cleanPath.startsWith("/sanidad")) return BEHAVIORAL_NUDGE_GROUPS.sanidad;
  if (cleanPath.startsWith("/finanzas") || cleanPath.startsWith("/contactos")) {
    return BEHAVIORAL_NUDGE_GROUPS.finanzas;
  }
  if (cleanPath.startsWith("/inventarios/alimentacion")) {
    return BEHAVIORAL_NUDGE_GROUPS.alimentacion;
  }
  if (cleanPath.startsWith("/inventarios")) {
    return BEHAVIORAL_NUDGE_GROUPS.inventarios;
  }
  if (cleanPath.startsWith("/almacen") || cleanPath.startsWith("/operaciones")) {
    return BEHAVIORAL_NUDGE_GROUPS.almacen_operaciones;
  }
  if (cleanPath.startsWith("/planeacion") || cleanPath.startsWith("/soberania")) {
    return BEHAVIORAL_NUDGE_GROUPS.planeacion;
  }
  if (cleanPath.startsWith("/analisis")) return BEHAVIORAL_NUDGE_GROUPS.analisis;
  if (cleanPath.startsWith("/configuracion") || cleanPath.startsWith("/exportar")) {
    return BEHAVIORAL_NUDGE_GROUPS.configuracion;
  }
  if (cleanPath.startsWith("/manual") || cleanPath.startsWith("/guia")) {
    return BEHAVIORAL_NUDGE_GROUPS.guia;
  }

  return BEHAVIORAL_NUDGE_GROUPS.inicio;
}

const CURSOR_PREFIX = "gallinero_nudge_cursor_v1:";

export interface PickedNudgeResult {
  index: number;
  total: number;
  nudge: BehavioralNudgeItem;
}

/**
 * Selecciona y avanza secuencialmente el índice del nudge para `pageKey` en `storage`,
 * garantizando que cada apertura o recarga de página muestre un mensaje distinto.
 */
export function pickNextRotatingNudge(
  pageKey: string,
  nudges: readonly BehavioralNudgeItem[],
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
  options?: { advance?: boolean; stepOffset?: number },
): PickedNudgeResult {
  const safeList = nudges.length > 0 ? nudges : BEHAVIORAL_NUDGE_GROUPS.inicio.nudges;
  const total = safeList.length;
  const advance = options?.advance ?? true;
  const stepOffset = options?.stepOffset ?? 1;
  const storageKey = `${CURSOR_PREFIX}${pageKey}`;

  let prevIndex = -1;
  if (storage) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw !== null) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed < total) {
          prevIndex = parsed;
        }
      }
    } catch {
      prevIndex = -1;
    }
  }

  const nextIndex = advance
    ? (((prevIndex < 0 ? 0 : prevIndex + stepOffset) % total) + total) % total
    : prevIndex >= 0
      ? prevIndex
      : 0;

  if (storage && advance) {
    try {
      storage.setItem(storageKey, String(nextIndex));
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }

  return {
    index: nextIndex,
    total,
    nudge: safeList[nextIndex],
  };
}

// ─── Bucle de retroalimentación adaptativa (Capacidad 3) ───

export const NUDGE_FEEDBACK_STORAGE_KEY = "gallinero_nudge_feedback_v1";
const NUDGE_DISMISS_COOLDOWN_MS = 86_400_000; // 24 h

export type NudgeFeedbackOutcome = "shown" | "acted" | "dismissed" | "skipped";

export interface NudgeFeedbackStats {
  nudgeId: string;
  shownCount: number;
  actedCount: number;
  dismissedCount: number;
  skippedCount: number;
  lastShownAt: number;
  lastActedAt: number;
  lastDismissedAt: number;
}

export interface NudgeUtilityEvaluation {
  score: number;
  conversionRate: number;
  isCooledDown: boolean;
  prioritizedByHistory: boolean;
}

export interface AdaptiveNudgeResult extends PickedNudgeResult {
  prioritizedByHistory: boolean;
  utilityScore: number;
  reasonCode?: NudgeReasonCode;
  appGuideHref?: string;
  schoolRouteId?: SchoolCurriculumRouteId;
}

interface NudgeGroupContextMeta {
  purposes: readonly FarmPurposeKey[];
  species?: readonly string[];
  appGuideSlug: string;
  schoolRouteId: SchoolCurriculumRouteId;
}

const NUDGE_GROUP_META: Record<string, NudgeGroupContextMeta> = {
  inicio: { purposes: ["hogar", "ingresos", "aprendizaje"], appGuideSlug: "primeros-pasos", schoolRouteId: "manejo_bienestar" },
  escanear: { purposes: ["aprendizaje", "proyecto"], appGuideSlug: "escanear-qr", schoolRouteId: "tecnologia_campo" },
  animales: { purposes: ["hogar", "ingresos", "reproduccion"], appGuideSlug: "trazabilidad-genetica", schoolRouteId: "manejo_bienestar" },
  produccion_huevos: { purposes: ["hogar", "ingresos"], species: ["gallina", "codorniz", "pato"], appGuideSlug: "recoger-huevos", schoolRouteId: "produccion_calidad" },
  produccion_carne: { purposes: ["ingresos", "hogar"], species: ["pollo", "pato", "conejo", "cuy"], appGuideSlug: "sacrificio-aves", schoolRouteId: "produccion_calidad" },
  produccion_gallinaza: { purposes: ["sostenibilidad", "hogar", "ingresos"], appGuideSlug: "gallinaza-produccion", schoolRouteId: "sostenibilidad_mejora" },
  alimentacion: { purposes: ["hogar", "ingresos", "sostenibilidad"], appGuideSlug: "alimentar-aves", schoolRouteId: "nutricion_bodega" },
  mortalidad: { purposes: ["hogar", "ingresos", "aprendizaje"], appGuideSlug: "alertas-mortalidad", schoolRouteId: "sanidad_bioseguridad" },
  ubicaciones: { purposes: ["hogar", "aprendizaje", "proyecto"], appGuideSlug: "lugares-manejo", schoolRouteId: "manejo_bienestar" },
  sanidad: { purposes: ["hogar", "ingresos", "aprendizaje"], appGuideSlug: "bioseguridad-bienestar", schoolRouteId: "sanidad_bioseguridad" },
  finanzas: { purposes: ["ingresos", "proyecto"], appGuideSlug: "registrar-venta", schoolRouteId: "gestion_economica" },
  inventarios: { purposes: ["ingresos", "hogar", "sostenibilidad"], appGuideSlug: "balance-inventarios", schoolRouteId: "nutricion_bodega" },
  almacen_operaciones: { purposes: ["sostenibilidad", "proyecto", "ingresos"], appGuideSlug: "cierre-sensores", schoolRouteId: "sostenibilidad_mejora" },
  planeacion: { purposes: ["hogar", "proyecto", "aprendizaje"], appGuideSlug: "calendario-rutinas", schoolRouteId: "manejo_bienestar" },
  analisis: { purposes: ["ingresos", "aprendizaje", "sostenibilidad"], appGuideSlug: "kpis-reportes", schoolRouteId: "produccion_calidad" },
  configuracion: { purposes: ["aprendizaje", "proyecto"], appGuideSlug: "configuracion-general", schoolRouteId: "tecnologia_campo" },
  guia: { purposes: ["aprendizaje", "proyecto"], appGuideSlug: "modo-offline-voz", schoolRouteId: "tecnologia_campo" },
};

const NUDGE_PREFIX_TO_GROUP: Record<string, string> = {
  ini: "inicio",
  qr: "escanear",
  ani: "animales",
  hue: "produccion_huevos",
  car: "produccion_carne",
  gal: "produccion_gallinaza",
  ali: "alimentacion",
  mor: "mortalidad",
  ubi: "ubicaciones",
  san: "sanidad",
  fin: "finanzas",
  inv: "inventarios",
  alm: "almacen_operaciones",
  pla: "planeacion",
  ana: "analisis",
  cfg: "configuracion",
  gui: "guia",
};

const NUDGE_OVERRIDES: Record<string, Partial<NudgeGroupContextMeta>> = {
  "ini-1": { purposes: ["hogar", "ingresos"], appGuideSlug: "recoger-huevos", schoolRouteId: "produccion_calidad" },
  "ini-2": { purposes: ["ingresos", "sostenibilidad"], appGuideSlug: "cierre-sensores", schoolRouteId: "nutricion_bodega" },
  "ini-4": { purposes: ["hogar", "ingresos"], appGuideSlug: "soberania-alimentaria", schoolRouteId: "sostenibilidad_mejora" },
  "ani-2": { purposes: ["reproduccion"], appGuideSlug: "trazabilidad-genetica", schoolRouteId: "manejo_bienestar" },
  "ani-3": { purposes: ["hogar", "ingresos"], species: ["gallina", "codorniz", "pato"], appGuideSlug: "control-peso", schoolRouteId: "produccion_calidad" },
  "ani-4": { purposes: ["hogar", "ingresos"], species: ["gallina", "codorniz"], appGuideSlug: "gestionar-gallinas", schoolRouteId: "produccion_calidad" },
  "ali-3": { purposes: ["hogar", "sostenibilidad"], species: ["conejo", "cuy"], appGuideSlug: "alimentar-aves", schoolRouteId: "nutricion_bodega" },
  "mor-2": { purposes: ["sostenibilidad", "hogar"], appGuideSlug: "compostaje", schoolRouteId: "sostenibilidad_mejora" },
  "mor-3": { purposes: ["hogar", "ingresos"], species: ["gallina", "codorniz"], appGuideSlug: "alertas-mortalidad", schoolRouteId: "produccion_calidad" },
  "fin-1": { purposes: ["ingresos"], appGuideSlug: "balance-financiero", schoolRouteId: "gestion_economica" },
  "fin-2": { purposes: ["ingresos"], appGuideSlug: "registrar-venta", schoolRouteId: "comercializacion_red" },
  "fin-3": { purposes: ["ingresos"], appGuideSlug: "cuentas-cobrar-pagar", schoolRouteId: "comercializacion_red" },
  "fin-4": { purposes: ["ingresos", "hogar"], appGuideSlug: "registrar-egreso", schoolRouteId: "gestion_economica" },
  "pla-3": { purposes: ["hogar", "sostenibilidad"], appGuideSlug: "soberania-alimentaria", schoolRouteId: "sostenibilidad_mejora" },
  "ana-3": { purposes: ["aprendizaje", "ingresos"], appGuideSlug: "normas-estandares", schoolRouteId: "sanidad_bioseguridad" },
};

export function resolveNudgeContextMeta(
  item: BehavioralNudgeItem,
  pageKey?: string,
): NudgeGroupContextMeta {
  const prefix = item.id.split("-")[0] || "";
  const groupFromPage = pageKey && pageKey.includes(":") ? pageKey.split(":")[0] : "";
  const resolvedGroup = NUDGE_PREFIX_TO_GROUP[prefix] || groupFromPage || "inicio";
  const groupMeta = NUDGE_GROUP_META[resolvedGroup] || NUDGE_GROUP_META.inicio;
  const override = NUDGE_OVERRIDES[item.id] || {};
  return {
    purposes: item.purposes || override.purposes || groupMeta.purposes,
    species: item.species || override.species || groupMeta.species,
    appGuideSlug: item.appGuideSlug || override.appGuideSlug || groupMeta.appGuideSlug,
    schoolRouteId: item.schoolRouteId || override.schoolRouteId || groupMeta.schoolRouteId,
  };
}

export function resolveNudgeFeedbackStorageKey(farmId?: string | null): string {
  const effectiveFarmId =
    farmId !== undefined
      ? farmId
      : typeof window !== "undefined"
        ? readCachedActiveFarmMeta()?.id ?? null
        : null;
  const trimmed = typeof effectiveFarmId === "string" ? effectiveFarmId.trim() : "";
  return trimmed ? `${NUDGE_FEEDBACK_STORAGE_KEY}:${trimmed}` : NUDGE_FEEDBACK_STORAGE_KEY;
}

export function getNudgeFeedbackMap(
  storage?: Pick<Storage, "getItem"> | null,
  farmId?: string | null,
): Record<string, NudgeFeedbackStats> {
  if (!storage) return {};
  try {
    const key = resolveNudgeFeedbackStorageKey(farmId);
    const raw = storage.getItem(key) ?? (key !== NUDGE_FEEDBACK_STORAGE_KEY ? storage.getItem(NUDGE_FEEDBACK_STORAGE_KEY) : null);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, NudgeFeedbackStats>;
  } catch {
    return {};
  }
}

function emptyStats(nudgeId: string): NudgeFeedbackStats {
  return {
    nudgeId,
    shownCount: 0,
    actedCount: 0,
    dismissedCount: 0,
    skippedCount: 0,
    lastShownAt: 0,
    lastActedAt: 0,
    lastDismissedAt: 0,
  };
}

export function recordNudgeFeedback(
  nudgeId: string,
  outcome: NudgeFeedbackOutcome,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
  nowMs: number = Date.now(),
  farmId?: string | null,
): NudgeFeedbackStats {
  const map = getNudgeFeedbackMap(storage, farmId);
  const current = map[nudgeId] ? { ...emptyStats(nudgeId), ...map[nudgeId] } : emptyStats(nudgeId);

  if (outcome === "shown") {
    current.shownCount += 1;
    current.lastShownAt = nowMs;
  } else if (outcome === "acted") {
    current.actedCount += 1;
    current.lastActedAt = nowMs;
  } else if (outcome === "dismissed") {
    current.dismissedCount += 1;
    current.lastDismissedAt = nowMs;
  } else if (outcome === "skipped") {
    current.skippedCount += 1;
  }

  map[nudgeId] = current;
  if (storage) {
    try {
      // Limitar a 120 nudges más recientes para mantener almacenamiento mínimo
      const entries = Object.entries(map).slice(-120);
      storage.setItem(resolveNudgeFeedbackStorageKey(farmId), JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Ignore storage quota errors
    }
  }
  return current;
}

export function computeNudgeUtilityScore(
  nudgeId: string,
  statsMap: Record<string, NudgeFeedbackStats>,
  nowMs: number = Date.now(),
): NudgeUtilityEvaluation {
  const stats = statsMap[nudgeId];
  if (!stats) {
    return {
      score: 0.5,
      conversionRate: 0,
      isCooledDown: false,
      prioritizedByHistory: false,
    };
  }

  const conversionRate = (stats.actedCount + 1) / (stats.shownCount + 2);
  const isCooledDown =
    stats.lastDismissedAt > 0 && nowMs - stats.lastDismissedAt < NUDGE_DISMISS_COOLDOWN_MS;
  const cooldownPenalty = isCooledDown ? 1.5 : 0;

  const rawScore =
    conversionRate +
    0.35 * stats.actedCount -
    0.45 * stats.dismissedCount -
    0.15 * stats.skippedCount -
    cooldownPenalty;

  return {
    score: Number(rawScore.toFixed(4)),
    conversionRate: Number(conversionRate.toFixed(4)),
    isCooledDown,
    prioritizedByHistory: stats.actedCount > 0 && stats.actedCount > stats.dismissedCount,
  };
}

/**
 * Selecciona el siguiente nudge combinando la rotación secuencial base con utilidad histórica real:
 * - Si no existe historial de interacción (`acted`/`dismissed`/`skipped`), mantiene la rotación exacta de `pickNextRotatingNudge`.
 * - Si existen señales previas, prioriza los nudges útiles (no enfriados) con mayor utilidad empírica.
 */
export function pickAdaptiveNudge(
  pageKey: string,
  nudges: readonly BehavioralNudgeItem[],
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
  options?: {
    advance?: boolean;
    nowMs?: number;
    purposes?: readonly FarmPurposeKey[];
    primaryPurpose?: FarmPurposeKey | null;
    activeSpecies?: readonly string[];
  },
): AdaptiveNudgeResult {
  const safeList = nudges.length > 0 ? nudges : BEHAVIORAL_NUDGE_GROUPS.inicio.nudges;
  const nowMs = options?.nowMs ?? Date.now();
  const feedbackMap = getNudgeFeedbackMap(storage);
  const activePurposes = (options?.purposes ?? []).filter(Boolean);
  const primaryPurpose = options?.primaryPurpose ?? activePurposes[0] ?? null;
  const activeSpecies = (options?.activeSpecies ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);

  const hasFeedbackSignal = safeList.some((item) => {
    const st = feedbackMap[item.id];
    return Boolean(st && (st.actedCount > 0 || st.dismissedCount > 0 || st.skippedCount > 0));
  });
  const hasContextFilter = activePurposes.length > 0 || activeSpecies.length > 0;

  if (!hasFeedbackSignal && !hasContextFilter) {
    const base = pickNextRotatingNudge(pageKey, safeList, storage, options);
    const meta = resolveNudgeContextMeta(base.nudge, pageKey);
    return {
      ...base,
      prioritizedByHistory: false,
      utilityScore: 0.5,
      reasonCode: "rotacion_base",
      appGuideHref: `/guia/${meta.appGuideSlug}`,
      schoolRouteId: meta.schoolRouteId,
    };
  }

  const total = safeList.length;
  const storageKey = `${CURSOR_PREFIX}${pageKey}`;
  let prevIndex = -1;
  if (storage) {
    try {
      const raw = storage.getItem(storageKey);
      if (raw !== null) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed < total) {
          prevIndex = parsed;
        }
      }
    } catch {
      prevIndex = -1;
    }
  }

  const advance = options?.advance ?? true;
  const evaluated = safeList.map((item, idx) => {
    const evalRes = computeNudgeUtilityScore(item.id, feedbackMap, nowMs);
    const meta = resolveNudgeContextMeta(item, pageKey);
    let purposeBonus = 0;
    if (primaryPurpose && meta.purposes.includes(primaryPurpose)) {
      purposeBonus = 0.3;
    } else if (activePurposes.some((p) => meta.purposes.includes(p))) {
      purposeBonus = 0.18;
    }

    let speciesMismatchPenalty = 0;
    if (activeSpecies.length > 0 && meta.species && meta.species.length > 0) {
      const matchesSpecies = meta.species.some((sp) => activeSpecies.includes(sp));
      if (!matchesSpecies) speciesMismatchPenalty = 0.65;
    }

    const totalScore = Number((evalRes.score + purposeBonus - speciesMismatchPenalty).toFixed(4));
    const circularOffset = ((idx - (prevIndex < 0 ? -1 : prevIndex) + total) % total) || total;
    return { item, idx, evalRes, meta, purposeBonus, speciesMismatchPenalty, totalScore, circularOffset };
  });

  const nonCooled = evaluated.filter((e) => !e.evalRes.isCooledDown);
  const pool = nonCooled.length > 0 ? nonCooled : evaluated;

  pool.sort((a, b) => {
    // Al avanzar manualmente, evitamos repetir el mismo nudge si hay otro con utilidad competitiva
    if (advance && a.idx === prevIndex && pool.length > 1) return 1;
    if (advance && b.idx === prevIndex && pool.length > 1) return -1;
    const scoreDiff = b.totalScore - a.totalScore;
    if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
    return a.circularOffset - b.circularOffset;
  });

  const winner = pool[0];
  if (storage && advance) {
    try {
      storage.setItem(storageKey, String(winner.idx));
    } catch {
      // Ignore storage errors
    }
  }

  const reasonCode: NudgeReasonCode =
    winner.evalRes.prioritizedByHistory
      ? "evento_operativo"
      : winner.purposeBonus > 0
        ? "objetivo_declarado"
        : activeSpecies.length > 0 && pool.some((p) => p.speciesMismatchPenalty > 0)
          ? "especie_etapa"
          : "rotacion_base";

  return {
    index: winner.idx,
    total,
    nudge: winner.item,
    prioritizedByHistory: winner.evalRes.prioritizedByHistory,
    utilityScore: winner.totalScore,
    reasonCode,
    appGuideHref: `/guia/${winner.meta.appGuideSlug}`,
    schoolRouteId: winner.meta.schoolRouteId,
  };
}
