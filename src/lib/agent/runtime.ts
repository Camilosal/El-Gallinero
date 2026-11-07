import { db } from "@/db";
import { aiActions, aiConversations, aiMessages } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { getAgentConfig, type AgentConfig } from "./config";
import { callLlm, type LlmMessage, type LlmToolCall } from "./llm";
import { InternalApiClient, resolveInternalBaseUrl } from "./internal-api";
import { buildSystemPrompt } from "./prompt";
import {
  getAgentTool,
  llmToolDefinitions,
  truncate,
  type AgentTool,
  type PreparedWrite,
  type ToolContext,
} from "./tools";

export class AgentNotConfiguredError extends Error {
  constructor() {
    super("El asistente no está configurado. Agrega ASSISTANT_AI_API_KEY para habilitarlo.");
    this.name = "AgentNotConfiguredError";
  }
}

export interface PendingActionView {
  id: string;
  toolName: string;
  summary: string;
  status: string;
  createdAt: Date;
}

export interface AgentTurnInput {
  userId: string;
  userName: string;
  conversationId?: string | null;
  message: string;
  cookie: string | null;
  requestOrigin?: string;
}

export interface AgentTurnResult {
  conversationId: string;
  reply: string;
  pendingActions: PendingActionView[];
}

const MAX_MESSAGE_LENGTH = 4_000;
const HISTORY_LIMIT = 40;

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function conversationTitle(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}...` : clean || "Nueva conversación";
}

type ContextInput = Pick<AgentTurnInput, "userId" | "userName" | "cookie" | "requestOrigin">;

function makeContext(input: ContextInput): ToolContext {
  const baseUrl = resolveInternalBaseUrl(input.requestOrigin);
  return {
    api: new InternalApiClient(baseUrl, input.cookie),
    userId: input.userId,
    userName: input.userName,
  };
}

async function getConversationForUser(userId: string, conversationId: string) {
  const [row] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .limit(1);
  return row || null;
}

async function getOrCreateConversation(input: AgentTurnInput): Promise<string> {
  if (input.conversationId) {
    const existing = await getConversationForUser(input.userId, input.conversationId);
    if (!existing) throw new Error("Conversación no encontrada");
    return existing.id;
  }

  const [created] = await db
    .insert(aiConversations)
    .values({ userId: input.userId, title: conversationTitle(input.message) })
    .returning();
  return created.id;
}

async function saveMessage(values: typeof aiMessages.$inferInsert) {
  const [row] = await db.insert(aiMessages).values(values).returning();
  return row;
}

async function touchConversation(conversationId: string) {
  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, conversationId));
}

function toLlmHistory(rows: (typeof aiMessages.$inferSelect)[]): LlmMessage[] {
  const messages: LlmMessage[] = [];
  for (const row of rows) {
    if (row.role === "user") {
      messages.push({ role: "user", content: row.content || "" });
    } else if (row.role === "assistant") {
      messages.push({
        role: "assistant",
        content: row.content || null,
        tool_calls: Array.isArray(row.toolCalls) ? (row.toolCalls as LlmToolCall[]) : undefined,
      });
    } else if (row.role === "tool") {
      messages.push({
        role: "tool",
        content: row.content || "",
        tool_call_id: row.toolCallId || undefined,
      });
    }
  }
  return messages;
}

function parseArguments(raw: string): Record<string, any> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    throw new Error("Los argumentos deben ser un objeto JSON");
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Argumentos inválidos para la herramienta: ${error.message}`
        : "Argumentos inválidos para la herramienta",
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

async function runPrepared(tool: AgentTool, prepared: PreparedWrite, ctx: ToolContext): Promise<unknown> {
  return tool.execute(prepared.args, ctx);
}

async function recordFailedAction(input: {
  conversationId: string;
  userId: string;
  messageId?: string | null;
  toolName: string;
  args: unknown;
  summary: string;
  error: string;
}) {
  await db.insert(aiActions).values({
    conversationId: input.conversationId,
    userId: input.userId,
    messageId: input.messageId || null,
    toolName: input.toolName,
    args: input.args as any,
    summary: input.summary,
    status: "failed",
    error: input.error,
    executedAt: new Date(),
  });
}

interface ToolCallOutcome {
  content: unknown;
  pendingAction?: PendingActionView;
}

