import { and, asc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { parseIntegrationPagination, withIntegrationContext } from "@/lib/integrations/auth-guard";
import { formatContactForProfile } from "@/lib/integrations/profiles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await withIntegrationContext(req, ["read:contacts"], async (ctx) => {
      const { searchParams } = new URL(req.url);
      const pagingResult = parseIntegrationPagination(searchParams);
      if (!pagingResult.ok) {
        return NextResponse.json({ error: pagingResult.error }, { status: 400 });
      }
      const { limit, offset, updatedSince } = pagingResult.value;
      const role = (searchParams.get("role") || "").trim().toLowerCase();

      if (role && !["cliente", "proveedor", "ambos"].includes(role)) {
        return NextResponse.json(
          { error: "Parámetro role inválido. Usa 'cliente', 'proveedor' o 'ambos'." },
          { status: 400 },
        );
      }

      const conditions: SQL[] = [];
      if (role === "cliente") {
        conditions.push(inArray(contacts.role, ["cliente", "ambos"]));
      } else if (role === "proveedor") {
        conditions.push(inArray(contacts.role, ["proveedor", "ambos"]));
      } else if (role === "ambos") {
        conditions.push(eq(contacts.role, "ambos"));
      }
      if (updatedSince) {
        conditions.push(gte(contacts.updatedAt, new Date(updatedSince)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(contacts)
        .where(whereClause);

      const rows = await db
        .select()
        .from(contacts)
        .where(whereClause)
        .orderBy(asc(contacts.name), asc(contacts.id))
        .limit(limit)
        .offset(offset);

      const total = countRow?.total ?? 0;
      const hasMore = offset + rows.length < total;
      const items = rows.map((row) =>
        formatContactForProfile(
          {
            id: row.id,
            name: row.name,
            role: row.role,
            personType: row.personType,
            documentType: row.documentType ?? null,
            documentNumber: row.documentNumber ?? null,
            contactName: row.contactName ?? null,
            phone: row.phone ?? null,
            whatsapp: row.whatsapp ?? null,
            email: row.email ?? null,
            address: row.address ?? null,
            city: row.city ?? null,
            department: row.department ?? null,
            paymentMethod: row.paymentMethod ?? null,
            creditDays: row.creditDays,
            isActive: row.isActive,
            updatedAt: row.updatedAt.toISOString(),
          },
          ctx.profile,
        ),
      );

      return NextResponse.json(
        {
          object: "integration_list",
          resource: "contacts",
          profile: ctx.profile,
          farmId: ctx.farmId,
          authVia: ctx.via,
          count: items.length,
          total,
          limit,
          cursor: String(offset),
          nextCursor: hasMore ? String(offset + rows.length) : null,
          hasMore,
          syncedAt: new Date().toISOString(),
          items,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    });
  } catch (error) {
    console.error("Integrations contacts error:", error);
    return NextResponse.json({ error: "No se pudieron consultar los terceros" }, { status: 500 });
  }
}
