import { NextRequest, NextResponse } from "next/server";
import { GET as agentToolsGet } from "@/app/api/v1/agent/tools/route";
import { POST as agentToolPost } from "@/app/api/v1/agent/tools/[name]/route";
import { readExportTokenFromRequest } from "@/lib/export/auth";
import {
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  RPC_INVALID_PARAMS,
  RPC_INVALID_REQUEST,
  RPC_METHOD_NOT_FOUND,
  RPC_PARSE_ERROR,
  RPC_UNAUTHORIZED,
  jsonRpcError,
  jsonRpcResult,
  manifestEntryToMcpTool,
  type AgentToolsManifestEntry,
  type JsonRpcRequest,
} from "@/lib/agent/mcp";

export const dynamic = "force-dynamic";

const MCP_INSTRUCTIONS =
  "Servidor MCP de IwaGranja: consulta y registra datos de la granja del token. " +
  "Las escrituras sensibles (ventas, gastos, cierres, pagos, etc.) devuelven una acción pendiente con actionId; " +
  "confírmala con POST /api/asistente/acciones/{actionId}/confirmar usando el mismo token, o pide al usuario que la confirme en la app. " +
  "Nunca reintentes una escritura pendiente como si fuera un error.";

function rpcResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

/** Reenvía la autenticación de integración a la API v1 (una sola puerta). */
function authHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authorization = req.headers.get("authorization");
  if (authorization) headers.authorization = authorization;
  const exportToken = req.headers.get("x-export-token");
  if (exportToken) headers["x-export-token"] = exportToken;
  return headers;
}

/**
 * POST /api/mcp — Streamable HTTP (JSON-RPC 2.0) con el subconjunto MCP mínimo:
 * initialize, notifications/initialized, ping, tools/list y tools/call.
 * Auth: Authorization: Bearer <token de integración> (scopes agent:read/agent:write).
 * tools/list y tools/call delegan en la API v1 de D1: mismos candados, RBAC/RLS,
 * piso duro, rate limit y auditoría. Sin token válido no hay lista ni escrituras.
 */
export async function POST(req: NextRequest) {
  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return rpcResponse(jsonRpcError(null, RPC_PARSE_ERROR, "JSON inválido"));
  }
  if (!body || typeof body !== "object" || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcResponse(jsonRpcError(body?.id ?? null, RPC_INVALID_REQUEST, "Solicitud JSON-RPC 2.0 inválida"));
  }

  const id = body.id ?? null;
  const method = body.method;
  const params = (body.params || {}) as Record<string, unknown>;
  const origin = req.nextUrl.origin;

  try {
    if (method === "initialize") {
      return rpcResponse(
        jsonRpcResult(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
          instructions: MCP_INSTRUCTIONS,
        }),
      );
    }

    // Notificación del cliente: sin respuesta JSON-RPC.
    if (method === "notifications/initialized" || method === "notifications/cancelled") {
      return new NextResponse(null, { status: 202 });
    }

    if (method === "ping") {
      return rpcResponse(jsonRpcResult(id, {}));
    }

    if (method === "tools/list") {
      if (!readExportTokenFromRequest(req)) {
        return rpcResponse(
          jsonRpcError(id, RPC_UNAUTHORIZED, "Falta el token de integración (Authorization: Bearer glli_exp_...)"),
          401,
        );
      }
      const manifestRes = await agentToolsGet(
        new NextRequest(`${origin}/api/v1/agent/tools`, { headers: authHeaders(req) }),
      );
      const manifest = await manifestRes.json();
      if (!manifestRes.ok) {
        return rpcResponse(
          jsonRpcError(id, RPC_UNAUTHORIZED, manifest.error || "Token de integración inválido"),
          manifestRes.status,
        );
      }
      const tools = ((manifest.tools || []) as AgentToolsManifestEntry[]).map(manifestEntryToMcpTool);
      return rpcResponse(jsonRpcResult(id, { tools }));
    }

    if (method === "tools/call") {
      const name = typeof params.name === "string" ? params.name : "";
      const args = params.arguments;
      if (!name || !args || typeof args !== "object" || Array.isArray(args)) {
        return rpcResponse(
          jsonRpcError(id, RPC_INVALID_PARAMS, "tools/call requiere { name, arguments: objeto }"),
        );
      }
      if (!readExportTokenFromRequest(req)) {
        return rpcResponse(
          jsonRpcError(id, RPC_UNAUTHORIZED, "Sin escritura anónima: envía Authorization: Bearer con un token agent:write"),
          401,
        );
      }
      const execRes = await agentToolPost(
        new NextRequest(`${origin}/api/v1/agent/tools/${encodeURIComponent(name)}`, {
          method: "POST",
          headers: authHeaders(req),
          body: JSON.stringify({ args }),
        }),
        { params: Promise.resolve({ name }) },
      );
      const execBody = await execRes.json();
      if (execRes.status === 401 || execRes.status === 403 || execRes.status === 404 || execRes.status === 429) {
        return rpcResponse(
          jsonRpcError(id, RPC_UNAUTHORIZED, execBody.error || "No autorizado", { httpStatus: execRes.status }),
          execRes.status,
        );
      }
      // Errores de ejecución de herramienta van como resultado MCP con isError.
      const isError = execRes.status >= 400 || execBody.status === "error";
      return rpcResponse(
        jsonRpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(execBody) }],
          isError,
        }),
      );
    }

    return rpcResponse(jsonRpcError(id, RPC_METHOD_NOT_FOUND, `Método no soportado: ${method}`));
  } catch (error) {
    console.error("MCP error:", error);
    return rpcResponse(
      jsonRpcError(id, -32603, error instanceof Error ? error.message : "Error interno del servidor MCP"),
    );
  }
}

/** Streamable HTTP: este servidor no abre streams SSE del servidor al cliente. */
export async function GET() {
  return NextResponse.json(
    { error: "Usa POST con JSON-RPC 2.0 (initialize, tools/list, tools/call)." },
    { status: 405, headers: { Allow: "POST" } },
  );
}