async function handleToolCall(
  call: LlmToolCall,
  ctx: ToolContext,
  conversationId: string,
  userId: string,
  assistantMessageId: string,
): Promise<ToolCallOutcome> {
  const tool = getAgentTool(call.function.name);
  if (!tool) {
    return { content: { status: "error", error: `Herramienta desconocida: ${call.function.name}` } };
  }

  let args: Record<string, any>;
  try {
    args = parseArguments(call.function.arguments);
  } catch (error) {
    return { content: { status: "error", error: errorMessage(error) } };
  }

  if (tool.kind === "read") {
    try {
      const result = await tool.execute(args, ctx);
      return { content: { status: "ok", data: truncate(result) } };
    } catch (error) {
      return { content: { status: "error", error: errorMessage(error) } };
    }
  }

  // Escritura: primero se resuelven ids/códigos y se construye el resumen.
  let prepared: PreparedWrite;
  try {
    prepared = tool.prepare
      ? await tool.prepare(args, ctx)
      : { args, summary: `Ejecutar ${tool.name}` };
  } catch (error) {
    const message = errorMessage(error);
    await recordFailedAction({
      conversationId,
      userId,
      messageId: assistantMessageId,
      toolName: tool.name,
      args,
      summary: `No se pudo preparar ${tool.name}`,
      error: message,
    });
    return { content: { status: "error", error: message } };
  }

  if (tool.requiresConfirmation) {
    const [action] = await db
      .insert(aiActions)
      .values({
        conversationId,
        userId,
        messageId: assistantMessageId,
        toolName: tool.name,
        args: prepared.args as any,
        summary: prepared.summary,
        status: "pending",
      })
      .returning();

    return {
      content: {
        status: "pending_confirmation",
        actionId: action.id,
        summary: prepared.summary,
        instruction:
          "La acción quedó pendiente. El usuario debe confirmarla desde la tarjeta o escribiendo 'confirmo'. No la ejecutes de nuevo.",
      },
      pendingAction: {
        id: action.id,
        toolName: action.toolName,
        summary: action.summary,
        status: action.status,
        createdAt: action.createdAt,
      },
    };
  }

  try {
    const result = await runPrepared(tool, prepared, ctx);
    await db.insert(aiActions).values({
      conversationId,
      userId,
      messageId: assistantMessageId,
      toolName: tool.name,
      args: prepared.args as any,
      summary: prepared.summary,
      status: "executed",
      result: result as any,
      executedAt: new Date(),
    });
    return {
      content: {
        status: "executed",
        summary: prepared.summary,
        result: truncate(result),
      },
    };
  } catch (error) {
    const message = errorMessage(error);
    await recordFailedAction({
      conversationId,
      userId,
      messageId: assistantMessageId,
      toolName: tool.name,
      args: prepared.args,
      summary: prepared.summary,
      error: message,
    });
    return { content: { status: "error", error: message, summary: prepared.summary } };
  }
}

export async function getPendingActions(
  userId: string,
  conversationId: string,
): Promise<PendingActionView[]> {
  const rows = await db
    .select()
    .from(aiActions)
    .where(
      and(
        eq(aiActions.conversationId, conversationId),
        eq(aiActions.userId, userId),
        eq(aiActions.status, "pending"),
      ),
    )
    .orderBy(asc(aiActions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    toolName: row.toolName,
    summary: row.summary,
    status: row.status,
    createdAt: row.createdAt,
  }));
}

