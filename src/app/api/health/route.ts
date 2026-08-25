import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
});
