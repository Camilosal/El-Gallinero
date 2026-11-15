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
      { label: "Ingresar gallinas", description: "Registra si fueron compradas, donadas o nacieron en la granja", icon: "bird", href: "/produccion/adquisiciones?nuevo=gallina", keywords: ["ave", "ponedora", "origen"] },
      { label: "Ingresar gallos reproductores", description: "Registra el origen antes de gestionar cada ficha", icon: "feather", href: "/produccion/adquisiciones?nuevo=gallo", keywords: ["ave", "macho", "origen"] },
      { label: "Ingresar un lote de animales", description: "Elige especie y destino: carne, postura o pie de cría", icon: "paw-print", href: "/produccion/adquisiciones?nuevo=lote_pollos", keywords: ["pollo", "pollitos", "broiler", "codorniz", "pato", "conejo", "cuy", "cuyes", "cobayo", "pie de cria", "lote"] },
      { label: "Registrar cría propia", description: "Da de alta nacimientos que no se registraron desde Incubación", icon: "sparkles", href: "/produccion/adquisiciones?nuevo=cria_propia", keywords: ["nacimiento", "eclosion", "pollitos", "gazapos"] },
      { label: "Registrar adquisición de animales", description: "Compra, donación u otro ingreso con origen y destino", icon: "incoming", href: "/produccion/adquisiciones?nuevo=1", keywords: ["compra", "donacion", "ingreso", "proveedor", "linaje", "gsmi"] },
      { label: "Registrar mortalidad", description: "Registra muerte o baja de animales", icon: "mortality", href: "/produccion/mortalidad?nuevo=1", keywords: ["muerte", "baja", "perdida"] },
      { label: "Crear lugar de manejo", description: "Registra corral, jaula, galpón, potrero, jardín o patio", icon: "map-pin", href: "/ubicaciones?nuevo=1", keywords: ["ubicacion", "corral", "galpon", "georreferencia", "area m2"] },
      { label: "Registrar traslado de animal", description: "Mueve animales o lotes entre lugares de manejo", icon: "truck", href: "/ubicaciones?nuevo=traslado", keywords: ["mover", "traslado", "cambio de corral"] },
      { label: "Registrar peso de un animal", description: "Guarda pesaje contra curva esperada y revisa qué tan parejo va el lote", icon: "scale", href: "/produccion/peso?nuevo=1", keywords: ["pesaje", "medicion", "biometria", "uniformidad", "cv%", "parejo"] },
      { label: "Iniciar incubación", description: "Registra huevos de gallina, codorniz o pato puestos a incubar", icon: "egg", href: "/produccion?tab=incubacion&nuevo=incubacion", keywords: ["incubar", "eclosion", "nacimiento", "codorniz", "pato", "ovoscopia"] },
      { label: "Registrar eclosión", description: "Completa una incubación y registra los animales nacidos", icon: "bird", href: "/produccion?tab=incubacion&nuevo=eclosion", keywords: ["nacimiento", "nacieron", "pollitos"] },
      { label: "Registrar empadre o nacimiento (Conejos/Cuyes)", description: "Control reproductivo, palpación, parto, destete y alerta de consanguinidad", icon: "heart", href: "/produccion?tab=reproduccion&nuevo=1", keywords: ["reproduccion", "empadre", "palpacion", "nidal", "parto", "destete", "conejo", "cuy", "cuyes", "consanguinidad", "madre elite"] },
      { label: "Crear plan de parvada", description: "Define metas de postura, reemplazo y proyección", icon: "clipboard", href: "/produccion/plan-parvada?nuevo=1", keywords: ["planificacion", "proyeccion", "parvada"] },
    ]
  },
  {
    label: "Producción y ventas", actions: [
      { label: "Registrar recolección de huevos", description: "Captura huevos del día por tamaño, temperatura de cuarto y consumo del hogar", icon: "egg", href: "/produccion?tab=huevos&nuevo=1", keywords: ["recoger", "postura", "produccion diaria", "ntc 1240", "jumbo", "aaa", "aa", "lote", "almacenamiento", "tamano"] },
      { label: "Registrar pérdida de huevos", description: "Registra huevos rotos o descartados", icon: "alert", href: "/produccion/mortalidad?nuevo=perdida", keywords: ["rotos", "descarte", "merma"] },
      { label: "Registrar faena", description: "Registra el sacrificio, carne obtenida y despiece por especie", icon: "meat", href: "/produccion?tab=carne&nuevo=faena", keywords: ["sacrificio", "beneficio", "canal", "cuy", "conejo", "pato", "pollo"] },
      { label: "Registrar venta de huevos", description: "Venta por tamaño de huevo, orden de salida y presentación", icon: "money", href: "/finanzas/ventas?tab=huevos&nuevo=1", keywords: ["huevo", "cliente", "cubeta", "ntc 1240", "peps", "fifo", "tamano"] },
      { label: "Registrar venta de animales", description: "Venta en pie de gallinas, gallos, pollos, codornices, patos, conejos o cuyes", icon: "bird", href: "/finanzas/ventas?tab=animales&nuevo=1", keywords: ["pollo", "gallina", "gallo", "codorniz", "pato", "conejo", "cuy", "cuyes", "en pie"] },
      { label: "Registrar venta de carne", description: "Venta de carne en canal o despiece por especie", icon: "meat", href: "/finanzas/ventas?tab=carne&nuevo=1", keywords: ["kilogramos", "kg", "canal", "pollo", "conejo", "cuy", "pato"] },
      { label: "Registrar venta de gallinaza", description: "Salida y cobro de abono, gallinaza o compost", icon: "sprout", href: "/finanzas/ventas?tab=gallinaza&nuevo=1", keywords: ["abono", "estiercol", "fertilizante", "compost"] },
      { label: "Registrar otra venta o subproducto", description: "Abonos, plumas, subproductos u otro producto de granja", icon: "tag", href: "/finanzas/ventas?tab=otros&nuevo=1", keywords: ["subproducto", "venta", "cliente", "producto", "ingreso"] },
      { label: "Ajustar inventario de gallinaza", description: "Corrige existencias o registra un ajuste", icon: "scale", href: "/produccion?tab=gallinaza&nuevo=ajuste", keywords: ["abono", "inventario", "correccion"] },
    ]
  },
  {
    label: "Almacén y operaciones", actions: [
      { label: "Registrar movimiento de alimento", description: "Captura una entrada o consumo de alimento", icon: "feed", href: "/produccion?tab=alimentacion&subtab=movimientos&nuevo=movimiento", keywords: ["comida", "concentrado", "forraje", "consumo", "entrada", "salida"] },
      { label: "Crear alimento", description: "Agrega concentrado o forraje con proteína, energía y presentación en bultos", icon: "feed", href: "/produccion?tab=alimentacion&subtab=inventario&nuevo=alimento", keywords: ["comida", "concentrado", "forraje", "existencias", "%ms", "%pc", "materia seca", "proteina", "vitamina c", "oreo"] },
      { label: "Crear plan de alimentación", description: "Define raciones diarias y mezclas por etapa y especie", icon: "notebook", href: "/produccion?tab=alimentacion&subtab=etapas&nuevo=plan", keywords: ["dieta", "racion", "programa", "etapas", "forraje", "fcr", "conversion"] },
      { label: "Crear insumo", description: "Agrega medicamentos, vacunas, herramientas o materiales", icon: "package-open", href: "/inventarios/insumos?nuevo=insumo", keywords: ["inventario", "existencias", "stock"] },
      { label: "Registrar movimiento de insumo", description: "Captura una entrada, consumo o ajuste", icon: "package", href: "/inventarios/insumos?nuevo=movimiento", keywords: ["entrada", "salida", "ajuste", "consumo"] },
      { label: "Registrar equipo o activo", description: "Guarda equipos con su vida útil en meses o ciclos para cuidar tu ganancia mensual", icon: "equipment", href: "/operaciones/activos?nuevo=1", keywords: ["activo", "maquina", "herramienta", "bomba", "incubadora", "depreciacion", "vida util", "capex", "desgaste"] },
      { label: "Crear tarea de mantenimiento", description: "Programa o registra una reparación", icon: "wrench", href: "/operaciones/mantenimiento?nuevo=1", keywords: ["reparacion", "equipo", "infraestructura"] },
      { label: "Iniciar pila de compostaje", description: "Manejo seguro de abono y bajas con control de temperatura y humedad", icon: "sprout", href: "/operaciones/compostaje?nuevo=1", keywords: ["compostaje", "pila", "carbono", "volteo", "mortalidad", "sanitizacion", "agrosavia", "3:1:1", "7:2:2"] },
      { label: "Registrar lectura ambiental o sensor", description: "Anota temperatura, humedad, sensación de calor, amoníaco o pesaje automático", icon: "thermometer", href: "/operaciones/cierre?nuevo=sensor", keywords: ["sensor", "iot", "telemetria", "ith", "estres termico", "amoniaco", "nh3", "temperatura", "humedad", "bascula"] },
      { label: "Ejecutar cierre diario", description: "Revisa el resumen del día y cierra la jornada sin cambios accidentales", icon: "clipboard", href: "/operaciones/cierre?nuevo=cierre", keywords: ["cierre diario", "conciliacion", "auditoria", "reapertura"] },
      { label: "Agregar tarea a rutina diaria", description: "Programa una tarea auto-ajustable en el calendario y rutina de hoy", icon: "calendar-days", href: "/planeacion/calendario?tab=rutina&nuevo=rutina", keywords: ["rutina", "calendario", "tarea", "planeacion", "turno", "diaria", "semanal"] },
      { label: "Crear producto", description: "Agrega un producto que puedas asociar a una compra", icon: "tag", href: "/finanzas/egresos?nuevo=producto", keywords: ["compra", "articulo", "insumo"] },
      { label: "Crear proveedor", description: "Registra proveedor con teléfono, ubicación y plazo", icon: "truck", href: "/contactos?nuevo=proveedor", keywords: ["compra", "suministrador", "contacto"] },
      { label: "Crear cliente", description: "Registra cliente con teléfono, WhatsApp, dirección y plazo", icon: "handshake", href: "/contactos?nuevo=cliente", keywords: ["comprador", "venta", "contacto"] },
    ]
  },
  {
    label: "Sanidad y hogar", actions: [
      { label: "Registrar tratamiento o control sanitario", description: "Vacunación con lote/cadena de frío, tratamiento y retiro", icon: "pill", href: "/sanidad/control?nuevo=1", keywords: ["vacuna", "medicina", "enfermedad", "desparasitacion", "carencia", "retiro", "cadena de frio"] },
      { label: "Programar evento sanitario", description: "Crea una vacuna, revisión o recordatorio futuro", icon: "calendar", href: "/sanidad/calendario?nuevo=evento", keywords: ["calendario", "recordatorio", "vacunacion"] },
      { label: "Registrar bioseguridad o bienestar", description: "Control sanitario, limpieza, visitantes, capacitaciones y bienestar animal", icon: "shield", href: "/sanidad/bioseguridad?nuevo=1", keywords: ["bioseguridad", "poe", "bienestar", "ica", "res 8452", "invima", "gsmi"] },
      { label: "Registrar consumo del hogar", description: "Captura autoconsumo y ahorro familiar", icon: "home", href: "/soberania?nuevo=consumo", keywords: ["autoconsumo", "familia", "ahorro"] },
    ]
  },
  {
    label: "Finanzas", actions: [
      { label: "Registrar egreso o compra", description: "Guarda gastos, equipos o compras de alimento por especie o lugar", icon: "outgoing", href: "/finanzas/egresos?nuevo=1", keywords: ["gasto", "pago", "compra", "especie", "lugar", "capex", "equipo", "bodega"] },
      { label: "Registrar transacción financiera", description: "Registra un ingreso u otro movimiento y elige su tipo", icon: "incoming", href: "/finanzas/finanzas?nuevo=1", keywords: ["ingreso", "dinero", "abono", "cobro"] },
      { label: "Repartir gastos compartidos", description: "Distribuye luz, agua o mano de obra entre especies según animales, peso o área", icon: "calculator", href: "/analisis/reportes?tab=analitica&nuevo=prorrateo", keywords: ["prorrateo", "costo indirecto", "energia", "agua", "mano de obra", "contabilidad analitica", "reporte", "gastos compartidos"] },
      { label: "Crear presupuesto", description: "Define un período y sus partidas", icon: "banknote", href: "/finanzas/presupuestos?nuevo=1", keywords: ["plan", "meta", "gasto"] },
      { label: "Registrar pago o abono de cuenta", description: "Aplica un cobro o pago sobre una cuenta pendiente", icon: "card", href: "/finanzas/cuentas?nuevo=pago", keywords: ["cuenta", "deuda", "cobrar", "pagar", "abono"] },
    ]
  },
  {
    label: "Catálogos y configuración", actions: [
      { label: "Abrir asistente inicial (Día 1 · 3 pasos)", description: "Configura granja, lugares, animales actuales y alimento inicial o CSV", icon: "sparkles", href: "/inicio?wizard=1", keywords: ["asistente inicial", "onboarding", "dia 1", "configuracion inicial", "wizard", "primeros pasos", "csv"] },
      { label: "Agregar norma, estándar o guía propia", description: "Registra un protocolo interno o resolución con sus adjuntos", icon: "book-open", href: "/analisis/normas?nuevo=1", keywords: ["norma", "estandar", "guia", "protocolo", "ica", "ntc 1240", "documento", "adjunto", "pdf"] },
      { label: "Presentar falla o incidencia", description: "Envía un reporte de error o mejora con diagnóstico automático de dónde ocurrió", icon: "alert", href: "/configuracion/fallas?nuevo=1", keywords: ["falla", "error", "bug", "incidencia", "soporte", "reportar"] },
      { label: "Agregar especie, raza o dato de catálogo", description: "Mantén listas y opciones usadas en los formularios", icon: "folder", href: "/configuracion/catalogos?nuevo=1", keywords: ["especie", "raza", "vacuna", "categorias", "etapas"] },
      { label: "Agregar estándar de peso", description: "Actualiza referencias por especie y edad", icon: "dna", href: "/configuracion/catalogos?tab=pesos&nuevo=1", keywords: ["raza", "crecimiento", "genetica"] },
    ]
  },
];