function normalizeIntent(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¡!¿?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAffirmative(text: string): boolean {
  const normalized = normalizeIntent(text);
  const exact = new Set([
    "si",
    "confirmo",
    "confirmar",
    "dale",
    "ok",
    "okay",
    "ejecuta",
    "adelante",
    "correcto",
    "hazlo",
    "de acuerdo",
    "si confirmo",
    "si ejecuta",
    "si dale",
    "dale confirmo",
    "confirmo la accion",
    "confirmar la accion",
    "si por favor",
  ]);
  return exact.has(normalized);
}

function isNegative(text: string): boolean {
  const normalized = normalizeIntent(text);
  return new Set([
    "no",
    "cancela",
    "cancelar",
    "olvidalo",
    "no lo hagas",
    "mejor no",
    "cancela la accion",
    "cancelar la accion",
  ]).has(normalized);
}

async function executePendingActionById(input: {
  userId: string;
  userName: string;
  actionId: string;
  cookie: string | null;
  requestOrigin?: string;
}): Promise<{ action: typeof aiActions.$inferSelect; result: unknown; message: string }> {
  const [action] = await db
    .select()
    .from(aiActions)
    .where(and(eq(aiActions.id, input.actionId), eq(aiActions.userId, input.userId)))
    .limit(1);

  if (!action) throw new Error("Acción no encontrada");
  if (action.status !== "pending") throw new Error("La acción ya fue procesada o cancelada");

  const [claimed] = await db
    .update(aiActions)
    .set({ status: "executing", executedAt: new Date() })
    .where(and(eq(aiActions.id, action.id), eq(aiActions.status, "pending")))
    .returning();

  if (!claimed) throw new Error("La acción ya fue procesada o cancelada");

  const tool = getAgentTool(action.toolName);
  if (!tool) {
    const message = `Herramienta desconocida: ${action.toolName}`;
    await db
      .update(aiActions)
      .set({ status: "failed", error: message })
      .where(eq(aiActions.id, action.id));
    throw new Error(message);
  }

  const ctx = makeContext({
    userId: input.userId,
    userName: input.userName,
    cookie: input.cookie,
    requestOrigin: input.requestOrigin,
  });

  try {
    const result = await tool.execute((action.args || {}) as Record<string, any>, ctx);
    const [updated] = await db
      .update(aiActions)
      .set({ status: "executed", result: result as any, error: null, executedAt: new Date() })
      .where(eq(aiActions.id, action.id))
      .returning();

    await saveMessage({
      conversationId: action.conversationId,
      role: "assistant",
      content: `✅ ${action.summary}`,
    });
    await touchConversation(action.conversationId);

    return {
      action: updated,
      result: truncate(result),
      message: `✅ ${action.summary}`,
    };
  } catch (error) {
    const message = errorMessage(error);
    await db
      .update(aiActions)
      .set({ status: "failed", error: message, executedAt: new Date() })
      .where(eq(aiActions.id, action.id));
    await saveMessage({
      conversationId: action.conversationId,
      role: "assistant",
      content: `❌ No se pudo ejecutar: ${action.summary}\n\n${message}`,
    });
    throw new Error(message);
  }
}

export async function confirmAction(input: {
  userId: string;
  userName: string;
  actionId: string;
  cookie: string | null;
  requestOrigin?: string;
}) {
  return executePendingActionById(input);
}

export async function cancelAction(input: { userId: string; actionId: string; reason?: string }) {
  const [action] = await db
    .select()
    .from(aiActions)
    .where(and(eq(aiActions.id, input.actionId), eq(aiActions.userId, input.userId)))
    .limit(1);

  if (!action) throw new Error("Acción no encontrada");
  if (action.status !== "pending") throw new Error("La acción ya fue procesada o cancelada");

  await db
    .update(aiActions)
    .set({ status: "cancelled", error: input.reason || null })
    .where(eq(aiActions.id, action.id));

  const message = `❌ Acción cancelada: ${action.summary}`;
  await saveMessage({
    conversationId: action.conversationId,
    role: "assistant",
    content: message,
  });
  await touchConversation(action.conversationId);
  return { message };
}

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const config = getAgentConfig();
  if (!config) throw new AgentNotConfiguredError();

  const text = cleanText(input.message);
  if (!text) throw new Error("Escribe un mensaje para el asistente");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`El mensaje es demasiado largo (máximo ${MAX_MESSAGE_LENGTH} caracteres)`);
  }

  const conversationId = await getOrCreateConversation({ ...input, message: text });

  await saveMessage({ conversationId, role: "user", content: text });
  await touchConversation(conversationId);

  const pendingBefore = await getPendingActions(input.userId, conversationId);

  // Confirmación o cancelación en lenguaje natural cuando hay una sola acción.
  if (isAffirmative(text) && pendingBefore.length === 1) {
    const execution = await executePendingActionById({
      userId: input.userId,
      userName: input.userName,
      actionId: pendingBefore[0].id,
      cookie: input.cookie,
      requestOrigin: input.requestOrigin,
    });
    return {
      conversationId,
      reply: execution.message,
      pendingActions: await getPendingActions(input.userId, conversationId),
    };
  }

  if (isAffirmative(text) && pendingBefore.length > 1) {
    const reply =
      "Hay varias acciones pendientes. Confírmalas una por una desde las tarjetas para evitar registrar algo equivocado.";
    await saveMessage({ conversationId, role: "assistant", content: reply });
    return { conversationId, reply, pendingActions: pendingBefore };
  }

  if (isNegative(text) && pendingBefore.length >= 1) {
    const cancelled = await cancelAction({ userId: input.userId, actionId: pendingBefore[pendingBefore.length - 1].id });
    return {
      conversationId,
      reply: cancelled.message,
      pendingActions: await getPendingActions(input.userId, conversationId),
    };
  }

  const historyRows = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(HISTORY_LIMIT);

  const history = toLlmHistory(historyRows.reverse());
  const systemPrompt = await buildSystemPrompt(input.userName);
  const llmMessages: LlmMessage[] = [{ role: "system", content: systemPrompt }, ...history];
  const tools = llmToolDefinitions();
  const ctx = makeContext(input);

  let reply = "";
  let lastAssistantContent = "";
  const pendingActions: PendingActionView[] = [];

  for (let iteration = 0; iteration < config.maxIterations; iteration += 1) {
    const assistant = await callLlm(llmMessages, tools, config);
    const assistantRow = await saveMessage({
      conversationId,
      role: "assistant",
      content: assistant.content || null,
      toolCalls: assistant.tool_calls && assistant.tool_calls.length > 0 ? (assistant.tool_calls as any) : null,
    });

    if (assistant.content) lastAssistantContent = assistant.content;

    llmMessages.push({
      role: "assistant",
      content: assistant.content || null,
      tool_calls: assistant.tool_calls,
    });

    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      reply = assistant.content || "";
      break;
    }

    for (const call of assistant.tool_calls) {
      const outcome = await handleToolCall(call, ctx, conversationId, input.userId, assistantRow.id);
      if (outcome.pendingAction) pendingActions.push(outcome.pendingAction);

      const content = JSON.stringify(truncate(outcome.content, 10_000));
      await saveMessage({
        conversationId,
        role: "tool",
        content,
        toolCallId: call.id,
      });
      llmMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content,
      });
    }
  }

  if (!reply) {
    reply =
      lastAssistantContent ||
      "Consulté la información, pero no pude cerrar la respuesta. Revisa las tarjetas de acción o intenta con una pregunta más específica.";
    await saveMessage({ conversationId, role: "assistant", content: reply });
  }

  await touchConversation(conversationId);

  return {
    conversationId,
    reply,
    pendingActions: await getPendingActions(input.userId, conversationId),
  };
}

