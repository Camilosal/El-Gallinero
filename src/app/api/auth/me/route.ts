import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { farms } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { withErrorHandler } from "@/lib/api-handler";
import { getPermissionsForRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let farmName: string | null = null;
  let farmSlug: string | null = null;
  let farmCode: string | null = null;
  try {
    const [farm] = await db
      .select({ name: farms.name, slug: farms.slug, code: farms.code })
      .from(farms)
      .where(eq(farms.id, user.farmId))
      .limit(1);
    if (farm) {
      farmName = farm.name;
      farmSlug = farm.slug;
      farmCode = farm.code;
    }
  } catch {
    // Non-fatal: still return session user even if farm metadata lookup fails
  }

  return NextResponse.json({
    ...user,
    farmName,
    farmSlug,
    farmCode,
    permissions: getPermissionsForRole(user.role),
  });
});
