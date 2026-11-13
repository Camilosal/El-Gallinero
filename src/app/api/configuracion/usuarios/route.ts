import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { farmSubscriptions, farms, users } from "@/db/schema";
import { DEFAULT_FARM_ID, getCurrentFarmId } from "@/db/tenant-context";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac-server";
import { ROLE_LABELS, type AppRole } from "@/lib/rbac";
import { PLAN_CATALOG, type BillingPlanCode } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set<AppRole>(["propietario", "gerente", "veterinario", "operario", "admin"]);

export function resolveMaxUsersFromPlan(planCode: string | null | undefined, explicitMax: number | null | undefined): number {
  if (explicitMax != null && explicitMax > 0) return explicitMax;
  if (planCode && planCode in PLAN_CATALOG) {
    return PLAN_CATALOG[planCode as BillingPlanCode].maxUsers;
  }
  if (planCode === "COMERCIAL_MEDIANO") return PLAN_CATALOG.MEDIANO_MENSUAL.maxUsers;
  return 2;
}

async function resolveFarmContext() {
  const sessionUser = await getSessionUser();
  const farmId = (sessionUser as { farmId?: string | null } | null)?.farmId || getCurrentFarmId() || DEFAULT_FARM_ID;
  const [farm] = await db.select().from(farms).where(eq(farms.id, farmId)).limit(1);
  const [sub] = await db
    .select()
    .from(farmSubscriptions)
    .where(eq(farmSubscriptions.farmId, farmId))
    .orderBy(desc(farmSubscriptions.updatedAt))
    .limit(1);

  const planCode = sub?.planCode || farm?.planCode || "FREEMIUM_SEMILLA";
  const maxUsers = resolveMaxUsersFromPlan(planCode, sub?.maxUsers);
  return { farmId, sessionUser, planCode, maxUsers };
}

export const GET = withApiHandler(async () => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const { farmId, planCode, maxUsers } = await resolveFarmContext();
  const rows = await db
    .select({
      id: users.id,
      farmId: users.farmId,
      username: users.username,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.farmId, farmId))
    .orderBy(asc(users.createdAt));

  return NextResponse.json({
    users: rows,
    planCode,
    maxUsers,
    activeCount: rows.length,
    roleLabels: ROLE_LABELS,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = String(body.role || "operario").trim().toLowerCase() as AppRole;

  if (name.length < 2) {
    return NextResponse.json({ error: "Ingresa el nombre de la persona" }, { status: 400 });
  }
  if (username.length < 3) {
    return NextResponse.json({ error: "Ingresa un usuario de al menos 3 caracteres" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const { farmId, planCode, maxUsers } = await resolveFarmContext();
  const currentUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.farmId, farmId));

  if (currentUsers.length >= maxUsers) {
    return NextResponse.json(
      {
        error: `Tu plan (${planCode}) permite hasta ${maxUsers} usuarios activos. Actualiza a Comercial Mediano (MEDIANO_MENSUAL) para habilitar hasta 15 usuarios.`,
        code: "USER_LIMIT_REACHED",
        maxUsers,
        activeCount: currentUsers.length,
      },
      { status: 403 },
    );
  }

  const [conflict] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (conflict) {
    return NextResponse.json({ error: "Ese usuario ya existe en el sistema" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({
      farmId,
      username,
      passwordHash,
      name,
      role,
    })
    .returning({
      id: users.id,
      farmId: users.farmId,
      username: users.username,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    });

  return NextResponse.json({ user: created }, { status: 201 });
});

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object" || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
  }

  const { farmId } = await resolveFarmContext();
  const [target] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, body.id), eq(users.farmId, farmId)))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado en esta granja" }, { status: 404 });
  }

  const nextRole = body.role ? (String(body.role).trim().toLowerCase() as AppRole) : (target.role as AppRole);
  if (!ALLOWED_ROLES.has(nextRole)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const nextName = typeof body.name === "string" ? body.name.trim() : "";
  if (body.name !== undefined && nextName.length < 2) {
    return NextResponse.json({ error: "El nombre debe tener al menos 2 caracteres" }, { status: 400 });
  }
  const rawPassword = typeof body.password === "string" ? body.password : "";
  if (body.password !== undefined && rawPassword.length > 0 && rawPassword.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const patch: Partial<typeof users.$inferInsert> = {
    role: nextRole,
    name: nextName.length >= 2 ? nextName : target.name,
  };
  if (rawPassword.length >= 8) {
    patch.passwordHash = await hashPassword(rawPassword);
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(and(eq(users.id, body.id), eq(users.farmId, farmId)))
    .returning({
      id: users.id,
      farmId: users.farmId,
      username: users.username,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    });

  return NextResponse.json({ user: updated });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
  }

  const { farmId, sessionUser } = await resolveFarmContext();
  if (sessionUser?.id === id) {
    return NextResponse.json({ error: "No puedes eliminar tu propio usuario activo" }, { status: 400 });
  }

  const farmUsers = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.farmId, farmId));

  const target = farmUsers.find((u) => u.id === id);
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado en esta granja" }, { status: 404 });
  }

  const owners = farmUsers.filter((u) => u.role === "propietario" || u.role === "admin");
  if ((target.role === "propietario" || target.role === "admin") && owners.length <= 1) {
    return NextResponse.json({ error: "Debe existir al menos un propietario o administrador en la granja" }, { status: 400 });
  }

  await db.delete(users).where(and(eq(users.id, id), eq(users.farmId, farmId)));
  return NextResponse.json({ ok: true });
});

