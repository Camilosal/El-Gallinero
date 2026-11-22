import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { staffProfiles } from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { getCurrentFarmId } from "@/db/tenant-context";
import { requirePermission } from "@/lib/rbac-server";
import { getTaxAndPayrollConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Ensures the team has one active producer profile, without duplicating it on repeated page loads. */
export const POST = withApiHandler(async () => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;

  const taxConfig = await getTaxAndPayrollConfig();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('iwage_default_producer'), hashtext(${getCurrentFarmId()}))`);

    const [existing] = await tx
      .select()
      .from(staffProfiles)
      .where(and(eq(staffProfiles.workerKind, "productor"), eq(staffProfiles.isActive, true)))
      .limit(1);
    if (existing) return { profile: existing, created: false };

    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        fullName: "Productor principal",
        workerKind: "productor",
        contractType: "propio",
        payPeriod: "hora",
        baseRateCop: taxConfig.ownerReferenceHourlyRateCop.toFixed(2),
        roleLabel: "Productor principal",
        applySocialSecurity: false,
        includeTransportAllowance: false,
        employerBurdenPct: "0.00",
        workerDeductionPct: "0.00",
        isActive: true,
        notes: "Perfil inicial. Edita el nombre y ajusta la tarifa horaria de referencia a las condiciones de la granja.",
      })
      .returning();

    return { profile, created: true };
  });

  return NextResponse.json(result, { status: result.created ? 201 : 200 });
});
