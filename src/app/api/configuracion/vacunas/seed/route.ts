import { db } from "@/db";
import { vaccinationTemplates } from "@/db/schema";
import { VACCINATION_SCHEDULES } from "@/lib/vaccination-schedules";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac-server";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const BREED_SPECIES: Record<string, string> = {
  "ISA Brown": "gallina",
  "Hy-Line W-36": "gallina",
  "Cobb 500": "pollo",
};

/** POST /api/configuracion/vacunas/seed — carga idempotente de planes de referencia. */
export const POST = withApiHandler(async () => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const rows = Object.entries(VACCINATION_SCHEDULES).flatMap(([breed, events]) =>
    events.map((event) => ({
      species: BREED_SPECIES[breed] || "gallina",
      breed,
      weekNumber: event.weekNumber,
      name: event.name,
      description: event.description,
      type: event.type,
      frequencyDays: event.frequencyDays,
      isActive: true,
    })),
  );

  if (rows.length === 0) {
    return NextResponse.json({ created: 0 });
  }

  const inserted = await db.insert(vaccinationTemplates).values(rows).onConflictDoNothing().returning();
  return NextResponse.json({ created: inserted.length, total: rows.length });
});
