import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, farms, users } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import {
  buildBugTags,
  resolveBugOriginInfo,
  type BugCapturedError,
  type BugEnvironmentContext,
  type BugReportCategory,
  type BugReportRecord,
  type BugReportSeverity,
  type BugReportStatus,
  type BugTriggerSource,
} from "@/lib/bug-report";
import { notifyBugReport } from "@/lib/notifications";
import { requirePermission } from "@/lib/rbac-server";
import { getSettings } from "@/lib/settings";
import { matchesTextQuery } from "@/lib/text";

export const dynamic = "force-dynamic";

const SUPPORT_BUG_PREFIX = "support.bug.%";

const VALID_CATEGORIES = new Set<BugReportCategory>([
  "ui",
  "calculo",
  "guardado",
  "acceso",
  "norma_dato",
  "mejora",
]);

const VALID_SEVERITIES = new Set<BugReportSeverity>([
  "baja",
  "media",
  "alta",
  "critica",
]);

const VALID_STATUSES = new Set<BugReportStatus>([
  "abierto",
  "en_revision",
  "resuelto",
  "descartado",
]);

const VALID_TRIGGERS = new Set<BugTriggerSource>([
  "topbar",
  "sidebar",
  "footer",
  "nudge",
  "pagina",
  "error_boundary",
  "manual",
]);

