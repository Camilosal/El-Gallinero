export interface CreateAction {
  label: string;
  description: string;
  icon: string;
  href: string;
  keywords?: string[];
}

export interface CreateActionGroup {
  label: string;
  actions: CreateAction[];
}

/** Catálogo único de acciones usado por «Crear» y por el buscador global. */
export const CREATE_ACTION_GROUPS: CreateActionGroup[] = [
  { label: "Animales", actions: [
    { label: "Ingresar gallinas", description: "Registra si fueron compradas, donadas o nacieron en la granja", icon: "🐔", href: "/dashboard/produccion/adquisiciones?nuevo=gallina", keywords: ["ave", "ponedora", "origen"] },
    { label: "Ingresar gallos reproductores", description: "Registra el origen antes de gestionar cada ficha", icon: "🐓", href: "/dashboard/produccion/adquisiciones?nuevo=gallo", keywords: ["ave", "macho", "origen"] },
    { label: "Ingresar un lote de animales", description: "Elige especie y destino: carne, postura o pie de cría", icon: "🐣", href: "/dashboard/produccion/adquisiciones?nuevo=lote_pollos", keywords: ["pollo", "pollitos", "codorniz", "pato", "conejo", "lote"] },
    { label: "Registrar cría propia", description: "Da de alta nacimientos que no se registraron desde Incubación", icon: "🐣", href: "/dashboard/produccion/adquisiciones?origen=cria_propia", keywords: ["nacimiento", "eclosion", "pollitos"] },
    { label: "Registrar adquisición de animales", description: "Compra, donación u otro ingreso con origen y destino", icon: "📥", href: "/dashboard/produccion/adquisiciones", keywords: ["compra", "donacion", "ingreso", "proveedor"] },
    { label: "Registrar mortalidad", description: "Registra muerte o baja de animales", icon: "🕊️", href: "/dashboard/produccion/mortalidad?nuevo=1", keywords: ["muerte", "baja", "perdida"] },
    { label: "Crear lugar de manejo", description: "Registra corral, jaula, galpón, potrero, jardín o patio", icon: "📍", href: "/dashboard/ubicaciones?nuevo=1", keywords: ["ubicacion", "corral", "galpon", "georreferencia"] },
    { label: "Gestionar traslado de animal", description: "Abre los lugares para elegir un destino y registrar el movimiento", icon: "↔️", href: "/dashboard/ubicaciones", keywords: ["mover", "traslado", "cambio de corral"] },
    { label: "Registrar peso de un animal", description: "Guarda una medición de peso", icon: "⚖️", href: "/dashboard/produccion/peso?nuevo=1", keywords: ["pesaje", "medicion"] },
    { label: "Iniciar incubación", description: "Registra huevos puestos a incubar", icon: "🐣", href: "/dashboard/produccion?tab=incubacion&nuevo=incubacion", keywords: ["incubar", "eclosion", "nacimiento"] },
    { label: "Registrar eclosión", description: "Completa una incubación y registra los animales nacidos", icon: "🐥", href: "/dashboard/produccion?tab=incubacion&nuevo=eclosion", keywords: ["nacimiento", "nacieron", "pollitos"] },
    { label: "Abrir plan de parvada", description: "Revisa y proyecta reemplazos y producción", icon: "📋", href: "/dashboard/produccion/plan-parvada", keywords: ["planificacion", "proyeccion"] },
  ] },
  { label: "Producción y ventas", actions: [
    { label: "Registrar recolección de huevos", description: "Captura producción, clasificación y autoconsumo", icon: "🥚", href: "/dashboard/produccion?tab=huevos&nuevo=1", keywords: ["recoger", "postura", "produccion diaria"] },
    { label: "Registrar pérdida de huevos", description: "Registra huevos rotos o descartados", icon: "🥚", href: "/dashboard/produccion/mortalidad?nuevo=perdida", keywords: ["rotos", "descarte", "merma"] },
    { label: "Registrar faena", description: "Registra el sacrificio y rendimiento de animales", icon: "🍗", href: "/dashboard/produccion?tab=carne&nuevo=faena", keywords: ["sacrificio", "beneficio", "canal"] },
    { label: "Registrar venta de huevos", description: "Venta por talla y presentación", icon: "💰", href: "/dashboard/finanzas/ventas?tab=huevos&nuevo=1", keywords: ["huevo", "cliente"] },
    { label: "Registrar venta de animales", description: "Venta de gallinas, gallos o lotes", icon: "🐓", href: "/dashboard/finanzas/ventas?tab=aves&nuevo=1", keywords: ["pollo", "gallina", "gallo"] },
    { label: "Registrar venta de carne", description: "Venta por peso o presentación", icon: "🍗", href: "/dashboard/finanzas/ventas?tab=carne&nuevo=1", keywords: ["kilogramos", "kg"] },
    { label: "Registrar venta de gallinaza", description: "Salida y cobro de abono o gallinaza", icon: "🌱", href: "/dashboard/produccion?tab=gallinaza&nuevo=venta", keywords: ["abono", "estiercol", "fertilizante"] },
    { label: "Ajustar inventario de gallinaza", description: "Corrige existencias o registra un ajuste", icon: "⚖️", href: "/dashboard/produccion?tab=gallinaza&nuevo=ajuste", keywords: ["abono", "inventario", "correccion"] },
  ] },
  { label: "Almacén y operaciones", actions: [
    { label: "Registrar movimiento de alimento", description: "Captura una entrada o consumo de alimento", icon: "🌾", href: "/dashboard/produccion?tab=alimentacion&subtab=movimientos&nuevo=movimiento", keywords: ["comida", "concentrado", "consumo", "entrada", "salida"] },
    { label: "Crear alimento", description: "Agrega un alimento al inventario", icon: "🌽", href: "/dashboard/produccion?tab=alimentacion&subtab=inventario&nuevo=alimento", keywords: ["comida", "concentrado", "existencias"] },
    { label: "Crear plan de alimentación", description: "Define un programa para una especie o etapa", icon: "🗒️", href: "/dashboard/produccion?tab=alimentacion&subtab=etapas&nuevo=plan", keywords: ["dieta", "racion", "programa"] },
    { label: "Crear insumo", description: "Agrega medicamentos, vacunas, herramientas o materiales", icon: "🧰", href: "/dashboard/inventarios/insumos?nuevo=insumo", keywords: ["inventario", "existencias", "stock"] },
    { label: "Registrar movimiento de insumo", description: "Captura una entrada, consumo o ajuste", icon: "📦", href: "/dashboard/inventarios/insumos?nuevo=movimiento", keywords: ["entrada", "salida", "ajuste", "consumo"] },
    { label: "Registrar equipo o activo", description: "Crea una ficha con su lugar, estado y garantía", icon: "🏗️", href: "/dashboard/operaciones/activos?nuevo=1", keywords: ["activo", "maquina", "herramienta", "bomba", "incubadora"] },
    { label: "Crear tarea de mantenimiento", description: "Programa o registra una reparación", icon: "🔧", href: "/dashboard/operaciones/mantenimiento?nuevo=1", keywords: ["reparacion", "equipo", "infraestructura"] },
    { label: "Crear producto", description: "Agrega un producto que puedas asociar a una compra", icon: "🏷️", href: "/dashboard/finanzas/egresos?nuevo=producto", keywords: ["compra", "articulo", "insumo"] },
    { label: "Crear proveedor", description: "Agrega un proveedor desde el formulario de egreso", icon: "🚚", href: "/dashboard/finanzas/egresos?nuevo=proveedor", keywords: ["compra", "suministrador"] },
  ] },
  { label: "Sanidad y hogar", actions: [
    { label: "Registrar tratamiento o control sanitario", description: "Vacunación, medicamento o revisión aplicada", icon: "💊", href: "/dashboard/sanidad/control?nuevo=1", keywords: ["vacuna", "medicina", "enfermedad", "desparasitacion"] },
    { label: "Programar evento sanitario", description: "Crea una vacuna, revisión o recordatorio futuro", icon: "📅", href: "/dashboard/sanidad/calendario?nuevo=evento", keywords: ["calendario", "recordatorio", "vacunacion"] },
    { label: "Registrar consumo del hogar", description: "Captura autoconsumo y ahorro familiar", icon: "🏡", href: "/dashboard/soberania?nuevo=consumo", keywords: ["autoconsumo", "familia", "ahorro"] },
  ] },
  { label: "Finanzas", actions: [
    { label: "Registrar egreso o compra", description: "Guarda gastos, costos y compras", icon: "📤", href: "/dashboard/finanzas/egresos?nuevo=1", keywords: ["gasto", "pago", "compra"] },
    { label: "Registrar transacción financiera", description: "Registra un ingreso u otro movimiento y elige su tipo", icon: "📥", href: "/dashboard/finanzas/finanzas?nuevo=1", keywords: ["ingreso", "dinero", "abono", "cobro"] },
    { label: "Crear presupuesto", description: "Define un período y sus partidas", icon: "💵", href: "/dashboard/finanzas/presupuestos?nuevo=1", keywords: ["plan", "meta", "gasto"] },
    { label: "Abrir cuentas para registrar un pago", description: "Elige la cuenta por cobrar o pagar antes de aplicar el abono", icon: "💳", href: "/dashboard/finanzas/cuentas", keywords: ["cuenta", "deuda", "cobrar", "pagar"] },
  ] },
  { label: "Catálogos y configuración", actions: [
    { label: "Agregar especie, raza o dato de catálogo", description: "Mantén listas y opciones usadas en los formularios", icon: "🗂️", href: "/dashboard/configuracion/catalogos?nuevo=1", keywords: ["especie", "raza", "vacuna", "categorias", "etapas"] },
    { label: "Agregar estándar de peso", description: "Actualiza referencias por especie y edad", icon: "🧬", href: "/dashboard/configuracion/catalogos?tab=pesos&nuevo=1", keywords: ["raza", "crecimiento", "genetica"] },
  ] },
];
