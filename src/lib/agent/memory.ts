import { db } from "@/db";
import { agentMemories, aiConversations, aiMessages } from "@/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { AgentConfig } from "./config";
import { normalizeSearchText, tokenizeQuery } from "./knowledge";

export const MEMORY_CATEGORIES = [
  "preferencia",
  "protocolo",
  "proveedor",
  "comprador",
  "instalacion",
  "lote",
  "restriccion",
  "hecho",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface FarmMemoryRecord {
  id: string;
  userId: string;
  category: string;
  subjectKey: string;
  content: string;
  entities: string[];
  importance: number;
  sourceConversationId: string | null;
  accessCount: number;
  lastAccessedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveMemoryInput {
  userId: string;
  category?: string;
  subjectKey: string;
  content: string;
  entities?: string[];
  importance?: number;
  sourceConversationId?: string | null;
}

export function normalizeMemoryCategory(value: unknown): MemoryCategory {
  const norm = normalizeSearchText(value);
  if ((MEMORY_CATEGORIES as readonly string[]).includes(norm)) {
    return norm as MemoryCategory;
  }
  if (/(prefer|estilo|formato|gust)/.test(norm)) return "preferencia";
  if (/(regla|protocolo|manejo|rutina|norma)/.test(norm)) return "protocolo";
  if (/(proveed|insumo|concentrado|bulto)/.test(norm)) return "proveedor";
  if (/(comprad|cliente|venta)/.test(norm)) return "comprador";
  if (/(galpon|corral|jaula|bodega|lugar|potrero)/.test(norm)) return "instalacion";
  if (/(lote|parvada|gallina|gallo|cuy|conejo|pato|codorniz)/.test(norm)) return "lote";
  if (/(restring|prohib|bloque|retiro|alerta)/.test(norm)) return "restriccion";
  return "hecho";
}

export function normalizeSubjectKey(value: unknown): string {
  const norm = normalizeSearchText(value)
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (norm || "dato_general").slice(0, 130);
}

const SPECIES_TERMS = ["gallina", "gallo", "pollo", "codorniz", "pato", "conejo", "cuy"];

export function extractFarmEntities(text: string): string[] {
  const found = new Set<string>();
  const norm = normalizeSearchText(text);

  for (const sp of SPECIES_TERMS) {
    if (norm.includes(sp)) found.add(sp);
  }

  const codeMatches = text.match(/\b(?:LOC|LT|GAL|G|C|P|COMP|ICA)[-\s]?\d{1,5}[A-Z]?\b/gi) || [];
  for (const code of codeMatches) {
    found.add(code.toUpperCase().replace(/\s+/g, "-"));
  }

  const locationMatches = text.match(/\b(?:galpon|corral|jaula|potrero|bodega|cuarentena)\s+[a-z0-9-]{1,16}\b/gi) || [];
  for (const loc of locationMatches) {
    found.add(normalizeSearchText(loc));
  }

  return Array.from(found).slice(0, 12);
}

export function scoreMemoryRelevance(
  memory: Pick<FarmMemoryRecord, "category" | "subjectKey" | "content" | "entities" | "importance" | "accessCount" | "updatedAt">,
  query: string,
  nowMs = Date.now(),
): number {
  const queryNorm = normalizeSearchText(query);
  const queryTokens = tokenizeQuery(query);
  const queryEntities = extractFarmEntities(query).map((e) => normalizeSearchText(e));

  const memText = normalizeSearchText(`${memory.category} ${memory.subjectKey} ${memory.content}`);
  const memEntities = (memory.entities || []).map((e) => normalizeSearchText(e));

  let score = Math.max(1, Math.min(5, memory.importance)) * 3;

  if (queryNorm.length >= 4 && memText.includes(queryNorm)) {
    score += 18;
  }

  for (const token of queryTokens) {
    if (memText.includes(token)) score += 5;
  }

  for (const entity of queryEntities) {
    if (memEntities.some((m) => m === entity || m.includes(entity) || entity.includes(m)) || memText.includes(entity)) {
      score += 10;
    }
  }

  if (memory.category === "preferencia" || memory.category === "restriccion") {
    score += 4;
  }

  const ageDays = Math.max(0, (nowMs - new Date(memory.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  score += Math.max(0, 4 - ageDays * 0.08);
  score += Math.min(3, Math.log1p(memory.accessCount || 0));

  return Number(score.toFixed(2));
}

export async function saveFarmMemory(input: SaveMemoryInput): Promise<FarmMemoryRecord> {
  const category = normalizeMemoryCategory(input.category);
  const subjectKey = normalizeSubjectKey(input.subjectKey);
  const content = String(input.content || "").trim().slice(0, 1500);
  if (!content) throw new Error("El contenido de la memoria no puede estar vacío.");

  const mergedEntities = Array.from(
    new Set([...(input.entities || []), ...extractFarmEntities(content)].map((e) => String(e).trim()).filter(Boolean)),
  ).slice(0, 15);
  const importance = Math.min(5, Math.max(1, Math.round(Number(input.importance) || 3)));
  const now = new Date();

  const [row] = await db
    .insert(agentMemories)
    .values({
      userId: input.userId,
      category,
      subjectKey,
      content,
      entities: mergedEntities,
      importance,
      sourceConversationId: input.sourceConversationId || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [agentMemories.userId, agentMemories.category, agentMemories.subjectKey],
      set: {
        content,
        entities: mergedEntities,
        importance,
        sourceConversationId: input.sourceConversationId || null,
        isActive: true,
        updatedAt: now,
      },
    })
    .returning();

  return row as FarmMemoryRecord;
}

export async function listFarmMemories(userId: string, category?: string, limit = 60): Promise<FarmMemoryRecord[]> {
  const conditions = [eq(agentMemories.userId, userId), eq(agentMemories.isActive, true)];
  if (category) {
    conditions.push(eq(agentMemories.category, normalizeMemoryCategory(category)));
  }
  const rows = await db
    .select()
    .from(agentMemories)
    .where(and(...conditions))
    .orderBy(desc(agentMemories.importance), desc(agentMemories.updatedAt))
    .limit(Math.min(200, Math.max(1, limit)));
  return rows as FarmMemoryRecord[];
}

export async function deleteFarmMemory(userId: string, memoryId: string): Promise<boolean> {
  const [updated] = await db
    .update(agentMemories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(agentMemories.id, memoryId), eq(agentMemories.userId, userId)))
    .returning({ id: agentMemories.id });
  return Boolean(updated);
}

export async function recallRelevantMemories(
  userId: string,
  query: string,
  limit = 6,
): Promise<FarmMemoryRecord[]> {
  try {
    const candidates = await listFarmMemories(userId, undefined, 120);
    if (candidates.length === 0) return [];

    const ranked = candidates
      .map((memory) => ({ memory, score: scoreMemoryRelevance(memory, query) }))
      .sort((a, b) => b.score - a.score);

    const pinnedHigh = candidates.filter((m) => m.importance >= 5).slice(0, 2);
    const chosenMap = new Map<string, FarmMemoryRecord>();
    for (const item of pinnedHigh) chosenMap.set(item.id, item);

    for (const item of ranked) {
      if (chosenMap.size >= limit) break;
      if (item.score >= 12 || chosenMap.size < 3) {
        chosenMap.set(item.memory.id, item.memory);
      }
    }

    const chosen = Array.from(chosenMap.values()).slice(0, limit);
    if (chosen.length > 0) {
      const ids = chosen.map((c) => c.id);
      await db
        .update(agentMemories)
        .set({
          accessCount: sql`${agentMemories.accessCount} + 1`,
          lastAccessedAt: new Date(),
        })
        .where(inArray(agentMemories.id, ids))
        .catch(() => undefined);
    }
    return chosen;
  } catch {
    return [];
  }
}

export function extractDurableMemoriesFromUserText(text: string): Array<Omit<SaveMemoryInput, "userId" | "sourceConversationId">> {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length < 14 || clean.length > 900) return [];

  const norm = normalizeSearchText(clean);
  const results: Array<Omit<SaveMemoryInput, "userId" | "sourceConversationId">> = [];

  const explicitTriggers = [
    /\brecuerda(?:\s+que|\s+siempre)?\s+(.+)/i,
    /\bten\s+en\s+cuenta\s+(?:que\s+)?(.+)/i,
    /\bno\s+olvides\s+(?:que\s+)?(.+)/i,
    /\bguarda\s+(?:en\s+tu\s+memoria|esto)\s*:?\s*(.+)/i,
  ];
  for (const rx of explicitTriggers) {
    const m = clean.match(rx);
    if (m?.[1] && m[1].trim().length >= 8) {
      const fact = m[1].trim().slice(0, 320);
      results.push({
        category: normalizeMemoryCategory(fact),
        subjectKey: normalizeSubjectKey(fact.split(/\s+/).slice(0, 6).join("_")),
        content: fact,
        importance: 5,
      });
      return results;
    }
  }

  if (/\b(siempre prefiero|prefiero que|siempre dime|siempre registra|mi proveedor principal|nuestro proveedor|nuestro comprador)\b/.test(norm)) {
    const cat = /proveedor/.test(norm)
      ? "proveedor"
      : /comprador|cliente/.test(norm)
        ? "comprador"
        : "preferencia";
    results.push({
      category: cat,
      subjectKey: normalizeSubjectKey(`${cat}_${clean.split(/\s+/).slice(0, 5).join("_")}`),
      content: clean.slice(0, 320),
      importance: 4,
    });
  } else if (/\b(por regla|protocolo interno|politica de la granja|en esta granja siempre|nunca vender|nunca mover)\b/.test(norm)) {
    results.push({
      category: /nunca/.test(norm) ? "restriccion" : "protocolo",
      subjectKey: normalizeSubjectKey(`regla_${clean.split(/\s+/).slice(0, 5).join("_")}`),
      content: clean.slice(0, 320),
      importance: 5,
    });
  }

  return results;
}

export async function distillMemoriesFromTurn(params: {
  userId: string;
  conversationId: string;
  userMessage: string;
}): Promise<number> {
  const candidates = extractDurableMemoriesFromUserText(params.userMessage);
  if (candidates.length === 0) return 0;
  let saved = 0;
  for (const item of candidates) {
    try {
      await saveFarmMemory({
        userId: params.userId,
        sourceConversationId: params.conversationId,
        ...item,
      });
      saved += 1;
    } catch {
      // No romper el turno principal por falla de memoria
    }
  }
  return saved;
}

export const COMPACTION_TRIGGER_COUNT = 26;
export const COMPACTION_KEEP_RECENT = 14;

export function buildDeterministicConversationSummary(
  previousSummary: string | null | undefined,
  rows: Array<{ role: string; content: string | null }>,
): string {
  const snippets: string[] = [];
  if (previousSummary && previousSummary.trim()) {
    snippets.push(previousSummary.trim());
  }
  for (const row of rows) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    const text = String(row.content || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const prefix = row.role === "user" ? "Usuario" : "Asistente";
    snippets.push(`${prefix}: ${text.slice(0, 180)}`);
  }
  return snippets.slice(-12).join("\n").slice(0, 2000);
}

async function summarizeWithLlm(
  previousSummary: string | null | undefined,
  rows: Array<{ role: string; content: string | null }>,
  config: AgentConfig,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(8_000, config.timeoutMs));
  try {
    const transcript = rows
      .filter((r) => (r.role === "user" || r.role === "assistant") && r.content)
      .map((r) => `${r.role === "user" ? "Usuario" : "Asistente"}: ${String(r.content).slice(0, 400)}`)
      .join("\n");

    if (!transcript.trim()) return null;

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        max_tokens: 320,
        messages: [
          {
            role: "system",
            content:
              "Resume brevemente en viñetas en español los hechos operativos clave (fechas, códigos de aves/lotes/galpones, montos, pendientes o acuerdos) de esta conversación agrícola para preservar continuidad de memoria. Máximo 900 caracteres.",
          },
          {
            role: "user",
            content: `${previousSummary ? `Resumen previo:\n${previousSummary}\n\n` : ""}Nuevos mensajes a compactar:\n${transcript}`,
          },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as any;
    const text = payload?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim().slice(0, 1800) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function maybeCompactConversationSummary(
  conversationId: string,
  config?: AgentConfig | null,
): Promise<string | null> {
  try {
    const [conv] = await db
      .select({
        id: aiConversations.id,
        summary: aiConversations.summary,
        summaryMessageCount: aiConversations.summaryMessageCount,
      })
      .from(aiConversations)
      .where(eq(aiConversations.id, conversationId))
      .limit(1);
    if (!conv) return null;

    const allRows = await db
      .select({
        id: aiMessages.id,
        role: aiMessages.role,
        content: aiMessages.content,
      })
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(asc(aiMessages.createdAt));

    if (allRows.length < COMPACTION_TRIGGER_COUNT) {
      return conv.summary || null;
    }

    const cutoffIndex = allRows.length - COMPACTION_KEEP_RECENT;
    if (cutoffIndex <= (conv.summaryMessageCount || 0)) {
      return conv.summary || null;
    }

    const sliceToCompact = allRows.slice(conv.summaryMessageCount || 0, cutoffIndex);
    const llmSummary = config ? await summarizeWithLlm(conv.summary, sliceToCompact, config) : null;
    const nextSummary = llmSummary || buildDeterministicConversationSummary(conv.summary, sliceToCompact);

    await db
      .update(aiConversations)
      .set({
        summary: nextSummary,
        summaryMessageCount: cutoffIndex,
        summaryUpdatedAt: new Date(),
      })
      .where(eq(aiConversations.id, conversationId));

    return nextSummary;
  } catch {
    return null;
  }
}
