// ─── Guide content data ───
// Each guide is a structured object with sections rendered by the wiki viewer.
// To add a new guide: add an object to the `guides` array and it will appear automatically.

export type SectionType = "intro" | "steps" | "tip" | "warning" | "note" | "diagram";

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
  /** For diagram type */
  nodes?: DiagramNode[];
  connections?: DiagramConnection[];
  layout?: "horizontal" | "vertical";
}

export interface Guide {
  slug: string;
  title: string;
  module: string;
  icon: string;
  relatedHrefs: { href: string; label: string }[];
  sections: GuideSection[];
}

export interface GuideModule {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export const guideModules: GuideModule[] = [
  { id: "primeros-pasos", label: "Primeros Pasos", icon: "🚀", description: "Comienza a usar el sistema" },
  { id: "animales", label: "Animales", icon: "🐾", description: "Registro e inventario de animales" },
  { id: "produccion", label: "Producción", icon: "🥚", description: "Huevos, carne y gallinaza" },
  { id: "finanzas", label: "Finanzas", icon: "💰", description: "Ventas, egresos y balances" },
  { id: "sanidad", label: "Sanidad", icon: "💊", description: "Salud y bienestar animal" },
  { id: "inventarios", label: "Inventarios", icon: "📦", description: "Valorización y stock de todo" },
  { id: "almacen", label: "Almacén", icon: "🧰", description: "Alimentos, insumos y mantenimiento" },
  { id: "planificacion", label: "Planificación", icon: "🌱", description: "Plan de parvada y soberanía" },
  { id: "analisis", label: "Análisis", icon: "📊", description: "KPIs, reportes y estándares" },
  { id: "configuracion", label: "Configuración", icon: "⚙️", description: "Personalización del sistema" },
];

export const guides: Guide[] = [
  // ═══════════════════════════════════════════
  // PRIMEROS PASOS
  // ═══════════════════════════════════════════
  {
    slug: "primeros-pasos",
    title: "Primeros Pasos",
    module: "primeros-pasos",
    icon: "🚀",
    relatedHrefs: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/animales", label: "Animales" },
      { href: "/dashboard/produccion", label: "Producción" },
      { href: "/dashboard/almacen", label: "Almacén" },
    ],
    sections: [
      { type: "intro", text: "El Gallinero es un sistema integral para gestionar tu granja: animales, producción, inventarios, almacén, finanzas y sanidad, todo en un solo lugar. Esta guía te ayudará a comenzar." },
      { type: "diagram", title: "Arquitectura del Sistema", layout: "vertical", nodes: [
        { id: "dash", label: "Dashboard", icon: "📊", color: "green" },
        { id: "animal", label: "Animales", icon: "🐾", color: "yellow" },
        { id: "prod", label: "Producción", icon: "🥚", color: "amber" },
        { id: "alm", label: "Almacén", icon: "🧰", color: "slate" },
        { id: "inv", label: "Inventarios", icon: "📦", color: "amber" },
        { id: "plan", label: "Planificación y Soberanía", icon: "🌱", color: "green" },
        { id: "san", label: "Sanidad", icon: "💊", color: "blue" },
        { id: "fin", label: "Finanzas", icon: "💰", color: "green" },
        { id: "an", label: "Análisis", icon: "📈", color: "purple" },
      ], connections: [
        { from: "dash", to: "animal", label: "Registro e inventario" },
        { from: "dash", to: "prod", label: "Huevos, carne, gallinaza" },
        { from: "dash", to: "alm", label: "Alimentos e insumos" },
        { from: "dash", to: "fin", label: "Ventas, Egresos" },
        { from: "dash", to: "san", label: "Plan Sanitario" },
        { from: "animal", to: "prod" },
        { from: "alm", to: "prod" },
        { from: "prod", to: "inv" },
        { from: "prod", to: "fin" },
        { from: "plan", to: "prod", label: "Proyección" },
        { from: "san", to: "fin" },
        { from: "inv", to: "an" },
        { from: "fin", to: "an" },
      ]},
      { type: "steps", title: "Configuración inicial", items: [
        "Accede al Dashboard principal: verás 4 tarjetas de tareas diarias (Recoger Huevos, Alimentación, Venta, Plan Sanitario) y un resumen rápido del estado de la granja.",
        "Registra tus gallinas en Animales → Gallinas (puedes escanear códigos QR individuales).",
        "Configura los programas de alimentación en Almacén → Gestión de alimentación.",
        "Establece tus primeros registros de huevos en Producción → Huevos.",
        "Revisa el Plan Sanitario en Sanidad para ver las acciones de salud según la etapa de tus animales.",
      ]},
      { type: "tip", title: "Grupos de navegación", text: "El sidebar agrupa el sistema por responsabilidad: Animales (seres vivos), Producción (productos generados), Inventarios (valorización de todas las existencias), Almacén (alimentos, insumos y mantenimiento) y Planificación y Soberanía (plan de parvada y autoconsumo). Sanidad, Finanzas y Análisis complementan la operación." },
      { type: "tip", title: "Ayuda en cada página y campo", text: "Cada página tiene un botón 'Ayuda' (❓) arriba a la derecha que explica el módulo completo. Además, cada campo de formulario tiene un ícono (?) al lado del nombre con explicación detallada." },
      { type: "note", text: "El sistema funciona offline como PWA (Progressive Web App). Puedes instalarlo en tu celular desde el navegador para acceso rápido." },
    ],
  },

