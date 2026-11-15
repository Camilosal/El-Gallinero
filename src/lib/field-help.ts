import { normalizeText } from "./text";

interface HelpRule {
  patterns: string[];
  help: string;
}

const EXACT_LABEL_HELP: Record<string, string> = {
  fecha: "Día real en que ocurrió o se registra este movimiento.",
  "fecha inicio": "Primer día en que arrancó el lote, proyecto o actividad.",
  "fecha de inicio": "Primer día en que arrancó el lote, proyecto o actividad.",
  "fecha fin": "Último día previsto o real de cierre.",
  "fecha nacimiento": "Día en que nacieron los animales o eclosionó la camada.",
  "fecha de ingreso": "Día en que llegaron estos animales a la granja.",
  "fecha de venta": "Día en que entregaste el pedido o cerraste la venta.",
  "fecha de vencimiento": "Plazo máximo acordado para pagar o cobrar este saldo.",
  "fecha programada": "Día planeado para ejecutar esta actividad.",
  "fecha ultima actualizacion": "Última vez que se revisó o ajustó este dato.",
  especie: "Tipo de animal al que pertenece este registro (ej. gallina, pollo, codorniz, pato, conejo o cuy).",
  "especie origen": "Especie de los animales que generaron este producto o subproducto.",
  raza: "Línea o raza genética del animal o lote (define sus curvas esperadas de peso y postura).",
  lote: "Grupo o tanda de animales que se manejan juntos desde la misma fecha.",
  "lote destino": "Lote que recibe este consumo, pesaje, vacuna o evento.",
  codigo: "Identificador corto y único para ubicar rápido el animal, lote o lugar (puede ir en la etiqueta QR).",
  nombre: "Nombre sencillo y claro con el que identifican esto en la granja.",
  descripcion: "Qué es o qué ocurrió, explicado en palabras simples.",
  categoria: "Grupo al que pertenece este movimiento para ordenar tus reportes.",
  tipo: "Clase o modalidad de registro según el trabajo realizado.",
  estado: "Situación actual (por ejemplo: activo, pendiente, vendido o cerrado).",
  cantidad: "Número exacto de unidades, animales o kilos de este movimiento.",
  peso: "Peso medido en báscula (kg o gramos según indique el campo).",
  "peso promedio": "Peso promedio por animal en gramos o kilos obtenido del muestreo.",
  precio: "Valor unitario o total acordado en pesos ($).",
  valor: "Monto en pesos ($) correspondiente a esta operación o bien.",
  costo: "Cuánto costó comprarlo o producirlo en pesos ($).",
  total: "Suma total de esta operación en pesos ($) o unidades.",
  lugar: "Galpón, corral, jaula o potrero donde ocurre este registro.",
  ubicacion: "Galpón, corral, jaula o espacio físico de la granja.",
  origen: "De dónde proviene el animal, material o dinero.",
  destino: "Hacia dónde va el animal, traslado o producto.",
  proveedor: "Persona o negocio a quien le compras este producto o servicio.",
  cliente: "Persona o negocio que te compra los productos de la granja.",
  contacto: "Cliente o proveedor relacionado con esta operación.",
  telefono: "Número de celular o fijo para contactar o enviar recibos por WhatsApp.",
  email: "Correo electrónico para notificaciones o comprobantes.",
  direccion: "Ubicación física o vereda donde está la persona o sede.",
  municipio: "Municipio o ciudad donde se ubica (ajusta clima y precios de mercado de la zona).",
  departamento: "Departamento territorial donde se encuentra la granja.",
  altitud: "Altura aproximada sobre el nivel del mar en metros (msnm); ayuda a ajustar alertas térmicas.",
  responsable: "Nombre de la persona encargada de realizar o verificar esta labor.",
  notas: "Anotaciones adicionales útiles para recordar qué pasó ese día.",
  observaciones: "Detalles extras, hallazgos o comentarios del momento.",
  "nota breve": "Anotación corta opcional para dar contexto (ej. turno de la mañana).",
  unidad: "Cómo se mide o empaca (ej. unidad, cubeta x30, kg, bulto 40 kg, litro).",
  presentacion: "Forma en que se entrega o compra (ej. cubeta, bulto, en pie, en canal).",
  marca: "Casa comercial o fabricante del alimento, equipo o producto.",
  lote_compra: "Número de lote del empaque o fabricante para trazabilidad sanitaria.",
  "stock minimo": "Cantidad mínima en bodega por debajo de la cual la app te avisará para reponer.",
  "vidas util meses": "Cuántos meses esperas que dure este equipo funcionando bien (sirve para repartir su desgaste sin golpear el mes de compra).",
  "vida util": "Tiempo o ciclos que dura el equipo antes de reponerlo.",
  "valor residual": "Valor aproximado al que podrías vender o rescatar el equipo cuando cumpla su vida útil.",
  titulo: "Título corto y fácil de reconocer en listados y calendarios.",
  prioridad: "Qué tan urgente es atender esto frente a otras tareas.",
  frecuencia: "Cada cuántos días se repite esta revisión o tarea.",
  edad: "Edad del animal o lote en días o semanas desde nacimiento/ingreso.",
  causa: "Motivo principal observado o diagnosticado.",
  tratamiento: "Producto aplicado, dosis y vía usada para atender el caso.",
  producto: "Nombre comercial del medicamento, vacuna, insumo o producto.",
  dosis: "Cantidad aplicada por animal o por litro de agua/kilo de alimento.",
  via: "Cómo se aplicó (ej. agua de bebida, gota ocular, inyectable, aspersión).",
  dias_retiro: "Días que debes esperar después de aplicar el producto antes de vender huevos o carne (tiempo de carencia ICA).",
  temperatura: "Temperatura medida en °C en el galpón, cuarto de huevos, incubadora o pila.",
  humedad: "Humedad relativa del aire medida en %.",
  amoniaco: "Concentración de olor fuerte o gas amoníaco (NH3) en partes por millón (ppm).",
};

