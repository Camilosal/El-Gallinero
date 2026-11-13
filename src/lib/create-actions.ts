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
  {
    label: "Animales", actions: [
      { label: "Ingresar gallinas", description: "Registra si fueron compradas, donadas o nacieron en la granja", icon: "bird", href: "/dashboard/produccion/adquisiciones?nuevo=gallina", keywords: ["ave", "ponedora", "origen"] },
      { label: "Ingresar gallos reproductores", description: "Registra el origen antes de gestionar cada ficha", icon: "feather", href: "/dashboard/produccion/adquisiciones?nuevo=gallo", keywords: ["ave", "macho", "origen"] },
      { label: "Ingresar un lote de animales", description: "Elige especie y destino: carne, postura o pie de cría", icon: "paw-print", href: "/dashboard/produccion/adquisiciones?nuevo=lote_pollos", keywords: ["pollo", "pollitos", "broiler", "codorniz", "pato", "conejo", "cuy", "cuyes", "cobayo", "pie de cria", "lote"] },
      { label: "Registrar cría propia", description: "Da de alta nacimientos que no se registraron desde Incubación", icon: "sparkles", href: "/dashboard/produccion/adquisiciones?nuevo=cria_propia", keywords: ["nacimiento", "eclosion", "pollitos", "gazapos"] },
      { label: "Registrar adquisición de animales", description: "Compra, donación u otro ingreso con origen genético y destino", icon: "incoming", href: "/dashboard/produccion/adquisiciones?nuevo=1", keywords: ["compra", "donacion", "ingreso", "proveedor", "linaje", "gsmi"] },
      { label: "Registrar mortalidad", description: "Registra muerte o baja de animales", icon: "mortality", href: "/dashboard/produccion/mortalidad?nuevo=1", keywords: ["muerte", "baja", "perdida"] },
      { label: "Crear lugar de manejo", description: "Registra corral, jaula, galpón, potrero, jardín o patio", icon: "map-pin", href: "/dashboard/ubicaciones?nuevo=1", keywords: ["ubicacion", "corral", "galpon", "georreferencia", "area m2"] },
      { label: "Registrar traslado de animal", description: "Mueve animales o lotes entre lugares de manejo", icon: "truck", href: "/dashboard/ubicaciones?nuevo=traslado", keywords: ["mover", "traslado", "cambio de corral"] },
      { label: "Registrar peso de un animal", description: "Guarda muestreo biométrico vs estándar y uniformidad", icon: "scale", href: "/dashboard/produccion/peso?nuevo=1", keywords: ["pesaje", "medicion", "biometria", "uniformidad", "cv%"] },
      { label: "Iniciar incubación", description: "Registra huevos de gallina, codorniz o pato puestos a incubar", icon: "egg", href: "/dashboard/produccion?tab=incubacion&nuevo=incubacion", keywords: ["incubar", "eclosion", "nacimiento", "codorniz", "pato", "ovoscopia"] },
      { label: "Registrar eclosión", description: "Completa una incubación y registra los animales nacidos", icon: "bird", href: "/dashboard/produccion?tab=incubacion&nuevo=eclosion", keywords: ["nacimiento", "nacieron", "pollitos"] },
      { label: "Registrar empadre o nacimiento (Conejos/Cuyes)", description: "Control reproductivo, palpación, parto, destete y alerta de consanguinidad", icon: "heart", href: "/dashboard/produccion?tab=reproduccion&nuevo=1", keywords: ["reproduccion", "empadre", "palpacion", "nidal", "parto", "destete", "conejo", "cuy", "cuyes", "consanguinidad", "madre elite"] },
      { label: "Crear plan de parvada", description: "Define metas de postura, reemplazo y proyección", icon: "clipboard", href: "/dashboard/produccion/plan-parvada?nuevo=1", keywords: ["planificacion", "proyeccion", "parvada"] },
    ]
  },
  {
    label: "Producción y ventas", actions: [
      { label: "Registrar recolección de huevos", description: "Captura producción, calibres NTC 1240, T°/HR y autoconsumo", icon: "egg", href: "/dashboard/produccion?tab=huevos&nuevo=1", keywords: ["recoger", "postura", "produccion diaria", "ntc 1240", "jumbo", "aaa", "aa", "lote", "almacenamiento"] },
      { label: "Registrar pérdida de huevos", description: "Registra huevos rotos o descartados", icon: "alert", href: "/dashboard/produccion/mortalidad?nuevo=perdida", keywords: ["rotos", "descarte", "merma"] },
      { label: "Registrar faena", description: "Registra el sacrificio, rendimiento en canal y despiece por especie", icon: "meat", href: "/dashboard/produccion?tab=carne&nuevo=faena", keywords: ["sacrificio", "beneficio", "canal", "cuy", "conejo", "pato", "pollo"] },
      { label: "Registrar venta de huevos", description: "Venta por talla NTC 1240, lote PEPS y presentación", icon: "money", href: "/dashboard/finanzas/ventas?tab=huevos&nuevo=1", keywords: ["huevo", "cliente", "cubeta", "ntc 1240", "peps", "fifo"] },
      { label: "Registrar venta de animales", description: "Venta en pie de gallinas, gallos, pollos, codornices, patos, conejos o cuyes", icon: "bird", href: "/dashboard/finanzas/ventas?tab=animales&nuevo=1", keywords: ["pollo", "gallina", "gallo", "codorniz", "pato", "conejo", "cuy", "cuyes", "en pie"] },
      { label: "Registrar venta de carne", description: "Venta de carne en canal o despiece por especie", icon: "meat", href: "/dashboard/finanzas/ventas?tab=carne&nuevo=1", keywords: ["kilogramos", "kg", "canal", "pollo", "conejo", "cuy", "pato"] },
      { label: "Registrar venta de gallinaza", description: "Salida y cobro de abono, gallinaza o compost", icon: "sprout", href: "/dashboard/finanzas/ventas?tab=gallinaza&nuevo=1", keywords: ["abono", "estiercol", "fertilizante", "compost"] },
      { label: "Registrar otra venta o subproducto", description: "Abonos, plumas, subproductos u otro producto de granja", icon: "tag", href: "/dashboard/finanzas/ventas?tab=otros&nuevo=1", keywords: ["subproducto", "venta", "cliente", "producto", "ingreso"] },
      { label: "Ajustar inventario de gallinaza", description: "Corrige existencias o registra un ajuste", icon: "scale", href: "/dashboard/produccion?tab=gallinaza&nuevo=ajuste", keywords: ["abono", "inventario", "correccion"] },
    ]
  },
  {
    label: "Almacén y operaciones", actions: [
      { label: "Registrar movimiento de alimento", description: "Captura una entrada o consumo de alimento", icon: "feed", href: "/dashboard/produccion?tab=alimentacion&subtab=movimientos&nuevo=movimiento", keywords: ["comida", "concentrado", "forraje", "consumo", "entrada", "salida"] },
      { label: "Crear alimento", description: "Agrega concentrado o forraje con %MS, %PC y energía", icon: "feed", href: "/dashboard/produccion?tab=alimentacion&subtab=inventario&nuevo=alimento", keywords: ["comida", "concentrado", "forraje", "existencias", "%ms", "%pc", "materia seca", "proteina", "vitamina c", "oreo"] },
      { label: "Crear plan de alimentación", description: "Define una dieta combinada por etapa y especie", icon: "notebook", href: "/dashboard/produccion?tab=alimentacion&subtab=etapas&nuevo=plan", keywords: ["dieta", "racion", "programa", "etapas", "forraje", "fcr"] },
      { label: "Crear insumo", description: "Agrega medicamentos, vacunas, herramientas o materiales", icon: "package-open", href: "/dashboard/inventarios/insumos?nuevo=insumo", keywords: ["inventario", "existencias", "stock"] },
      { label: "Registrar movimiento de insumo", description: "Captura una entrada, consumo o ajuste", icon: "package", href: "/dashboard/inventarios/insumos?nuevo=movimiento", keywords: ["entrada", "salida", "ajuste", "consumo"] },
      { label: "Registrar equipo o activo", description: "Crea una ficha con su lugar, estado y garantía", icon: "equipment", href: "/dashboard/operaciones/activos?nuevo=1", keywords: ["activo", "maquina", "herramienta", "bomba", "incubadora"] },
      { label: "Crear tarea de mantenimiento", description: "Programa o registra una reparación", icon: "wrench", href: "/dashboard/operaciones/mantenimiento?nuevo=1", keywords: ["reparacion", "equipo", "infraestructura"] },
      { label: "Iniciar pila de compostaje", description: "Fórmulas 3:1:1 y 7:2:2 con control térmico <=70 °C y humedad <=20 %", icon: "sprout", href: "/dashboard/operaciones/compostaje?nuevo=1", keywords: ["compostaje", "pila", "carbono", "volteo", "mortalidad", "sanitizacion"] },
      { label: "Registrar lectura ambiental (Sensor IoT)", description: "Registra temperatura, HR%, índice ITH, amoníaco NH3 o báscula", icon: "thermometer", href: "/dashboard/operaciones/cierre?nuevo=sensor", keywords: ["sensor", "iot", "telemetria", "ith", "estres termico", "amoniaco", "nh3", "temperatura", "humedad", "bascula"] },
      { label: "Ejecutar cierre diario", description: "Conciliación diaria auditable con bloqueo de jornada", icon: "clipboard", href: "/dashboard/operaciones/cierre?nuevo=cierre", keywords: ["cierre diario", "conciliacion", "auditoria", "reapertura"] },
      { label: "Agregar tarea a rutina diaria", description: "Programa una tarea auto-ajustable en el calendario y rutina de hoy", icon: "calendar-days", href: "/dashboard/planeacion/calendario?tab=rutina&nuevo=rutina", keywords: ["rutina", "calendario", "tarea", "planeacion", "turno", "diaria", "semanal"] },
      { label: "Crear producto", description: "Agrega un producto que puedas asociar a una compra", icon: "tag", href: "/dashboard/finanzas/egresos?nuevo=producto", keywords: ["compra", "articulo", "insumo"] },
      { label: "Crear proveedor", description: "Registra proveedor con teléfono, ubicación y plazo", icon: "truck", href: "/dashboard/contactos?nuevo=proveedor", keywords: ["compra", "suministrador", "contacto"] },
      { label: "Crear cliente", description: "Registra cliente con teléfono, WhatsApp, dirección y plazo", icon: "handshake", href: "/dashboard/contactos?nuevo=cliente", keywords: ["comprador", "venta", "contacto"] },
    ]
  },
  {
    label: "Sanidad y hogar", actions: [
      { label: "Registrar tratamiento o control sanitario", description: "Vacunación con lote/cadena de frío, tratamiento y retiro", icon: "pill", href: "/dashboard/sanidad/control?nuevo=1", keywords: ["vacuna", "medicina", "enfermedad", "desparasitacion", "carencia", "retiro", "cadena de frio"] },
      { label: "Programar evento sanitario", description: "Crea una vacuna, revisión o recordatorio futuro", icon: "calendar", href: "/dashboard/sanidad/calendario?nuevo=evento", keywords: ["calendario", "recordatorio", "vacunacion"] },
      { label: "Registrar bioseguridad o bienestar", description: "POE GAB, Resolución 8452/2025, capacitación 5 años o desinfección", icon: "shield", href: "/dashboard/sanidad/bioseguridad?nuevo=1", keywords: ["bioseguridad", "poe", "bienestar", "ica", "res 8452", "invima", "gsmi"] },
      { label: "Registrar consumo del hogar", description: "Captura autoconsumo y ahorro familiar", icon: "home", href: "/dashboard/soberania?nuevo=consumo", keywords: ["autoconsumo", "familia", "ahorro"] },
    ]
  },
  {
    label: "Finanzas", actions: [
      { label: "Registrar egreso o compra", description: "Guarda gastos, costos y compras por especie o lugar", icon: "outgoing", href: "/dashboard/finanzas/egresos?nuevo=1", keywords: ["gasto", "pago", "compra", "especie", "lugar"] },
      { label: "Registrar transacción financiera", description: "Registra un ingreso u otro movimiento y elige su tipo", icon: "incoming", href: "/dashboard/finanzas/finanzas?nuevo=1", keywords: ["ingreso", "dinero", "abono", "cobro"] },
      { label: "Prorratear costo indirecto", description: "Reparte gastos compartidos por cabezas, biomasa, alimento o m²", icon: "calculator", href: "/dashboard/analisis/reportes?tab=analitica&nuevo=prorrateo", keywords: ["prorrateo", "costo indirecto", "energia", "agua", "mano de obra", "contabilidad analitica", "reporte"] },
      { label: "Crear presupuesto", description: "Define un período y sus partidas", icon: "banknote", href: "/dashboard/finanzas/presupuestos?nuevo=1", keywords: ["plan", "meta", "gasto"] },
      { label: "Registrar pago o abono de cuenta", description: "Aplica un cobro o pago sobre una cuenta pendiente", icon: "card", href: "/dashboard/finanzas/cuentas?nuevo=pago", keywords: ["cuenta", "deuda", "cobrar", "pagar", "abono"] },
    ]
  },
  {
    label: "Catálogos y configuración", actions: [
      { label: "Abrir asistente inicial (Día 1 · 3 pasos)", description: "Configura granja, lugares, animales actuales y alimento inicial o CSV", icon: "sparkles", href: "/dashboard?wizard=1", keywords: ["asistente inicial", "onboarding", "dia 1", "configuracion inicial", "wizard", "primeros pasos", "csv"] },
      { label: "Agregar especie, raza o dato de catálogo", description: "Mantén listas y opciones usadas en los formularios", icon: "folder", href: "/dashboard/configuracion/catalogos?nuevo=1", keywords: ["especie", "raza", "vacuna", "categorias", "etapas"] },
      { label: "Agregar estándar de peso", description: "Actualiza referencias por especie y edad", icon: "dna", href: "/dashboard/configuracion/catalogos?tab=pesos&nuevo=1", keywords: ["raza", "crecimiento", "genetica"] },
    ]
  },
];
