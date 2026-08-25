import { db } from "@/db";
import {
  mortalityRecords,
  hens,
  roosters,
  eggProduction,
  transactions,
  broilerBatches,
  slaughter,
  birdAcquisitions,
} from "@/db/schema";
import { eq, sql, gte, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "30";
  const days = parseInt(period);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  // --- Mortality ---
  const [totalDeathsRow] = await db
    .select({ total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int` })
    .from(mortalityRecords)
    .where(gte(mortalityRecords.date, cutoffStr));

  const [henCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hens)
    .where(eq(hens.status, "activa"));

  const [roosterCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(roosters)
    .where(eq(roosters.status, "activo"));

  const totalFlock = (henCount?.count || 0) + (roosterCount?.count || 0);
  const totalDeaths = totalDeathsRow?.total || 0;
  const mortalityRate = totalFlock > 0 ? ((totalDeaths / totalFlock) * 100) : 0;

  const byCause = await db
    .select({
      cause: mortalityRecords.cause,
      total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int`,
    })
    .from(mortalityRecords)
    .where(gte(mortalityRecords.date, cutoffStr))
    .groupBy(mortalityRecords.cause);

  // --- Laying ---
  const [totalEggsRow] = await db
    .select({ total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int` })
    .from(eggProduction)
    .where(gte(eggProduction.date, cutoffStr));

  const totalEggs = totalEggsRow?.total || 0;
  // Laying-age hens: hens with status activa (assume laying age for simplicity)
  const layingHens = henCount?.count || 0;
  const layingRate = layingHens > 0 && days > 0
    ? (totalEggs / layingHens / days) * 100
    : 0;
  const avgDaily = days > 0 ? totalEggs / days : 0;

  // Laying series (daily)
  const layingSeries = await db
    .select({
      date: eggProduction.date,
      total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int`,
    })
    .from(eggProduction)
    .where(gte(eggProduction.date, cutoffStr))
    .groupBy(eggProduction.date)
    .orderBy(eggProduction.date);

  // --- Cost per unit ---
  const [totalExpensesRow] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text` })
    .from(transactions)
    .where(and(eq(transactions.type, "egreso"), gte(transactions.date, cutoffStr)));

  const totalExpenses = parseFloat(totalExpensesRow?.total || "0");

  // Total meat produced (kg) in period
  const [totalMeatRow] = await db
    .select({ total: sql<string>`coalesce(sum(${slaughter.weightKg}), 0)::text` })
    .from(slaughter)
    .where(gte(slaughter.date, cutoffStr));

  const totalMeatKg = parseFloat(totalMeatRow?.total || "0");

  const perEgg = totalEggs > 0 ? totalExpenses / totalEggs : 0;
  const perKgMeat = totalMeatKg > 0 ? totalExpenses / totalMeatKg : 0;

  // --- Flock ---
  const allHens = await db.select({ birthDate: hens.birthDate, status: hens.status }).from(hens);
  const allRoosters = await db.select({ birthDate: roosters.birthDate, status: roosters.status }).from(roosters);

  const now = new Date();
  let totalAgeWeeks = 0;
  let countWithAge = 0;
  for (const h of allHens) {
    if (h.status === "activa" || h.status === "empollando" || h.status === "enferma") {
      const birth = new Date(h.birthDate + "T12:00:00");
      const weeks = (now.getTime() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000);
      totalAgeWeeks += weeks;
      countWithAge++;
    }
  }
  for (const r of allRoosters) {
    if (r.status === "activo") {
      const birth = new Date(r.birthDate + "T12:00:00");
      const weeks = (now.getTime() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000);
      totalAgeWeeks += weeks;
      countWithAge++;
    }
  }
  const avgAgeWeeks = countWithAge > 0 ? totalAgeWeeks / countWithAge : 0;
  const productiveRatio = totalFlock > 0 ? (layingHens / totalFlock) : 0;

  // Expense by category for cost breakdown
  const expenseByCategory = await db
    .select({
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
    })
    .from(transactions)
    .where(and(eq(transactions.type, "egreso"), gte(transactions.date, cutoffStr)))
    .groupBy(transactions.category)
    .orderBy(sql`sum(${transactions.amount}) desc`);

  // --- Costo por ave: expenses in alimentacion + sanidad + adquisiciones / total birds acquired ---
  const [costCategoriesRow] = await db
    .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text` })
    .from(transactions)
    .where(and(
      eq(transactions.type, "egreso"),
      gte(transactions.date, cutoffStr),
      inArray(transactions.category, ["alimentacion", "sanidad", "adquisiciones"])
    ));
  const costCategoriesTotal = parseFloat(costCategoriesRow?.total || "0");

  const [birdsAcquiredRow] = await db
    .select({ total: sql<number>`coalesce(sum(${birdAcquisitions.quantity}), 0)::int` })
    .from(birdAcquisitions)
    .where(gte(birdAcquisitions.date, cutoffStr));
  const totalBirdsAcquired = birdsAcquiredRow?.total || 0;
  const costoPorAve = totalBirdsAcquired > 0 ? costCategoriesTotal / totalBirdsAcquired : 0;

  // --- Costo por docena: total egg production costs / (totalEggs / 12) ---
  const dozens = totalEggs / 12;
  const costoPorDocena = dozens > 0 ? totalExpenses / dozens : 0;

  // --- Peak production detection: group eggProduction last 90 days by week ---
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysStr = ninetyDaysAgo.toISOString().split("T")[0];

  const eggWeekly = await db
    .select({
      weekStart: sql<string>`date_trunc('week', ${eggProduction.date}::date)::date::text`,
      totalEggs: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int`,
      days: sql<number>`count(distinct ${eggProduction.date})::int`,
    })
    .from(eggProduction)
    .where(gte(eggProduction.date, ninetyDaysStr))
    .groupBy(sql`date_trunc('week', ${eggProduction.date}::date)`)
    .orderBy(sql`date_trunc('week', ${eggProduction.date}::date)`);

  let peakWeek: { weekStart: string; avgDaily: number; totalEggs: number } | null = null;
  for (const w of eggWeekly) {
    const avgDaily = w.days > 0 ? w.totalEggs / w.days : 0;
    if (!peakWeek || avgDaily > peakWeek.avgDaily) {
      peakWeek = { weekStart: w.weekStart, avgDaily: Math.round(avgDaily * 10) / 10, totalEggs: w.totalEggs };
    }
  }

  const peakRate = peakWeek && layingHens > 0
    ? Math.round((peakWeek.avgDaily / layingHens) * 10000) / 100
    : 0;

  // Current rate: last 7 days avg daily / laying hens
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString().split("T")[0];

  const [recentEggsRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int`,
      days: sql<number>`count(distinct ${eggProduction.date})::int`,
    })
    .from(eggProduction)
    .where(gte(eggProduction.date, sevenDaysStr));

  const currentAvgDaily = (recentEggsRow?.days || 0) > 0
    ? (recentEggsRow?.total || 0) / (recentEggsRow?.days || 1)
    : 0;
  const currentRate = layingHens > 0
    ? Math.round((currentAvgDaily / layingHens) * 10000) / 100
    : 0;

  const declinePercent = peakRate > 0
    ? Math.round(((peakRate - currentRate) / peakRate) * 10000) / 100
    : 0;

  return NextResponse.json({
    mortality: {
      rate: parseFloat(mortalityRate.toFixed(2)),
      totalDeaths,
      totalFlock,
      byCause,
    },
    laying: {
      rate: parseFloat(layingRate.toFixed(2)),
      totalEggs,
      avgDaily: parseFloat(avgDaily.toFixed(1)),
      series: layingSeries,
    },
    costPerUnit: {
      perEgg: parseFloat(perEgg.toFixed(2)),
      perKgMeat: parseFloat(perKgMeat.toFixed(2)),
      totalExpenses,
    },
    flock: {
      avgAgeWeeks: parseFloat(avgAgeWeeks.toFixed(1)),
      totalBirds: totalFlock,
      productiveRatio: parseFloat(productiveRatio.toFixed(2)),
    },
    expenseByCategory,
    periodDays: days,
    costMetrics: {
      costoPorAve: parseFloat(costoPorAve.toFixed(2)),
      costoPorDocena: parseFloat(costoPorDocena.toFixed(2)),
      costoPorHuevo: parseFloat(perEgg.toFixed(2)),
      costoPorKgCarne: parseFloat(perKgMeat.toFixed(2)),
      totalExpenses,
      totalBirds: totalFlock,
      totalEggs,
      dozens: parseFloat(dozens.toFixed(1)),
    },
    peakProduction: {
      peakWeek: peakWeek?.weekStart || null,
      peakDate: peakWeek?.weekStart || null,
      peakRate,
      currentRate,
      declinePercent,
      avgDaily: peakWeek?.avgDaily || 0,
      totalEggs: peakWeek?.totalEggs || 0,
    },
  });
});