const KEYWORD_RULES: HelpRule[] = [
  { patterns: ["precio/u", "precio por unidad", "precio unitario"], help: "Cuánto vale cada unidad en pesos ($). El total se calcula solo." },
  { patterns: ["precio/kg", "precio por kg", "valor por kg"], help: "Precio en pesos ($) por cada kilogramo vendido o comprado." },
  { patterns: ["huevos recogidos", "total huevos", "recogidos hoy"], help: "Total de huevos recolectados hoy sumando sanos, rotos e incubables." },
  { patterns: ["rotos", "averiados", "cascara"], help: "Huevos que salieron quebrados o no sirven para venta normal." },
  { patterns: ["incubacion", "fertiles", "para empollar"], help: "Huevos fértiles separados para llevar a nido o incubadora." },
  { patterns: ["autoconsumo", "consumo familiar", "hogar"], help: "Parte de la producción que dejaste para alimentación de la familia." },
  { patterns: ["excedente"], help: "Huevos adicionales o fuera de talla estándar." },
  { patterns: ["alimento del inventario", "tipo de alimento"], help: "Elige el concentrado o grano de tu bodega del cual vas a descontar o ingresar." },
  { patterns: ["peso vivo"], help: "Peso total del animal vivo antes de sacrificio o en pie (kg)." },
  { patterns: ["peso canal", "canal"], help: "Peso final de la carne limpia ya beneficiada (kg)." },
  { patterns: ["cobro", "forma de pago", "metodo de pago"], help: "Cómo te pagan o cómo pagas: de contado, Nequi/Daviplata, banco o fiado/crédito." },
  { patterns: ["plazo", "credito", "dias de plazo"], help: "Si es fiado o a crédito, cuántos días tiene plazo para pagarse." },
  { patterns: ["bulto", "kg"], help: "Cantidad en kilogramos o bultos; la app la convierte automáticamente a inventario." },
  { patterns: ["capacidad"], help: "Cuántos animales caben cómodamente en este espacio según normas de bienestar." },
  { patterns: ["vida util"], help: "Duración estimada del equipo en meses o ciclos para calcular su desgaste mensual sin dañar tu ganancia." },
  { patterns: ["depreciacion", "desgaste"], help: "Cómo se reparte el costo del equipo a lo largo de su vida útil." },
  { patterns: ["retiro", "carencia"], help: "Días obligatorios de espera antes de usar o vender huevo/carne tras aplicar un fármaco." },
  { patterns: ["mortalidad", "bajas"], help: "Cantidad de animales muertos encontrados en la revisión de hoy." },
  { patterns: ["madre", "padre", "linaje", "origen genetico", "generacion"], help: "Datos de los padres o criadero de origen para evitar cruces entre parientes." },
  { patterns: ["fecha"], help: "Selecciona el día real en que sucedió o se registra este dato." },
  { patterns: ["especie"], help: "Elige el tipo de animal (gallina, pollo, codorniz, pato, conejo o cuy)." },
  { patterns: ["lugar", "galpon", "corral", "jaula"], help: "Selecciona el espacio físico o galpón donde están los animales o insumos." },
  { patterns: ["lote"], help: "Selecciona el grupo o lote correspondiente para llevar su costo e historia por separado." },
  { patterns: ["cantidad"], help: "Escribe el número exacto registrado en esta operación." },
  { patterns: ["precio", "valor", "costo", "monto", "presupuesto"], help: "Ingresa el valor en pesos colombianos ($)." },
  { patterns: ["nota", "observacion", "comentario", "detalle"], help: "Campo opcional para anotar cualquier detalle importante que quieras recordar." },
];

function cleanFieldLabel(rawLabel: string): string {
  return normalizeText(rawLabel)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[*?:.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Devuelve una explicación corta en lenguaje sencillo para un campo de formulario
 * cuando no se pasó un tooltip `help` explícito en el componente.
 */
export function resolveDefaultFieldHelp(label?: string): string | undefined {
  if (!label) return undefined;
  const cleaned = cleanFieldLabel(label);
  if (!cleaned) return undefined;

  if (EXACT_LABEL_HELP[cleaned]) {
    return EXACT_LABEL_HELP[cleaned];
  }

  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((pat) => cleaned.includes(normalizeText(pat)))) {
      return rule.help;
    }
  }

  return `Ingresa o selecciona el dato correspondiente a «${label.replace(/[*]/g, "").trim()}».`;
}
