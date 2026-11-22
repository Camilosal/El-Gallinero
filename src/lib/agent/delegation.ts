import { getSettings, updateSettings } from "@/lib/settings";
import { AGENT_TOOLS, type AgentTool } from "./tools";

/**
 * Política de delegación del asistente (B3).
 *
 * - El propietario/administrador puede marcar escrituras rutinarias como "auto"
 *   (se ejecutan sin tarjeta previa) o "confirm" (tarjeta de confirmación humana).
 * - El PISO DURO es una constante de código: esas herramientas SIEMPRE requieren
 *   confirmación humana aunque la política diga "auto", en cualquier canal
 *   (web, voz, Telegram, API v1 o MCP).
 * - Toda auto-ejecución por delegación queda auditada en ai_actions con
 *   origin "delegated_auto".
 */

export const DELEGATION_POLICY_SETTING_KEY = "assistant.delegation_policy.v1";

export type DelegationMode = "auto" | "confirm";
export type DelegationPolicy = Record<string, DelegationMode>;

/** Piso duro no delegable: ventas, dinero, cartera, animales, lugares, alimentos y cierres. */
export const HARD_FLOOR_TOOL_NAMES: readonly string[] = [
  "registrar_venta_huevos",
  "registrar_venta_animales",
  "registrar_venta_carne",
  "registrar_venta_gallinaza",
  "registrar_gasto",
  "registrar_ingreso",
  "registrar_pago_cuenta",
  "registrar_pago_personal",
  "registrar_prorrateo",
  "registrar_adquisicion",
  "gestionar_lugar",
  "trasladar_animales",
  "registrar_sacrificio_carne",
  "ajustar_gallinaza",
  "gestionar_alimento",
  "registrar_cierre_diario",
] as const;

const HARD_FLOOR = new Set<string>(HARD_FLOOR_TOOL_NAMES);

export function isHardFloorTool(toolName: string): boolean {
  return HARD_FLOOR.has(toolName);
}

function writeTools(): AgentTool[] {
  return AGENT_TOOLS.filter((tool) => tool.kind === "write");
}

/** Política recomendada por defecto: igual al comportamiento histórico del asistente. */
export function defaultDelegationPolicy(): DelegationPolicy {
  const policy: DelegationPolicy = {};
  for (const tool of writeTools()) {
    policy[tool.name] = tool.requiresConfirmation || isHardFloorTool(tool.name) ? "confirm" : "auto";
  }
  return policy;
}

/** Sanea un objeto de política: solo herramientas de escritura conocidas y valores válidos; el piso duro queda fijo en confirm. */
export function sanitizeDelegationPolicy(raw: unknown): DelegationPolicy {
  const defaults = defaultDelegationPolicy();
  const policy: DelegationPolicy = { ...defaults };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [name, mode] of Object.entries(raw as Record<string, unknown>)) {
      if (!(name in defaults)) continue;
      if (mode !== "auto" && mode !== "confirm") continue;
      policy[name] = isHardFloorTool(name) ? "confirm" : mode;
    }
  }
  for (const name of HARD_FLOOR) {
    if (name in policy) policy[name] = "confirm";
  }
  return policy;
}

export async function getDelegationPolicy(): Promise<DelegationPolicy> {
  const settings = await getSettings();
  const raw = settings[DELEGATION_POLICY_SETTING_KEY];
  if (!raw || !raw.trim()) return defaultDelegationPolicy();
  try {
    return sanitizeDelegationPolicy(JSON.parse(raw));
  } catch {
    return defaultDelegationPolicy();
  }
}

/** Confirmación efectiva = piso duro || política distinta de "auto". */
export function effectiveRequiresConfirmation(toolName: string, policy: DelegationPolicy): boolean {
  if (isHardFloorTool(toolName)) return true;
  const mode = policy[toolName] ?? (AGENT_TOOLS.find((t) => t.name === toolName)?.requiresConfirmation ? "confirm" : "auto");
  return mode !== "auto";
}

export async function saveDelegationPolicy(
  rawPolicy: unknown,
  userId?: string | null,
): Promise<DelegationPolicy> {
  const policy = sanitizeDelegationPolicy(rawPolicy);
  await updateSettings(
    [{ key: DELEGATION_POLICY_SETTING_KEY, value: JSON.stringify(policy) }],
    userId ?? null,
  );
  return policy;
}

export async function resetDelegationPolicy(userId?: string | null): Promise<DelegationPolicy> {
  const policy = defaultDelegationPolicy();
  await updateSettings(
    [{ key: DELEGATION_POLICY_SETTING_KEY, value: JSON.stringify(policy) }],
    userId ?? null,
  );
  return policy;
}

/** Descripción para la cola dinámica del prompt (preserva el KV caching del núcleo estático). */
export function describeDelegationPolicy(policy: DelegationPolicy): string {
  const auto: string[] = [];
  const confirm: string[] = [];
  for (const tool of writeTools()) {
    if (effectiveRequiresConfirmation(tool.name, policy)) {
      confirm.push(tool.name);
    } else {
      auto.push(tool.name);
    }
  }
  const lines = [
    `Política de delegación vigente de esta granja (el piso duro de confirmación humana es inviolable aunque la política cambie).`,
    `Se ejecutan sin preguntar (auto): ${auto.length > 0 ? auto.join(", ") : "ninguna escritura"}.`,
    `Requieren confirmación humana en tarjeta o escribiendo "confirmo": ${confirm.join(", ")}.`,
    `Las auto-ejecuciones delegadas quedan auditadas con origen delegated_auto; no vuelvas a crear una acción que ya quedó pendiente o ejecutada.`,
  ];
  return lines.join("\n- ");
}

export interface DelegationToolView {
  name: string;
  description: string;
  hardFloor: boolean;
  defaultMode: DelegationMode;
  mode: DelegationMode;
  effectiveMode: DelegationMode;
}

/** Vista completa para la UI de Configuración → Módulos. */
export function delegationToolViews(policy: DelegationPolicy): DelegationToolView[] {
  const defaults = defaultDelegationPolicy();
  return writeTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    hardFloor: isHardFloorTool(tool.name),
    defaultMode: defaults[tool.name],
    mode: policy[tool.name] ?? defaults[tool.name],
    effectiveMode: effectiveRequiresConfirmation(tool.name, policy) ? "confirm" : "auto",
  }));
}