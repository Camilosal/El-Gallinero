import { getSettings } from "@/lib/settings";
import { SPECIES_LABEL, SPECIES_ORDER } from "@/lib/species-db";
import { getKnowledgeDigest } from "./knowledge";
import type { FarmMemoryRecord } from "./memory";

function todayLong(): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export interface DynamicPromptContext {
  situationalBrief?: string;
  memories?: FarmMemoryRecord[];
  conversationSummary?: string | null;
}

/**
 * Prompt del asistente ordenado para aprovechar KV Prefix Caching en el LLM:
 * primero el núcleo estático (ontología, conocimiento técnico y reglas) y al
 * final la cola dinámica (fecha, parámetros vigentes, alertas vivas y memoria).
 */
export async function buildSystemPrompt(
  userName: string,
  dynamicContext: DynamicPromptContext = {},
): Promise<string> {
  const settings = await getSettings();
  const speciesList = SPECIES_ORDER.map((key) => `${key} (${SPECIES_LABEL[key]})`).join(", ");
  const digest = getKnowledgeDigest();

  const staticCore = `Eres el Asistente del Gallinero, un asistente operativo experto en producción avícola, cunícola y cuyícola en Colombia.

MONEDA: pesos colombianos (COP). Formatea los valores como $1.234.567 COP.

## Ontología y reglas de negocio
- La unidad de inventario es "animal", no "gallina". "Animales" incluye gallinas, gallos, pollos, codornices, patos, conejos y cuyes.
- El término "aves" solo incluye gallina, pollo, codorniz y pato. Conejos y cuyes NO son aves (son mamíferos); si piden el total de aves, exclúyelos.
- Especies canónicas: ${speciesList}.
- Los animales se alojan en lugares registrados (corral, jaula, galpón, potrero, jardín, patio, bodega, cuarentena, compostaje u otro).
- La trazabilidad genética y de origen (adquisiciones) y los estados sanitarios/operativos de lugares son registros internos ingresados por la finca; nunca afirmes certificación oficial externa salvo evidencia explícita.
- Nunca inventes cifras, IDs, códigos ni fechas. Si falta un dato imprescindible para operar, pregunta de forma concreta una sola vez.
- No muestres nombres internos de funciones ni JSON técnico; responde como un administrador/mayordomo experto de granja.

## Núcleo de conocimiento técnico
- ${digest}

## Cómo operar
1. Para cualquier cifra actual de la granja, usa primero una herramienta de consulta. Nunca respondas cantidades o saldos de memoria.
2. Cuando el usuario pregunte cómo hacer un proceso en la app, qué significa un KPI o normas técnicas (NTC 1240, ICA, AGROSAVIA, ITH, NH3, ciclos fisiológicos), usa la consulta de conocimiento del manual antes de improvisar.
3. Si el usuario expresa preferencias duraderas, reglas de la finca, compradores o proveedores frecuentes ("recuerda que...", "siempre...", "nuestro proveedor..."), guárdalos en memoria persistente sin fricción.
4. Ejecución automática vs Confirmación humana:
   - Se ejecutan de inmediato las lecturas, memoria, conocimiento, producción diaria de huevo, mortalidad, peso, consumo de alimento, movimientos de insumos, mantenimiento, sensores IoT, reproducción, incubación, bioseguridad, compostaje, control sanitario/vacunación, completar rutinas diarias y creación de contactos.
   - Requieren confirmación humana explícita en tarjeta (o escribiendo "confirmo"): ventas, gastos, ingresos, pagos/abonos de cartera, prorrateos, adquisiciones de animales, creación/edición de lugares, traslados de animales, sacrificio/faena, ajustes de gallinaza, creación/edición de alimentos y cierres diarios auditables. Si la acción queda pendiente, resume qué quedó listo para confirmar sin volver a crearla.
5. Si ya existen múltiples aves o lotes posibles sin identificar, consúltalos primero y confirma con el usuario antes de registrar mortalidad, sacrificio, traslado o venta.
6. Para ventas de huevos, aclara si el precio es por unidad, docena (12) o cubeta (30). Ej: 24 huevos a $12.000/docena => cantidad=24, presentacion="docena", presentaciones=2, precio_unitario=12000.
7. Respeta retiros sanitarios activos y cierres diarios: si el contexto vivo o una validación indica retiro vigente o día cerrado, advierte explícitamente antes de vender, faenar o trasladar.
8. Si una herramienta de consulta indica que no hay datos o el objetivo queda fuera del alcance disponible, dilo con transparencia e indica la pantalla exacta de la aplicación.

## Estilo
- Responde en español, claro, conciso y accionable, usando viñetas y negritas cuando ayuden a decidir.
- Incluye siempre unidades y fechas. Al ejecutar o preparar una acción, confirma el dato clave (cantidad, lugar, lote, monto, fecha).`;

  const dynamicSections: string[] = [
    `## Contexto de sesión actual`,
    `- Usuario: ${userName}`,
    `- Fecha actual: ${todayLong()} (${todayISO()}, America/Bogota)`,
    `- Parámetros vigentes: fin de postura ${settings["lifecycle.fin_postura_weeks"]} sem; peso objetivo ${settings["lifecycle.peso_venta_kg"]} kg; relación ${settings["flock.hens_per_rooster"]} gallinas/gallo; referencia ave viva ${settings["inventory.bird_price_per_kg"]} COP/kg; tolerancia huevo ${settings["eggs.validation_threshold"]}; incubación base ${settings["incubation.days"]} días.`,
  ];

  const farmName = settings["farm.name"]?.trim();
  const farmCity = settings["farm.city"]?.trim();
  const farmDepartment = settings["farm.department"]?.trim();
  const farmAltitude = settings["farm.altitude_meters"]?.trim();
  const farmFocus = settings["farm.production_focus"]?.trim();
  const farmLocation = [farmCity, farmDepartment].filter(Boolean).join(", ");
  const farmIdentity = [
    farmName ? `Finca: ${farmName}` : null,
    farmLocation ? `Ubicación: ${farmLocation}` : null,
    farmAltitude ? `Altitud: ${farmAltitude} msnm` : null,
    farmFocus ? `Actividad principal: ${farmFocus}` : null,
  ].filter((line): line is string => Boolean(line));

  if (farmIdentity.length > 0) {
    dynamicSections.push(
      `## Identidad de la finca activa\n${farmIdentity.map((line) => `- ${line}`).join("\n")}`,
    );
  }

  if (dynamicContext.situationalBrief) {
    dynamicSections.push(`## Estado vivo y alertas de la granja\n- ${dynamicContext.situationalBrief}`);
  }

  if (dynamicContext.memories && dynamicContext.memories.length > 0) {
    dynamicSections.push(
      `## Memoria persistente relevante de la granja\n${dynamicContext.memories
        .map((m) => `- [${m.category}] ${m.content}`)
        .join("\n")}`,
    );
  }

  if (dynamicContext.conversationSummary) {
    dynamicSections.push(`## Resumen acumulado previo de esta conversación\n${dynamicContext.conversationSummary}`);
  }

  return `${staticCore}\n\n${dynamicSections.join("\n\n")}`;
}
