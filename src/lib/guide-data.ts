// ─── Guide content data & search helpers ───
// Cada guía refleja la estructura real de navegación y pantallas de El Gallinero.
// Todas las capturas en `type: "screenshot"` apuntan a archivos verificados en `public/images/guia/`.

export type SectionType = "intro" | "steps" | "tip" | "warning" | "note" | "diagram" | "screenshot";

export interface DiagramNode {
  id: string;
  label: string;
  icon?: string;
  color?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
}

export interface GuideSection {
  type: SectionType;
  text?: string;
  title?: string;
  items?: string[];
  /** Para secciones tipo "diagram" */
  nodes?: DiagramNode[];
  connections?: DiagramConnection[];
  layout?: "horizontal" | "vertical";
  /** Para secciones tipo "screenshot" */
  image?: string;
  alt?: string;
  caption?: string;
  badge?: string;
  targetHref?: string;
  targetLabel?: string;
}

export interface Guide {
  slug: string;
  title: string;
  module: string;
  icon: string;
  summary: string;
  estimatedMinutes: number;
  tags: string[];
  relatedHrefs: { href: string; label: string }[];
  sections: GuideSection[];
}

export interface GuideModule {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface GuideWorkflow {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge: string;
  slugs: string[];
}

export const guideModules: GuideModule[] = [
  {
    id: "primeros-pasos",
    label: "Primeros Pasos y Offline",
    icon: "rocket",
    description: "Inicio diario, buscador global, copia offline y Asistente IA con voz",
  },
  {
    id: "escanear-qr",
    label: "Escáner QR y Etiquetas",
    icon: "qr-code",
    description: "Escaneo en campo de galpones, aves, lotes y equipos",
  },
  {
    id: "animales",
    label: "Animales y Genética",
    icon: "paw-print",
    description: "Parvada multiespecie, entradas, biometría e incubación",
  },
  {
    id: "ubicaciones",
    label: "Lugares de Manejo",
    icon: "map-pin",
    description: "Galpones, potreros, ocupación, QR y desempeño espacial",
  },
  {
    id: "produccion",
    label: "Producción",
    icon: "egg",
    description: "Postura de huevos, carne en canal y gestión de gallinaza",
  },
  {
    id: "inventarios",
    label: "Inventarios",
    icon: "package",
    description: "Balance patrimonial y trazabilidad FIFO de huevos y carne",
  },
  {
    id: "almacen",
    label: "Almacén y Equipos",
    icon: "package-open",
    description: "Alimentos, insumos, activos, maquinaria y mantenimiento",
  },
  {
    id: "planeacion",
    label: "Planeación y Soberanía",
    icon: "calendar-days",
    description: "Plan de parvada, metas semanales y autoconsumo del hogar",
  },
  {
    id: "sanidad",
    label: "Sanidad y Mortalidad",
    icon: "pill",
    description: "Plan sanitario, vacunaciones, alertas y bajas",
  },
  {
    id: "finanzas",
    label: "Finanzas y Cuentas",
    icon: "money",
    description: "Ventas, egresos, cuentas por cobrar/pagar, P&L y presupuestos",
  },
  {
    id: "analisis",
    label: "Análisis y Curvas",
    icon: "bar-chart",
    description: "KPIs productivos, curvas estándar por raza y reportes",
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: "settings",
    description: "Catálogos maestros, parámetros globales y vacunación",
  },
];

export const GUIDE_WORKFLOWS: GuideWorkflow[] = [
  {
    id: "operacion-diaria",
    title: "Rutina operativa diaria",
    description: "Arranca en el tablero, recoge huevos en modo rápido o desde el escáner QR y registra alimento.",
    icon: "sun",
    badge: "Diario · 5 min",
    slugs: ["primeros-pasos", "escanear-qr", "recoger-huevos", "alimentar-aves"],
  },
  {
    id: "campo-sin-internet",
    title: "Trabajo de campo sin señal",
    description: "Descarga la copia completa al celular, dicta notas por voz y sincroniza automáticamente al volver.",
    icon: "smartphone",
    badge: "Offline + Voz",
    slugs: ["modo-offline-voz", "asistente-operativo", "escanear-qr"],
  },
  {
    id: "trazabilidad-total",
    title: "Trazabilidad de animal y lote",
    description: "Registra linaje al ingreso, ubica en galpón/potrero, pesa muestras semanales y controla su salida.",
    icon: "dna",
    badge: "Ciclo completo",
    slugs: ["trazabilidad-genetica", "lugares-manejo", "control-peso", "sacrificio-aves"],
  },
  {
    id: "salud-finanzas",
    title: "Cierre semanal sanitario y contable",
    description: "Revisa vacunas vencidas, cobra saldos pendientes en CxC/CxP y contrasta tu margen real.",
    icon: "money",
    badge: "Semanal",
    slugs: ["plan-sanitario", "registrar-venta", "cuentas-cobrar-pagar", "kpis-reportes"],
  },
];

export const guides: Guide[] = [
  // ═══════════════════════════════════════════
  // PRIMEROS PASOS Y OFFLINE
  // ═══════════════════════════════════════════
  {
    slug: "primeros-pasos",
    title: "Primeros pasos e interfaz general",
    module: "primeros-pasos",
    icon: "rocket",
    summary:
      "Conoce el tablero Inicio, la barra superior (estado offline, buscador Ctrl+K y botón Crear +) y los atajos rápidos en móvil y PC.",
    estimatedMinutes: 4,
    tags: ["inicio", "dashboard", "ctrl+k", "buscar", "crear", "móvil", "atajos"],
    relatedHrefs: [
      { href: "/dashboard", label: "Ir a Inicio" },
      { href: "/dashboard/configuracion/catalogos", label: "Catálogos del sistema" },
      { href: "/dashboard/animales", label: "Ver Animales" },
    ],
    sections: [
      {
        type: "intro",
        text: "El tablero Inicio reúne los signos vitales de tu finca avícola y multi-especie en un vistazo: aves activas, postura del día, reservas de alimento, margen del mes y checklist pendiente de configuración o sanidad.",
      },
      {
        type: "screenshot",
        title: "Tablero principal Inicio y barra de herramientas",
        image: "/images/guia/inicio-dashboard.webp",
        alt: "Captura del tablero principal Inicio de El Gallinero con resumen de aves, huevos, alimento, finanzas y la barra superior",
        caption:
          "En la parte superior derecha tienes siempre tres controles en línea: el indicador de conexión y copia offline, el buscador global Ctrl+K y el botón Crear + para abrir cualquier formulario sin navegar menús.",
        badge: "Pantalla principal",
        targetHref: "/dashboard",
        targetLabel: "Abrir Inicio",
      },
      {
        type: "steps",
        title: "Orientarte en 4 pasos el primer día",
        items: [
          "Revisa los catálogos base en Configuración → Catálogos y verifica tamaños de huevo, razas y precios de referencia.",
          "Crea al menos un espacio en Animales → Lugares de manejo (por ejemplo Galpón Principal o Potrero Norte) antes de ingresar lotes nuevos.",
          "En el botón Crear + de la barra superior o en el dock inferior móvil (+ Registrar) accede al formulario directo de huevos, alimentación, ventas, egresos, bajas o pesajes.",
          "En cada página encontrarás un buscador alineado sobre el contenido o tabla para filtrar al instante sin perder contexto.",
        ],
      },
      {
        type: "screenshot",
        title: "Buscador global inteligente (Ctrl+K)",
        image: "/images/guia/buscar-global-modal.webp",
        alt: "Modal del buscador global Ctrl+K filtrando resultados para el término huev",
        caption:
          "Pulsa Ctrl+K (o Cmd+K en Mac) o haz clic en «Buscar» para saltar a cualquier módulo o formulario buscando incluso por sinónimos cotidianos como «potrero», «gastos», «equipos» o «linaje».",
        badge: "Navegación rápida",
        targetHref: "/dashboard",
        targetLabel: "Probar Ctrl+K",
      },
      {
        type: "screenshot",
        title: "Modal de captura rápida en campo",
        image: "/images/guia/captura-rapida-modal.webp",
        alt: "Ventana modal de Captura rápida en modo recolección de huevos",
        caption:
          "Desde la barra inferior en móvil («Registrar») o tras escanear un QR se abre este formulario ultracorto que guarda en un toque y funciona también sin internet.",
        badge: "Captura ágil",
        targetHref: "/dashboard/escanear",
        targetLabel: "Ver acciones rápidas",
      },
      {
        type: "diagram",
        title: "Flujo de información dentro del sistema",
        nodes: [
          { id: "lugares", label: "Lugares y Animales", icon: "paw-print", color: "green" },
          { id: "diario", label: "Captura Diaria / QR", icon: "egg", color: "amber" },
          { id: "inv", label: "Inventarios FIFO", icon: "package", color: "blue" },
          { id: "fin", label: "Finanzas y CxC/CxP", icon: "money", color: "emerald" },
          { id: "kpi", label: "KPIs y Soberanía", icon: "bar-chart", color: "purple" },
        ],
        connections: [
          { from: "lugares", to: "diario", label: "Asocia galpón o lote" },
          { from: "diario", to: "inv", label: "Actualiza existencias" },
          { from: "inv", to: "fin", label: "Descuenta ventas/costos" },
          { from: "fin", to: "kpi", label: "Calcula margen y metas" },
        ],
      },
      {
        type: "tip",
        title: "Lista inicial recomendada en Inicio",
        text: "Si ves tarjetas de configuración pendiente en Inicio, resuelve primero la revisión de precios, etapas y calendario sanitario; una vez marcadas como listas no vuelven a molestarte.",
      },
    ],
  },
  {
    slug: "modo-offline-voz",
    title: "Modo offline, copia completa y notas de voz",
    module: "primeros-pasos",
    icon: "smartphone",
    summary:
      "Descarga una copia navegable de toda la aplicación y datos en tu celular, registra sin señal y graba notas de voz en campo.",
    estimatedMinutes: 3,
    tags: ["offline", "sin conexión", "pwa", "copia", "sincronizar", "outbox", "voz", "audio"],
    relatedHrefs: [
      { href: "/dashboard", label: "Abrir estado En línea" },
      { href: "/dashboard/escanear", label: "Escáner QR offline" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Gallinero incluye un motor PWA + IndexedDB diseñado para fincas con señal intermitente. Guarda pantallas, activos visuales y datos en el dispositivo para que puedas abrir módulos, escanear QR y capturar registros sin recibir «Error cargando datos» cuando estás fuera de cobertura.",
      },
      {
        type: "screenshot",
        title: "Panel de Copia Offline y Cola de Sincronización",
        image: "/images/guia/offline-copia-modal.webp",
        alt: "Modal de estado de conexión mostrando la sección Copia completa en el dispositivo y registros pendientes",
        caption:
          "Haz clic en la píldora «En línea» (o «Sin conexión / Offline») en la barra superior para ver cuántas pantallas y módulos están replicados, forzar una copia actualizada o revisar la cola local antes de sincronizar.",
        badge: "Resiliencia rural",
        targetHref: "/dashboard",
        targetLabel: "Revisar estado de copia",
      },
      {
        type: "steps",
        title: "Preparar el celular antes de salir al galpón",
        items: [
          "Con Wi-Fi o buena señal móvil, inicia sesión y toca la píldora «En línea» en la parte superior derecha.",
          "Verifica el bloque «Copia completa en el dispositivo» y presiona «Guardar copia» o «Actualizar copia» hasta llegar al 100 %.",
          "Mientras recorres los potreros sin señal puedes abrir módulos cacheados, escanear códigos QR y guardar huevos, alimentación, mortalidad, ventas o egresos en la cola local.",
          "Si no tienes manos libres para escribir, abre el Asistente o el dock móvil de voz y graba una nota de audio; quedará guardada en tu teléfono hasta recuperar conexión.",
          "Al reconectar, el sistema envía automáticamente la cola pendiente con identificador único (sin duplicados) y transcribe tus notas de voz para confirmar los registros.",
        ],
      },
      {
        type: "warning",
        text: "Evita cerrar sesión o borrar los datos del navegador mientras tengas registros pendientes en «Offline (N)»; primero recupera señal y verifica que el contador vuelva a «En línea» sin pendientes.",
      },
      {
        type: "note",
        text: "Las lecturas sin conexión reflejan la última copia sincronizada junto con los cambios optimistas que registraste en tu dispositivo. Las pantallas públicas de solo lectura (/guia) también quedan cacheadas para consulta en terreno.",
      },
    ],
  },
  {
    slug: "asistente-operativo",
    title: "Asistente IA y registro por voz",
    module: "primeros-pasos",
    icon: "sparkles",
    summary:
      "Consulta datos de la finca en lenguaje natural, dicta capturas por voz o audio offline y confirma cada escritura antes de guardarla.",
    estimatedMinutes: 3,
    tags: ["asistente", "ia", "chat", "voz", "dictado", "confirmación", "herramientas"],
    relatedHrefs: [
      { href: "/dashboard", label: "Abrir Asistente en Inicio" },
      { href: "/dashboard/escanear", label: "Complementar con QR" },
    ],
    sections: [
      {
        type: "intro",
        text: "El botón flotante «Asistente» está disponible en la esquina inferior derecha del dashboard. Lee tus datos reales (aves, huevos, saldos, ubicaciones, activos, sanidad) y te ayuda a preparar registros escritos o por voz sin salir de la pantalla donde estás trabajando.",
      },
      {
        type: "screenshot",
        title: "Panel lateral del Asistente Operativo",
        image: "/images/guia/asistente-ia.webp",
        alt: "Drawer lateral del Asistente Operativo mostrando sugerencias de consulta, campo de mensaje y controles de voz",
        caption:
          "Incluye historial de conversaciones, botones de preguntas frecuentes («¿Cómo está la granja hoy?») y entrada de texto o micrófono para dictado en tiempo real y notas de voz offline.",
        badge: "Asistente con confirmación",
        targetHref: "/dashboard",
        targetLabel: "Abrir el dashboard",
      },
      {
        type: "steps",
        title: "Consultar o preparar un registro paso a paso",
        items: [
          "Haz clic en «Asistente» en la esquina inferior derecha.",
          "Escribe o dicta con el micrófono tu petición concreta: por ejemplo «¿cuántos huevos recogimos esta semana?» o «registra 18 huevos grandes de hoy del Galpón Principal».",
          "Si pediste crear o modificar un dato, el Asistente prepara un borrador seguro que no altera la base de datos por sí solo.",
          "Revisa el resumen de la acción pendiente (cantidades, fecha, producto o lugar) y elige «Confirmar» para guardarla o «Cancelar» para descartarla.",
        ],
      },
      {
        type: "note",
        text: "Toda acción de escritura pasa primero por confirmación humana. Las cifras y listas que responde el Asistente salen de las consultas internas del sistema en ese momento.",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // ESCÁNER QR Y ETIQUETAS
  // ═══════════════════════════════════════════
  {
    slug: "escanear-qr",
    title: "Escáner QR, etiquetas e historial público de lote",
    module: "escanear-qr",
    icon: "qr-code",
    summary:
      "Escanea puertas de galpón, gallinas, lotes y equipos desde cámara o teclado, imprime etiquetas QR y comparte fichas de lote.",
    estimatedMinutes: 4,
    tags: ["qr", "escanear", "cámara", "etiqueta", "imprimir", "lote", "trazabilidad pública"],
    relatedHrefs: [
      { href: "/dashboard/escanear", label: "Abrir Escáner QR" },
      { href: "/dashboard/ubicaciones", label: "Etiquetas de lugares" },
      { href: "/dashboard/operaciones/activos", label: "Etiquetas de equipos" },
    ],
    sections: [
      {
        type: "intro",
        text: "El escáner unificado reconoce cuatro tipos de entidad mediante cámara o búsqueda manual por código: lugares de manejo (LOC-...), aves individuales (G-...), lotes productivos y equipos/activos (ACT-...). Al detectar el código muestra métricas resumidas y botones directos para actuar al instante.",
      },
      {
        type: "screenshot",
        title: "Escáner QR con ficha detectada de galpón y accesos rápidos",
        image: "/images/guia/escanear-qr.webp",
        alt: "Pantalla de Escáner QR mostrando la ficha del Galpón Principal tras escanear o buscar LOC-01",
        caption:
          "Una vez identificado un galpón, lote o gallina, aparecen métricas inmediatas (animales, huevos 30d, mantenimientos) y botones en un clic para recoger huevos, dar alimento, registrar mortalidad o ir a su ficha.",
        badge: "Campo + QR",
        targetHref: "/dashboard/escanear",
        targetLabel: "Abrir Escáner",
      },
      {
        type: "screenshot",
        title: "Generación e impresión de etiquetas QR desde fichas",
        image: "/images/guia/etiqueta-qr-modal.webp",
        alt: "Modal de generación de etiqueta QR listo para imprimir o descargar SVG/PNG para colocar en puerta o jaula",
        caption:
          "En Lugares de manejo, Animales, Lotes y Activos puedes abrir el botón «QR» para descargar o imprimir una etiqueta resistente con código legible y enlace directo.",
        badge: "Impresión rápida",
        targetHref: "/dashboard/ubicaciones",
        targetLabel: "Ver lugares con QR",
      },
      {
        type: "steps",
        title: "Cómo implantar etiquetas QR en 3 pasos",
        items: [
          "Entra a Lugares de manejo, Animales o Activos y haz clic en el botón «QR» del registro que quieras identificar.",
          "Imprime o descarga la etiqueta y plastifícala para pegarla en la puerta del galpón, la criadora o el chasis del equipo.",
          "En campo, abre Escanear en el menú lateral o dock móvil, apunta la cámara (o escribe el código como LOC-01 / G-001) y elige la acción rápida deseada.",
        ],
      },
      {
        type: "screenshot",
        title: "Ficha pública de trazabilidad compartible de lote",
        image: "/images/guia/trazabilidad-lote-publica.webp",
        alt: "Página pública /lote/[id] mostrando origen, edad en semanas, mortalidad y características del lote para compradores",
        caption:
          "Cada lote cuenta con una URL pública sin sesión (/lote/[id]) accesible escaneando su QR comercial para mostrar procedencia, edad y métricas básicas.",
        badge: "Trazabilidad comercial",
        targetHref: "/dashboard/animales",
        targetLabel: "Ver lotes en Animales",
      },
      {
        type: "tip",
        title: "Funciona también en dispositivos sin cámara o sin internet",
        text: "El buscador manual del escáner acepta códigos parciales de gallinas, galpones o activos cargados en la copia offline y dispara la misma captura rápida.",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // ANIMALES Y GENÉTICA
  // ═══════════════════════════════════════════
  {
    slug: "gestionar-gallinas",
    title: "Gestión integral de animales multiespecie",
    module: "animales",
    icon: "paw-print",
    summary:
      "Administra gallinas, gallos y lotes de pollos, codornices, patos o conejos desde un resumen consolidado con asignación de lugares.",
    estimatedMinutes: 4,
    tags: ["animales", "gallinas", "gallos", "pollos", "codornices", "patos", "conejos", "especies"],
    relatedHrefs: [
      { href: "/dashboard/animales", label: "Resumen de Animales" },
      { href: "/dashboard/produccion?tab=animales", label: "Pestañas por especie" },
      { href: "/dashboard/ubicaciones", label: "Lugares de manejo" },
    ],
    sections: [
      {
        type: "intro",
        text: "El módulo Animales reúne en un solo inventario a las gallinas ponedoras, gallos reproductores y lotes de especies complementarias (pollos de engorde, codornices, patos y conejos), mostrando cantidad activa, peso total estimado, valoración y pendientes de asignar a un espacio.",
      },
      {
        type: "screenshot",
        title: "Vista consolidada de inventario de animales por especie",
        image: "/images/guia/animales-resumen.webp",
        alt: "Pantalla Resumen de Animales mostrando totales por especie, estado productivo y tabla de grupos",
        caption:
          "Filtra rápidamente por tipo de animal, identifica ejemplares sin lugar asignado y navega a la ficha individual o pestaña de manejo de cada especie.",
        badge: "Multiespecie",
        targetHref: "/dashboard/animales",
        targetLabel: "Abrir Animales",
      },
      {
        type: "steps",
        title: "Administrar estados, ciclo de vida y fichas individuales",
        items: [
          "Entra a Animales → Resumen de animales para ver el conteo consolidado o a Animales → Gestión de animales para gestionar cada especie.",
          "En Gallinas verás indicadores de etapa (pollita, juvenil, pre-postura, postura), edad en semanas, estado reproductivo (empollando, enferma, descarte o recomendada de sacrificio) y su código único.",
          "Usa la tarjeta «Sin asignar lugar» cuando tengas animales heredados sin ubicación y ubícalos con un solo clic en un galpón o potrero.",
          "Haz clic en el código de una gallina (por ejemplo G-001) para abrir su ficha completa con cronología de eventos, etiqueta QR, historial sanitario y cambio de estado.",
        ],
      },
      {
        type: "tip",
        title: "Ciclo automático por edad",
        text: "El sistema calcula automáticamente las semanas de vida desde la fecha de nacimiento o ingreso para agrupar cada ejemplar en la etapa definida en Catálogos y ajustar su ración esperada.",
      },
    ],
  },
  {
    slug: "trazabilidad-genetica",
    title: "Adquisiciones, entradas y trazabilidad genética",
    module: "animales",
    icon: "dna",
    summary:
      "Registra nacimientos, incubaciones y compras de aves o lotes conservando padres, línea genética, generación, procedencia y evidencias.",
    estimatedMinutes: 4,
    tags: ["adquisiciones", "entradas", "linaje", "genética", "padres", "origen", "generación"],
    relatedHrefs: [
      { href: "/dashboard/produccion/adquisiciones", label: "Adquisiciones y entradas" },
      { href: "/dashboard/produccion?tab=incubacion", label: "Incubación" },
      { href: "/dashboard/analisis/razas", label: "Curvas y desempeño" },
    ],
    sections: [
      {
        type: "intro",
        text: "Cada ingreso nuevo de animales se registra en Adquisiciones y entradas. Allí quedan enlazados procedencia (finca o proveedor), costo, línea genética, generación, progenitores internos o externos, referencia de evidencia y el lugar de manejo destino donde quedan alojados.",
      },
      {
        type: "screenshot",
        title: "Historial de adquisiciones y registro de linaje",
        image: "/images/guia/adquisiciones-genetica.webp",
        alt: "Módulo Adquisiciones y entradas con resumen de inventario y tabla de ingresos con especie, raza, origen y códigos generados",
        caption:
          "Cada fila conserva la trazabilidad de origen, el tipo de entrada (compra, cría en casa, incubación), los códigos asignados automáticamente y el galpón/corral donde ingresaron.",
        badge: "Origen y linaje",
        targetHref: "/dashboard/produccion/adquisiciones",
        targetLabel: "Abrir Adquisiciones",
      },
      {
        type: "steps",
        title: "Registrar un ingreso o nacimiento con trazabilidad",
        items: [
          "Ve a Animales → Adquisiciones y entradas y haz clic en «+ Nueva Adquisición».",
          "Elige el tipo de entrada (compra, cría en casa, incubación u otro), la especie, la raza y la cantidad que ingresa.",
          "Completa los campos de trazabilidad disponibles: finca o ubicación de origen, lote de origen, línea genética y generación (por ejemplo F1, F2).",
          "Si conoces la madre o el padre en tu propia parvada, selecciónalos en sus listas; si son externos, escribe el código o referencia del criador y guarda la referencia documental de evidencia genética o sanitaria.",
          "Selecciona el lugar de manejo activo de destino. Si además fue compra con costo mayor a cero, registra el gasto correspondiente en Finanzas según corresponda.",
        ],
      },
      {
        type: "warning",
        text: "El registro de linaje documenta los antecedentes que informas para análisis internos; no reemplaza certificados oficiales de raza pura ni auditorías sanitarias externas.",
      },
    ],
  },
  {
    slug: "control-peso",
    title: "Control de peso y biometría vs estándar",
    module: "animales",
    icon: "scale",
    summary:
      "Registra pesajes por muestra de lotes o grupos de gallinas y compara su evolución semanal frente al rango mínimo-máximo de la raza.",
    estimatedMinutes: 3,
    tags: ["peso", "biometría", "curva", "desarrollo", "ganancia", "muestra", "estándar"],
    relatedHrefs: [
      { href: "/dashboard/produccion/peso", label: "Control de Peso" },
      { href: "/dashboard/analisis/razas", label: "Curvas por Raza" },
      { href: "/dashboard/configuracion/catalogos?tab=pesos", label: "Pesos de referencia" },
    ],
    sections: [
      {
        type: "intro",
        text: "El seguimiento biométrico permite detectar a tiempo si una camada de pollos o pollonas en levante está creciendo por debajo o por encima de lo esperado, ajustando ración o revisando sanidad antes de afectar el punto de postura o peso de faena.",
      },
      {
        type: "screenshot",
        title: "Gráfica de pesajes reales vs banda estándar de raza",
        image: "/images/guia/peso-biometria.webp",
        alt: "Módulo Control de Peso y Biometría mostrando curva comparativa con banda de peso objetivo y registros de pesaje",
        caption:
          "La zona sombreada muestra el rango esperado (mínimo a máximo) para la raza y sexo seleccionados, mientras los puntos muestran tus muestreos promedio reales en gramos o kilogramos.",
        badge: "Biometría",
        targetHref: "/dashboard/produccion/peso",
        targetLabel: "Registrar pesaje",
      },
      {
        type: "steps",
        title: "Cómo registrar un muestreo de peso",
        items: [
          "Entra a Animales → Control de peso y haz clic en «+ Registrar Pesaje».",
          "Selecciona el lote o indica el grupo de gallinas, raza, semana de edad y el lugar de manejo.",
          "Ingresa el peso promedio calculado en kg y el tamaño de la muestra pesada (por ejemplo, 5 o 10 aves representativas).",
          "Guarda y filtra la gráfica superior por raza/género para comprobar si el punto cae dentro de la banda verde objetivo.",
        ],
      },
      {
        type: "tip",
        title: "Mantener estándares actualizados",
        text: "Puedes ajustar los pesos objetivo por semana y raza en Configuración → Catálogos dentro de la pestaña de Pesos de referencia.",
      },
    ],
  },
  {
    slug: "incubacion",
    title: "Incubación y nacimientos",
    module: "animales",
    icon: "clock",
    summary:
      "Lleva control de huevos cargados en incubadora o gallina clueca, eclosión estimada, nacidos vivos y pase automático al inventario.",
    estimatedMinutes: 3,
    tags: ["incubación", "eclosión", "clueca", "pollitos", "tasa de nacimiento"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=incubacion", label: "Ir a Incubación" },
      { href: "/dashboard/produccion/adquisiciones", label: "Ver ingresos derivados" },
    ],
    sections: [
      {
        type: "intro",
        text: "Registra cada tanda de huevos puestos a incubar (en incubadora eléctrica o bajo gallina empollando), controla los días transcurridos hasta la eclosión y documenta cuántos pollitos, paticos o codornices nacieron con éxito.",
      },
      {
        type: "screenshot",
        title: "Seguimiento de lotes de incubación",
        image: "/images/guia/produccion-incubacion.webp",
        alt: "Pestaña de Incubación mostrando tandas activas, huevos cargados, porcentaje de nacimiento y fechas",
        caption:
          "Controla lotes en curso con progreso de días (por ejemplo 21 días en gallinas) y consulta la tasa histórica de eclosión.",
        badge: "Nacimientos",
        targetHref: "/dashboard/produccion?tab=incubacion",
        targetLabel: "Abrir Incubación",
      },
      {
        type: "steps",
        title: "Iniciar y cerrar una tanda de incubación",
        items: [
          "Ve a Animales → Incubación y pulsa «+ Nueva Incubación».",
          "Indica la fecha de inicio, cantidad de huevos, especie/raza y si es incubadora automática o gallina clueca (si aplica).",
          "El tablero calcula automáticamente la fecha estimada de eclosión según los días propios de la especie.",
          "Al nacer los animales, actualiza los nacidos vivos e infértiles/pérdidas para calcular el porcentaje de eclosión real e incorpóralos a su lugar de cría.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // LUGARES DE MANEJO
  // ═══════════════════════════════════════════
  {
    slug: "lugares-manejo",
    title: "Lugares de manejo y resultados por espacio",
    module: "ubicaciones",
    icon: "map-pin",
    summary:
      "Organiza galpones, corrales y potreros, controla capacidad, estado sanitario/operativo, QR de puerta y analiza métricas por espacio.",
    estimatedMinutes: 5,
    tags: ["ubicaciones", "lugares", "galpón", "potrero", "traslados", "capacidad", "qr"],
    relatedHrefs: [
      { href: "/dashboard/ubicaciones", label: "Lugares de manejo" },
      { href: "/dashboard/escanear", label: "Escanear QR de puerta" },
      { href: "/dashboard/operaciones/mantenimiento", label: "Mantenimiento por lugar" },
    ],
    sections: [
      {
        type: "intro",
        text: "Cada lugar de manejo representa un alojamiento físico real (galpón, potrero, corral, jaula, jardín o patio), incluso organizado en jerarquía padre-hijo. Registrar el espacio en cada captura permite comparar qué galpón produce mejor o requiere mantenimiento urgente.",
      },
      {
        type: "screenshot",
        title: "Directorio de galpones, potreros y espacios activos",
        image: "/images/guia/ubicaciones-lista.webp",
        alt: "Listado de Lugares de manejo con tarjetas de capacidad, estado operativo, estado sanitario y botón QR",
        caption:
          "Desde la vista general controlas ocupación actual contra capacidad máxima, ves si cumple estado sanitario y generas con un clic la etiqueta QR para la puerta.",
        badge: "Espacios físicos",
        targetHref: "/dashboard/ubicaciones",
        targetLabel: "Ver lugares",
      },
      {
        type: "screenshot",
        title: "Ficha detallada de desempeño y traslados del lugar",
        image: "/images/guia/ubicacion-ficha.webp",
        alt: "Ficha individual de un galpón con huevos, carne, bajas de los últimos 30 días y registro de traslados",
        caption:
          "Dentro de cada ubicación revisas la ocupación por especie, los resultados de los últimos 30 días (huevos, carne, pesajes, bajas y tareas) y trasladas aves o lotes conservando el historial origen-destino.",
        badge: "Resultados por lugar",
        targetHref: "/dashboard/ubicaciones",
        targetLabel: "Abrir una ficha",
      },
      {
        type: "steps",
        title: "Crear espacios y mover animales correctamente",
        items: [
          "Ve a Animales → Lugares de manejo y crea el espacio con código único (por ejemplo LOC-01), nombre, tipo, área y capacidad.",
          "Registra referencias internas para ubicarlo dentro del predio y opcionalmente coordenadas GPS (enlace directo a mapa), además de su estado operativo y sanitario.",
          "Cuando necesites cambiar un ave o un lote de lugar, abre la ficha del espacio destino y registra el traslado indicando fecha y motivo.",
          "Imprime el QR desde el botón «QR» de la tarjeta para que los operarios registren huevos o limpieza escaneando directamente en la puerta.",
        ],
      },
      {
        type: "warning",
        text: "El estado sanitario y operativo en la ficha refleja la última inspección registrada por tu equipo; no constituye una certificación oficial externa.",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // PRODUCCIÓN
  // ═══════════════════════════════════════════
  {
    slug: "recoger-huevos",
    title: "Recolección de huevos multiespecie",
    module: "produccion",
    icon: "egg",
    summary:
      "Registra la postura diaria de gallinas, codornices o patos en modo rápido o detallado por talla y separa autoconsumo de excedente para venta.",
    estimatedMinutes: 3,
    tags: ["huevos", "postura", "AA", "AAA", "Jumbo", "autoconsumo", "excedente", "diario"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=huevos", label: "Producción de Huevos" },
      { href: "/dashboard/inventarios/huevos", label: "Inventario de Huevos" },
      { href: "/dashboard/soberania", label: "Ver en Soberanía" },
    ],
    sections: [
      {
        type: "intro",
        text: "El módulo de Huevos admite tanto el conteo ágil diario en galpón como la clasificación detallada por tamaño (Jumbo, AAA, AA, A, B, C) y especie. Además permite dividir en el mismo acto cuánto se destina al autoconsumo familiar y cuánto entra al stock comercial.",
      },
      {
        type: "screenshot",
        title: "Control de recolección diaria y gráfica de postura",
        image: "/images/guia/produccion-huevos.webp",
        alt: "Módulo Producción de Huevos con tarjetas resumen, tendencia diaria y tabla de recolecciones",
        caption:
          "Visualiza producción de hoy, acumulada de 7 días, promedio diario y partición entre consumo del hogar y stock vendible.",
        badge: "Postura diaria",
        targetHref: "/dashboard/produccion?tab=huevos",
        targetLabel: "Ir a Huevos",
      },
      {
        type: "steps",
        title: "Registrar huevos en modo rápido o detallado",
        items: [
          "Entra a Producción → Huevos (o usa el botón Crear + → Recoger Huevos o la captura rápida del celular).",
          "En el modal de recolección elige la fecha, especie (gallina, codorniz, pato) y opcionalmente el galpón/lote origen.",
          "Usa el Modo Rápido para anotar el total en una sola cifra, o cambia a Detallado por tamaño para desglosar unidades por cada calibre.",
          "Ajusta las unidades separadas para autoconsumo del hogar; el resto queda disponible automáticamente en Inventarios → Huevos para la venta.",
        ],
      },
      {
        type: "diagram",
        title: "Destino automático del huevo registrado",
        nodes: [
          { id: "rec", label: "Recolección (total)", icon: "egg", color: "amber" },
          { id: "auto", label: "Autoconsumo hogar", icon: "home", color: "emerald" },
          { id: "stock", label: "Stock vendible FIFO", icon: "package", color: "blue" },
          { id: "venta", label: "Venta / CxC", icon: "money", color: "green" },
        ],
        connections: [
          { from: "rec", to: "auto", label: "Ahorro en Soberanía" },
          { from: "rec", to: "stock", label: "Excedente por tamaño" },
          { from: "stock", to: "venta", label: "Descuento automático" },
        ],
      },
    ],
  },
  {
    slug: "produccion-carne",
    title: "Producción de carne y rendimiento en canal",
    module: "produccion",
    icon: "meat",
    summary:
      "Lleva historial de cosecha de carne por especie (pollos, gallinas de descarte, gallos, patos, conejos), rendimiento vivo vs canal y valorización.",
    estimatedMinutes: 3,
    tags: ["carne", "canal", "rendimiento", "peso vivo", "lotes", "autoconsumo"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=carne", label: "Producción de Carne" },
      { href: "/dashboard/inventarios/carne", label: "Inventario de Carne FIFO" },
    ],
    sections: [
      {
        type: "intro",
        text: "El tablero de Producción de Carne centraliza cada cosecha o beneficio realizado en la finca, midiendo el rendimiento real entre peso vivo y peso en canal limpia y separando kilos para hogar frente a kilos para comercialización.",
      },
      {
        type: "screenshot",
        title: "Panel de Producción de Carne y Beneficio",
        image: "/images/guia/produccion-carne.webp",
        alt: "Módulo Producción de Carne con kilos totales producidos, rendimiento promedio y listado de beneficios",
        caption:
          "Incluye métricas de rendimiento en canal (%), resumen por especie y botón directo para registrar nuevos beneficios.",
        badge: "Cosecha de carne",
        targetHref: "/dashboard/produccion?tab=carne",
        targetLabel: "Abrir Carne",
      },
      {
        type: "steps",
        title: "Analizar rendimiento y alimentar el inventario",
        items: [
          "Entra a Producción → Carne para revisar los kilos obtenidos, porcentaje de rendimiento en canal y destino.",
          "Cada nuevo registro de beneficio descuenta el ave o lote de animales activos y crea un lote de carne disponible en Inventarios → Carne.",
          "Las porciones marcadas para hogar alimentan automáticamente los indicadores de Soberanía Alimentaria sin inflar el stock vendible.",
        ],
      },
    ],
  },
  {
    slug: "sacrificio-aves",
    title: "Sacrificio y beneficio controlado",
    module: "produccion",
    icon: "scissors",
    summary:
      "Registra la salida de pollos de engorde, aves recomendadas de sacrificio o conejos convirtiéndolos en lotes trazables de carne.",
    estimatedMinutes: 3,
    tags: ["sacrificio", "faena", "beneficio", "descarte", "pollo", "conejo"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=carne", label: "Registrar en Carne / Beneficio" },
      { href: "/dashboard/inventarios/carne", label: "Inventario de Carne" },
    ],
    sections: [
      {
        type: "intro",
        text: "El registro de sacrificio unifica en Producción → Carne la salida de aves individuales (gallinas de descarte o gallos) o la saca parcial/total de un lote de engorde o conejos, calculando automáticamente el rendimiento e integrando el inventario FIFO de carne.",
      },
      {
        type: "screenshot",
        title: "Registro de sacrificio dentro del módulo de Carne",
        image: "/images/guia/produccion-carne.webp",
        alt: "Pantalla de Producción de Carne donde se registra un nuevo beneficio de aves o lotes",
        caption:
          "Pulsa el botón superior de registro en Producción → Carne (o accede desde el menú Crear + → Registrar Beneficio) para capturar peso vivo, peso en canal y destino hogar/venta.",
        badge: "Beneficio",
        targetHref: "/dashboard/produccion?tab=carne",
        targetLabel: "Registrar beneficio",
      },
      {
        type: "steps",
        title: "Registrar un sacrificio en 4 pasos",
        items: [
          "Abre Producción → Carne y haz clic en «+ Registrar Sacrificio / Beneficio».",
          "Selecciona el origen: gallina individual (especialmente marcadas en descarte/recomendadas), gallo o lote activo de pollos/patos/conejos.",
          "Anota la cantidad de animales beneficiados, el peso vivo total y el peso neto en canal; indica cuántos kilos van a autoconsumo vs venta.",
          "Confirma: el sistema actualiza el conteo del animal o lote e ingresa los kilogramos excedentes al inventario FIFO de carne.",
        ],
      },
      {
        type: "warning",
        text: "Verifica primero en Sanidad que los animales a beneficiar no se encuentren en período de carencia vigente por antibióticos o antiparasitarios.",
      },
    ],
  },
  {
    slug: "gallinaza-produccion",
    title: "Producción y recolección de gallinaza",
    module: "produccion",
    icon: "sprout",
    summary:
      "Mide la generación diaria estimada según tu parvada, registra recolecciones reales de cama/abono y controla su aprovechamiento o venta.",
    estimatedMinutes: 3,
    tags: ["gallinaza", "abono", "compost", "cama", "estiércol"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=gallinaza", label: "Producción de Gallinaza" },
      { href: "/dashboard/inventarios/gallinaza", label: "Inventario de Gallinaza" },
    ],
    sections: [
      {
        type: "intro",
        text: "La gallinaza y el abono orgánico representan tanto un subproducto agrícola valioso para huertas y cultivos propios como un ingreso extra vendiendo bultos curados.",
      },
      {
        type: "screenshot",
        title: "Control de recolección y producción de gallinaza",
        image: "/images/guia/produccion-gallinaza.webp",
        alt: "Módulo de Gallinaza mostrando acumulación diaria estimada, recolecciones reales y controles de inventario",
        caption:
          "Combina la estimación automática por población animal con tus pesajes reales de recolección y ajustes de compostaje.",
        badge: "Economía circular",
        targetHref: "/dashboard/produccion?tab=gallinaza",
        targetLabel: "Abrir Gallinaza",
      },
      {
        type: "steps",
        title: "Cómo llevar el registro real en galpón",
        items: [
          "Ve a Producción → Gallinaza para consultar los kilogramos diarios estimados según el número de animales activos.",
          "Cuando limpies un galpón o coseches el abono seco, haz clic en registrar recolección real e indica los kilogramos obtenidos.",
          "Para ventas en bulto o granel usa Finanzas → Ventas en la pestaña Gallinaza, y para mermas o uso en tu propia huerta consulta Inventarios → Gallinaza.",
        ],
      },
    ],
  },
  {
    slug: "gestion-gallinaza",
    title: "Factores y ajustes de gallinaza",
    module: "produccion",
    icon: "sliders",
    summary:
      "Calibra gramos por animal al día, humedad por especie y registra ajustes manuales de inventario por limpieza o pérdida.",
    estimatedMinutes: 2,
    tags: ["factores", "humedad", "ajustes", "gallinaza", "configuración"],
    relatedHrefs: [
      { href: "/dashboard/configuracion/catalogos?tab=gallinaza", label: "Factores en Catálogos" },
      { href: "/dashboard/inventarios/gallinaza", label: "Ajustes en Inventario" },
    ],
    sections: [
      {
        type: "intro",
        text: "Para que la estimación de abono sea precisa según el sistema de cama (viruta, jaula o pastoreo) y especie, puedes ajustar los factores técnicos y conciliar físicamente las existencias.",
      },
      {
        type: "screenshot",
        title: "Factores e historial de gallinaza",
        image: "/images/guia/produccion-gallinaza.webp",
        alt: "Vista de Gallinaza con acceso a configuración de factores y balance disponible",
        caption:
          "Ajusta los parámetros base en Configuración → Catálogos (pestaña Gallinaza) y concilia inventarios físicos desde Inventarios → Gallinaza.",
        badge: "Calibración",
        targetHref: "/dashboard/inventarios/gallinaza",
        targetLabel: "Ver Inventario Gallinaza",
      },
      {
        type: "steps",
        title: "Ajustar factores y registrar diferencias físicas",
        items: [
          "Abre Configuración → Catálogos y selecciona la pestaña de Gallinaza para modificar gramos por día y porcentaje de humedad por especie.",
          "Cuando el volumen físico tras secar o cernir difiera del teórico, ve a Inventarios → Gallinaza y registra un ajuste positivo o negativo con su motivo.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // INVENTARIOS
  // ═══════════════════════════════════════════
  {
    slug: "balance-inventarios",
    title: "Balance patrimonial de inventarios",
    module: "inventarios",
    icon: "package",
    summary:
      "Consulta el valor total combinado de animales vivos, huevos disponibles, carne, alimentos e insumos con alertas de stock crítico.",
    estimatedMinutes: 3,
    tags: ["balance", "valorización", "patrimonio", "stock", "alertas"],
    relatedHrefs: [
      { href: "/dashboard/inventarios/balance", label: "Balance de Inventarios" },
      { href: "/dashboard/finanzas/finanzas", label: "Balance Financiero" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Balance de Inventarios consolida en una sola pantalla todo el capital físico existente hoy en tu granja: el valor estimado de tu parvada viva, los huevos por vender, kilos de carne en congelación, concentrados/granos en bodega y medicamentos/empaques.",
      },
      {
        type: "screenshot",
        title: "Valorización global de inventarios y desglose por rubro",
        image: "/images/guia/inventarios-balance.webp",
        alt: "Pantalla Balance de Inventarios mostrando tarjeta de valor total, gráfico de distribución e inventarios detallados",
        caption:
          "Identifica qué porcentaje de tu capital está inmovilizado en animales, producto terminado o bodega y accede a cada inventario específico desde sus tarjetas.",
        badge: "Patrimonio actual",
        targetHref: "/dashboard/inventarios/balance",
        targetLabel: "Abrir Balance Inventarios",
      },
      {
        type: "steps",
        title: "Leer el balance e interpretar alertas",
        items: [
          "Entra a Inventarios → Balance de inventarios.",
          "Revisa las tarjetas superiores con la valorización de Animales, Huevos, Carne, Alimentos e Insumos.",
          "Utiliza el gráfico circular y las tablas inferiores para detectar insumos por debajo del stock mínimo o próximos a vencer.",
          "Cruza esta cifra periódicamente con tu Balance Financiero para evaluar crecimiento real (caja + inventario).",
        ],
      },
    ],
  },
  {
    slug: "inventario-huevos",
    title: "Inventario de huevos y envejecimiento FIFO",
    module: "inventarios",
    icon: "egg",
    summary:
      "Controla existencias disponibles por tamaño (Jumbo, AAA, AA, A, B, C), edad en días de los lotes más antiguos y salidas por merma.",
    estimatedMinutes: 3,
    tags: ["inventario", "huevos", "fifo", "antigüedad", "lotes", "merma"],
    relatedHrefs: [
      { href: "/dashboard/inventarios/huevos", label: "Inventario de Huevos" },
      { href: "/dashboard/produccion?tab=huevos", label: "Recoger Huevos" },
      { href: "/dashboard/finanzas/ventas", label: "Vender Huevos" },
    ],
    sections: [
      {
        type: "intro",
        text: "Las ventas descuentan siempre primero los lotes de recolección más antiguos (lógica FIFO: primero en entrar, primero en salir) para garantizar frescura hacia tus clientes.",
      },
      {
        type: "screenshot",
        title: "Inventario por calibres y envejecimiento de lotes de huevo",
        image: "/images/guia/inventario-huevos.webp",
        alt: "Pantalla Inventario de Huevos con resumen por calibre, antigüedad en días y listado de lotes activos",
        caption:
          "Vigila en un vistazo los días acumulados del lote más antiguo y prioriza su despacho o promoción antes de que pierda frescura.",
        badge: "Control FIFO",
        targetHref: "/dashboard/inventarios/huevos",
        targetLabel: "Ver Inventario Huevos",
      },
      {
        type: "steps",
        title: "Cómo revisar existencias y evitar vencimientos",
        items: [
          "Abre Inventarios → Inventario de huevos.",
          "Consulta el resumen por tamaño (producidos, vendidos, pérdidas y disponibles hoy con su precio sugerido).",
          "En la tabla inferior ordena o busca lotes y revisa la etiqueta de edad en días; despacha primero cualquier lote marcado en alerta amarilla o roja.",
        ],
      },
    ],
  },
  {
    slug: "inventario-carne",
    title: "Inventario de carne (FIFO)",
    module: "inventarios",
    icon: "meat",
    summary:
      "Consulta kilos en cava o congelador por especie y lote de beneficio, antigüedad y descuentos automáticos al vender o reportar mermas.",
    estimatedMinutes: 3,
    tags: ["carne", "inventario", "congelador", "fifo", "descuento"],
    relatedHrefs: [
      { href: "/dashboard/inventarios/carne", label: "Inventario de Carne" },
      { href: "/dashboard/produccion?tab=carne", label: "Registrar Beneficio" },
      { href: "/dashboard/finanzas/ventas?tab=carne", label: "Vender Carne" },
    ],
    sections: [
      {
        type: "intro",
        text: "Cada beneficio registrado en Producción → Carne abre un lote con su especie, kilos disponibles para comercialización y fecha de origen. Cuando vendes carne o registras una merma, el sistema descuenta automáticamente empezando por el lote más antiguo.",
      },
      {
        type: "screenshot",
        title: "Disponibilidad de carne por especie y lotes en almacenamiento",
        image: "/images/guia/inventario-carne.webp",
        alt: "Pantalla Inventario de Carne con resumen por especie y antigüedad de lotes de beneficio",
        caption:
          "Controla kilogramos disponibles por especie (pollo, gallina de descarte, pato, codorniz, conejo), valor estimado en cava y días desde el beneficio.",
        badge: "Trazabilidad canal",
        targetHref: "/dashboard/inventarios/carne",
        targetLabel: "Abrir Inventario Carne",
      },
      {
        type: "steps",
        title: "Consultar y despachar carne en orden FIFO",
        items: [
          "Abre Inventarios → Inventario de carne.",
          "Verifica el resumen superior por especie y detecta el lote con más días de almacenamiento.",
          "Registra las ventas desde Finanzas → Ventas (pestaña Carne) para que se descuenten automáticamente los kilos en orden FIFO.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // ALMACÉN Y EQUIPOS
  // ═══════════════════════════════════════════
  {
    slug: "alimentar-aves",
    title: "Gestión de alimentación, raciones y programas",
    module: "almacen",
    icon: "wheat",
    summary:
      "Registra entradas y consumos diarios de concentrado o forrajes, configura programas automáticos por etapa y proyecta necesidad de compra.",
    estimatedMinutes: 4,
    tags: ["alimentación", "ración", "concentrado", "grano", "programa", "consumo"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=alimentacion", label: "Gestión de Alimentación" },
      { href: "/dashboard/inventarios/alimentacion", label: "Inventario de Alimentos" },
      { href: "/dashboard/almacen", label: "Centro Almacén" },
    ],
    sections: [
      {
        type: "intro",
        text: "Controlar exactamente qué alimento entra a bodega y cuánto consume cada grupo o etapa te permite reducir desperdicios y saber con semanas de anticipación cuándo debes reordenar bultos.",
      },
      {
        type: "screenshot",
        title: "Gestión de movimientos y programas de alimentación",
        image: "/images/guia/alimentacion-gestion.webp",
        alt: "Módulo de Alimentación con tipos de alimento, movimientos de entrada/consumo y programas automáticos",
        caption:
          "Administra fórmulas compradas o producidas en granja (maíz, morera, preparados), programa entregas automáticas por etapa de edad y controla mermas.",
        badge: "Nutrición diaria",
        targetHref: "/dashboard/produccion?tab=alimentacion",
        targetLabel: "Abrir Alimentación",
      },
      {
        type: "screenshot",
        title: "Vista resumen del centro de Almacén",
        image: "/images/guia/almacen-hub.webp",
        alt: "Hub de Almacén con alertas de stock bajo, resumen de alimentos, insumos y tareas de mantenimiento",
        caption:
          "La entrada principal de Almacén unifica stock bajo de raciones e insumos con los mantenimientos pendientes en una sola lectura.",
        badge: "Almacén",
        targetHref: "/dashboard/almacen",
        targetLabel: "Ir a Almacén",
      },
      {
        type: "steps",
        title: "Configurar alimentos y registrar consumos",
        items: [
          "Entra a Almacén → Gestión de alimentación y crea o edita los tipos de alimento (con stock mínimo, unidad, costo por kg y origen granja/comprado).",
          "Registra consumos diarios eligiendo alimento, cantidad, etapa o lugar de manejo; también puedes registrar compras de alimento desde Finanzas → Egresos.",
          "Activa Programas de alimentación si deseas descontar raciones automáticas calculadas por número de aves en cada etapa.",
        ],
      },
    ],
  },
  {
    slug: "inventario-alimentos",
    title: "Inventario de alimentos y proyección de días restantes",
    module: "almacen",
    icon: "bar-chart",
    summary:
      "Analiza cuántos días te alcanza el concentrado o grano actual usando la ventana de consumo de 7, 30 o 90 días y actúa sobre alertas rojas.",
    estimatedMinutes: 2,
    tags: ["inventario alimentos", "días restantes", "proyección", "bodega", "stock mínimo"],
    relatedHrefs: [
      { href: "/dashboard/inventarios/alimentacion", label: "Inventario de Alimentos" },
      { href: "/dashboard/produccion?tab=alimentacion", label: "Registrar movimientos" },
    ],
    sections: [
      {
        type: "intro",
        text: "Además de la cantidad en bodega, Inventario de alimentos calcula automáticamente para cuántos días alcanza cada alimento según el ritmo de consumo reciente de tu finca.",
      },
      {
        type: "screenshot",
        title: "Proyección de existencias y días de alimento restantes",
        image: "/images/guia/inventario-alimentos.webp",
        alt: "Módulo Inventario de Alimentación mostrando stock actual, valor y días proyectados restantes por alimento",
        caption:
          "Selecciona el horizonte de análisis (7, 30 o 90 días) arriba a la derecha; los ítems con 7 días o menos de cobertura se marcan en alerta roja.",
        badge: "Abastecimiento",
        targetHref: "/dashboard/inventarios/alimentacion",
        targetLabel: "Ver Proyección de Alimentos",
      },
      {
        type: "steps",
        title: "Evitar quiebres de concentrado o forraje",
        items: [
          "Abre Almacén → Inventario de alimentos.",
          "Cambia el selector «Proyección» (7, 30 o 90 días) según la variabilidad de tu parvada y pulsa «Aplicar».",
          "Programa pedido en Finanzas → Egresos para todo alimento cuya columna «Días restantes» baje de tu margen de entrega del proveedor.",
        ],
      },
    ],
  },
  {
    slug: "inventario-insumos",
    title: "Insumos operativos, vacunas y empaques",
    module: "almacen",
    icon: "package-open",
    summary:
      "Lleva control de medicamentos, vacunas, desinfectantes, cubetas y materiales no alimenticios con fechas de vencimiento y consumo.",
    estimatedMinutes: 3,
    tags: ["insumos", "medicamentos", "vacunas", "desinfectante", "empaques", "stock"],
    relatedHrefs: [
      { href: "/dashboard/inventarios/insumos", label: "Abrir Insumos" },
      { href: "/dashboard/sanidad", label: "Plan Sanitario" },
    ],
    sections: [
      {
        type: "intro",
        text: "Controla aquí todos los suministros distintos del alimento: biológicos, antibióticos, desinfectantes, cubetas o empaques y repuestos pequeños, con alertas por fecha de caducidad y existencias mínimas.",
      },
      {
        type: "screenshot",
        title: "Control de bodega de insumos e historial de movimientos",
        image: "/images/guia/inventario-insumos.webp",
        alt: "Módulo de Insumos mostrando tarjetas de stock bajo, lista de productos médicos y consumos",
        caption:
          "Cuando aplicas un tratamiento o vacuna desde Sanidad con el insumo enlazado, el sistema descuenta el consumo automáticamente de este stock.",
        badge: "Bodega general",
        targetHref: "/dashboard/inventarios/insumos",
        targetLabel: "Abrir Insumos",
      },
      {
        type: "steps",
        title: "Crear insumos y registrar entradas o salidas",
        items: [
          "Entra a Almacén → Insumos y crea cada producto con categoría (medicamento, vacuna, desinfectante, limpieza, equipo u otro), unidad y stock mínimo.",
          "Registra entradas por compra o donación y salidas por consumo o merma con el botón «+ Movimiento».",
          "Revisa periódicamente la columna de fecha de vencimiento para priorizar vacunas y frascos próximos a expirar.",
        ],
      },
    ],
  },
  {
    slug: "infraestructura-equipos",
    title: "Activos y equipos con ficha e historial",
    module: "almacen",
    icon: "wrench",
    summary:
      "Registra incubadoras, básculas, bebederos, comederos y herramientas con código, serial, garantía, ubicación, QR y costo.",
    estimatedMinutes: 3,
    tags: ["activos", "equipos", "herramientas", "serial", "garantía", "qr"],
    relatedHrefs: [
      { href: "/dashboard/operaciones/activos", label: "Activos y Equipos" },
      { href: "/dashboard/operaciones/mantenimiento", label: "Mantenimiento" },
      { href: "/dashboard/escanear", label: "Escanear equipo QR" },
    ],
    sections: [
      {
        type: "intro",
        text: "El inventario de activos documenta tus bienes físicos durables (equipos, herramientas, estructuras y vehículos internos), asignándoles código único, ubicación dentro de la granja y etiqueta QR para asociarles mantenimientos y revisar estado operativo.",
      },
      {
        type: "screenshot",
        title: "Registro de activos, códigos seriales y garantías",
        image: "/images/guia/activos-equipos.webp",
        alt: "Pantalla de Activos y Equipos mostrando incubadora, báscula y línea de bebederos con su estado y costo",
        caption:
          "Visualiza de un vistazo qué equipos están operativos, cuáles requieren mantenimiento y cuáles siguen en garantía vigente.",
        badge: "Activos físicos",
        targetHref: "/dashboard/operaciones/activos",
        targetLabel: "Ver Activos",
      },
      {
        type: "steps",
        title: "Dar de alta equipos y enlazarlos con lugares",
        items: [
          "Ve a Almacén → Activos y equipos y haz clic en «+ Nuevo Activo».",
          "Registra código (por ejemplo ACT-001), nombre, categoría, marca, modelo, número de serie, fecha y costo de adquisición y garantía.",
          "Asocia el equipo al Lugar de manejo donde opera y cambia su estado a «Requiere mantenimiento» o «Fuera de servicio» cuando presente fallas.",
          "Imprime su código QR para reportar o revisar mantenimientos rápidamente desde el Escáner QR.",
        ],
      },
      {
        type: "note",
        text: "La ficha conserva todos los datos técnicos, costo original de adquisición y tareas vinculadas; no calcula depreciación contable fiscal.",
      },
    ],
  },
  {
    slug: "mantenimiento",
    title: "Mantenimiento preventivo y correctivo",
    module: "almacen",
    icon: "wrench",
    summary:
      "Programa limpiezas, desinfecciones y reparaciones ligadas a un lugar o equipo, con recurrencia automática y costo trazado a egresos.",
    estimatedMinutes: 3,
    tags: ["mantenimiento", "tareas", "preventivo", "correctivo", "recurrencia", "limpieza"],
    relatedHrefs: [
      { href: "/dashboard/operaciones/mantenimiento", label: "Abrir Mantenimiento" },
      { href: "/dashboard/operaciones/activos", label: "Equipos vinculados" },
    ],
    sections: [
      {
        type: "intro",
        text: "Organiza las labores de adecuación, limpieza y reparación de galpones o equipos. Las tareas recurrentes reprograman su siguiente fecha al instante cuando las marcas como completadas, y las próximas a vencer aparecen en Inicio.",
      },
      {
        type: "screenshot",
        title: "Tablero de órdenes de mantenimiento por lugar y equipo",
        image: "/images/guia/mantenimiento-tareas.webp",
        alt: "Pantalla Mantenimiento mostrando tareas programadas, equipo asignado, lugar y estado",
        caption:
          "Incluye plantillas rápidas de tareas frecuentes en avicultura, filtros por estado y enlace con equipos y lugares de manejo.",
        badge: "Preventivo",
        targetHref: "/dashboard/operaciones/mantenimiento",
        targetLabel: "Ver Mantenimiento",
      },
      {
        type: "steps",
        title: "Programar una revisión periódica o reparación",
        items: [
          "Entra a Almacén → Mantenimiento y presiona «+ Nueva Tarea».",
          "Escribe o escoge una plantilla (como desinfección o revisión de bebederos), asigna el equipo y/o lugar y define la fecha programada.",
          "Si es una rutina periódica (cada 30 o 90 días), completa el campo de recurrencia en días.",
          "Al terminarla, cambia su estado a «Completado» e ingresa el costo final; el sistema programará automáticamente el próximo ciclo si es recurrente.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // PLANEACIÓN Y SOBERANÍA
  // ═══════════════════════════════════════════
  {
    slug: "plan-parvada",
    title: "Plan de parvada y proyecciones",
    module: "planeacion",
    icon: "calendar-days",
    summary:
      "Compara huevos esperados vs reales, calcula reemplazos y proporción de gallos y visualiza el futuro productivo de la parvada semana a semana.",
    estimatedMinutes: 3,
    tags: ["planeación", "parvada", "reemplazo", "proyección", "gallos", "metas"],
    relatedHrefs: [
      { href: "/dashboard/produccion/plan-parvada", label: "Plan de Parvada" },
      { href: "/dashboard/planeacion", label: "Resumen Planeación" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Plan de Parvada traduce la estructura actual de edades de tus aves en proyecciones semanales de postura, consumo esperado de alimento y alertas anticipadas de reposición para no quedarte sin gallinas en postura cuando el lote adulto envejezca.",
      },
      {
        type: "screenshot",
        title: "Estado vivo de parvada y gráfica de proyección",
        image: "/images/guia/plan-parvada.webp",
        alt: "Módulo Plan de Parvada con cumplimiento de postura, gallos recomendados, hitos de edad y gráfico proyectado",
        caption:
          "Contrasta en tiempo real la postura promedio de los últimos 7 días frente a lo esperado para la edad de tus gallinas y planifica tu fecha de reemplazo.",
        badge: "Estrategia avícola",
        targetHref: "/dashboard/produccion/plan-parvada",
        targetLabel: "Abrir Plan de Parvada",
      },
      {
        type: "steps",
        title: "Configurar y seguir un plan activo",
        items: [
          "Ve a Planeación → Plan de parvada.",
          "Crea o edita tu plan indicando meta de gallinas ponedoras, gallos reproductores, fecha de reemplazo y fase actual.",
          "Revisa las tarjetas de cumplimiento productivo, relación gallo/gallina y fechas críticas de reposición (pollitas que deben ingresar con 18–20 semanas de anticipación).",
        ],
      },
    ],
  },
  {
    slug: "soberania-alimentaria",
    title: "Soberanía alimentaria y autoconsumo del hogar",
    module: "planeacion",
    icon: "sprout",
    summary:
      "Mide cuántos huevos, carne y alimento sano consume tu familia directamente de la granja y cuánto dinero ahorras frente al mercado.",
    estimatedMinutes: 3,
    tags: ["soberanía", "autoconsumo", "hogar", "ahorro", "familia", "proteína"],
    relatedHrefs: [
      { href: "/dashboard/soberania", label: "Soberanía Alimentaria" },
      { href: "/dashboard/produccion?tab=huevos", label: "Separar huevos de hogar" },
    ],
    sections: [
      {
        type: "intro",
        text: "La producción avícola familiar no solo genera ventas: también garantiza huevos frescos y carne sana en la mesa. Este módulo valora a precio de mercado cada alimento consumido por tu hogar para medir tu ahorro real y autosuficiencia proteica.",
      },
      {
        type: "screenshot",
        title: "Tablero de Soberanía Alimentaria y registro de autoconsumo",
        image: "/images/guia/soberania-alimentaria.webp",
        alt: "Pantalla Soberanía Alimentaria mostrando ahorro total, aporte de huevos y carne al hogar e historial de autoconsumo",
        caption:
          "Cada vez que destinas huevos en Recolección o kilos en Sacrificio hacia el hogar se registra aquí su valor equivalente al precio de mercado.",
        badge: "Autoconsumo",
        targetHref: "/dashboard/soberania",
        targetLabel: "Abrir Soberanía",
      },
      {
        type: "steps",
        title: "Alimentar los indicadores de soberanía",
        items: [
          "Al registrar recolección de huevos o un beneficio de carne, usa el campo de «Autoconsumo hogar».",
          "También puedes ir directamente a Planeación → Soberanía Alimentaria para añadir entregas puntuales (huevos, carne, vísceras o abono para huerta) e indicar el hogar destino.",
          "Consulta en los KPIs superiores el ahorro acumulado mensual y el porcentaje de producción propia que alimenta a tu familia.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // SANIDAD Y MORTALIDAD
  // ═══════════════════════════════════════════
  {
    slug: "plan-sanitario",
    title: "Plan Sanitario Integral",
    module: "sanidad",
    icon: "pill",
    summary:
      "Centro completo en 5 pestañas: diagnóstico actual de parvada, protocolos por etapa de edad, calendario, vacunas en bodega y bioseguridad.",
    estimatedMinutes: 4,
    tags: ["sanidad", "plan sanitario", "bioseguridad", "protocolo", "vacunas", "etapas"],
    relatedHrefs: [
      { href: "/dashboard/sanidad", label: "Plan Sanitario Integral" },
      { href: "/dashboard/sanidad/calendario", label: "Calendario de Vacunación" },
      { href: "/dashboard/inventarios/insumos", label: "Stock de Vacunas" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Plan Sanitario consolida la salud preventiva de tu granja en cinco pestañas conectadas entre sí: Estado de parvada, Protocolo por etapa, Calendario próximo, Stock sanitario de insumos e Historial/Bioseguridad.",
      },
      {
        type: "screenshot",
        title: "Panel del Plan Sanitario con 5 pestañas integradas",
        image: "/images/guia/sanidad-plan.webp",
        alt: "Pantalla del Plan Sanitario Integral mostrando pestañas de estado, protocolos por etapa, eventos e insumos disponibles",
        caption:
          "Consulta en un mismo sitio qué protocolo toca según las semanas de vida de tus gallinas y confirma si tienes stock suficiente del biológico en almacén.",
        badge: "Prevención integral",
        targetHref: "/dashboard/sanidad",
        targetLabel: "Abrir Plan Sanitario",
      },
      {
        type: "steps",
        title: "Recorrer las 5 pestañas de trabajo",
        items: [
          "Estado actual: resume animales sanos vs enfermos, vencimientos de calendario y alertas activas.",
          "Protocolos por etapa: revisa las dosis recomendadas desde la primera semana de pollito hasta postura.",
          "Calendario y Stock de insumos: verifica existencias de vacunas o antiparasitarios antes del día programado y aplica eventos pendientes con descuento automático.",
          "Historial y Bioseguridad: conserva la trazabilidad de todas las medidas tomadas en finca.",
        ],
      },
    ],
  },
  {
    slug: "control-sanitario",
    title: "Control sanitario, tratamientos y carencia",
    module: "sanidad",
    icon: "stethoscope",
    summary:
      "Registra vacunaciones aplicadas, desparasitaciones o tratamientos curativos, asociando costo, lugar de manejo y días de carencia.",
    estimatedMinutes: 3,
    tags: ["control sanitario", "tratamiento", "carencia", "medicamento", "enfermedad"],
    relatedHrefs: [
      { href: "/dashboard/sanidad/control", label: "Control Sanitario" },
      { href: "/dashboard/sanidad/alertas", label: "Ver Alertas" },
    ],
    sections: [
      {
        type: "intro",
        text: "Anota aquí cada intervención clínica o preventiva ya ejecutada sobre un animal, galpón o lote completo, controlando si el tratamiento exige días de retiro (carencia) antes de consumir o vender huevo o carne.",
      },
      {
        type: "screenshot",
        title: "Bitácora de eventos y tratamientos sanitarios",
        image: "/images/guia/sanidad-control.webp",
        alt: "Módulo Control Sanitario mostrando listado de eventos aplicados, fechas, productos, costos y próximas dosis",
        caption:
          "Incluye filtro por tipo de evento, enlace con lugares de manejo y generación automática del gasto o recordatorio de refuerzo.",
        badge: "Bitácora médica",
        targetHref: "/dashboard/sanidad/control",
        targetLabel: "Abrir Control Sanitario",
      },
      {
        type: "steps",
        title: "Registrar un tratamiento o desinfección",
        items: [
          "Abre Sanidad → Control sanitario y haz clic en «+ Nuevo Evento».",
          "Elige tipo (vacunación, desparasitación, tratamiento, inspección o limpieza), describe el cuadro clínico o procedimiento y selecciona las aves o lugar afectados.",
          "Indica producto usado y costo; si aplica un medicamento con retiro, anota los días de carencia o próxima revisión para seguimiento.",
        ],
      },
    ],
  },
  {
    slug: "calendario-vacunacion",
    title: "Calendario de vacunación y recurrencia",
    module: "sanidad",
    icon: "calendar",
    summary:
      "Programa vacunas y desparasitaciones periódicas, identifica vencimientos críticos y aplícalas en un toque para reprogramar el siguiente ciclo.",
    estimatedMinutes: 3,
    tags: ["vacunación", "calendario", "newcastle", "gumboro", "refuerzo", "vencida"],
    relatedHrefs: [
      { href: "/dashboard/sanidad/calendario", label: "Calendario de Vacunación" },
      { href: "/dashboard/configuracion/catalogos?tab=vacunas", label: "Plantillas de vacunas" },
    ],
    sections: [
      {
        type: "intro",
        text: "El calendario sanitario mantiene vivas las fechas de inmunización y desparasitación de toda la parvada. Cuando ejecutas una vacuna desde el calendario, automáticamente crea su historial en Control sanitario y reprograma el próximo refuerzo según la frecuencia configurada.",
      },
      {
        type: "screenshot",
        title: "Agenda de vacunas próximas y vencidas",
        image: "/images/guia/sanidad-calendario.webp",
        alt: "Calendario de Vacunación mostrando vacunas programadas, días restantes hasta vencimiento y botón Aplicar",
        caption:
          "Los eventos vencidos destacan en rojo y los próximos en ámbar para priorizar compras de biológico antes de la fecha límite.",
        badge: "Inmunización",
        targetHref: "/dashboard/sanidad/calendario",
        targetLabel: "Abrir Calendario",
      },
      {
        type: "steps",
        title: "Programar y ejecutar refuerzos",
        items: [
          "Abre Sanidad → Calendario de vacunación.",
          "Crea eventos manuales o revisa las dosis base de Newcastle, Bronquitis y Desparasitación cargadas por el sistema.",
          "Al aplicar la dosis en el galpón, pulsa «Aplicar» sobre el evento para registrar fecha real, costo y recalcular la nueva fecha futura.",
        ],
      },
    ],
  },
  {
    slug: "alertas-mortalidad",
    title: "Alertas tempranas, mortalidad y pérdidas de huevos",
    module: "sanidad",
    icon: "alert-triangle",
    summary:
      "Monitorea caídas de postura, desvíos de peso o vacunas vencidas y registra causas de mortalidad animal o pérdidas de huevo.",
    estimatedMinutes: 3,
    tags: ["alertas", "mortalidad", "bajas", "pérdidas", "huevos rotos", "causas"],
    relatedHrefs: [
      { href: "/dashboard/sanidad/alertas", label: "Alertas Sanitarias" },
      { href: "/dashboard/produccion/mortalidad", label: "Registro de Mortalidad" },
    ],
    sections: [
      {
        type: "intro",
        text: "Reaccionar rápido ante una baja anormal o una caída súbita de postura protege al resto de la parvada. Aquí conviven las alertas automáticas del sistema con el registro clasificado de bajas animales y mermas de huevo.",
      },
      {
        type: "screenshot",
        title: "Centro de alertas automáticas de la parvada",
        image: "/images/guia/sanidad-alertas.webp",
        alt: "Pantalla de Alertas Sanitarias mostrando avisos críticos y advertencias sobre vacunación, postura o cambios de dieta",
        caption:
          "Consolida avisos críticos por vacunas atrasadas, caídas repentinas de postura o variaciones significativas en el peso frente a la referencia.",
        badge: "Detección temprana",
        targetHref: "/dashboard/sanidad/alertas",
        targetLabel: "Ver Alertas",
      },
      {
        type: "screenshot",
        title: "Historial y distribución por causa de bajas y huevos perdidos",
        image: "/images/guia/mortalidad-bajas.webp",
        alt: "Pantalla de Mortalidad mostrando gráfico circular de causas y listado de bajas de animales y pérdidas de huevos",
        caption:
          "Permite identificar si predominan causas infecciosas, accidentes, depredadores o rotura en nidal para tomar medidas físicas en galpones.",
        badge: "Control de bajas",
        targetHref: "/dashboard/produccion/mortalidad",
        targetLabel: "Registrar Baja",
      },
      {
        type: "steps",
        title: "Registrar una baja o pérdida correctamente",
        items: [
          "Entra a Sanidad → Mortalidad (o utiliza la acción «Reportar Baja» del escáner QR o del botón Crear +).",
          "Elige si es baja de animal (gallina/gallo individual o cantidad dentro de un lote) o pérdida de huevos rotos/infértiles.",
          "Selecciona la causa (enfermedad, depredador, accidente, sacrificio sanitario o causa natural) para actualizar de inmediato las existencias vivas o inventario FIFO.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // FINANZAS Y CUENTAS
  // ═══════════════════════════════════════════
  {
    slug: "registrar-venta",
    title: "Ventas multicanal (huevos, carne, aves y gallinaza)",
    module: "finanzas",
    icon: "money",
    summary:
      "Vende productos por presentación de contado o a crédito (CxC), descontando inventarios FIFO y creando ingresos automáticamente.",
    estimatedMinutes: 4,
    tags: ["ventas", "ingresos", "contado", "crédito", "cxc", "clientes", "presentación"],
    relatedHrefs: [
      { href: "/dashboard/finanzas/ventas", label: "Ir a Ventas" },
      { href: "/dashboard/finanzas/cuentas", label: "Ver CxC pendientes" },
      { href: "/dashboard/inventarios/huevos", label: "Stock disponible" },
    ],
    sections: [
      {
        type: "intro",
        text: "El módulo de Ventas centraliza cuatro líneas comerciales en pestañas dedicadas: Huevos, Aves vivas, Carne en canal y Gallinaza. Cada venta registrada actualiza existencias FIFO, alimenta los ingresos del Balance y puede quedar marcada a crédito para cobrarla luego en CxC.",
      },
      {
        type: "screenshot",
        title: "Gestión de ventas con pestañas por producto",
        image: "/images/guia/finanzas-ventas.webp",
        alt: "Módulo Ventas mostrando pestañas de huevos, carne, aves vivas y gallinaza junto con estadísticas y tabla comercial",
        caption:
          "Selecciona cliente desde catálogo o créalo al instante, define unidades o kilos por presentación (cubeta, media cubeta, kilo) y alterna entre Contado y Crédito.",
        badge: "4 líneas de venta",
        targetHref: "/dashboard/finanzas/ventas",
        targetLabel: "Registrar Venta",
      },
      {
        type: "steps",
        title: "Registrar una venta paso a paso",
        items: [
          "Abre Finanzas → Ventas y escoge la pestaña del producto (Huevos, Carne, Aves o Gallinaza).",
          "Pulsa «+ Nueva Venta» y selecciona el comprador (cliente frecuente del catálogo) o escríbelo en el momento.",
          "En huevos puedes mezclar varias tallas/presentaciones en un mismo pedido; en carne o gallinaza se calculan kilos por precio unitario.",
          "Marca la casilla «Venta a crédito» y fija una fecha de vencimiento cuando el cliente pague después: el sistema creará la cuenta por cobrar automáticamente.",
        ],
      },
    ],
  },
  {
    slug: "registrar-egreso",
    title: "Egresos, compras detalladas y abono a proveedores",
    module: "finanzas",
    icon: "outgoing",
    summary:
      "Registra gastos operativos y compras de concentrado o insumos por bultos, con opción a crédito (CxP) y recálculo de bodega.",
    estimatedMinutes: 4,
    tags: ["egresos", "gastos", "compras", "bultos", "alimentación", "cxp"],
    relatedHrefs: [
      { href: "/dashboard/finanzas/egresos", label: "Abrir Egresos" },
      { href: "/dashboard/finanzas/cuentas", label: "Ver CxP por pagar" },
      { href: "/dashboard/inventarios/alimentacion", label: "Almacén de Alimentos" },
    ],
    sections: [
      {
        type: "intro",
        text: "Los egresos registran todo dinero que sale para operar la granja. Si categorizas el gasto como compra de alimento o insumos y vinculas el ítem del inventario, la entrada de existencias a tu almacén ocurre en un solo paso junto con la contabilización del costo promedio.",
      },
      {
        type: "screenshot",
        title: "Control de egresos, gráfico diario y desglose por categoría",
        image: "/images/guia/finanzas-egresos.webp",
        alt: "Módulo Egresos mostrando total gastado, gráfico de barras de gastos, desglose por categoría y listado",
        caption:
          "Incluye barra de búsqueda, filtro por horizonte de días y enlace rápido con el Catálogo de productos de compra frecuentes.",
        badge: "Control de costos",
        targetHref: "/dashboard/finanzas/egresos",
        targetLabel: "Abrir Egresos",
      },
      {
        type: "steps",
        title: "Registrar una compra con actualización automática de stock",
        items: [
          "Entra a Finanzas → Egresos y pulsa «+ Nuevo Egreso».",
          "Selecciona la categoría (por ejemplo «Compra de alimento» o «Compra de insumos»).",
          "Si el producto ya existe en tu catálogo de compras, selecciónalo para autocompletar proveedor, unidad de presentación (bulto de 40 kg, caja) y último precio pagado.",
          "Elige el alimento o insumo de bodega destino para acreditar automáticamente el stock y define si fue pago inmediato o crédito de proveedor.",
        ],
      },
    ],
  },
  {
    slug: "catalogo-productos",
    title: "Catálogo de productos de compra y proveedores",
    module: "finanzas",
    icon: "shopping-cart",
    summary:
      "Agiliza tus compras recurrentes guardando presentaciones estándar (bulto, paquete, frasco), proveedores habituales y último precio.",
    estimatedMinutes: 2,
    tags: ["productos de compra", "proveedores", "presentaciones", "atajo", "precios"],
    relatedHrefs: [
      { href: "/dashboard/finanzas/egresos?nuevo=producto", label: "Nuevo Producto de Compra" },
      { href: "/dashboard/finanzas/egresos?nuevo=proveedor", label: "Agregar Proveedor" },
    ],
    sections: [
      {
        type: "intro",
        text: "En lugar de repetir la conversión de bultos a kilos o recordar el último valor pagado cada vez que surtes bodega, guarda los productos frecuentes como plantillas inteligentes en Egresos.",
      },
      {
        type: "screenshot",
        title: "Atajo de Productos de Compra dentro de Egresos",
        image: "/images/guia/finanzas-catalogo-compras.webp",
        alt: "Modal de nuevo producto frecuente de compra dentro del módulo Finanzas Egresos",
        caption:
          "Usa Crear + → Producto de compra (o el acceso directo dentro de Egresos) para almacenar presentaciones, unidades base, proveedor favorito y precio de referencia.",
        badge: "Compras ágiles",
        targetHref: "/dashboard/finanzas/egresos?nuevo=producto",
        targetLabel: "Crear Producto",
      },
      {
        type: "steps",
        title: "Crear plantillas frecuentes de compra",
        items: [
          "En Crear + selecciona Producto de compra (o abre Egresos y haz clic en el botón para crear un producto).",
          "Define nombre, categoría de egreso, presentación habitual (por ejemplo Bulto 40kg), unidad base y proveedor.",
          "En adelante bastará elegir este producto al registrar un egreso para precargar automáticamente cantidades, proveedor y el último precio actualizado.",
        ],
      },
    ],
  },
  {
    slug: "cuentas-cobrar-pagar",
    title: "Cuentas por cobrar, por pagar (CxC / CxP) y abonos",
    module: "finanzas",
    icon: "receipt",
    summary:
      "Gestiona cartera de clientes fiados y deudas a proveedores, identifica saldos vencidos y registra abonos parciales o totales con recibo.",
    estimatedMinutes: 3,
    tags: ["cuentas por cobrar", "cuentas por pagar", "cxc", "cxp", "cartera", "abonos", "crédito"],
    relatedHrefs: [
      { href: "/dashboard/finanzas/cuentas", label: "Cuentas por Cobrar y Pagar" },
      { href: "/dashboard/finanzas/ventas", label: "Ventas a crédito" },
      { href: "/dashboard/finanzas/egresos", label: "Compras a crédito" },
    ],
    sections: [
      {
        type: "intro",
        text: "Cuando entregas cubetas o canales fiados o compras concentrado a plazo de proveedor, tus ventas/egresos alimentan directamente las pestañas de Cuentas por Cobrar (CxC) y Cuentas por Pagar (CxP) con control de abonos parciales.",
      },
      {
        type: "screenshot",
        title: "Panel de Cuentas por Cobrar y Pagar con control de vencimientos",
        image: "/images/guia/finanzas-cuentas.webp",
        alt: "Pantalla Cuentas por Cobrar y Pagar mostrando saldo pendiente por cobrar, saldo por pagar y detalle de cuotas",
        caption:
          "Alterna entre pestañas de CxC, CxP e historial de pagos; las cuentas vencidas destacan de inmediato para gestionar cobro o desembolso.",
        badge: "Cartera y pagos",
        targetHref: "/dashboard/finanzas/cuentas",
        targetLabel: "Abrir CxC / CxP",
      },
      {
        type: "steps",
        title: "Registrar un abono o liquidar un saldo",
        items: [
          "Entra a Finanzas → Cuentas cobrar/pagar.",
          "Ubica la cuenta del cliente (CxC) o proveedor (CxP) y haz clic en «Registrar Pago / Abono».",
          "Ingresa el monto abonado (parcial o el total restante), medio de pago (efectivo, transferencia, Nequi, etc.) y referencia.",
          "Al guardar, el saldo pendiente se recalcula automáticamente hasta cambiar la cuenta a estado «Pagada».",
        ],
      },
    ],
  },
  {
    slug: "balance-financiero",
    title: "Balance financiero y flujo acumulado",
    module: "finanzas",
    icon: "wallet",
    summary:
      "Consulta utilidad neta, margen operativo, gráfica de tendencia acumulada y libro de movimientos unificados de ingresos y egresos.",
    estimatedMinutes: 3,
    tags: ["balance", "utilidad", "flujo", "margen", "ingresos", "egresos"],
    relatedHrefs: [
      { href: "/dashboard/finanzas/finanzas", label: "Balance Financiero" },
      { href: "/dashboard/analisis/reportes", label: "Estado P&L Exportable" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Balance Financiero sintetiza cuánto ingresó, cuánto costó mantener el galpón durante el período seleccionado y si el flujo diario acumulado cerró en utilidad o pérdida.",
      },
      {
        type: "screenshot",
        title: "Flujo financiero, curva de utilidad y desglose de rubros",
        image: "/images/guia/finanzas-balance.webp",
        alt: "Módulo Balance Financiero con tarjetas de ingresos, gastos, ganancia neta y área de evolución temporal",
        caption:
          "Visualiza ingresos vs gastos promedio al día, margen de ganancia (%) y el gráfico comparativo temporal para detectar semanas de mayor gasto.",
        badge: "Salud financiera",
        targetHref: "/dashboard/finanzas/finanzas",
        targetLabel: "Abrir Balance",
      },
      {
        type: "steps",
        title: "Analizar la rentabilidad de un período",
        items: [
          "Abre Finanzas → Balance financiero y ajusta la ventana temporal (7, 30, 90 o 365 días).",
          "Compara las tarjetas de Ingresos, Egresos, Utilidad Neta y Margen.",
          "Revisa el libro inferior usando el buscador rápido para verificar cualquier movimiento puntual originado desde Ventas, Egresos o Mantenimiento.",
        ],
      },
    ],
  },
  {
    slug: "presupuestos",
    title: "Presupuestos y control de variación",
    module: "finanzas",
    icon: "target",
    summary:
      "Fija topes de gasto y metas mensuales de venta por categoría para vigilar en barras si la operación va según lo planeado.",
    estimatedMinutes: 3,
    tags: ["presupuestos", "metas", "tope", "variación", "planeación"],
    relatedHrefs: [
      { href: "/dashboard/finanzas/presupuestos", label: "Abrir Presupuestos" },
      { href: "/dashboard/finanzas/finanzas", label: "Balance real" },
    ],
    sections: [
      {
        type: "intro",
        text: "Compara automáticamente lo ejecutado en tus movimientos reales de Finanzas frente a las metas mensuales que te trazaste para concentrado, sanidad, mantenimiento o ventas de huevos.",
      },
      {
        type: "screenshot",
        title: "Comparativo Meta Presupuestada vs Ejecución Real",
        image: "/images/guia/finanzas-presupuestos.webp",
        alt: "Pantalla de Presupuestos con barras comparativas entre monto presupuestado y gasto/ingreso real",
        caption:
          "Detecta desvíos porcentuales por categoría antes de cerrar el mes para ajustar compras o precios de venta.",
        badge: "Control de metas",
        targetHref: "/dashboard/finanzas/presupuestos",
        targetLabel: "Ver Presupuestos",
      },
      {
        type: "steps",
        title: "Crear y monitorear un presupuesto",
        items: [
          "Entra a Finanzas → Presupuestos y haz clic en «+ Nuevo Presupuesto».",
          "Define el nombre del período, fechas de inicio/fin y añade líneas con meta mensual por categoría (ingreso o egreso).",
          "El gráfico compara en tiempo real lo acumulado frente al objetivo calculando variación monetaria y porcentual.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // ANÁLISIS Y CURVAS
  // ═══════════════════════════════════════════
  {
    slug: "kpis-reportes",
    title: "KPIs operativos y reportes P&L exportables",
    module: "analisis",
    icon: "bar-chart",
    summary:
      "Calcula tasa de postura real, pico productivo, costo por huevo y por kg de carne, y genera reportes de pérdidas y ganancias.",
    estimatedMinutes: 4,
    tags: ["kpis", "reportes", "p&l", "costo por huevo", "rentabilidad", "tasa de postura"],
    relatedHrefs: [
      { href: "/dashboard/analisis/kpis", label: "KPIs del Gallinero" },
      { href: "/dashboard/analisis/reportes", label: "Reportes P&L y Rentabilidad" },
    ],
    sections: [
      {
        type: "intro",
        text: "El área de Análisis convierte los registros diarios en indicadores técnicos y financieros accionables: cuánto cuesta producir cada huevo o cada kilo de carne, qué tan lejos está tu parvada de su pico de postura y qué línea genera mayor margen.",
      },
      {
        type: "screenshot",
        title: "Tablero de KPIs productivos y costos unitarios",
        image: "/images/guia/analisis-kpis.webp",
        alt: "Módulo KPIs mostrando tasa de postura, pico productivo, tasa de mortalidad, costo por huevo y costo por kg de carne",
        caption:
          "Mide automáticamente costo unitario por huevo y por kilogramo de carne además de curvas de postura y causas de mortalidad.",
        badge: "Indicadores clave",
        targetHref: "/dashboard/analisis/kpis",
        targetLabel: "Ver KPIs",
      },
      {
        type: "screenshot",
        title: "Reportes de Pérdidas y Ganancias (P&L) y rentabilidad por línea",
        image: "/images/guia/analisis-reportes.webp",
        alt: "Módulo Reportes mostrando Estado de Pérdidas y Ganancias (P&L) y rentabilidad comparativa por línea productiva",
        caption:
          "Alterna entre el estado de resultados P&L por rango de fechas personalizado y la rentabilidad por producto (huevos, carne, gallinaza, aves).",
        badge: "Informes financieros",
        targetHref: "/dashboard/analisis/reportes",
        targetLabel: "Abrir Reportes",
      },
      {
        type: "steps",
        title: "Aprovechar KPIs y Reportes para fijar precios",
        items: [
          "Entra a Análisis → KPIs para calcular cuánto te cuesta realmente cada huevo y kg de carne frente al precio al que vendes hoy.",
          "Vigila el indicador «Pico de Producción» para saber si un lote está declinando su postura y evaluar su relevo en Plan de Parvada.",
          "Abre Análisis → Reportes para emitir un estado P&L entre dos fechas exactas y revisar qué línea (huevo, carne o abono) aporta la mayor utilidad.",
        ],
      },
    ],
  },
  {
    slug: "estandares-raza",
    title: "Curvas de referencia y desempeño por raza",
    module: "analisis",
    icon: "trending-up",
    summary:
      "Contrasta la postura (%) y ganancia de peso semanal reales de tus galpones contra las curvas genéticas de referencia por especie y raza.",
    estimatedMinutes: 3,
    tags: ["razas", "curvas", "estándar", "isa brown", "cobb 500", "postura", "desempeño"],
    relatedHrefs: [
      { href: "/dashboard/analisis/razas", label: "Curvas y Desempeño" },
      { href: "/dashboard/produccion/peso", label: "Registrar pesajes" },
    ],
    sections: [
      {
        type: "intro",
        text: "Curvas y desempeño te permite responder si la producción actual de huevos o el crecimiento de engorde de tu granja se mantiene alineado con el potencial genético esperado de razas como Isa Brown, Hy-Line o Cobb 500.",
      },
      {
        type: "screenshot",
        title: "Gráfica de comparación real frente a banda genética esperada",
        image: "/images/guia/analisis-razas.webp",
        alt: "Módulo Curvas y Desempeño por Raza con banda genética objetivo, puntos reales semanales y estado de alineación",
        caption:
          "Selecciona especie (gallina, pollo, codorniz, pato, conejo) y curva para ver una etiqueta clara de estado: Alineado, Por debajo o Por encima del rango.",
        badge: "Benchmark genético",
        targetHref: "/dashboard/analisis/razas",
        targetLabel: "Abrir Curvas por Raza",
      },
      {
        type: "steps",
        title: "Interpretar las curvas",
        items: [
          "Ve a Análisis → Curvas y desempeño.",
          "Elige especie (por ejemplo Gallinas ponedoras o Pollos de engorde) y la curva específica de postura o peso.",
          "Compara tus puntos reales frente a la franja esperada para detectar oportunidades de ajuste nutricional, espacio o sanidad.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // CONFIGURACIÓN
  // ═══════════════════════════════════════════
  {
    slug: "catalogos-sistema",
    title: "Catálogos y configuración maestra (7 pestañas)",
    module: "configuracion",
    icon: "settings",
    summary:
      "Adapta listas desplegables, parámetros globales, especies, esquemas de vacunas, pesos objetivo, factores de gallinaza y raciones.",
    estimatedMinutes: 4,
    tags: ["catálogos", "configuración", "parámetros", "razas", "especies", "precios"],
    relatedHrefs: [
      { href: "/dashboard/configuracion/catalogos", label: "Abrir Catálogos" },
      { href: "/dashboard/configuracion", label: "Resumen Configuración" },
    ],
    sections: [
      {
        type: "intro",
        text: "El corazón configurable de El Gallinero vive en Configuración → Catálogos. Organizado en 7 pestañas, controla las opciones de todos los formularios, precios de talla de huevo, etapas de edad, parámetros operativos globales y curvas de referencia sin tocar código.",
      },
      {
        type: "screenshot",
        title: "Administrador de catálogos y parámetros en 7 pestañas",
        image: "/images/guia/configuracion-catalogos.webp",
        alt: "Módulo Catálogos mostrando pestañas de Listas, Parámetros, Especies, Vacunas, Pesos, Gallinaza y Alimentación",
        caption:
          "Incluye Listas desplegables (17 categorías), Parámetros generales, Especies habilitadas, Plantillas de vacunas, Pesos estándar, Factores de gallinaza y Reglas de alimentación.",
        badge: "Configuración maestra",
        targetHref: "/dashboard/configuracion/catalogos",
        targetLabel: "Abrir Catálogos",
      },
      {
        type: "steps",
        title: "Personalizar el sistema para tu finca",
        items: [
          "Entra a Configuración → Catálogos.",
          "En «Listas» edita razas por especie, clientes, proveedores, tamaños/precios de huevo, presentaciones de venta/compra, categorías financieras, etapas de crecimiento y más.",
          "En «Parámetros» ajusta días de alerta temprana, umbrales de caída de postura o precios base globales.",
          "Configura tus plantillas en «Vacunas», curvas objetivo en «Pesos», gramos diarios en «Gallinaza» y consumo por etapa en «Alimentación».",
        ],
      },
      {
        type: "warning",
        text: "Desactivar un ítem en cualquier catálogo no borra los registros históricos que ya lo utilizaban; simplemente deja de mostrarse como opción nueva para preservar la integridad contable.",
      },
    ],
  },
];

// ─── Helper: get guide by slug ───
export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}

// ─── Helper: get guides grouped by module ───
export function getGuidesByModule(): Map<string, Guide[]> {
  const map = new Map<string, Guide[]>();
  for (const mod of guideModules) {
    map.set(mod.id, guides.filter((g) => g.module === mod.id));
  }
  return map;
}

// ─── Helper: get previous/next guide ───
export function getAdjacentGuides(slug: string): { prev: Guide | null; next: Guide | null } {
  const idx = guides.findIndex((g) => g.slug === slug);
  return {
    prev: idx > 0 ? guides[idx - 1] : null,
    next: idx >= 0 && idx < guides.length - 1 ? guides[idx + 1] : null,
  };
}

// ─── Helper: get preview screenshot image for a guide ───
export function getGuidePreviewImage(guide: Guide): { src: string; alt: string } | null {
  const sec = guide.sections.find((s) => s.type === "screenshot" && s.image);
  if (!sec?.image) return null;
  return { src: sec.image, alt: sec.alt || guide.title };
}

// ─── Helper: deduplicated screenshot assets for offline caching ───
export function getAllGuideAssetUrls(): string[] {
  const urls = new Set<string>();
  for (const guide of guides) {
    for (const section of guide.sections) {
      if (section.type === "screenshot" && section.image) {
        urls.add(section.image);
      }
    }
  }
  return Array.from(urls);
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ─── Helper: ranked full-text search across guides, tags, steps & captions ───
export function searchGuides(query: string, moduleId?: string): Guide[] {
  const moduleFiltered =
    moduleId && moduleId !== "all" ? guides.filter((g) => g.module === moduleId) : guides;

  const q = normalizeSearch(query);
  if (!q) return moduleFiltered;

  const terms = q.split(/\s+/).filter(Boolean);
  const moduleLabels = new Map(guideModules.map((m) => [m.id, normalizeSearch(m.label)]));

  const scored: { guide: Guide; score: number }[] = [];

  for (const guide of moduleFiltered) {
    const titleNorm = normalizeSearch(guide.title);
    const summaryNorm = normalizeSearch(guide.summary);
    const tagsNorm = guide.tags.map(normalizeSearch).join(" ");
    const modNorm = moduleLabels.get(guide.module) || "";
    const bodyNorm = normalizeSearch(
      guide.sections
        .map((s) => [s.title, s.text, s.caption, s.items?.join(" ")].filter(Boolean).join(" "))
        .join(" "),
    );

    const combined = `${titleNorm} ${tagsNorm} ${modNorm} ${summaryNorm} ${bodyNorm}`;
    if (!terms.every((t) => combined.includes(t))) continue;

    let score = 0;
    for (const term of terms) {
      if (titleNorm.includes(term)) score += 12;
      if (tagsNorm.includes(term)) score += 8;
      if (modNorm.includes(term)) score += 5;
      if (summaryNorm.includes(term)) score += 4;
      if (bodyNorm.includes(term)) score += 2;
    }
    scored.push({ guide, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.guide);
}
