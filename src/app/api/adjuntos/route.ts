import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { ATTACHMENT_ENTITY_TYPES } from "@/lib/attachments-shared";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DATA_URL_LENGTH = 2_400_000; // ~1.7 MB en base64

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  const entityType = searchParams.get("entityType")?.trim();
  const entityId = searchParams.get("entityId")?.trim();
  const entityIdsParam = searchParams.get("entityIds")?.trim();
  const category = searchParams.get("category")?.trim();
  const metaOnly = searchParams.get("metaOnly") === "1";

  const conditions = [];
  if (id && UUID_REGEX.test(id)) {
    conditions.push(eq(attachments.id, id));
  }
  if (entityType) {
    conditions.push(eq(attachments.entityType, entityType));
  }
  if (entityId) {
    conditions.push(eq(attachments.entityId, entityId));
  } else if (entityIdsParam) {
    const ids = entityIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (ids.length > 0) {
      conditions.push(inArray(attachments.entityId, ids));
    }
  }
  if (category) {
    conditions.push(eq(attachments.category, category));
  }

  const whereClause =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  if (metaOnly) {
    const rows = await db
      .select({
        id: attachments.id,
        entityType: attachments.entityType,
        entityId: attachments.entityId,
        category: attachments.category,
        fileName: attachments.fileName,
        mimeType: attachments.mimeType,
        sizeBytes: attachments.sizeBytes,
        extractedText: attachments.extractedText,
        extractedData: attachments.extractedData,
        notes: attachments.notes,
        createdAt: attachments.createdAt,
      })
      .from(attachments)
      .where(whereClause)
      .orderBy(desc(attachments.createdAt))
      .limit(250);

    return NextResponse.json(rows);
  }

  const rows = await db
    .select()
    .from(attachments)
    .where(whereClause)
    .orderBy(desc(attachments.createdAt))
    .limit(100);

  return NextResponse.json(rows);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const entityType = typeof body.entityType === "string" ? body.entityType.trim() : "";
  const entityId = typeof body.entityId === "string" ? body.entityId.trim() : "";
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : "general";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 255) : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim().slice(0, 100) : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl.trim() : "";
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  const extractedText = typeof body.extractedText === "string" && body.extractedText.trim() ? body.extractedText.trim() : null;
  const extractedData =
    body.extractedData && typeof body.extractedData === "object" && !Array.isArray(body.extractedData)
      ? (body.extractedData as Record<string, unknown>)
      : null;

  if (!entityType || !(ATTACHMENT_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return NextResponse.json({ error: "Tipo de entidad (entityType) inválido." }, { status: 400 });
  }
  if (!entityId) {
    return NextResponse.json({ error: "Identificador de entidad (entityId) requerido." }, { status: 400 });
  }
  if (!fileName || !mimeType || !dataUrl) {
    return NextResponse.json({ error: "Nombre de archivo, tipo MIME y contenido (dataUrl) son obligatorios." }, { status: 400 });
  }
  if (!dataUrl.startsWith("data:image/") && !dataUrl.startsWith("data:application/pdf")) {
    return NextResponse.json({ error: "Solo se permiten imágenes comprimidas o archivos PDF en formato dataURL." }, { status: 400 });
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "El adjunto excede el tamaño máximo permitido (1.5 MB)." }, { status: 413 });
  }

  const estimatedBytes = Math.round(((dataUrl.split(",")[1] || "").length * 3) / 4);
  const sizeBytes = Number.isFinite(Number(body.sizeBytes)) && Number(body.sizeBytes) > 0
    ? Math.round(Number(body.sizeBytes))
    : estimatedBytes;

  const customId = typeof body.id === "string" && UUID_REGEX.test(body.id.trim()) ? body.id.trim() : undefined;

  if (customId) {
    const [existing] = await db.select().from(attachments).where(eq(attachments.id, customId)).limit(1);
    if (existing) {
      const [updated] = await db
        .update(attachments)
        .set({
          entityType,
          entityId,
          category,
          fileName,
          mimeType,
          sizeBytes,
          dataUrl,
          extractedText: extractedText ?? existing.extractedText,
          extractedData: extractedData ?? existing.extractedData,
          notes: notes ?? existing.notes,
        })
        .where(eq(attachments.id, customId))
        .returning();
      return NextResponse.json(updated, { status: 200 });
    }
  }

  const [created] = await db
    .insert(attachments)
    .values({
      ...(customId ? { id: customId } : {}),
      entityType,
      entityId,
      category,
      fileName,
      mimeType,
      sizeBytes,
      dataUrl,
      extractedText,
      extractedData,
      notes,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  // Modo 1: Re-vincular adjuntos creados en borrador (draft_<uuid>) al ID definitivo del registro guardado
  if (typeof body.draftEntityId === "string" && typeof body.finalEntityId === "string") {
    const draftEntityId = body.draftEntityId.trim();
    const finalEntityId = body.finalEntityId.trim();
    const entityType = typeof body.entityType === "string" ? body.entityType.trim() : "";

    if (!draftEntityId || !finalEntityId) {
      return NextResponse.json({ error: "draftEntityId y finalEntityId son requeridos." }, { status: 400 });
    }

    const whereCond = entityType
      ? and(eq(attachments.entityId, draftEntityId), eq(attachments.entityType, entityType))
      : eq(attachments.entityId, draftEntityId);

    const updatedRows = await db
      .update(attachments)
      .set({ entityId: finalEntityId })
      .where(whereCond)
      .returning({ id: attachments.id, entityId: attachments.entityId });

    return NextResponse.json({
      ok: true,
      reboundCount: updatedRows.length,
      items: updatedRows,
    });
  }

  // Modo 2: Actualizar metadatos o notas de un adjunto individual
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "ID de adjunto válido requerido." }, { status: 400 });
  }

  const [existing] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Adjunto no encontrado." }, { status: 404 });
  }

  const [updated] = await db
    .update(attachments)
    .set({
      entityId: typeof body.entityId === "string" && body.entityId.trim() ? body.entityId.trim() : existing.entityId,
      category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : existing.category,
      notes: body.notes !== undefined ? (typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null) : existing.notes,
      extractedText:
        body.extractedText !== undefined
          ? typeof body.extractedText === "string" && body.extractedText.trim()
            ? body.extractedText.trim()
            : null
          : existing.extractedText,
      extractedData:
        body.extractedData !== undefined && typeof body.extractedData === "object"
          ? (body.extractedData as Record<string, unknown>)
          : existing.extractedData,
    })
    .where(eq(attachments.id, id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim() || "";
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "ID de adjunto válido requerido." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(attachments)
    .where(eq(attachments.id, id))
    .returning({ id: attachments.id });

  if (!deleted) {
    return NextResponse.json({ error: "Adjunto no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: deleted.id });
});

