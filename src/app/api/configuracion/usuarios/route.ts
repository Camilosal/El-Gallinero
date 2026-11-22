import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { farmSubscriptions, farms, users } from "@/db/schema";
import { DEFAULT_FARM_ID, getCurrentFarmId } from "@/db/tenant-context";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac-server";
import { canDelegateRole, ROLE_LABELS, type AppRole } from "@/lib/rbac";
import { getFarmSubscriptionStatus } from "@/lib/subscription";

export const dynamic = "force-dynamic";

// "admin" es un rol de plataforma reservado a la granja base y se crea por CLI.
// La gestión de usuarios de una granja nunca debe poder emitirlo.
const ALLOWED_ROLES = new Set<AppRole>([
  "propietario",
  "gerente",
  "veterinario",
  "operario",
  "comercial",
  "financiero",
  "directivo",
]);

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
  const subscription = await getFarmSubscriptionStatus(farmId);
  return {
    farmId,
    farmCode: farm?.code || null,
    farmName: farm?.name || null,
    sessionUser,
    planCode,
    planKey: subscription.planKey,
    planName: subscription.planName,
    maxUsers: subscription.maxUsers,
  };
}

export const GET = withApiHandler(async () => {
  const denied = await requirePermission("users:manage");
  if (denied) return denied;

  const { farmId, farmCode, farmName, planCode, planKey, planName, maxUsers } = await resolveFarmContext();
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
    farmCode,
    farmName,
    planCode,
    planKey,
    planName,
    maxUsers,
    activeCount: rows.length,
    roleLabels: ROLE_LABELS,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("users:manage");
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

  const { farmId, farmCode, planCode, planName, maxUsers, sessionUser } = await resolveFarmContext();
  if (!canDelegateRole(sessionUser?.role, role)) {
    return NextResponse.json({ error: "No puedes asignar un rol con permisos superiores a los tuyos" }, { status: 403 });
  }
  const passwordHash = await hashPassword(password);
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`user-seat-limit:${farmId}`}))`);
    const [existingInFarm] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.farmId, farmId), sql`lower(${users.username}) = ${username}`))
      .limit(1);
    if (existingInFarm) return { usernameConflict: true as const };

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.farmId, farmId));
    const activeCount = Number(countRow?.count || 0);
    if (activeCount >= maxUsers) return { limitReached: true as const, activeCount };

    const [created] = await tx
      .insert(users)
      .values({ farmId, username, passwordHash, name, role })
      .returning({
        id: users.id,
        farmId: users.farmId,
        username: users.username,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      });
    return { created };
  });

  if ("limitReached" in result) {
    return NextResponse.json(
      {
        error: `El plan ${planName} permite hasta ${maxUsers} usuario${maxUsers === 1 ? "" : "s"}. Consulta los planes de IwaGranja para ampliar el cupo.`,
        code: "USER_LIMIT_REACHED",
        planName,
        maxUsers,
        activeCount: result.activeCount,
      },
      { status: 403 },
    );
  }
  if ("usernameConflict" in result) {
    return NextResponse.json({ error: "Ese usuario ya existe en esta granja" }, { status: 409 });
  }

  return NextResponse.json({ user: result.created, farmCode }, { status: 201 });
});

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("users:manage");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object" || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
  }

  const { farmId, sessionUser } = await resolveFarmContext();
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
  if (!canDelegateRole(sessionUser?.role, target.role) || !canDelegateRole(sessionUser?.role, nextRole)) {
    return NextResponse.json({ error: "No puedes modificar una cuenta con permisos superiores ni asignar un rol superior al tuyo" }, { status: 403 });
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
  const denied = await requirePermission("users:manage");
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
  if (!canDelegateRole(sessionUser?.role, target.role)) {
    return NextResponse.json({ error: "No puedes eliminar una cuenta con permisos superiores a los tuyos" }, { status: 403 });
  }

  const owners = farmUsers.filter((u) => u.role === "propietario" || u.role === "admin");
  if ((target.role === "propietario" || target.role === "admin") && owners.length <= 1) {
    return NextResponse.json({ error: "Debe existir al menos un propietario o administrador en la granja" }, { status: 400 });
  }

  await db.delete(users).where(and(eq(users.id, id), eq(users.farmId, farmId)));
  return NextResponse.json({ ok: true });
});