  // ═══════════════════════════════════════════
  // PRODUCCIÓN
  // ═══════════════════════════════════════════
  {
    slug: "recoger-huevos",
    title: "Recoger Huevos",
    module: "produccion",
    icon: "🥚",
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=huevos", label: "Registro de Huevos" },
      { href: "/dashboard/inventarios/huevos", label: "Inventario Huevos" },
    ],
    sections: [
      { type: "intro", text: "Desde aquí registras la recolección diaria de huevos. El sistema ofrece dos modos: rápido (recomendado para el día a día) y detallado." },
      { type: "diagram", title: "Flujo de Producción de Huevos", layout: "vertical", nodes: [
        { id: "hen", label: "Gallina pone", icon: "🐔", color: "yellow" },
        { id: "collect", label: "Recolección", icon: "🥚", color: "amber" },
        { id: "classify", label: "Clasificación por Tamaño", icon: "📏", color: "blue" },
        { id: "storage", label: "Inventario (PEPS)", icon: "📦", color: "green" },
        { id: "sale", label: "Venta", icon: "💰", color: "green" },
        { id: "incub", label: "Incubación", icon: "🐣", color: "purple" },
        { id: "finance", label: "Finanzas", icon: "📈", color: "indigo" },
      ], connections: [
        { from: "hen", to: "collect" },
        { from: "collect", to: "classify", label: "P, M, G, XL, XXL" },
        { from: "classify", to: "storage" },
        { from: "storage", to: "sale", label: "Descuenta stock" },
        { from: "storage", to: "incub", label: "Resta del inventario" },
        { from: "sale", to: "finance", label: "Ingreso automático" },
      ]},
      { type: "steps", title: "Modo Rápido (recomendado)", items: [
        "Ve a Producción → Huevos.",
        "Ingresa la fecha de recolección (por defecto hoy).",
        "Escribe el total de huevos recogidos en el campo 'Total'.",
        "El sistema distribuye automáticamente por tamaño según el promedio de tus últimos 14 registros.",
        "Opcionalmente registra huevos rotos y los destinados a incubación.",
        "Agrega notas si es necesario y guarda.",
      ]},
      { type: "steps", title: "Modo Detallado", items: [
        "Ingresa la cantidad de cada tamaño (P, M, G, XL, XXL) por separado.",
        "Útil cuando quieres precisión en la clasificación.",
        "El total se calcula automáticamente.",
      ]},
      { type: "tip", title: "Consejo", text: "Usa el modo rápido para el día a día. El sistema aprende de tu distribución de tamaños y cada vez será más preciso. Cambia a detallado solo cuando necesites clasificar manualmente." },
      { type: "warning", text: "Los huevos registrados para incubación se restan automáticamente del inventario disponible para venta." },
    ],
  },
  {
    slug: "gestionar-gallinas",
    title: "Gestionar Gallinas",
    module: "animales",
    icon: "🐔",
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=gallinas", label: "Gallinas" },
      { href: "/dashboard/animales", label: "Inventario de Animales" },
      { href: "/dashboard/escanear", label: "Escanear Ave" },
    ],
    sections: [
      { type: "intro", text: "Gestiona el registro individual de cada gallina: datos, estado, peso, ciclo de vida y recomendaciones automáticas." },
      { type: "diagram", title: "Ciclo de Vida de la Gallina", layout: "vertical", nodes: [
        { id: "chick", label: "Pollito (0–6 sem)", icon: "🐤", color: "yellow" },
        { id: "juv", label: "Juvenil (6–18 sem)", icon: "🐔", color: "green" },
        { id: "pre", label: "Pre-postura (18–20 sem)", icon: "🥚", color: "amber" },
        { id: "lay", label: "Postura (20+ sem)", icon: "🐔", color: "blue" },
        { id: "rec", label: "Recomendada sacrificio (≥80 sem)", icon: "⚠️", color: "red" },
      ], connections: [
        { from: "chick", to: "juv", label: "Cumple 6 semanas" },
        { from: "juv", to: "pre", label: "Cumple 18 semanas" },
        { from: "pre", to: "lay", label: "Cumple 20 semanas" },
        { from: "lay", to: "rec", label: "≥80 semanas Y ≥2.5 kg" },
      ]},
      { type: "steps", title: "Registrar una gallina", items: [
        "Ve a Animales → Gallinas.",
        "Haz clic en 'Agregar Gallina'.",
        "Completa los datos: nombre/ID, raza, fecha de nacimiento o compra, peso inicial.",
        "Opcionalmente escanea o genera un código QR para identificación individual.",
        "Guarda el registro.",
      ]},
      { type: "steps", title: "Escanear código QR", items: [
        "Ve a 'Escanear Ave' en el sidebar.",
        "Apunta la cámara al código QR de la gallina.",
        "El sistema muestra toda la información del ave.",
        "Desde ahí puedes registrar peso, estado sanitario o cambiar su estado.",
      ]},
      { type: "tip", title: "Ciclo de vida automático", text: "El sistema evalúa automáticamente el estado de cada gallina según su edad y peso. Las gallinas con ≥80 semanas Y ≥2.5 kg serán recomendadas para sacrificio. Las gallinas jóvenes con buen peso NO se marcan incorrectamente." },
      { type: "note", text: "El historial de peso de cada gallina se muestra en una gráfica. Es importante registrar los pesajes periódicos para monitorear la salud del plantel." },
    ],
  },
  {
    slug: "alimentar-aves",
    title: "Alimentar Animales",
    module: "almacen",
    icon: "🌾",
    relatedHrefs: [
      { href: "/dashboard/almacen", label: "Almacén" },
      { href: "/dashboard/produccion?tab=alimentacion", label: "Gestión de Alimentación" },
      { href: "/dashboard/inventarios/alimentacion", label: "Inventario de Alimentos" },
    ],
    sections: [
      { type: "intro", text: "Gestiona los alimentos y los programas de alimentación del plantel. El sistema calcula automáticamente el consumo estimado según el número y tipo de animales." },
      { type: "steps", title: "Configurar un programa de alimentación", items: [
        "Ve a Almacén → Gestión de alimentación.",
        "Crea un nuevo programa definiendo el tipo de alimento, cantidad por animal y frecuencia.",
        "Asigna el programa al grupo de animales correspondiente.",
        "El sistema calculará el consumo diario estimado.",
      ]},
      { type: "steps", title: "Registrar alimentación", items: [
        "Registra la cantidad de alimento suministrado y la fecha.",
        "El sistema compara con el consumo esperado y te alerta si hay desviaciones.",
        "El costo se registra automáticamente como egreso si el alimento está en el catálogo de productos.",
      ]},
      { type: "tip", title: "Auto-registro", text: "La alimentación se gestiona a través de programas. Una vez configurados, el sistema puede auto-registrar el consumo según los programas activos y los alimentos disponibles en inventario." },
      { type: "warning", text: "Mantén actualizado el inventario de alimentos. Si el stock llega a cero, el sistema te alertará para que realices una compra." },
    ],
  },
  {
    slug: "incubacion",
    title: "Incubación",
    module: "animales",
    icon: "🐣",
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=incubacion", label: "Incubación" },
      { href: "/dashboard/animales", label: "Inventario de Animales" },
    ],
    sections: [
      { type: "intro", text: "Controla el proceso de incubación de huevos: desde la selección hasta el nacimiento de los pollitos." },
      { type: "steps", title: "Proceso de incubación", items: [
        "Al recoger huevos, marca los que destinarás a incubación.",
        "Ve a Animales → Incubación para ver los lotes en proceso.",
        "Registra la fecha de inicio de incubación (la incubadora toma ~21 días).",
        "Monitorea el progreso: el sistema muestra los días transcurridos y la fecha estimada de nacimiento.",
        "Al finalizar, registra los nacimientos y los huevos no fértiles.",
      ]},
      { type: "tip", title: "Tasa de eclosión", text: "El sistema calcula automáticamente la tasa de eclosión (pollitos nacidos / huevos incubados). Una tasa normal está entre 65-75%. Si es menor, revisa la calidad de los huevos y las condiciones de la incubadora." },
      { type: "note", text: "Los huevos seleccionados para incubación se descuentan del inventario de huevos disponibles para venta." },
    ],
  },
  {
    slug: "produccion-carne",
    title: "Producción de Carne",
    module: "produccion",
    icon: "🍗",
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=carne", label: "Producción Carne" },
      { href: "/dashboard/inventarios/carne", label: "Inventario Carne" },
      { href: "/dashboard/finanzas/ventas?tab=carne", label: "Venta de Carne" },
    ],
    sections: [
      { type: "intro", text: "Registra el sacrificio de aves para producción de carne. La carne producida se agrega automáticamente al inventario." },
      { type: "steps", title: "Registrar sacrificio", items: [
        "Ve a Producción → Carne.",
        "Selecciona el tipo de ave: gallina de descarte, gallo o pollo de engorde.",
        "Si es una gallina específica, selecciónala del listado (prioriza las recomendadas para sacrificio).",
        "Ingresa la cantidad de aves y el peso en canal total.",
        "Selecciona el destino: consumo propio, venta o donación.",
        "Guarda el registro. La carne se agrega al inventario automáticamente.",
      ]},
      { type: "tip", title: "Peso en canal", text: "El peso en canal es el peso del ave después del sacrificio y limpieza. Representa aproximadamente el 70-75% del peso vivo." },
      { type: "note", text: "Para vender la carne, ve a Inventarios → Carne o Finanzas → Ventas (pestaña Carne). El sistema usa FIFO (primero en entrar, primero en salir) para el inventario." },
    ],
  },
  {
    slug: "sacrificio-aves",
    title: "Sacrificio de Aves",
    module: "produccion",
    icon: "🔪",
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=carne", label: "Producción Carne" },
      { href: "/dashboard/produccion?tab=gallinas", label: "Gallinas" },
    ],
    sections: [
      { type: "intro", text: "Gestiona el proceso de sacrificio de aves, ya sea para producción de carne o por recomendación del sistema (fin de ciclo productivo)." },
      { type: "steps", title: "Sacrificio recomendado", items: [
        "El sistema marca gallinas con ≥80 semanas de edad Y ≥2.5 kg como 'recomendadas para sacrificio'.",
        "Estas gallinas aparecen destacadas en el listado con estado 'recomendada_sacrificio'.",
        "Al sacrificarlas desde Producción → Carne, se priorizan estas aves.",
        "El estado cambia automáticamente y se registra en el historial.",
      ]},
      { type: "warning", text: "Solo se recomiendan para sacrificio gallinas que cumplen AMBOS criterios (edad Y peso). Una gallina joven con buen peso NO será recomendada, ya que puede seguir produciendo huevos." },
      { type: "tip", title: "Registro de mortalidad", text: "Si un ave muere sin ser sacrificada (causa natural, enfermedad), regístralo en Animales → Mortalidad en lugar de Sacrificio." },
    ],
  },
  {
    slug: "gallinaza-produccion",
    title: "Producción de Gallinaza",
    module: "produccion",
    icon: "🌱",
    relatedHrefs: [
      { href: "/dashboard/produccion?tab=gallinaza", label: "Gallinaza" },
      { href: "/dashboard/inventarios/gallinaza", label: "Inventario Gallinaza" },
    ],
    sections: [
      { type: "intro", text: "La gallinaza es un subproducto valioso como abono orgánico. El sistema estima su producción automáticamente según el número de aves y factores de conversión." },
      { type: "steps", title: "Cómo funciona", items: [
        "La producción se calcula automáticamente: número de aves × factor de producción diario.",
        "Puedes hacer ajustes manuales en Inventarios → Gallinaza (por limpieza, humedad, etc.).",
        "El stock disponible se muestra en el inventario.",
        "Para vender gallinaza, registra la venta desde Inventarios → Gallinaza.",
      ]},
      { type: "tip", title: "Configurar factores", text: "Ve a Producción → Gallinaza para ajustar los factores de conversión según tu tipo de gallinaza, método de limpieza y condiciones de humedad." },
    ],
  },
  {
    slug: "plan-parvada",
    title: "Plan de Parvada",
    module: "planificacion",
    icon: "📋",
    relatedHrefs: [
      { href: "/dashboard/produccion/plan-parvada", label: "Plan de Parvada" },
      { href: "/dashboard/soberania", label: "Soberanía Alimentaria" },
    ],
    sections: [
      { type: "intro", text: "Diagnostica la parvada real y proyecta postura, alimento y reemplazo con la edad de cada gallina. El plan no usa curvas fijas: se calcula con los estándares de Catálogos y los datos reales de la granja." },
      { type: "steps", title: "Cómo usarlo", items: [
        "Ve a Planificación y Soberanía → Plan de Parvada.",
        "Revisa el diagnóstico: animales en inventario, gallinas en postura, huevos de los últimos 7 días y alimento estimado.",
        "Atiende las alertas: gallinas fuera del ciclo, recomendadas para venta, postura baja y relación gallos/gallinas. Cada alerta enlaza a la pantalla donde se resuelve.",
        "Consulta la proyección de 17 semanas: esperado vs real y cumplimiento semanal.",
        "Crea o edita un plan para fijar la meta de gallinas, gallos y la fecha de reemplazo.",
      ]},
      { type: "note", text: "La proyección se actualiza sola con la edad de las gallinas y los parámetros de Catálogos. Si cambias el estándar de postura o alimento de una etapa, el plan lo refleja de inmediato." },
    ],
  },

  // ═══════════════════════════════════════════
  // FINANZAS
  // ═══════════════════════════════════════════
  {
    slug: "registrar-venta",
    title: "Registrar Venta",
    module: "finanzas",
    icon: "💰",
    relatedHrefs: [
      { href: "/dashboard/finanzas/ventas", label: "Ventas" },
      { href: "/dashboard/finanzas/finanzas", label: "Balance" },
    ],
    sections: [
      { type: "intro", text: "Registra las ventas de huevos, carne, gallinaza y otros productos. Cada venta se refleja automáticamente en el balance financiero." },
      { type: "steps", title: "Registrar una venta", items: [
        "Ve a Finanzas → Ventas (o usa el acceso rápido desde el Dashboard).",
        "Selecciona el tipo de producto: huevos, carne, gallinaza u otro.",
        "Ingresa la cantidad, precio unitario y cliente (opcional).",
        "Selecciona el método de pago: efectivo, transferencia, fiado.",
        "Agrega notas si es necesario.",
        "Guarda la venta. El ingreso se registra automáticamente.",
      ]},
      { type: "tip", title: "Venta rápida de huevos", text: "Desde el Dashboard hay un botón de 'venta rápida' para huevos. Solo ingresas cantidad y precio, y el sistema completa el resto con los valores predeterminados." },
      { type: "tip", title: "Venta de carne", text: "Para vender carne, ve a Inventario → Carne y haz clic en 'Registrar Venta'. El sistema usa el costo de producción calculado para determinar el margen." },
      { type: "note", text: "Si el cliente queda 'fiado' (pago pendiente), la venta se registra como cuenta por cobrar. Puedes gestionarlo en Finanzas → Cuentas." },
    ],
  },
  {
    slug: "registrar-egreso",
    title: "Registrar Egreso",
    module: "finanzas",
    icon: "📤",
    relatedHrefs: [
      { href: "/dashboard/finanzas/egresos", label: "Egresos" },
      { href: "/dashboard/finanzas/finanzas", label: "Balance" },
    ],
    sections: [
      { type: "intro", text: "Registra todos los gastos de la granja: compra de insumos, alimentación, medicamentos, servicios y otros egresos." },
      { type: "steps", title: "Registrar un egreso", items: [
        "Ve a Finanzas → Egresos (accesible desde el modo simple del sidebar).",
        "Selecciona el tipo: compra de producto, servicio, alimentación u otro.",
        "Si es una compra de producto, usa el selector de catálogo para auto-completar los datos.",
        "Ingresa el monto, proveedor y categoría del gasto.",
        "Agrega notas si es necesario.",
        "Guarda el egreso.",
      ]},
      { type: "tip", title: "Catálogo de productos", text: "Si el tipo es 'compra', aparece un selector de productos del catálogo. Al seleccionar un producto, se auto-completan la presentación, precio y proveedor. Puedes crear nuevos productos y proveedores directamente desde el formulario con los botones +Producto y +Proveedor." },
      { type: "tip", title: "Actualización automática de precios", text: "Después de registrar una compra, el sistema actualiza automáticamente el último precio y proveedor del producto en el catálogo, para que la próxima vez el dato esté al día." },
      { type: "warning", text: "Los gastos de alimentación se calculan automáticamente si tienes programas activos. Solo registra manualmente los egresos que no sean de alimentación automática." },
    ],
  },
  {
    slug: "catalogo-productos",
    title: "Catálogo de Productos de Compra",
    module: "finanzas",
    icon: "🛒",
    relatedHrefs: [
      { href: "/dashboard/finanzas/egresos", label: "Egresos" },
    ],
    sections: [
      { type: "intro", text: "El catálogo de productos es tu base de datos de productos que compras habitualmente. Permite registrar egresos más rápido porque auto-completa los datos." },
      { type: "steps", title: "Crear un producto", items: [
        "Ve a Finanzas → Egresos y haz clic en '+ Producto' dentro del selector de productos.",
        "O accede desde el formulario de egreso cuando el tipo sea 'compra'.",
        "Completa: nombre del producto, categoría de gasto, presentación (ej: 'bulto 50kg'), unidad de medida, precio estimado y proveedor.",
        "Guarda el producto.",
      ]},
      { type: "steps", title: "Editar un producto", items: [
        "En el selector de productos del formulario de egresos, haz clic en el ícono de edición (✏️) junto al producto.",
        "Modifica los datos necesarios.",
        "Guarda los cambios.",
      ]},
      { type: "steps", title: "Agregar un proveedor", items: [
        "En el campo de proveedor del formulario de egresos, haz clic en '+ Proveedor'.",
        "Escribe el nombre del proveedor.",
        "Se guarda inmediatamente y queda disponible para seleccionar.",
      ]},
      { type: "tip", title: "Precios actualizados", text: "Cada vez que compras un producto del catálogo, el sistema actualiza automáticamente el último precio registrado. Así siempre tienes referencia de precios actuales." },
    ],
  },
  {
    slug: "balance-financiero",
    title: "Balance Financiero",
    module: "finanzas",
    icon: "📈",
    relatedHrefs: [
      { href: "/dashboard/finanzas/finanzas", label: "Balance" },
      { href: "/dashboard/finanzas/ventas", label: "Ventas" },
      { href: "/dashboard/finanzas/egresos", label: "Egresos" },
    ],
    sections: [
      { type: "intro", text: "Visualiza el estado financiero de tu granja: ingresos, egresos, balance y evolución en el tiempo." },
      { type: "diagram", title: "Integración Automática de Finanzas", layout: "vertical", nodes: [
        { id: "sale", label: "Venta de Huevos/Aves/Carne", icon: "💰", color: "green" },
        { id: "expense", label: "Compra de Alimento/Insumos", icon: "🛒", color: "red" },
        { id: "maint", label: "Mantenimiento Completado", icon: "🔧", color: "amber" },
        { id: "health", label: "Evento Sanitario con Costo", icon: "💊", color: "blue" },
        { id: "tx", label: "Transacción Automática", icon: "📝", color: "indigo" },
        { id: "kpi", label: "KPIs y Gráficos", icon: "📈", color: "purple" },
      ], connections: [
        { from: "sale", to: "tx", label: "Ingreso automático" },
        { from: "expense", to: "tx", label: "Egreso automático" },
        { from: "maint", to: "tx", label: "Egreso al completar" },
        { from: "health", to: "tx", label: "Egreso con costo" },
        { from: "tx", to: "kpi", label: "Actualiza indicadores" },
      ]},
      { type: "steps", title: "Usar el balance", items: [
        "Ve a Finanzas → Balance.",
        "Selecciona el período que quieres analizar (mes, trimestre, año o personalizado).",
        "El sistema muestra: total ingresos, total egresos, balance neto.",
        "La gráfica muestra la evolución mensual.",
        "Puedes filtrar por categoría de ingreso o egreso.",
      ]},
      { type: "tip", title: "Indicadores clave", text: "Presta atención al margen neto (ingresos - egresos / ingresos). Un margen saludable indica que la granja es rentable. Si es negativo, revisa qué categorías de egreso puedes optimizar." },
    ],
  },
  {
    slug: "presupuestos",
    title: "Presupuestos",
    module: "finanzas",
    icon: "💵",
    relatedHrefs: [
      { href: "/dashboard/finanzas/presupuestos", label: "Presupuestos" },
      { href: "/dashboard/finanzas/finanzas", label: "Balance" },
    ],
    sections: [
      { type: "intro", text: "Establece presupuestos mensuales por categoría de gasto para controlar tus egresos y evitar desviaciones." },
      { type: "steps", title: "Crear un presupuesto", items: [
        "Ve a Finanzas → Presupuestos.",
        "Haz clic en 'Nuevo Presupuesto'.",
        "Selecciona la categoría de gasto (alimentación, medicamentos, servicios, etc.).",
        "Define el monto máximo mensual.",
        "Guarda el presupuesto.",
      ]},
      { type: "tip", title: "Alertas de presupuesto", text: "Cuando te acercas al límite de un presupuesto (80%), el sistema te alerta. Si lo superas, aparece en rojo para que tomes acciones correctivas." },
    ],
  },

  // ═══════════════════════════════════════════
  // SANIDAD
  // ═══════════════════════════════════════════
  {
    slug: "plan-sanitario",
    title: "Plan Sanitario",
    module: "sanidad",
    icon: "🛡️",
    relatedHrefs: [
      { href: "/dashboard/sanidad", label: "Plan Sanitario" },
      { href: "/dashboard/sanidad/control", label: "Control Sanitario" },
      { href: "/dashboard/sanidad/calendario", label: "Calendario" },
    ],
    sections: [
      { type: "intro", text: "El Plan Sanitario es tu sistema proactivo de salud para la parvada. Funciona como el Plan de Alimentación: el sistema define qué acciones sanitarias corresponden a cada etapa de crecimiento y te alerta cuando es momento de ejecutarlas." },
      { type: "diagram", title: "Flujo del Plan Sanitario", layout: "vertical", nodes: [
        { id: "proto", label: "Protocolos por Etapa", icon: "📋", color: "blue" },
        { id: "events", label: "Eventos en Calendario", icon: "📅", color: "yellow" },
        { id: "alert", label: "Alerta de Acción", icon: "🔔", color: "red" },
        { id: "exec", label: "Ejecutar Acción", icon: "✅", color: "green" },
        { id: "record", label: "Historial Sanitario", icon: "📊", color: "purple" },
      ], connections: [
        { from: "proto", to: "events", label: "Genera eventos automáticos" },
        { from: "events", to: "alert", label: "Vencimiento próximo" },
        { from: "alert", to: "exec", label: "Confirma recursos y ejecuta" },
        { from: "exec", to: "record", label: "Registra en historial" },
      ]},
      { type: "steps", title: "Las 5 pestañas del Plan Sanitario", items: [
        "Plan de Acción: muestra las acciones pendientes organizadas por urgencia (vencidas en rojo, próximas en azul). Incluye barra de cumplimiento y horizonte configurable (7–90 días).",
        "Protocolos por Etapa: define qué acciones sanitarias corresponden a cada etapa (Pollito, Juvenil, Pre-postura, Postura). Puedes generar eventos automáticamente desde aquí.",
        "Ejecutar: vista enfocada en las acciones pendientes con verificación de recursos disponibles. Ejecuta con un clic y confirma los insumos utilizados.",
        "Historial: registro completo de todas las acciones sanitarias ejecutadas con fecha, tipo, producto, costo y notas.",
        "Recursos: estado del inventario de insumos sanitarios (medicamentos, vacunas, antiparasitarios) con alertas de stock bajo y crítico.",
      ]},
      { type: "steps", title: "Cómo empezar", items: [
        "Ve a Sanidad → Plan Sanitario.",
        "Revisa los 'Protocolos por Etapa' para ver las acciones definidas para cada etapa de tus aves.",
        "Haz clic en 'Generar Eventos' en cada etapa para crear los eventos en el calendario.",
        "Ve a 'Plan de Acción' para ver las acciones pendientes.",
        "Cuando llegue la fecha, ejecuta la acción desde la pestaña 'Ejecutar' o directamente desde el Plan de Acción.",
      ]},
      { type: "tip", title: "Recursos automáticos", text: "Al ejecutar una acción, el sistema verifica si tienes los insumos necesarios en el inventario. Si el medicamento o vacuna está en stock, lo deduce automáticamente. Si no está disponible, te alerta para que lo compres." },
      { type: "warning", title: "Períodos de carencia", text: "Cada acción sanitaria tiene un período de carencia (días durante los cuales no se deben consumir los huevos). El sistema te muestra este período al ejecutar la acción. Respétalo para garantizar la seguridad alimentaria." },
    ],
  },
  {
    slug: "control-sanitario",
    title: "Control Sanitario",
    module: "sanidad",
    icon: "💊",
    relatedHrefs: [
      { href: "/dashboard/sanidad/control", label: "Control Sanitario" },
      { href: "/dashboard/sanidad/calendario", label: "Calendario" },
    ],
    sections: [
      { type: "intro", text: "Registra y gestiona los tratamientos sanitarios del plantel: medicamentos aplicados, dosis, fechas y aves tratadas. Este módulo funciona junto al Plan Sanitario proactivo." },
      { type: "tip", title: "Plan Sanitario Proactivo", text: "Además del control manual, el sistema tiene un Plan Sanitario proactivo que define protocolos por etapa de crecimiento y genera eventos automáticamente. Ve a Sanidad para ver el Plan de Acción, Protocolos, Ejecución y Recursos." },
      { type: "steps", title: "Registrar un tratamiento", items: [
        "Ve a Sanidad → Control.",
        "Haz clic en 'Nuevo Registro'.",
        "Selecciona las aves tratadas (puedes seleccionar todo el plantel o aves específicas).",
        "Ingresa el medicamento, dosis, vía de administración y duración del tratamiento.",
        "Registra la fecha de inicio y fin del tratamiento.",
        "Agrega observaciones sobre el motivo del tratamiento.",
        "Guarda el registro.",
      ]},
      { type: "warning", text: "Si un ave está en tratamiento, el sistema marca un período de carencia durante el cual no se deben consumir sus huevos. Respeta estos períodos." },
      { type: "tip", title: "Tratamientos pendientes", text: "El Dashboard muestra alertas de tratamientos sanitarios pendientes. Puedes hacer clic directamente para aplicar el tratamiento desde ahí." },
    ],
  },
  {
    slug: "calendario-vacunacion",
    title: "Calendario de Vacunación",
    module: "sanidad",
    icon: "📅",
    relatedHrefs: [
      { href: "/dashboard/sanidad/calendario", label: "Calendario" },
      { href: "/dashboard/sanidad/control", label: "Control Sanitario" },
    ],
    sections: [
      { type: "intro", text: "Programa y monitorea las vacunaciones del plantel. El calendario te muestra qué vacunas están pendientes, cuáles se aplicaron y cuáles están próximas." },
      { type: "steps", title: "Programar una vacunación", items: [
        "Ve a Sanidad → Calendario.",
        "Haz clic en 'Nueva Vacunación'.",
        "Selecciona el tipo de vacuna, las aves objetivo y la fecha programada.",
        "El sistema la agrega al calendario.",
        "Cuando llegue la fecha, aparece como pendiente en el Dashboard y en Alertas.",
      ]},
      { type: "steps", title: "Registrar una vacunación aplicada", items: [
        "En el calendario, haz clic en la vacunación pendiente.",
        "Confirma la fecha real de aplicación.",
        "Registra el lote del vacina y cualquier observación.",
        "La vacunación queda marcada como completada.",
      ]},
      { type: "tip", title: "Alertas automáticas", text: "Las vacunaciones próximas (dentro de 7 días) aparecen como alertas en Sanidad → Alertas y en el Dashboard principal." },
    ],
  },
  {
    slug: "alertas-mortalidad",
    title: "Alertas y Mortalidad",
    module: "sanidad",
    icon: "🔔",
    relatedHrefs: [
      { href: "/dashboard/sanidad/alertas", label: "Alertas" },
      { href: "/dashboard/produccion/mortalidad", label: "Mortalidad" },
    ],
    sections: [
      { type: "intro", text: "Monitorea las alertas sanitarias del sistema y registra la mortalidad del plantel." },
      { type: "steps", title: "Revisar alertas", items: [
        "Ve a Sanidad → Alertas.",
        "El sistema muestra: vacunaciones pendientes, tratamientos por aplicar, alertas de mortalidad inusual.",
        "Haz clic en cada alerta para ver el detalle y tomar acción.",
      ]},
      { type: "steps", title: "Registrar mortalidad", items: [
        "Ve a Producción → Mortalidad (dentro de la pestaña de producción).",
        "Registra el ave fallecida, la fecha y la causa estimada.",
        "El sistema actualiza automáticamente el conteo del plantel.",
        "Si la mortalidad supera el umbral normal, se genera una alerta sanitaria.",
      ]},
      { type: "warning", text: "Si registras múltiples muertes en un corto período, el sistema genera una alerta de mortalidad inusual. Esto puede indicar un brote de enfermedad y requiere atención inmediata." },
    ],
  },

  // ═══════════════════════════════════════════
  // INVENTARIOS
  // ═══════════════════════════════════════════
  {
    slug: "inventario-huevos",
    title: "Inventario de Huevos",
    module: "inventarios",
    icon: "📦",
    relatedHrefs: [
      { href: "/dashboard/inventarios/huevos", label: "Inventario Huevos" },
      { href: "/dashboard/produccion?tab=huevos", label: "Registro de Huevos" },
    ],
    sections: [
      { type: "intro", text: "Visualiza el stock de huevos disponible por tamaño, el historial de movimientos (entradas por recolección, salidas por venta o incubación) y el valor estimado del inventario." },
      { type: "steps", title: "Consultar el inventario", items: [
        "Ve a Inventarios → Huevos.",
        "Ves el stock actual desglosado por tamaño (P, M, G, XL, XXL).",
        "El historial muestra los movimientos: recolecciones, ventas, huevos para incubación, roturas.",
        "El valor estimado se calcula con los últimos precios de venta.",
      ]},
      { type: "tip", title: "Venta directa", text: "Desde el inventario de huevos puedes registrar una venta directamente. Selecciona los tamaños y cantidades que quieres vender, y el sistema genera la venta con el precio del último registro." },
    ],
  },
  {
    slug: "inventario-carne",
    title: "Inventario de Carne",
    module: "inventarios",
    icon: "🍗",
    relatedHrefs: [
      { href: "/dashboard/inventarios/carne", label: "Inventario Carne" },
      { href: "/dashboard/produccion?tab=carne", label: "Producción de Carne" },
    ],
    sections: [
      { type: "intro", text: "Controla el stock de carne disponible proveniente de sacrificios. El sistema usa FIFO (First In, First Out): lo más antiguo se vende primero." },
      { type: "steps", title: "Gestionar inventario de carne", items: [
        "Ve a Inventarios → Carne.",
        "Ves los lotes de carne producidos, vendidos y el stock restante.",
        "Cada lote muestra: fecha de producción, cantidad, peso y valor estimado.",
        "Para vender, haz clic en 'Registrar Venta' y selecciona el lote.",
      ]},
      { type: "note", text: "El valor estimado se calcula con el costo de producción (alimentación + insumos utilizados). Esto te ayuda a determinar el precio de venta adecuado." },
    ],
  },
  {
    slug: "inventario-insumos",
    title: "Inventario de Insumos",
    module: "almacen",
    icon: "🧰",
    relatedHrefs: [
      { href: "/dashboard/inventarios/insumos", label: "Inventario Insumos" },
      { href: "/dashboard/almacen", label: "Almacén" },
      { href: "/dashboard/finanzas/egresos", label: "Egresos" },
    ],
    sections: [
      { type: "intro", text: "Gestiona el stock de insumos: medicamentos, vacunas, empaques, materiales de limpieza y otros productos que compras para la operación." },
      { type: "steps", title: "Gestionar insumos", items: [
        "Ve a Almacén → Insumos.",
        "Ves la lista de insumos con su stock actual, mínimo y valor.",
        "Cuando el stock baja del mínimo, aparece una alerta para reabastecer.",
        "Al registrar una compra en Egresos, el stock del insumo se actualiza automáticamente.",
      ]},
      { type: "tip", title: "Alertas de stock bajo", text: "Configura el stock mínimo de cada insumo. Cuando se acerque al mínimo, el sistema te alertará en el Dashboard y en Almacén." },
    ],
  },
  {
    slug: "balance-inventarios",
    title: "Balance de Inventarios",
    module: "inventarios",
    icon: "⚖️",
    relatedHrefs: [
      { href: "/dashboard/inventarios/balance", label: "Balance Inventarios" },
      { href: "/dashboard/animales", label: "Animales" },
    ],
    sections: [
      { type: "intro", text: "Vista consolidada y valorizada de todas las existencias: animales, huevos, carne, gallinaza, alimentos e insumos. Un solo lugar para ver el estado completo del patrimonio de la granja." },
      { type: "steps", title: "Usar el balance", items: [
        "Ve a Inventarios → Balance.",
        "Ves un resumen de cada categoría con su valor total.",
        "Puedes navegar al detalle de cada inventario haciendo clic en la categoría.",
        "El balance se actualiza en tiempo real con cada movimiento registrado.",
      ]},
    ],
  },

  // ═══════════════════════════════════════════
  // ANÁLISIS
  // ═══════════════════════════════════════════
  {
    slug: "kpis-reportes",
    title: "KPIs y Reportes",
    module: "analisis",
    icon: "🎯",
    relatedHrefs: [
      { href: "/dashboard/analisis/kpis", label: "KPIs" },
      { href: "/dashboard/analisis/reportes", label: "Reportes" },
    ],
    sections: [
      { type: "intro", text: "Analiza el desempeño de tu granja con indicadores clave (KPIs) y reportes detallados por área." },
      { type: "steps", title: "KPIs principales", items: [
        "Ve a Análisis → KPIs.",
        "Los indicadores incluyen: tasa de postura, mortalidad, conversión alimenticia, rentabilidad.",
        "Cada KPI muestra su valor actual, tendencia y comparación con el período anterior.",
        "Puedes filtrar por período (semana, mes, trimestre, año).",
      ]},
      { type: "steps", title: "Generar reportes", items: [
        "Ve a Análisis → Reportes.",
        "Selecciona el tipo de reporte: producción, financiero, sanitario o inventario.",
        "Define el período y las opciones de visualización.",
        "El reporte se genera con gráficas y tablas resumen.",
      ]},
      { type: "tip", title: "Interpretar KPIs", text: "Tasa de postura > 80% es excelente. Conversión alimenticia < 2.5 kg alimento/kg huevo es eficiente. Mortalidad < 1% mensual es saludable. Si algún KPI está fuera de rango, investiga la causa." },
    ],
  },
  {
    slug: "estandares-raza",
    title: "Estándares de Raza",
    module: "analisis",
    icon: "🧬",
    relatedHrefs: [
      { href: "/dashboard/analisis/razas", label: "Estándares de Raza" },
    ],
    sections: [
      { type: "intro", text: "Consulta y gestiona los estándares productivos por raza: peso esperado, tasa de postura, consumo de alimento y otros parámetros de referencia." },
      { type: "steps", title: "Usar los estándares", items: [
        "Ve a Análisis → Estándares de Raza.",
        "Busca la raza de tus aves para ver los valores de referencia.",
        "El sistema compara tus datos reales contra los estándares.",
        "Si tus aves están por debajo del estándar, el sistema te alerta.",
      ]},
      { type: "steps", title: "Editar estándares", items: [
        "En la página de estándares, haz clic en 'Editar' junto a la raza.",
        "Ajusta los valores según tu experiencia o datos de la guía de la estirpe.",
        "Guarda los cambios. Se usarán como referencia para las comparaciones.",
      ]},
      { type: "note", text: "Los estándares son valores de referencia, no objetivos estrictos. Factores como clima, altitud y manejo pueden afectar los resultados reales." },
    ],
  },

  // ═══════════════════════════════════════════
  // OPERACIONES
  // ═══════════════════════════════════════════
  {
    slug: "mantenimiento",
    title: "Mantenimiento",
    module: "almacen",
    icon: "🔧",
    relatedHrefs: [
      { href: "/dashboard/operaciones/mantenimiento", label: "Mantenimiento" },
    ],
    sections: [
      { type: "intro", text: "Programa y registra las tareas de mantenimiento de las instalaciones: limpieza de galpones, reparación de equipos, mantenimiento de incubadoras, etc." },
      { type: "steps", title: "Registrar mantenimiento", items: [
        "Ve a Almacén → Mantenimiento.",
        "Haz clic en 'Nueva Tarea'.",
        "Describe la tarea, selecciona el área/equipo affected.",
        "Define la prioridad y la fecha programada.",
        "Al completarla, marca como realizada y agrega observaciones.",
      ]},
      { type: "tip", title: "Mantenimiento preventivo", text: "Programa tareas recurrentes (limpieza semanal, revisión mensual de equipos). El sistema te recordará cuando sea tiempo de realizarlas." },
    ],
  },
  {
    slug: "gestion-gallinaza",
    title: "Gestión de Gallinaza",
    module: "produccion",
    icon: "🌱",
    relatedHrefs: [
      { href: "/dashboard/operaciones/gallinaza", label: "Gestión Gallinaza" },
      { href: "/dashboard/inventarios/gallinaza", label: "Inventario Gallinaza" },
    ],
    sections: [
      { type: "intro", text: "Configura los factores de producción de gallinaza y registra ajustes manuales por limpieza, humedad u otros motivos." },
      { type: "steps", title: "Configurar factores", items: [
        "Ve a Producción → Gallinaza.",
        "Ajusta el factor de producción diaria (kg por ave por día).",
        "Configura el factor de humedad si es relevante para tu zona.",
        "Los cambios se aplican automáticamente al cálculo de producción.",
      ]},
      { type: "steps", title: "Registrar ajustes", items: [
        "Si necesitas ajustar el inventario (por limpieza, pérdida, venta a granel), ve a Inventarios → Gallinaza.",
        "Registra el ajuste indicando el motivo y la cantidad.",
        "El inventario se actualiza inmediatamente.",
      ]},
    ],
  },

  // ═══════════════════════════════════════════
  // CONFIGURACIÓN
  // ═══════════════════════════════════════════
  {
    slug: "catalogos-sistema",
    title: "Catálogos del Sistema",
    module: "configuracion",
    icon: "🗂️",
    relatedHrefs: [
      { href: "/dashboard/configuracion/catalogos", label: "Catálogos" },
    ],
    sections: [
      { type: "intro", text: "Personaliza los catálogos del sistema: razas de aves, categorías de gasto, tipos de alimento, unidades de medida y otros valores que se usan en los formularios." },
      { type: "steps", title: "Gestionar catálogos", items: [
        "Ve a Configuración → Catálogos.",
        "Selecciona el catálogo que quieres editar.",
        "Puedes agregar, editar o desactivar elementos.",
        "Los cambios se reflejan inmediatamente en los formularios de toda la app.",
      ]},
      { type: "warning", text: "Al desactivar un elemento del catálogo, no se elimina de los registros existentes. Solo deja de aparecer como opción en nuevos registros. Esto protege la integridad de datos históricos." },
      { type: "tip", title: "Catálogos disponibles", text: "Los catálogos configurables incluyen: razas de aves, categorías de egreso, tipos de alimento, métodos de pago, unidades de medida, categorías de mantenimiento y más." },
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
    next: idx < guides.length - 1 ? guides[idx + 1] : null,
  };
}
