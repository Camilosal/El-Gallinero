import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farmLocations, transactions } from "@/db/schema";
import { parseIntegrationPagination, withIntegrationContext } from "@/lib/integrations/auth-guard";
import { formatTransactionForProfile } from "@/lib/integrations/profiles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await withIntegrationContext(req, ["read:finance"], async (ctx) => {
      const { searchParams } = new URL(req.url);
      const pagingResult = parseIntegrationPagination(searchParams);
      if (!pagingResult.ok) {
        return NextResponse.json({ error: pagingResult.error }, { status: 400 });
      }
      const { limit, offset, updatedSince, from, to } = pagingResult.value;

      const rawType = (searchParams.get("type") || "").trim().toLowerCase();
      const typeFilter = rawType === "gasto" ? "egreso" : rawType;
      if (typeFilter && typeFilter !== "ingreso" && typeFilter !== "egreso") {
        return NextResponse.json(
          { error: "Parámetro type inválido. Usa 'ingreso' o 'egreso'." },
          { status: 400 },
        );
      }

      const conditions: SQL[] = [];
      if (from) conditions.push(gte(transactions.date, from));
      if (to) conditions.push(lte(transactions.date, to));
      if (updatedSince) conditions.push(gte(transactions.createdAt, new Date(updatedSince)));
      if (typeFilter === "ingreso" || typeFilter === "egreso") {
        conditions.push(eq(transactions.type, typeFilter));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(transactions)
        .where(whereClause);

      const rows = await db
        .select({
          id: transactions.id,
          date: transactions.date,
          type: transactions.type,
          category: transactions.category,
          description: transactions.description,
          counterparty: transactions.counterparty,
          amount: transactions.amount,
          quantity: transactions.quantity,
          unitPrice: transactions.unitPrice,
          unit: transactions.unit,
          presentation: transactions.presentation,
          species: transactions.species,
          locationId: transactions.locationId,
          locationCode: farmLocations.code,
          locationName: farmLocations.name,
          batchId: transactions.batchId,
          isCredit: transactions.isCredit,
          sourceType: transactions.sourceType,
          sourceId: transactions.sourceId,
          notes: transactions.notes,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .leftJoin(farmLocations, eq(transactions.locationId, farmLocations.id))
        .where(whereClause)
        .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
        .limit(limit)
        .offset(offset);

      const total = countRow?.total ?? 0;
      const hasMore = offset + rows.length < total;
      const items = rows.map((row) =>
        formatTransactionForProfile(
          {
            id: row.id,
            date: row.date,
            type: row.type,
            category: row.category,
            description: row.description,
            counterparty: row.counterparty ?? null,
            amount: Number(row.amount),
            quantity: row.quantity !== null ? Number(row.quantity) : null,
            unitPrice: row.unitPrice !== null ? Number(row.unitPrice) : null,
            unit: row.unit ?? null,
            presentation: row.presentation ?? null,
            species: row.species ?? null,
            locationId: row.locationId ?? null,
            locationCode: row.locationCode ?? null,
            locationName: row.locationName ?? null,
            batchId: row.batchId ?? null,
            isCredit: row.isCredit,
            sourceType: row.sourceType ?? null,
            sourceId: row.sourceId ?? null,
            notes: row.notes ?? null,
            createdAt: row.createdAt.toISOString(),
          },
          ctx.profile,
          ctx.mapping,
        ),
      );

      return NextResponse.json(
        {
          object: "integration_list",
          resource: "transactions",
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
    console.error("Integrations transactions error:", error);
    return NextResponse.json({ error: "No se pudieron consultar las transacciones" }, { status: 500 });
  }
}
