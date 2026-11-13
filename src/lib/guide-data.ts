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
    description: "Inicio en grupos, Asistente Día 1, Escala Pequeño/Mediano, Ctrl+K, offline y Gina",
  },
  {
    id: "escanear-qr",
    label: "Escáner QR y Etiquetas",
    icon: "qr-code",
    description: "Escaneo en campo de lugares, ejemplares, lotes y equipos",
  },
  {
    id: "animales",
    label: "Animales y Reproducción",
    icon: "paw-print",
    description: "6 especies (incluyendo cuyes), adquisiciones, biometría CV%/EPEF, incubación y reproducción",
  },
  {
    id: "ubicaciones",
    label: "Lugares de Manejo",
    icon: "map-pin",
    description: "Galpones, jaulas, potreros, ocupación, QR y desempeño espacial",
  },
  {
    id: "produccion",
    label: "Producción",
    icon: "egg",
    description: "Postura NTC 1240 + T°/HR, carne multi-especie, gallinaza y microcápsulas",
  },
  {
    id: "inventarios",
    label: "Inventarios",
    icon: "package",
    description: "Balance patrimonial y trazabilidad PEPS/FIFO de huevos, carne y gallinaza",
  },
  {
    id: "almacen",
    label: "Almacén, Compostaje y Cierre",
    icon: "package-open",
    description: "Alimentos, dieta combinada, insumos, activos, mantenimiento, compostaje y cierre IoT",
  },
  {
    id: "planeacion",
    label: "Planeación y Calendario",
    icon: "calendar-days",
    description: "Calendario Maestro con rutinas, Plan de Parvada y Soberanía Alimentaria",
  },
  {
    id: "sanidad",
    label: "Sanidad y Bioseguridad",
    icon: "pill",
    description: "Plan sanitario, vacunaciones, retiros, bajas y POE GAB ICA (Res. 8452)",
  },
  {
    id: "finanzas",
    label: "Finanzas, Ventas y Contactos",
    icon: "money",
    description: "5 líneas de venta, egresos con adjuntos/OCR, CxC/CxP, P&L y Clientes/Proveedores",
  },
  {
    id: "analisis",
    label: "Análisis y Curvas",
    icon: "bar-chart",
    description: "KPIs (HAA, EPEF, CAPEX/ROI), curvas ajustadas por altitud y contabilidad analítica Excel/PDF",
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: "settings",
    description: "Panel general, módulos progresivos, catálogos en 8 pestañas, recuperación y licencia",
  },
];