export async function listConversations(userId: string) {
  const rows = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.userId, userId), eq(aiConversations.isArchived, false)))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(40);

  const result = [];
  for (const row of rows) {
    const [lastMessage] = await db
      .select({ content: aiMessages.content, role: aiMessages.role, createdAt: aiMessages.createdAt })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, row.id))
      .orderBy(desc(aiMessages.createdAt))
      .limit(1);

    const pending = await db
      .select({ count: aiActions.id })
      .from(aiActions)
      .where(and(eq(aiActions.conversationId, row.id), eq(aiActions.status, "pending")));

    result.push({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastMessage: lastMessage?.content || "",
      lastRole: lastMessage?.role || null,
      pendingCount: pending.length,
    });
  }

  return result;
}

export async function createConversation(userId: string, title?: string) {
  const [created] = await db
    .insert(aiConversations)
    .values({
      userId,
      title: cleanText(title) ? conversationTitle(cleanText(title)) : "Nueva conversación",
    })
    .returning();
  return created;
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = await getConversationForUser(userId, conversationId);
  if (!conversation) throw new Error("Conversación no encontrada");

  const messages = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt));

  const actions = await db
    .select()
    .from(aiActions)
    .where(and(eq(aiActions.conversationId, conversationId), eq(aiActions.userId, userId)))
    .orderBy(desc(aiActions.createdAt))
    .limit(50);

  return {
    conversation,
    messages: messages.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      toolCalls: row.toolCalls,
      toolCallId: row.toolCallId,
      createdAt: row.createdAt,
    })),
    pendingActions: await getPendingActions(userId, conversationId),
    actions,
  };
}

export async function deleteConversation(userId: string, conversationId: string) {
  const conversation = await getConversationForUser(userId, conversationId);
  if (!conversation) throw new Error("Conversación no encontrada");
  await db.delete(aiConversations).where(eq(aiConversations.id, conversationId));
}

export function agentStatus(config: AgentConfig | null) {
  return {
    configured: Boolean(config),
    model: config?.model || null,
    baseUrl: config?.baseUrl || null,
  };
}