function buildReportCode(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `FAIL-${y}${m}${d}-${suffix}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveSafeUserFk(userId?: string | null): Promise<string | null> {
  if (!userId || !UUID_RE.test(userId)) return null;
  try {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.id ?? null;
  } catch {
    return null;
  }
}

function parseReportRow(row: {
  id: string;
  key: string;
  value: string;
  updatedAt: Date;
}): BugReportRecord | null {
  try {
    const parsed = JSON.parse(row.value) as Partial<BugReportRecord>;
    if (!parsed || typeof parsed !== "object" || !parsed.reportCode || !parsed.title) {
      return null;
    }
    return {
      ...parsed,
      id: parsed.id || row.id,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      capturedErrors: Array.isArray(parsed.capturedErrors) ? parsed.capturedErrors : [],
      status: VALID_STATUSES.has(parsed.status as BugReportStatus)
        ? (parsed.status as BugReportStatus)
        : "abierto",
    } as BugReportRecord;
  } catch {
    return null;
  }
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const rows = await db
    .select({
      id: appSettings.id,
      key: appSettings.key,
      value: appSettings.value,
      updatedAt: appSettings.updatedAt,
    })
    .from(appSettings)
    .where(like(appSettings.key, SUPPORT_BUG_PREFIX))
    .orderBy(desc(appSettings.updatedAt))
    .limit(200);

  const allReports = rows
    .map(parseReportRow)
    .filter((r): r is BugReportRecord => Boolean(r))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const searchParams = req.nextUrl?.searchParams ?? new URL(req.url).searchParams;
  const statusFilter = (searchParams.get("status") || "").trim().toLowerCase();
  const severityFilter = (searchParams.get("severity") || "").trim().toLowerCase();
  const tagFilter = (searchParams.get("tag") || "").trim().toLowerCase();
  const q = (searchParams.get("q") || "").trim();

  const filtered = allReports.filter((item) => {
    if (statusFilter && statusFilter !== "todos" && item.status !== statusFilter) return false;
    if (severityFilter && severityFilter !== "todas" && item.severity !== severityFilter) return false;
    if (tagFilter && !item.tags.some((tag) => tag.toLowerCase().includes(tagFilter))) return false;
    if (
      q &&
      !matchesTextQuery(q, [
        item.reportCode,
        item.title,
        item.description,
        item.originModule,
        item.originGroup,
        item.originPath,
        item.reporterUsername,
        ...item.tags,
      ])
    ) {
      return false;
    }
    return true;
  });

  const tagCounts: Record<string, number> = {};
  const groupCounts: Record<string, number> = {};
  for (const rep of allReports) {
    groupCounts[rep.originGroup] = (groupCounts[rep.originGroup] ?? 0) + 1;
    for (const tag of rep.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    reports: filtered,
    summary: {
      total: allReports.length,
      abiertos: allReports.filter((r) => r.status === "abierto").length,
      enRevision: allReports.filter((r) => r.status === "en_revision").length,
      resueltos: allReports.filter((r) => r.status === "resuelto").length,
      byGroup: groupCounts,
      topTags: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([tag, count]) => ({ tag, count })),
    },
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const rawCategory = String(body.category || "ui").trim().toLowerCase() as BugReportCategory;
  const category: BugReportCategory = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "ui";

  const rawSeverity = String(body.severity || "media").trim().toLowerCase() as BugReportSeverity;
  const severity: BugReportSeverity = VALID_SEVERITIES.has(rawSeverity) ? rawSeverity : "media";

  const rawTrigger = String(body.triggerSource || "topbar").trim().toLowerCase() as BugTriggerSource;
  const triggerSource: BugTriggerSource = VALID_TRIGGERS.has(rawTrigger) ? rawTrigger : "topbar";

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 4000) : "";
  const stepsToReproduce =
    typeof body.stepsToReproduce === "string" ? body.stepsToReproduce.trim().slice(0, 2000) : "";
  const expectedBehavior =
    typeof body.expectedBehavior === "string" ? body.expectedBehavior.trim().slice(0, 1500) : "";

  if (title.length < 4) {
    return NextResponse.json(
      { error: "Escribe un título breve de la falla (mínimo 4 caracteres)." },
      { status: 400 },
    );
  }
  if (description.length < 10) {
    return NextResponse.json(
      { error: "Describe qué pasó con al menos 10 caracteres." },
      { status: 400 },
    );
  }

  const rawPath = typeof body.originPath === "string" ? body.originPath.trim().slice(0, 200) : "/dashboard";
  const rawQuery = typeof body.originQuery === "string" ? body.originQuery.trim().slice(0, 300) : "";
  const resolvedOrigin = resolveBugOriginInfo(rawPath, rawQuery, triggerSource);

  const sessionUser = await getSessionUser();
  const farmId = sessionUser?.farmId || getCurrentFarmId();

  let farmName = "Granja principal";
  try {
    const [farmRow] = await db
      .select({ name: farms.name })
      .from(farms)
      .where(eq(farms.id, farmId))
      .limit(1);
    if (farmRow?.name) {
      farmName = farmRow.name;
    } else {
      const settings = await getSettings();
      if (settings["farm.name"]) farmName = settings["farm.name"];
    }
  } catch {
    // Keep fallback farmName
  }

  const rawEnv = (body.environment && typeof body.environment === "object"
    ? body.environment
    : {}) as Partial<BugEnvironmentContext>;
  const environment: BugEnvironmentContext = {
    online: typeof rawEnv.online === "boolean" ? rawEnv.online : true,
    deviceType: rawEnv.deviceType === "movil" ? "movil" : "escritorio",
    viewport: typeof rawEnv.viewport === "string" ? rawEnv.viewport.slice(0, 40) : undefined,
    userAgent:
      typeof rawEnv.userAgent === "string"
        ? rawEnv.userAgent.slice(0, 180)
        : req.headers.get("user-agent")?.slice(0, 180) || undefined,
    language: typeof rawEnv.language === "string" ? rawEnv.language.slice(0, 24) : "es-CO",
    standalonePwa: Boolean(rawEnv.standalonePwa),
  };

  const capturedErrors: BugCapturedError[] = Array.isArray(body.capturedErrors)
    ? body.capturedErrors
        .slice(-10)
        .filter((e: unknown): e is BugCapturedError => Boolean(e && typeof e === "object" && "message" in e))
        .map((e: BugCapturedError) => ({
          kind: e.kind === "promise" || e.kind === "network" ? e.kind : "runtime",
          message: String(e.message || "").slice(0, 400),
          source: e.source ? String(e.source).slice(0, 180) : undefined,
          occurredAt: typeof e.occurredAt === "string" ? e.occurredAt : new Date().toISOString(),
        }))
    : [];

  const computedTags = buildBugTags({
    originPath: resolvedOrigin.originPath,
    originModule: resolvedOrigin.originModule,
    originGroup: resolvedOrigin.originGroup,
    triggerSource,
    category,
    severity,
    online: environment.online,
    deviceType: environment.deviceType,
    reporterRole: sessionUser?.role || "USUARIO",
    farmName,
  });

  const extraTags = Array.isArray(body.customTags)
    ? body.customTags
        .slice(0, 5)
        .map((t: unknown) => String(t || "").trim().toLowerCase().slice(0, 40))
        .filter((t: string) => t.length >= 2)
    : [];

  const tags = Array.from(new Set([...computedTags, ...extraTags]));

  const now = new Date();
  const reportCode = buildReportCode(now);
  const recordId = crypto.randomUUID();
  const record: BugReportRecord = {
    id: recordId,
    reportCode,
    status: "abierto",
    category,
    severity,
    title,
    description,
    ...(stepsToReproduce ? { stepsToReproduce } : {}),
    ...(expectedBehavior ? { expectedBehavior } : {}),
    originPath: resolvedOrigin.originPath,
    originQuery: resolvedOrigin.originQuery,
    originFullUrl: resolvedOrigin.originFullUrl,
    originModule: resolvedOrigin.originModule,
    originGroup: resolvedOrigin.originGroup,
    triggerSource,
    tags,
    farmId,
    farmName,
    reporterId: sessionUser?.id ?? null,
    reporterUsername: sessionUser?.username ?? "anonimo",
    reporterName: sessionUser?.name ?? "Usuario de granja",
    reporterRole: sessionUser?.role ?? "USUARIO",
    environment,
    capturedErrors,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const settingKey = `support.bug.${now.getTime()}_${crypto.randomBytes(3).toString("hex")}`;
  const updatedBy = await resolveSafeUserFk(sessionUser?.id);
  await db.insert(appSettings).values({
    farmId,
    key: settingKey,
    value: JSON.stringify(record),
    updatedBy,
  });

  await notifyBugReport(record);

  return NextResponse.json(
    {
      ok: true,
      report: record,
    },
    { status: 201 },
  );
});

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const targetCode = typeof body.reportCode === "string" ? body.reportCode.trim() : "";
  const targetId = typeof body.id === "string" ? body.id.trim() : "";
  const nextStatus = String(body.status || "").trim().toLowerCase() as BugReportStatus;
  const resolutionNote =
    typeof body.resolutionNote === "string" ? body.resolutionNote.trim().slice(0, 1000) : undefined;

  if (!targetCode && !targetId) {
    return NextResponse.json({ error: "Indica reportCode o id del reporte" }, { status: 400 });
  }
  if (!VALID_STATUSES.has(nextStatus)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: appSettings.id,
      key: appSettings.key,
      value: appSettings.value,
      updatedAt: appSettings.updatedAt,
    })
    .from(appSettings)
    .where(like(appSettings.key, SUPPORT_BUG_PREFIX));

  for (const row of rows) {
    const parsed = parseReportRow(row);
    if (!parsed) continue;
    if ((targetCode && parsed.reportCode === targetCode) || (targetId && parsed.id === targetId)) {
      const updated: BugReportRecord = {
        ...parsed,
        status: nextStatus,
        ...(resolutionNote !== undefined ? { resolutionNote } : {}),
        updatedAt: new Date().toISOString(),
      };
      const user = await getSessionUser();
      const updatedBy = await resolveSafeUserFk(user?.id);
      await db
        .update(appSettings)
        .set({
          value: JSON.stringify(updated),
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(appSettings.id, row.id));

      return NextResponse.json({ ok: true, report: updated });
    }
  }

  return NextResponse.json({ error: "Reporte de falla no encontrado" }, { status: 404 });
});