export const GUIDE_WORKFLOWS: GuideWorkflow[] = [
  {
    id: "operacion-diaria",
    title: "Arranque, rutina diaria y cierre",
    description: "Configura tu escala en Día 1, sigue las tareas en Inicio, registra recolección o ración y ejecuta el cierre diario auditado.",
    icon: "sun",
    badge: "Diario · 5 min",
    slugs: ["primeros-pasos", "escala-y-modulos", "calendario-rutinas", "recoger-huevos", "alimentar-aves", "cierre-sensores"],
  },
  {
    id: "campo-sin-internet",
    title: "Trabajo de campo sin señal con Gina y QR",
    description: "Descarga la copia completa al celular, dicta notas por voz a Gina, escanea QR y sincroniza automáticamente al volver.",
    icon: "smartphone",
    badge: "Offline + Voz",
    slugs: ["modo-offline-voz", "asistente-operativo", "escanear-qr"],
  },
  {
    id: "trazabilidad-total",
    title: "Trazabilidad animal, reproducción y biometría",
    description: "Registra linaje al ingreso, ubica en galpón/jaula, gestiona empadres y pesa muestras semanales con CV%.",
    icon: "dna",
    badge: "Ciclo completo",
    slugs: ["trazabilidad-genetica", "lugares-manejo", "reproduccion-cunicola", "control-peso", "sacrificio-aves"],
  },
  {
    id: "salud-finanzas",
    title: "Cierre semanal sanitario, comercial y contable",
    description: "Valida bioseguridad ICA y retiros, factura en 5 líneas de venta, concilia CxC/CxP y exporta reportes por especie.",
    icon: "money",
    badge: "Semanal",
    slugs: ["plan-sanitario", "bioseguridad-bienestar", "registrar-venta", "cuentas-cobrar-pagar", "kpis-reportes"],
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
      "Recorre el tablero Inicio en grupos enmarcados, barra superior con Pequeño/Mediano y Crear + directo, buscador Ctrl+K y Gina.",
    estimatedMinutes: 4,
    tags: ["inicio", "dashboard", "rutinas", "microcápsulas", "ctrl+k", "buscar", "crear", "móvil", "atajos", "gina"],
    relatedHrefs: [
      { href: "/dashboard", label: "Ir a Inicio" },
      { href: "/dashboard/configuracion/modulos", label: "Escala y Módulos Progresivos" },
      { href: "/dashboard/planeacion/calendario", label: "Calendario Maestro y Rutinas" },
      { href: "/dashboard/configuracion/catalogos", label: "Catálogos del sistema" },
    ],
    sections: [
      {
        type: "intro",
        text: "El tablero Inicio organiza la jornada de arriba hacia abajo en grupos visuales enmarcados y sin numeración confusa: Resumen del día (4 cifras clave), avisos urgentes en Requiere atención, Tareas de hoy (con verificación real de registros), Accesos directos y dos bloques inferiores con el mismo formato plegable estándar: Resumen del mes (o Tablero técnico en Mediano) y Completar configuración de finca.",
      },
      {
        type: "screenshot",
        title: "Tablero principal Inicio y barra de herramientas superior",
        image: "/images/guia/inicio-dashboard.webp",
        alt: "Captura del tablero principal Inicio de El Gallinero con grupos enmarcados, selector de escala superior y botón Crear +",
        caption:
          "En la barra superior tienes estado En línea/Offline, buscador global Ctrl+K, selector de escala Pequeño / Mediano y el botón Crear +, que abre directamente el modal o formulario de cada registro sin pantallas intermedias. Abajo a la derecha te acompaña Gina, tu asistente de granja.",
        badge: "Pantalla principal",
        targetHref: "/dashboard",
        targetLabel: "Abrir Inicio",
      },
      {
        type: "steps",
        title: "Orientarte en 4 pasos el primer día",
        items: [
          "Usa «Abrir asistente inicial» en Inicio (o Configuración) para completar en 3 pasos el nombre de tu finca, lugares, animales vivos hoy y saldo de alimento —manual o importado por CSV.",
          "Alterna en un toque entre Modo Pequeño (interfaz simple) y Modo Mediano (tableros técnicos) desde la barra superior sin perder historial.",
          "Cada registro de huevos, alimento, ventas, egresos, pesos o reproducción entrega una Microcápsula inmediata con costo unitario, días de alimento o margen.",
          "Pulsa Crear + arriba (o + Registrar en móvil) para abrir de inmediato el formulario exacto de adquisición, traslado, venta, pago, plan de parvada o cierre diario.",
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
        text: "Si ves el panel plegable «Completar configuración de finca» en Inicio, resuelve primero ubicación, especies, precios y calendario sanitario; también puedes relanzar el Asistente inicial de 3 pasos desde su botón derecho.",
      },
    ],
  },
  {
    slug: "escala-y-modulos",
    title: "Asistente inicial (3 pasos), Escala Pequeño vs. Mediano y Módulos",
    module: "primeros-pasos",
    icon: "sparkles",
    summary:
      "Arranca en Día 1 sin historial atrasado, alterna entre Modo Pequeño y Mediano desde la barra superior y gestiona los 5 módulos progresivos.",
    estimatedMinutes: 4,
    tags: ["asistente inicial", "día 1", "csv", "pequeño", "mediano", "escala", "módulos progresivos", "feature flags", "onboarding"],
    relatedHrefs: [
      { href: "/dashboard/configuracion/modulos", label: "Escala y Módulos Progresivos" },
      { href: "/dashboard?wizard=1", label: "Abrir Asistente inicial" },
      { href: "/dashboard/configuracion", label: "Panel Configuración" },
    ],
    sections: [
      {
        type: "intro",
        text: "El sistema se adapta a granjas familiares o comerciales sobre la misma base de datos y sin migraciones. En Modo Pequeño ves únicamente lo esencial del galpón para capturar rápido; al crecer o cambiar a Modo Mediano en la barra superior se habilitan las herramientas avanzadas.",
      },
      {
        type: "screenshot",
        title: "Panel de Escala Productiva, Progreso y Módulos Desbloqueables",
        image: "/images/guia/configuracion-modulos.webp",
        alt: "Pantalla de Onboarding Progresivo, Escala y Módulos mostrando Modo Pequeño vs Mediano, 4 módulos core y 5 progresivos",
        caption:
          "Los 4 módulos esenciales (Captura Diaria Offline, Inventario y Cobertura, Sanidad/Retiros/Compostaje y Resumen WhatsApp) están siempre activos; los 5 módulos avanzados se encienden manualmente o al superar umbrales reales de tu finca.",
        badge: "Escala gradual",
        targetHref: "/dashboard/configuracion/modulos",
        targetLabel: "Abrir Escala y Módulos",
      },
      {
        type: "steps",
        title: "Arrancar en Día 1 y crecer sin cambiar de software",
        items: [
          "Abre «Asistente inicial» en Inicio o Configuración para seguir 3 pasos: (1) Escala y datos de la finca, (2) Lugares de manejo y animales vivos hoy (manual o creando lugar en un clic), y (3) Alimento disponible en bodega o plantilla CSV multi-especie.",
          "Cambia entre Pequeño y Mediano cuando quieras usando el control de escala de la barra superior derecha.",
          "Conoce los 5 módulos progresivos y sus activadores automáticos: Auditoría POE GAB/ICA (>200 aves), Contabilidad Analítica y Prorrateo (≥2 especies activas), Calibres NTC 1240 y Stock PEPS (≥150 ponedoras), Reportes Formales DIAN/Crédito/ROI y Genealogía 3 Gen + Cierre Auditable + IoT (≥30 mamíferos reproductores).",
          "En Configuración → Módulos puedes revisar en cualquier momento qué módulo se activó por crecimiento real de tu inventario o activarlo/ocultarlo manualmente.",
        ],
      },
      {
        type: "diagram",
        title: "Evolución progresiva de la granja en la plataforma",
        nodes: [
          { id: "wizard", label: "Asistente Día 1 (3 pasos)", icon: "sparkles", color: "green" },
          { id: "core", label: "Modo Pequeño (4 esenciales)", icon: "home", color: "amber" },
          { id: "triggers", label: "Crecimiento o Manual", icon: "trending-up", color: "blue" },
          { id: "mediano", label: "Modo Mediano Tecnificado", icon: "bar-chart", color: "purple" },
        ],
        connections: [ 
          { from: "wizard", to: "core", label: "Carga foto inicial o CSV" },
          { from: "core", to: "triggers", label: "Supera umbral o switch" },
          { from: "triggers", to: "mediano", label: "Desbloquea 5 avanzados" },
        ],
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
          "Si no tienes manos libres para escribir, abre a Gina o el dock móvil de voz y graba una nota de audio; quedará guardada en tu teléfono hasta recuperar conexión.",
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
    title: "Gina: asistente de la granja, voz, fotos y memoria",
    module: "primeros-pasos",
    icon: "sparkles",
    summary:
      "Conversa con Gina (la gallina con gafas) por texto, voz o foto de facturas para consultar datos en vivo, recordar reglas de tu finca y confirmar registros.",
    estimatedMinutes: 3,
    tags: ["gina", "asistente", "ia", "chat", "voz", "dictado", "memoria", "fotos", "confirmación"],
    relatedHrefs: [
      { href: "/dashboard", label: "Hablar con Gina en Inicio" },
      { href: "/dashboard/escanear", label: "Complementar con Escanear QR" },
    ],
    sections: [
      {
        type: "intro",
        text: "En la esquina inferior derecha te acompaña Gina (nuestra gallina con gafas). Su panel resume en lenguaje claro lo que puede hacer por ti sin términos técnicos: anotar movimientos diarios (siempre con tarjeta de confirmación), leer fotos de facturas o etiquetas, consultar tus lotes/rutinas/cuentas al instante y recordar reglas propias de tu granja.",
      },
      {
        type: "screenshot",
        title: "Panel de chat con Gina · Asistente de tu granja",
        image: "/images/guia/asistente-ia.webp",
        alt: "Panel lateral de Gina con su avatar de gallina con gafas, resumen de capacidades, preguntas rápidas, cámara, micrófono y entrada de texto",
        caption:
          "Incluye memoria persistente de la granja (ícono del cerebro), historial de conversaciones, preguntas sugeridas, cámara para facturas/etiquetas ICA, dictado por voz en tiempo real y notas de voz offline.",
        badge: "Gina + confirmación",
        targetHref: "/dashboard",
        targetLabel: "Abrir el dashboard",
      },
      {
        type: "steps",
        title: "Qué puedes hacer con Gina paso a paso",
        items: [
          "Haz clic en «Gina» en la esquina inferior derecha y escribe, dicta con el micrófono o toca la cámara para adjuntar una factura, etiqueta de concentrado o comprobante.",
          "Pregúntale datos vivos de las 6 especies («¿cómo está la granja hoy?», «¿cuántos días de alimento quedan y cuál es el FCR?», «¿qué vacunas están pendientes?»).",
          "Guarda reglas permanentes de tu predio en el ícono de Memoria arriba (por ejemplo «Proveedor principal Concentrados del Valle» o «Precio cubeta AAA $18.000»).",
          "Cuando pidas crear huevos, traslados, egresos o ventas, Gina arma una tarjeta segura; revisa las cifras y pulsa «Confirmar» para aplicarlo o «Cancelar».",
        ],
      },
      {
        type: "note",
        text: "Toda acción que altera inventario, animales o finanzas exige confirmación humana en tarjeta. Si te quedas sin señal, el botón de micrófono graba audio localmente para procesarlo al reconectar.",
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
      "Escanea puertas de galpón, jaulas, ejemplares individuales, lotes y equipos desde cámara o teclado e imprime etiquetas QR.",
    estimatedMinutes: 4,
    tags: ["qr", "escanear", "cámara", "etiqueta", "imprimir", "lote", "trazabilidad pública"],
    relatedHrefs: [
      { href: "/dashboard/escanear", label: "Abrir Escáner" },
      { href: "/dashboard/ubicaciones", label: "Etiquetas de lugares" },
      { href: "/dashboard/operaciones/activos", label: "Etiquetas de equipos" },
    ],
    sections: [
      {
        type: "intro",
        text: "La sección «Escanear» del menú reconoce cuatro tipos de entidad multiespecie mediante cámara o búsqueda manual por código: lugares de manejo (LOC-...), ejemplares individuales (G-...), lotes productivos y equipos/activos (ACT-...). Al detectar el código muestra métricas resumidas y botones directos para actuar al instante.",
      },
      {
        type: "screenshot",
        title: "Escáner QR con ficha detectada de lugar y accesos rápidos",
        image: "/images/guia/escanear-qr.webp",
        alt: "Pantalla de Escanear QR mostrando la ficha de un lugar tras escanear o buscar LOC-01",
        caption:
          "Una vez identificado un lugar, lote, ejemplar o activo, aparecen métricas inmediatas (animales, producción, mantenimientos) y botones en un clic para recoger huevos, dar alimento, trasladar, pesar o registrar sanidad.",
        badge: "Campo + QR",
        targetHref: "/dashboard/escanear",
        targetLabel: "Abrir Escanear",
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
        text: "El buscador manual del escáner acepta códigos parciales de animales, lotes, lugares o activos cargados en la copia offline y dispara la misma captura rápida.",
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
      "Administra gallinas, gallos y lotes de pollos, codornices, patos, conejos o cuyes desde un resumen consolidado con asignación de lugares.",
    estimatedMinutes: 4,
    tags: ["animales", "gallinas", "gallos", "pollos", "codornices", "patos", "conejos", "cuyes", "especies"],
    relatedHrefs: [
      { href: "/dashboard/animales", label: "Resumen de Animales" },
      { href: "/dashboard/produccion?tab=animales", label: "Pestañas por especie" },
      { href: "/dashboard/ubicaciones", label: "Lugares de manejo" },
    ],
    sections: [
      {
        type: "intro",
        text: "El módulo Animales reúne en un solo inventario a las gallinas ponedoras, gallos reproductores y lotes de especies complementarias (pollos de engorde, codornices, patos, conejos y cuyes), mostrando cantidad activa, peso total estimado, valoración y pendientes de asignar a un espacio.",
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
    title: "Control de peso, biometría, CV% y EPEF",
    module: "animales",
    icon: "scale",
    summary:
      "Registra pesajes por muestra con peso promedio y desviación estándar para obtener CV%, uniformidad, ganancia diaria (GDP) y puntaje EPEF.",
    estimatedMinutes: 3,
    tags: ["peso", "biometría", "curva", "cv%", "uniformidad", "epef", "ganancia", "muestra", "estándar"],
    relatedHrefs: [
      { href: "/dashboard/produccion/peso", label: "Control de Peso" },
      { href: "/dashboard/analisis/razas", label: "Curvas por Raza" },
      { href: "/dashboard/configuracion/catalogos?tab=pesos", label: "Pesos de referencia" },
    ],
    sections: [
      {
        type: "intro",
        text: "El seguimiento biométrico compara el peso real de cada especie (gallinas, pollos, codornices, patos, conejos y cuyes) frente a la banda estándar y calcula automáticamente Coeficiente de Variación (CV%), Uniformidad (±10%), Ganancia Diaria de Peso (GDP), FCR ajustada y Factor Europeo de Eficiencia Productiva (EPEF).",
      },
      {
        type: "screenshot",
        title: "Gráfica de pesajes reales vs banda estándar de raza",
        image: "/images/guia/peso-biometria.webp",
        alt: "Módulo Control de Peso y Biometría mostrando curva comparativa con banda de peso objetivo y registros de pesaje",
        caption:
          "La zona sombreada muestra el rango esperado (mínimo a máximo) para la especie y raza seleccionadas, mientras los puntos revelan si la ganancia semanal está alineada.",
        badge: "Biometría zootécnica",
        targetHref: "/dashboard/produccion/peso",
        targetLabel: "Registrar pesaje",
      },
      {
        type: "steps",
        title: "Cómo registrar un muestreo de peso con uniformidad",
        items: [
          "Entra a Animales → Control de peso y haz clic en «+ Registrar Pesaje».",
          "Selecciona el lote (o grupo de aves, conejos o cuyes), especie, semana/edad y lugar de manejo.",
          "Ingresa el peso promedio en kg, el tamaño de la muestra (mínimo 5–10 animales) y opcionalmente la desviación estándar o rango observado.",
          "Al guardar, el sistema entrega una Microcápsula con CV% y uniformidad del lote y actualiza las alertas de ventana óptima de sacrificio en KPIs.",
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
    slug: "reproduccion-cunicola",
    title: "Reproducción de conejos y cuyes (empadre a destete)",
    module: "animales",
    icon: "rabbit",
    summary:
      "Controla eventos de empadre, palpación, nidal, parto, tamaño de camada y destete para conejos y cuyes con alerta automática de consanguinidad.",
    estimatedMinutes: 4,
    tags: ["reproducción", "conejos", "cuyes", "empadre", "palpación", "nidal", "parto", "destete", "consanguinidad"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=reproduccion", label: "Abrir Reproducción" },
      { href: "/dashboard/planeacion/calendario", label: "Ver fechas en Calendario Maestro" },
      { href: "/dashboard/animales", label: "Ver lotes activos" },
    ],
    sections: [
      {
        type: "intro",
        text: "Los conejos (31 días de gestación) y los cuyes (68 días de gestación) requieren fechas precisas de palpación, colocación de nidal, parto y destete. Este módulo registra cada evento por pareja/lote reproductor y calcula automáticamente los hitos futuros en el Calendario Maestro.",
      },
      {
        type: "screenshot",
        title: "Control del ciclo reproductivo multi-especie",
        image: "/images/guia/animales-resumen.webp",
        alt: "Vista de gestión de animales y lotes multi-especie con conejos y cuyes integrados",
        caption:
          "Administra hembras y machos reproductores desde Animales y sigue sus empadres, tasas de fertilidad, gazapos/crías nacidas vivas y destetadas.",
        badge: "Conejos y cuyes",
        targetHref: "/dashboard/produccion?tab=reproduccion",
        targetLabel: "Ir a Reproducción",
      },
      {
        type: "steps",
        title: "Registrar un ciclo desde el empadre hasta el destete",
        items: [
          "Entra a Animales → Reproducción (o desde Crear + → Evento reproductivo).",
          "Elige especie (conejo o cuy), tipo de evento (Empadre, Palpación, Colocación de Nidal, Parto, Destete o Descanso) y selecciona hembra y macho.",
          "Si el cruce presenta parentesco cercano en el historial genético, el sistema mostrará una alerta de consanguinidad antes de confirmar.",
          "En el evento Parto registra crías nacidas vivas, muertas y peso de camada; el sistema calcula automáticamente la fecha estimada de destete para tu rutina diaria.",
        ],
      },
      {
        type: "note",
        text: "Cada registro reproductivo actualiza el Calendario Maestro para que nunca pases por alto una palpación (día 12–14 en conejos) ni la preparación del nidal previo al parto.",
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
    title: "Recolección de huevos multiespecie (NTC 1240)",
    module: "produccion",
    icon: "egg",
    summary:
      "Registra la postura diaria de gallinas, codornices o patos bajo clasificación NTC 1240 con T°/HR, separa autoconsumo y recibe microcápsulas al guardar.",
    estimatedMinutes: 3,
    tags: ["huevos", "postura", "ntc 1240", "AA", "AAA", "Jumbo", "temperatura", "humedad", "autoconsumo", "microcápsulas"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=huevos", label: "Producción de Huevos" },
      { href: "/dashboard/inventarios/huevos", label: "Inventario PEPS de Huevos" },
      { href: "/dashboard/soberania", label: "Ver en Soberanía" },
    ],
    sections: [
      {
        type: "intro",
        text: "El módulo de Huevos admite captura ágil en galpón (4 interacciones o menos) y clasificación por peso bajo la norma colombiana NTC 1240 (Jumbo, AAA, AA, A, B, C) además de huevos de codorniz o pato. Puedes registrar temperatura y humedad ambiente, descontar autoconsumo del hogar y recibir una Microcápsula inmediata con tu tasa de postura del día.",
      },
      {
        type: "screenshot",
        title: "Control de recolección diaria y gráfica de postura",
        image: "/images/guia/produccion-huevos.webp",
        alt: "Módulo Producción de Huevos con tarjetas resumen, tendencia diaria y tabla de recolecciones",
        caption:
          "Visualiza producción de hoy, acumulada de 7 días, promedio diario y partición entre consumo del hogar y stock comercial PEPS.",
        badge: "Postura diaria NTC 1240",
        targetHref: "/dashboard/produccion?tab=huevos",
        targetLabel: "Ir a Huevos",
      },
      {
        type: "steps",
        title: "Registrar huevos en modo rápido o detallado",
        items: [
          "Entra a Producción → Huevos (o usa la Rutina Diaria de Inicio, el botón Crear + → Recoger Huevos o Captura Rápida).",
          "En el modal de recolección elige fecha, especie (gallina, codorniz, pato), galpón/lote origen y, si cuentas con lectura térmica, temperatura (°C) y humedad (% HR) del recinto.",
          "Usa el Modo Rápido para anotar el total en una sola cifra, o cambia a Detallado por tamaño NTC 1240 para desglosar unidades por calibre.",
          "Indica las unidades para autoconsumo del hogar; el excedente entra a Inventarios → Huevos con trazabilidad PEPS/FIFO, marca completada la tarea de tu rutina y muestra tu microcápsula de eficiencia.",
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
      "Lleva historial de cosecha de carne por especie (pollos, gallinas de descarte, gallos, patos, conejos, cuyes), rendimiento vivo vs canal y valorización.",
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
      "Registra la salida de pollos de engorde, aves recomendadas de sacrificio, conejos o cuyes convirtiéndolos en lotes trazables de carne.",
    estimatedMinutes: 3,
    tags: ["sacrificio", "faena", "beneficio", "descarte", "pollo", "conejo", "cuy"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=carne", label: "Registrar en Carne / Beneficio" },
      { href: "/dashboard/inventarios/carne", label: "Inventario de Carne" },
    ],
    sections: [
      {
        type: "intro",
        text: "El registro de sacrificio unifica en Producción → Carne la salida de aves individuales (gallinas de descarte o gallos) o la saca parcial/total de un lote de engorde, conejos o cuyes, calculando automáticamente el rendimiento e integrando el inventario FIFO de carne.",
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
          "Selecciona el origen: gallina individual (especialmente marcadas en descarte/recomendadas), gallo o lote activo de pollos/patos/conejos/cuyes.",
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
          "Controla kilogramos disponibles por especie (pollo, gallina de descarte, pato, codorniz, conejo, cuy), valor estimado en cava y días desde el beneficio.",
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
    title: "Alimentación, dieta combinada y predicción",
    module: "almacen",
    icon: "wheat",
    summary:
      "Registra consumos y programas por etapa, balancea dietas combinadas (%MS, %PC y Vitamina C), predice necesidad en bultos de 40 kg y recibe microcápsulas.",
    estimatedMinutes: 4,
    tags: ["alimentación", "ración", "concentrado", "forraje", "dieta combinada", "vitamina c", "bultos", "programa", "consumo"],
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=alimentacion", label: "Gestión de Alimentación" },
      { href: "/dashboard/inventarios/alimentacion", label: "Inventario de Alimentos" },
      { href: "/dashboard/configuracion/catalogos?tab=alimentacion", label: "Tabla Nutricional" },
      { href: "/dashboard/almacen", label: "Centro Almacén" },
    ],
    sections: [
      {
        type: "intro",
        text: "Controlar qué entra a bodega y cuánto consume cada especie permite balancear raciones entre concentrado comercial y forrajes locales (% Materia Seca, % Proteína Cruda y aporte de Vitamina C en cuyes), comparar consumo real vs esperado por curva y proyectar reposiciones en bultos de 40 kg con alertas de cobertura.",
      },
      {
        type: "screenshot",
        title: "Gestión de movimientos, programas y balance nutricional",
        image: "/images/guia/alimentacion-gestion.webp",
        alt: "Módulo de Alimentación con tipos de alimento, movimientos de entrada/consumo y programas automáticos",
        caption:
          "Administra concentrados y forrajes locales, programa entregas automáticas por etapa/especie y revisa días de cobertura y bultos requeridos.",
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
          "La entrada principal de Almacén unifica alimentos, insumos, activos, mantenimiento, compostaje y cierre diario en una sola vista.",
        badge: "Almacén",
        targetHref: "/dashboard/almacen",
        targetLabel: "Ir a Almacén",
      },
      {
        type: "steps",
        title: "Configurar alimentos, dieta combinada y registrar consumos",
        items: [
          "Entra a Almacén → Gestión de alimentación y crea tipos de alimento indicando %MS, %PC, contenido de Vitamina C (clave en cuyes), costo por kg y origen.",
          "Registra consumos diarios eligiendo alimento, cantidad en kg, especie/lote y lugar de manejo; también puedes registrar compras por bultos desde Finanzas → Egresos.",
          "Consulta el comparativo Real vs Esperado, ajusta la dieta combinada para optimizar costo/kg y al guardar recibe una Microcápsula con tus días de cobertura restantes y bultos sugeridos a comprar.",
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
  {
    slug: "compostaje",
    title: "Compostaje térmico y pilas sanitarias (AGROSAVIA)",
    module: "almacen",
    icon: "sprout",
    summary:
      "Gestiona pilas de compostaje 3:1:1 y 7:2:2 para gallinaza o mortalidad sanitaria, monitorea temperatura (55–70 °C), programa volteos y registra cosecha.",
    estimatedMinutes: 3,
    tags: ["compostaje", "agrosavia", "pila", "temperatura", "volteo", "gallinaza", "mortalidad", "abono"],
    relatedHrefs: [
      { href: "/dashboard/operaciones/compostaje", label: "Abrir Compostaje" },
      { href: "/dashboard/inventarios/gallinaza", label: "Inventario de Gallinaza" },
      { href: "/dashboard/planeacion/calendario", label: "Ver volteos en Calendario" },
    ],
    sections: [
      {
        type: "intro",
        text: "El compostaje controlado bajo metodología AGROSAVIA convierte la gallinaza, pollinaza y mortalidad controlada en abono orgánico seguro. El sistema administra fórmulas 3:1:1 (gallinaza + material carbonado + agua/humedad) y 7:2:2 para mortalidad, alertando si la pila cae de 55 °C o excede 70 °C.",
      },
      {
        type: "screenshot",
        title: "Gestión de pilas, volteos y transformación de subproductos",
        image: "/images/guia/produccion-gallinaza.webp",
        alt: "Vista de producción y procesamiento de gallinaza y compostaje orgánico en pilas",
        caption:
          "Sigue el avance térmico de cada pila activa, registra volteos periódicos para aireación y cosecha el compost maduro listo para huerta o venta.",
        badge: "Economía circular",
        targetHref: "/dashboard/operaciones/compostaje",
        targetLabel: "Ir a Compostaje",
      },
      {
        type: "steps",
        title: "Operar una pila de compostaje de inicio a cosecha",
        items: [
          "Entra a Almacén → Compostaje y crea una nueva pila indicando nombre/código, fórmula (3:1:1 o 7:2:2), kilos iniciales de estiércol/mortalidad y material seco estructurante.",
          "Registra periódicamente lecturas de temperatura (°C), humedad y volteos; las pilas activas programan recordatorios de monitoreo en el Calendario Maestro.",
          "Mantén la fase termofílica entre 55 °C y 68 °C para inactivar patógenos sin superar 70 °C.",
          "Al estabilizarse la pila, presiona «Cosechar pila» para registrar los kilos de compost maduro obtenido y su destino.",
        ],
      },
    ],
  },
  {
    slug: "cierre-sensores",
    title: "Cierre diario auditable y sensores IoT en galpón",
    module: "almacen",
    icon: "clipboard",
    summary:
      "Concilia la operación del día con hash anti-fraude, verificación de rutinas incumplidas y registro de lecturas ITH, amoníaco (NH3), T°/HR y báscula IoT.",
    estimatedMinutes: 3,
    tags: ["cierre diario", "antifraude", "auditoría", "sensores", "iot", "ith", "amoniaco", "nh3", "temperatura", "humedad", "báscula"],
    relatedHrefs: [
      { href: "/dashboard/operaciones/cierre", label: "Cierre Diario y Sensores" },
      { href: "/dashboard/planeacion/calendario", label: "Calendario Maestro" },
      { href: "/dashboard", label: "Panel Inicio" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Cierre Diario Auditable consolida la jornada de la granja (huevos recolectados, alimentación consumida, ventas, egresos, bajas y tareas completadas) con sello de auditoría anti-fraude, mientras la pestaña de Sensores IoT monitorea microclima (T°, %HR, ITH de estrés térmico, amoníaco NH3 ppm y peso por báscula) por lugar de manejo.",
      },
      {
        type: "screenshot",
        title: "Centro operativo de cierre diario y telemetría",
        image: "/images/guia/almacen-hub.webp",
        alt: "Centro de Almacén y Operaciones con monitoreo y control de cierre",
        caption:
          "Centraliza el cierre al final del turno, revisa alertas por estrés calórico (ITH) o NH3 alto y descarga evidencia auditable de cada jornada.",
        badge: "Control diario",
        targetHref: "/dashboard/operaciones/cierre",
        targetLabel: "Abrir Cierre Diario",
      },
      {
        type: "steps",
        title: "Ejecutar el cierre del día y monitorear microclima",
        items: [
          "Entra a Almacén → Cierre Diario y Sensores al terminar la jornada operativa.",
          "Verifica el resumen automático de huevos, alimento, ventas, gastos y tareas pendientes del día; agrega observaciones si hubo algún ajuste o novedad.",
          "Registra el cierre para generar el registro auditable inalterable de la fecha.",
          "En la sección de Sensores IoT consulta o registra lecturas de temperatura, humedad relativa, NH3 y peso en báscula por galpón para anticipar ventilación o cama nueva.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // PLANEACIÓN Y SOBERANÍA
  // ═══════════════════════════════════════════
  {
    slug: "calendario-rutinas",
    title: "Calendario Maestro y rutinas auto-ajustables",
    module: "planeacion",
    icon: "calendar-days",
    summary:
      "Unifica todas las fechas de la granja a corto, mediano y largo plazo, configura tu rutina diaria y monitorea tareas cumplidas vs incumplidas.",
    estimatedMinutes: 4,
    tags: ["calendario maestro", "rutinas", "autoajustable", "inicio", "cumplimiento", "incumplidas", "horizonte", "agenda"],
    relatedHrefs: [
      { href: "/dashboard/planeacion/calendario", label: "Abrir Calendario Maestro" },
      { href: "/dashboard", label: "Ver Rutina en Inicio" },
      { href: "/dashboard/sanidad/calendario", label: "Calendario Sanitario" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Calendario Maestro resuelve la fragmentación entre módulos: reúne en una sola agenda las fechas de recolección diaria, ración, biometría semanal, vacunación ICA, fin de retiro farmacológico, incubaciones, partos/destetes de conejos y cuyes, volteo de compostaje, mantenimientos y vencimientos de CxC/CxP.",
      },
      {
        type: "screenshot",
        title: "Calendario Maestro con horizonte, rutinas y cumplimiento",
        image: "/images/guia/plan-parvada.webp",
        alt: "Vista de planeación y programación temporal de la granja",
        caption:
          "Alterna entre Hoy, Horizonte a mediano/largo plazo, Configurar Rutinas y Cumplimiento e Incumplimiento para no dejar tareas vencidas sin atender.",
        badge: "Agenda unificada",
        targetHref: "/dashboard/planeacion/calendario",
        targetLabel: "Abrir Calendario Maestro",
      },
      {
        type: "steps",
        title: "Configurar tu rutina auto-ajustable en 4 pasos",
        items: [
          "Abre Planeación → Calendario Maestro (o haz clic en «Configurar rutina» desde Inicio).",
          "Activa o personaliza los ítems de tu rutina diaria/semanal (huevos, alimentación, revisión sanitaria, pesaje, limpieza, cierre diario) indicando recurrencia y días hábiles.",
          "Vuelve a Inicio: los botones de Rutina del Día aparecen automáticamente solo cuando esa labor aplica hoy, y se marcan como «Cumplida» apenas guardas el registro real en el módulo correspondiente.",
          "Revisa la pestaña «Cumplimiento» en el Calendario Maestro para identificar rachas de disciplina y tareas incumplidas a tiempo.",
        ],
      },
    ],
  },
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
    title: "Plan Sanitario Integral y tiempos de retiro",
    module: "sanidad",
    icon: "pill",
    summary:
      "Centro sanitario conectado con Control, Calendario, Alertas, Bioseguridad ICA y bloqueos automáticos por tiempo de retiro farmacológico.",
    estimatedMinutes: 4,
    tags: ["sanidad", "plan sanitario", "bioseguridad", "retiro", "carencia", "protocolo", "vacunas", "etapas"],
    relatedHrefs: [
      { href: "/dashboard/sanidad", label: "Plan Sanitario Integral" },
      { href: "/dashboard/sanidad/bioseguridad", label: "Bioseguridad y Bienestar ICA" },
      { href: "/dashboard/sanidad/calendario", label: "Calendario de Vacunación" },
      { href: "/dashboard/sanidad/control", label: "Control Sanitario" },
      { href: "/dashboard/inventarios/insumos", label: "Stock de Vacunas" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Plan Sanitario consolida la salud preventiva de tu granja en cinco pestañas conectadas entre sí (Plan de Acción, Protocolos por Etapa, Ejecutar, Historial y Recursos) y se enlaza directamente con Control Sanitario, Calendario, Alertas de retiro farmacológico y el módulo de Bioseguridad y Bienestar ICA.",
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
  {
    slug: "bioseguridad-bienestar",
    title: "Bioseguridad, POE GAB y Bienestar Animal (ICA / Res. 8452)",
    module: "sanidad",
    icon: "shield",
    summary:
      "Lleva registros auditables de ingreso de visitantes, desinfección POE, bienestar animal multiespecie y bloqueos preventivos por retiro farmacológico.",
    estimatedMinutes: 4,
    tags: ["bioseguridad", "poe", "gab", "ica", "res 8452", "bienestar", "visitantes", "desinfección", "capacitación", "retiro"],
    relatedHrefs: [
      { href: "/dashboard/sanidad/bioseguridad", label: "Abrir Bioseguridad" },
      { href: "/dashboard/sanidad/control", label: "Control Sanitario y Retiros" },
      { href: "/dashboard/sanidad/alertas", label: "Ver Alertas Sanitarias" },
    ],
    sections: [
      {
        type: "intro",
        text: "Este módulo alinea la operación de la finca con normativas sanitarias del ICA (Res. 3650–3652/2014 y Res. 8452/2025 de Bienestar Animal): controla trazabilidad de visitantes y vehículos, rutinas POE de limpieza/desinfección con vacío sanitario, densidad por espacio, vigencia de capacitaciones (5 años) y alertas por retiro de medicamentos.",
      },
      {
        type: "screenshot",
        title: "Panel de Bioseguridad, Visitantes, Desinfección y Bienestar",
        image: "/images/guia/sanidad-control.webp",
        alt: "Vista de controles sanitarios y bioseguridad aplicada por galpón y lote",
        caption:
          "Documenta ingresos a granja, procedimientos POE GAB, protocolos de bienestar animal multi-especie y bloqueos activos mientras vence un período de retiro.",
        badge: "Normativa ICA",
        targetHref: "/dashboard/sanidad/bioseguridad",
        targetLabel: "Abrir Bioseguridad",
      },
      {
        type: "steps",
        title: "Mantener el cumplimiento sanitario y de bienestar al día",
        items: [
          "Entra a Sanidad → Bioseguridad y Bienestar para revisar el índice de cumplimiento y las tarjetas POE vigentes.",
          "Registra el ingreso de visitantes externos o proveedores con su origen y fecha para mantener cerco epidemiológico.",
          "Anota las jornadas de desinfección, desratización o vacío sanitario por galpón y las certificaciones/capacitaciones del personal.",
          "Cuando apliques medicamentos con retiro en Control Sanitario, verifica en Alertas e historial qué lotes permanecen bloqueados temporalmente para recolección o beneficio.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // FINANZAS Y CUENTAS
  // ═══════════════════════════════════════════
  {
    slug: "registrar-venta",
    title: "Ventas en 5 líneas (huevos, carne, animales, gallinaza y otros)",
    module: "finanzas",
    icon: "money",
    summary:
      "Factura en 5 líneas comerciales (huevos, carne, animales en pie, gallinaza u otros subproductos) de contado o a crédito CxC con microcápsulas y descuento PEPS.",
    estimatedMinutes: 4,
    tags: ["ventas", "5 líneas", "huevos", "carne", "animales en pie", "gallinaza", "otros", "crédito", "cxc", "clientes", "microcápsulas"],
    relatedHrefs: [
      { href: "/dashboard/finanzas", label: "Centro de Finanzas" },
      { href: "/dashboard/finanzas/ventas", label: "Ir a Ventas (5 líneas)" },
      { href: "/dashboard/finanzas/cuentas", label: "Ver CxC pendientes" },
      { href: "/dashboard/contactos", label: "Directorio de Clientes" },
      { href: "/dashboard/inventarios/huevos", label: "Stock disponible" },
    ],
    sections: [
      {
        type: "intro",
        text: "El módulo de Ventas centraliza cinco líneas comerciales en pestañas dedicadas (y disponibles también desde Captura Rápida): Huevos, Carne, Animales en pie (gallinas, gallos, pollos, patos, codornices, conejos o cuyes), Gallinaza y Otros (subproductos o servicios). Cada venta actualiza inventarios PEPS, suma a Finanzas, crea CxC si es fiada y entrega una Microcápsula de margen/ingreso.",
      },
      {
        type: "screenshot",
        title: "Gestión de ventas con 5 líneas comerciales por producto",
        image: "/images/guia/finanzas-ventas.webp",
        alt: "Módulo Ventas mostrando pestañas de huevos, carne, animales en pie, gallinaza y otros ingresos junto con tabla comercial",
        caption:
          "Elige cliente del directorio para aplicar automáticamente su plazo de crédito, combina presentaciones/tallas o kilos y alterna entre Contado y Crédito CxC.",
        badge: "5 líneas de venta",
        targetHref: "/dashboard/finanzas/ventas",
        targetLabel: "Registrar Venta",
      },
      {
        type: "steps",
        title: "Registrar una venta paso a paso",
        items: [
          "Abre Finanzas → Ventas (o pulsa Crear + → Registrar Venta) y selecciona la línea: Huevos, Carne, Animales en pie, Gallinaza u Otros.",
          "Selecciona un cliente del Directorio (para heredar su plazo de crédito y WhatsApp) o créalo al instante con «+ Cliente».",
          "En huevos mezcla tallas NTC 1240; en carne o gallinaza registra kilos y presentación; en animales en pie vincula la ficha o lote vendido; en otros elige categoría e ítem libre.",
          "Activa «Venta a crédito» para generar automáticamente la cuenta por cobrar CxC con fecha de vencimiento calculada.",
        ],
      },
    ],
  },
  {
    slug: "registrar-egreso",
    title: "Egresos, adjuntos con OCR y abono a proveedores",
    module: "finanzas",
    icon: "outgoing",
    summary:
      "Registra gastos operativos y compras por bultos, adjunta fotos/PDF de facturas con lectura automática OCR y actualiza bodega o CxP en un paso.",
    estimatedMinutes: 4,
    tags: ["egresos", "gastos", "compras", "adjuntos", "ocr", "factura", "bultos", "alimentación", "cxp"],
    relatedHrefs: [
      { href: "/dashboard/finanzas/egresos", label: "Abrir Egresos" },
      { href: "/dashboard/finanzas/cuentas", label: "Ver CxP por pagar" },
      { href: "/dashboard/inventarios/alimentacion", label: "Almacén de Alimentos" },
    ],
    sections: [
      {
        type: "intro",
        text: "Los egresos registran todo dinero o compromiso que sale para operar la granja. Puedes adjuntar fotos o PDFs de facturas y recibos —con lectura automática OCR para prellenar monto, proveedor y fecha—, acreditar automáticamente bultos de alimento o insumos a bodega y asignar gastos compartidos a centros de costo o especies.",
      },
      {
        type: "screenshot",
        title: "Control de egresos, adjuntos OCR y desglose por categoría",
        image: "/images/guia/finanzas-egresos.webp",
        alt: "Módulo Egresos mostrando total gastado, gráfico de barras de gastos, desglose por categoría y listado",
        caption:
          "Incluye adjuntos de comprobantes con OCR, centro de costos por especie o galpón, barra de búsqueda y enlace con Productos frecuentes.",
        badge: "Costos y OCR",
        targetHref: "/dashboard/finanzas/egresos",
        targetLabel: "Abrir Egresos",
      },
      {
        type: "steps",
        title: "Registrar una compra con actualización automática de stock y soporte",
        items: [
          "Entra a Finanzas → Egresos y pulsa «+ Nuevo Egreso» (o «Subir factura OCR» desde Captura Rápida).",
          "Adjunta la foto del recibo o PDF si la tienes para leer datos con OCR y conservar el soporte contable.",
          "Selecciona categoría, especie o centro de costos (específico o compartido para prorrateo), y si es un producto frecuente autocompleta proveedor, presentación (bulto de 40 kg) y último precio.",
          "Define si fue pago inmediato o crédito para acreditar inventario en bodega y generar la CxP en Finanzas → Cuentas.",
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
      { href: "/dashboard/contactos?nuevo=proveedor", label: "Agregar Proveedor" },
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
      { href: "/dashboard/contactos", label: "Clientes y Proveedores" },
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
    slug: "clientes-proveedores",
    title: "Directorio de Clientes y Proveedores (crédito y WhatsApp)",
    module: "finanzas",
    icon: "handshake",
    summary:
      "Centraliza clientes, veterinarias y proveedores de alimento con teléfono, botón de WhatsApp, ubicación en mapa y plazos de crédito predeterminados.",
    estimatedMinutes: 3,
    tags: ["clientes", "proveedores", "contactos", "directorio", "whatsapp", "mapa", "plazo crédito"],
    relatedHrefs: [
      { href: "/dashboard/contactos", label: "Abrir Directorio" },
      { href: "/dashboard/finanzas/ventas", label: "Usar clientes en Ventas" },
      { href: "/dashboard/finanzas/egresos", label: "Usar proveedores en Egresos" },
    ],
    sections: [
      {
        type: "intro",
        text: "El Directorio unificado de Clientes y Proveedores evita digitar datos repetidos al facturar o comprar. Cada ficha guarda nombre/razón social, rol (cliente, proveedor o ambos), teléfono, WhatsApp directo, vereda/ubicación GPS y días de crédito autorizados.",
      },
      {
        type: "screenshot",
        title: "Directorio comercial integrado con Ventas y Cuentas",
        image: "/images/guia/finanzas-cuentas.webp",
        alt: "Vista de cartera y directorio comercial vinculado con clientes y proveedores",
        caption:
          "Cuando seleccionas un contacto en Ventas, Egresos o Captura Rápida se precargan sus condiciones de pago y plazo para calcular vencimientos CxC/CxP.",
        badge: "CRM de granja",
        targetHref: "/dashboard/contactos",
        targetLabel: "Abrir Contactos",
      },
      {
        type: "steps",
        title: "Crear y aprovechar fichas comerciales",
        items: [
          "Abre Finanzas → Clientes y Proveedores (o Configuración → Catálogos pestaña Contactos).",
          "Crea un nuevo contacto eligiendo tipo (Cliente, Proveedor o Ambos), documento, teléfono/WhatsApp, ubicación y días de crédito (ej. 0 para contado o 15/30 días).",
          "También puedes crear un contacto nuevo al vuelo sin salir de un formulario de venta o compra usando el selector integrado.",
          "Usa el enlace directo a WhatsApp o ubicación para coordinar entregas de cubetas, animales o pedidos de concentrado.",
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
    title: "KPIs zootécnicos, punto de equilibrio y contabilidad analítica",
    module: "analisis",
    icon: "bar-chart",
    summary:
      "Mide postura HAA, CV%/EPEF, punto de equilibrio unitario, CAPEX/ROI y emite reportes P&L con prorrateo multi-especie exportables a Excel y PDF.",
    estimatedMinutes: 4,
    tags: ["kpis", "reportes", "p&l", "contabilidad analítica", "prorrateo", "haa", "epef", "capex", "roi", "punto de equilibrio", "excel", "pdf"],
    relatedHrefs: [
      { href: "/dashboard/analisis", label: "Centro de Análisis" },
      { href: "/dashboard/analisis/kpis", label: "KPIs del Gallinero" },
      { href: "/dashboard/analisis/reportes", label: "Reportes y Contabilidad Analítica" },
    ],
    sections: [
      {
        type: "intro",
        text: "El área de Análisis aplica contabilidad analítica anti-subsidio cruzado: calcula costo unitario real por huevo/cubeta y por kg de carne, alerta si vendes por debajo del punto de equilibrio, reporta EPEF, CV%, uniformidad, HAA (Gallina-Alojada), retorno CAPEX/ROI y prorroga costos indirectos compartidos entre especies en reportes exportables a Excel (.xlsx) y PDF.",
      },
      {
        type: "screenshot",
        title: "Tablero de KPIs zootécnicos, equilibrio y CAPEX/ROI",
        image: "/images/guia/analisis-kpis.webp",
        alt: "Módulo KPIs mostrando tasa de postura, pico productivo, costo por huevo, punto de equilibrio, EPEF y mortalidad",
        caption:
          "Filtra por período y especie para auditar mortalidad, conversión FCR, CV%, uniformidad, costo por cubeta/kg y ventanas óptimas de sacrificio.",
        badge: "Indicadores clave",
        targetHref: "/dashboard/analisis/kpis",
        targetLabel: "Ver KPIs",
      },
      {
        type: "screenshot",
        title: "Reportes P&L, contabilidad analítica por especie y exportación",
        image: "/images/guia/analisis-reportes.webp",
        alt: "Módulo Reportes mostrando Estado de Pérdidas y Ganancias (P&L) y rentabilidad comparativa por línea productiva y especie",
        caption:
          "Evalúa márgenes reales por especie/producto aplicando reglas configurables de prorrateo para costos compartidos y descarga paquetes listos para DIAN o crédito agropecuario.",
        badge: "Excel / PDF",
        targetHref: "/dashboard/analisis/reportes",
        targetLabel: "Abrir Reportes",
      },
      {
        type: "steps",
        title: "Aprovechar KPIs y Contabilidad Analítica para decidir",
        items: [
          "Entra a Análisis → KPIs para comparar tu costo unitario real (huevo, cubeta de 30 o kg de carne) frente al precio de venta promedio y vigilar alertas bajo costo.",
          "Revisa EPEF, ganancia diaria, uniformidad y alertas de ventana de sacrificio antes de sostener lotes improductivos.",
          "Abre Análisis → Reportes para emitir estados P&L, analizar rentabilidad por especie con prorrateo justo de costos indirectos y exportar en Excel o PDF.",
        ],
      },
    ],
  },
  {
    slug: "estandares-raza",
    title: "Curvas de referencia con ajuste climático y por altitud",
    module: "analisis",
    icon: "trending-up",
    summary:
      "Contrasta postura y crecimiento real de tus 6 especies frente a curvas genéticas ajustadas automáticamente por altitud (m.s.n.m.) y tipo de piso.",
    estimatedMinutes: 3,
    tags: ["razas", "curvas", "estándar", "altitud", "clima", "isa brown", "cobb 500", "cuyes", "conejos", "postura", "desempeño"],
    relatedHrefs: [
      { href: "/dashboard/analisis/razas", label: "Curvas y Desempeño" },
      { href: "/dashboard/produccion/peso", label: "Registrar pesajes" },
      { href: "/dashboard/ubicaciones", label: "Altitud por Lugar" },
    ],
    sections: [
      {
        type: "intro",
        text: "Curvas y desempeño compara tus galpones, jaulas o corrales contra el potencial genético de cada especie (gallinas, pollos, codornices, patos, conejos y cuyes), incorporando ajustes ambientales según altitud (m.s.n.m.) y tipo de piso del lugar seleccionado.",
      },
      {
        type: "screenshot",
        title: "Gráfica de comparación real frente a banda genética esperada",
        image: "/images/guia/analisis-razas.webp",
        alt: "Módulo Curvas y Desempeño por Raza con banda genética objetivo, puntos reales semanales y estado de alineación",
        caption:
          "Selecciona especie, raza y lugar de manejo para ver CV%, uniformidad, ganancia diaria y el estado de alineación frente a la curva ajustada.",
        badge: "Benchmark multi-especie",
        targetHref: "/dashboard/analisis/razas",
        targetLabel: "Abrir Curvas por Raza",
      },
      {
        type: "steps",
        title: "Interpretar las curvas ajustadas",
        items: [
          "Ve a Análisis → Curvas y desempeño.",
          "Elige especie (gallina, pollo, codorniz, pato, conejo o cuy), raza y opcionalmente un Lugar de manejo para aplicar corrección ambiental por altitud.",
          "Compara tus puntos reales frente a la franja esperada para detectar oportunidades de ajuste nutricional, térmico o sanitario.",
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════
  // CONFIGURACIÓN
  // ═══════════════════════════════════════════
  {
    slug: "catalogos-sistema",
    title: "Catálogos y configuración maestra (8 pestañas)",
    module: "configuracion",
    icon: "settings",
    summary:
      "Adapta listas, clientes/proveedores, parámetros del predio, las 6 especies (incluyendo cuyes), vacunas, pesos objetivo, gallinaza y nutrición.",
    estimatedMinutes: 4,
    tags: ["catálogos", "configuración", "8 pestañas", "parámetros", "razas", "especies", "cuyes", "precios", "nutrición"],
    relatedHrefs: [
      { href: "/dashboard/configuracion/catalogos", label: "Abrir Catálogos (8 pestañas)" },
      { href: "/dashboard/contactos", label: "Directorio Clientes y Proveedores" },
      { href: "/dashboard/configuracion", label: "Resumen Configuración" },
    ],
    sections: [
      {
        type: "intro",
        text: "El corazón configurable de El Gallinero vive en Configuración → Catálogos. Organizado en 8 pestañas (Listas, Clientes y Proveedores, Parámetros, Especies, Vacunas, Pesos, Gallinaza y Alimentación), gobierna razas de 6 especies (con cuyes incluidos), precios por calibre NTC 1240, etapas, reglas de prorrateo, vacunas y composición nutricional sin tocar código.",
      },
      {
        type: "screenshot",
        title: "Administrador de catálogos y parámetros en 8 pestañas",
        image: "/images/guia/configuracion-catalogos.webp",
        alt: "Módulo Catálogos mostrando pestañas maestras de configuración del sistema",
        caption:
          "Incluye Listas desplegables, Directorio de Clientes y Proveedores, Parámetros globales del predio, Especies habilitadas, Plantillas de vacunas, Pesos estándar, Factores de gallinaza y Tabla nutricional.",
        badge: "Configuración maestra",
        targetHref: "/dashboard/configuracion/catalogos",
        targetLabel: "Abrir Catálogos",
      },
      {
        type: "steps",
        title: "Personalizar el sistema para tu finca",
        items: [
          "Entra a Configuración → Catálogos.",
          "En «Listas» y «Especies» habilita razas para gallinas, pollos, codornices, patos, conejos y cuyes, precios por tamaño NTC 1240, presentaciones y categorías.",
          "En «Clientes y Proveedores» administra contactos comerciales (también accesible desde Finanzas → Clientes y Proveedores); en «Parámetros» ajusta ubicación, moneda, umbrales de alerta y reglas del predio.",
          "Configura plantillas en «Vacunas», curvas en «Pesos», factores diarios en «Gallinaza» y %MS/%PC/Vitamina C en «Alimentación».",
        ],
      },
      {
        type: "warning",
        text: "Desactivar un ítem en cualquier catálogo no borra los registros históricos que ya lo utilizaban; simplemente deja de mostrarse como opción nueva para preservar la integridad contable.",
      },
    ],
  },
  {
    slug: "configuracion-general",
    title: "Configuración general, recuperación de acceso, respaldo y licencia",
    module: "configuracion",
    icon: "settings",
    summary:
      "Centraliza los accesos de configuración de la granja, protege o recupera la cuenta administradora y respalda tus datos sin bloqueo de proveedor.",
    estimatedMinutes: 3,
    tags: ["configuración", "recuperación", "contraseña", "respaldo", "backup", "código abierto", "soberanía", "licencia"],
    relatedHrefs: [
      { href: "/dashboard/configuracion", label: "Abrir Configuración" },
      { href: "/dashboard/configuracion/modulos", label: "Escala y Módulos" },
      { href: "/dashboard/configuracion/catalogos", label: "Catálogos Maestros" },
      { href: "/dashboard/contactos", label: "Clientes y Proveedores" },
    ],
    sections: [
      {
        type: "intro",
        text: "El menú Configuración agrupa en un solo tablero el Asistente inicial de 3 pasos, los Módulos Progresivos, los Catálogos maestros y el Directorio de Clientes y Proveedores. Además, la arquitectura Open-Core del sistema garantiza que tu finca conserve propiedad y portabilidad completa de su base de datos.",
      },
      {
        type: "screenshot",
        title: "Panel principal de Configuración y atribución del proyecto",
        image: "/images/guia/configuracion-panel.webp",
        alt: "Pantalla Configuración mostrando tarjetas de Asistente inicial, Módulos Progresivos, Catálogos y Directorio de Contactos",
        caption:
          "Desde aquí puedes buscar apartados de ajuste con el filtro superior o relanzar el Asistente inicial cuando quieras añadir nuevas instalaciones o especies.",
        badge: "Centro de ajustes",
        targetHref: "/dashboard/configuracion",
        targetLabel: "Ir a Configuración",
      },
      {
        type: "steps",
        title: "Seguridad de acceso y portabilidad de la información",
        items: [
          "Usa contraseñas de al menos 12 caracteres para el usuario administrador; si alguna vez olvidas la clave, solicita o utiliza un código de recuperación de un solo uso desde la pantalla de acceso (/login/recuperar).",
          "Exporta tus estados P&L, KPIs e inventarios en Excel o PDF desde Análisis → Reportes y mantén al día la copia offline en tu dispositivo móvil.",
          "Si deseas autoalojar la aplicación o implementar soluciones institucionales multi-predio sobre su núcleo GNU AGPLv3, consulta la documentación del repositorio y el enlace oficial del desarrollador en la tarjeta inferior.",
        ],
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
