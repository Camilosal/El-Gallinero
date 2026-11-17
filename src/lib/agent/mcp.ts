// D2: adaptador del agente al Model Context Protocol (MCP).
//
// Una sola puerta de entrada: el servidor MCP reutiliza el manifiesto y el
// ejecutor de la API v1 (D1), con los mismos candados, RBAC/RLS, piso duro,
// política de delegación y auditoría (origin external_agent + token_id).
// Los schemas MCP se derivan de los parámetros ya declarados en AgentTool,
// sin duplicar definiciones.

import type { AgentTool } from "./tools";

export const MCP_PROTOCOL_VERSION = "2025-03-26";
export const MCP_SERVER_INFO = {
  name: "iwagranja",
  title: "IwaGranja — Gestión de granjas",
  version: "1.0.0",
} as const;

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
}

/** AgentTool → schema MCP (inputSchema = parameters ya declarados). */
export function agentToolToMcpSchema(tool: AgentTool): McpToolSchema {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
    annotations: { readOnlyHint: tool.kind === "read" },
  };
}

export interface AgentToolsManifestEntry {
  name: string;
  description: string;
  kind: "read" | "write";
  requiredScope: string;
  requiresConfirmation: boolean;
  hardFloor: boolean;
  jevDomains: string[];
  parameters: Record<string, unknown>;
}

/** Entrada del manifiesto D1 → tool MCP, preservando el aviso de confirmación. */
export function manifestEntryToMcpTool(entry: AgentToolsManifestEntry): McpToolSchema {
  const confirmationNote =
    entry.kind === "write"
      ? entry.requiresConfirmation
        ? " ESCRITURA SENSIBLE: la llamada devuelve una acción pendiente (actionId) que debe confirmarse vía POST /api/asistente/acciones/{actionId}/confirmar con el mismo token; nunca se ejecuta sola."
        : " Escritura de bajo riesgo: se ejecuta automáticamente y queda auditada."
      : "";
  return {
    name: entry.name,
    description: `${entry.description}${confirmationNote}`,
    inputSchema: entry.parameters,
    annotations: { readOnlyHint: entry.kind === "read" },
  };
}

export function jsonRpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

export function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0" as const,
    id: id ?? null,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

// Códigos JSON-RPC estándar + error de autenticación propio del servidor.
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;
export const RPC_UNAUTHORIZED = -32001;