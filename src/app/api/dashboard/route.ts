import { db } from "@/db";
import { hens, eggProduction, eggSales, feedInventory, transactions, incubation, maintenance, catalogos, feedPrograms, feedMovements, chickenSales, slaughter, roosters, broilerBatches, manureFactors, mortalityRecords, sanitaryCalendar, supplyInventory, manureSales, meatSales } from "@/db/schema";
import { eq, sql, desc, and, gte, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ageInWeeks, isAvailableForExit, stageForAge } from "@/lib/lifecycle";
import { flockBalance } from "@/lib/flock";
import { totalEstimatedKgPerDay } from "@/lib/manure";
import { computeManureInventory, computeEggInventory } from "@/lib/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split("T")[0];

    const [
      henStats,
      eggStats,
      salesStats,
      feedAlerts,
      activeIncubations,
      pendingMaintenance,
      recentEggs,
      financeStats,
      stages,
      allHens,
      mortalityRows,
      sanitaryAlerts,
      supplyAlerts,
      eggInventory,
    ] = await Promise.all([
      db.select({
        status: hens.status,
        count: sql<number>`count(*)::int`,
      }).from(hens).groupBy(hens.status),

      db.select({
        total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int`,
        avgDaily: sql<number>`coalesce(round(avg(${eggProduction.totalCollected})), 0)::int`,
      }).from(eggProduction).where(gte(eggProduction.date, dateStr)),

      db.select({
        totalSold: sql<number>`coalesce(sum(${eggSales.quantity}), 0)::int`,
        totalRevenue: sql<string>`coalesce(sum(${eggSales.totalAmount}), 0)::text`,
      }).from(eggSales).where(gte(eggSales.date, dateStr)),

      db.select({
        count: sql<number>`count(*)::int`,
      }).from(feedInventory).where(sql`${feedInventory.currentStock}::numeric <= ${feedInventory.minStock}::numeric`),

      db.select({
        count: sql<number>`count(*)::int`,
      }).from(incubation).where(eq(incubation.isComplete, false)),

      db.select({
        count: sql<number>`count(*)::int`,
      }).from(maintenance).where(eq(maintenance.status, "pendiente")),

      db.select({
        date: eggProduction.date,
        total: eggProduction.totalCollected,
      }).from(eggProduction).orderBy(desc(eggProduction.date)).limit(14),

      db.select({
        type: transactions.type,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
      }).from(transactions).where(gte(transactions.date, dateStr)).groupBy(transactions.type),

      db.select().from(catalogos)
        .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
        .orderBy(sql`${catalogos.sortOrder}`),

      db.select({ id: hens.id, birthDate: hens.birthDate, status: hens.status }).from(hens),

      // Mortality records last 30 days
      db.select({
        birdType: mortalityRecords.birdType,
        cause: mortalityRecords.cause,
        total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int`,
      }).from(mortalityRecords).where(gte(mortalityRecords.date, dateStr))
        .groupBy(mortalityRecords.birdType, mortalityRecords.cause),

      // Sanitary alerts (due within 7 days)
      db.select({ count: sql<number>`count(*)::int` }).from(sanitaryCalendar)
        .where(and(eq(sanitaryCalendar.isActive, true), sql`${sanitaryCalendar.nextDueDate}::date <= CURRENT_DATE + 7`)),

      // Supply alerts (low stock)
      db.select({ count: sql<number>`count(*)::int` }).from(supplyInventory)
        .where(sql`${supplyInventory.currentStock}::numeric <= ${supplyInventory.minStock}::numeric`),

      // Egg inventory (real data from details)
      computeEggInventory(),
    ]);

    const totalHens = henStats.reduce((sum, s) => sum + s.count, 0);
    const activeHens = henStats.find((s) => s.status === "activa")?.count || 0;
    const broodyHens = henStats.find((s) => s.status === "empollando")?.count || 0;
    const sickHens = henStats.find((s) => s.status === "enferma")?.count || 0;
    const recommendedHens = henStats.find((s) => s.status === "recomendada_sacrificio")?.count || 0;

    const income = financeStats.find((f) => f.type === "ingreso")?.total || "0";
    const expenses = financeStats.find((f) => f.type === "egreso")?.total || "0";

    // Calcular distribución por etapa
    const today = new Date();
    const stageDistribution = stages.map((stage) => {
      const minWeeks = stage.minWeeks ?? 0;
      const maxWeeks = stage.maxWeeks;
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() - minWeeks * 7);

      let count = 0;
      for (const hen of allHens) {
        if (!isAvailableForExit(hen.status)) continue;
        const weeks = ageInWeeks(hen.birthDate, today);
        if (weeks >= minWeeks && (maxWeeks === null || weeks < maxWeeks)) {
          count++;
        }
      }

      const eggsPerHen = Number(stage.expectedEggsPerHen || 0);
      return {
        name: stage.value,
        count,
        expectedEggsPerDay: Math.round(eggsPerHen * count * 10) / 10,
      };
    });

    const totalExpectedEggs = stageDistribution.reduce((s, st) => s + st.expectedEggsPerDay, 0);

    // Stock projection: aggregate daily feed needs across all stages
    const feedNeedsMap: Record<string, { name: string; dailyGrams: number; stockKg: number }> = {};
    for (const stage of stageDistribution) {
      const stageData = stages.find((s) => s.value === stage.name);
      if (!stageData) continue;
      const stageProgs = await db
        .select({
          feedId: feedPrograms.feedId,
          feedName: feedInventory.name,
          dailyAmountPerHen: feedPrograms.dailyAmountPerHen,
          currentStock: feedInventory.currentStock,
        })
        .from(feedPrograms)
        .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id))
        .where(eq(feedPrograms.stageCatalogoId, stageData.id));

      for (const p of stageProgs) {
        if (!p.feedId) continue;
        const dailyGrams = Number(p.dailyAmountPerHen) * stage.count;
        if (!feedNeedsMap[p.feedId]) {
          feedNeedsMap[p.feedId] = { name: p.feedName || "", dailyGrams: 0, stockKg: Number(p.currentStock) };
        }
        feedNeedsMap[p.feedId].dailyGrams += dailyGrams;
      }
    }

    const stockProjection = Object.entries(feedNeedsMap).map(([feedId, data]) => {
      const dailyKg = data.dailyGrams / 1000;
      const daysRemaining = dailyKg > 0 ? Math.floor(data.stockKg / dailyKg) : null;
      return {
        feedId,
        feedName: data.name,
        dailyNeedKg: Math.round(dailyKg * 100) / 100,
        currentStockKg: data.stockKg,
        daysRemaining,
      };
    });

    // ─── FCR: Feed Conversion Ratio ───
    // Total feed consumed in last 30 days (kg)
    const [feedConsumption] = await db.select({
      totalKg: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)::text`,
    }).from(feedMovements).where(and(gte(feedMovements.date, dateStr), eq(feedMovements.isEntry, false)));
    const totalFeedConsumedKg = Number(feedConsumption?.totalKg || 0);

    // Daily feed consumption for chart (last 14 days)
    const dailyFeed = await db.select({
      date: feedMovements.date,
      totalKg: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)::text`,
    }).from(feedMovements)
      .where(and(gte(feedMovements.date, new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0]), eq(feedMovements.isEntry, false)))
      .groupBy(feedMovements.date)
      .orderBy(feedMovements.date);

    // Incubation efficiency: hatched / set
    const [incubationStats] = await db.select({
      totalEggsSet: sql<number>`coalesce(sum(${incubation.eggsSet}), 0)::int`,
      totalHatched: sql<number>`coalesce(sum(${incubation.eggsHatched}), 0)::int`,
    }).from(incubation);

    // Chicken sales (meat) in last 30 days
    const [meatStats] = await db.select({
      totalBirds: sql<number>`coalesce(sum(${chickenSales.quantity}), 0)::int`,
      totalWeightKg: sql<string>`coalesce(sum(${chickenSales.weightKg}), 0)::text`,
      totalRevenue: sql<string>`coalesce(sum(${chickenSales.totalAmount}), 0)::text`,
    }).from(chickenSales).where(gte(chickenSales.date, dateStr));

    // Slaughter (meat production) in last 30 days
    const [slaughterStats] = await db.select({
      totalBirds: sql<number>`coalesce(sum(${slaughter.quantity}), 0)::int`,
      totalWeightKg: sql<string>`coalesce(sum(${slaughter.weightKg}), 0)::text`,
      totalRevenue: sql<string>`coalesce(sum(${slaughter.totalAmount}), 0)::text`,
    }).from(slaughter).where(gte(slaughter.date, dateStr));

    // Meat sales (processed meat) in last 30 days
    const [meatSalesStats] = await db.select({
      totalKg: sql<string>`coalesce(sum(${meatSales.quantityKg}), 0)::text`,
      totalRevenue: sql<string>`coalesce(sum(${meatSales.totalAmount}), 0)::text`,
    }).from(meatSales).where(gte(meatSales.date, dateStr));

    // Manure sales (gallinaza) in last 30 days
    const [manureSalesStats] = await db.select({
      totalKg: sql<string>`coalesce(sum(${manureSales.quantityKg}), 0)::text`,
      totalRevenue: sql<string>`coalesce(sum(${manureSales.totalAmount}), 0)::text`,
    }).from(manureSales).where(gte(manureSales.date, dateStr));

    // ─── Parvada: gallos reproductores y lotes de engorde ───
    const [roosterCount, readyBatchCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(roosters).where(eq(roosters.status, "activo")),
      db.select({ count: sql<number>`count(*)::int` }).from(broilerBatches).where(eq(broilerBatches.status, "listo_sacrificio")),
    ]);
    const hensInCoop = henStats.filter((s) => isAvailableForExit(s.status)).reduce((sum, s) => sum + s.count, 0);
    const roosterBalance = flockBalance(hensInCoop, roosterCount[0]?.count || 0);

    // ─── Gallinaza: stock y estimación (solo lectura, sin lazy-sync) ───
    const [manureFactorRows, manureInventoryData] = await Promise.all([
      db.select().from(manureFactors),
      computeManureInventory(),
    ]);
    const stageRangeList = stages.map((s) => ({ id: s.id, value: s.value, minWeeks: s.minWeeks ?? 0, maxWeeks: s.maxWeeks }));
    const hensPerStage = new Map<string, number>();
    for (const hen of allHens) {
      if (!isAvailableForExit(hen.status)) continue;
      const stage = stageForAge(stageRangeList, ageInWeeks(hen.birthDate, today));
      if (stage) hensPerStage.set(stage.id, (hensPerStage.get(stage.id) || 0) + 1);
    }
    const batchQty = await db.select({ total: sql<number>`coalesce(sum(${broilerBatches.currentQuantity}), 0)::int` })
      .from(broilerBatches).where(or(eq(broilerBatches.status, "activo"), eq(broilerBatches.status, "listo_sacrificio")));
    const factorOf = (stageId?: string, group?: string) =>
      Number(manureFactorRows.find((f) => (stageId ? f.stageCatalogoId === stageId : f.birdGroup === group))?.kgPerBirdPerDay || 0);
    const manureGroups = [
      ...stages.map((s) => ({ key: s.id, label: s.value, count: hensPerStage.get(s.id) || 0, kgPerBirdPerDay: factorOf(s.id) })),
      { key: "gallo", label: "Gallos", count: roosterCount[0]?.count || 0, kgPerBirdPerDay: factorOf(undefined, "gallo") },
      { key: "lote", label: "Lotes", count: batchQty[0]?.total || 0, kgPerBirdPerDay: factorOf(undefined, "lote") },
    ];
    const manure = {
      currentStockKg: Math.round(manureInventoryData.summary.available * 100) / 100,
      totalKgPerDay: totalEstimatedKgPerDay(manureGroups),
    };

    // ─── Mortality rate computation ───
    const mortalityByCause: Record<string, number> = {};
    let totalDeaths30d = 0;
    for (const m of mortalityRows) {
      totalDeaths30d += m.total;
      const cause = m.cause || "otro";
      mortalityByCause[cause] = (mortalityByCause[cause] || 0) + m.total;
    }
    const totalFlock = totalHens + (roosterCount[0]?.count || 0) + (batchQty[0]?.total || 0);
    const mortalityRate = totalFlock > 0 ? Math.round((totalDeaths30d / totalFlock) * 10000) / 100 : 0;

    const totalEggs30 = eggInventory.summary.produced;
    const totalHatched = incubationStats?.totalHatched || 0;
    // Combine chickenSales + slaughter + meatSales for total meat
    const totalMeatKg = Number(meatStats?.totalWeightKg || 0) + Number(slaughterStats?.totalWeightKg || 0) + Number(meatSalesStats?.totalKg || 0);
    const totalMeatRevenue = (Number(meatStats?.totalRevenue || 0) + Number(slaughterStats?.totalRevenue || 0) + Number(meatSalesStats?.totalRevenue || 0)).toFixed(2);
    const totalBirdsMeat = (meatStats?.totalBirds || 0) + (slaughterStats?.totalBirds || 0);

    // Manure sales stats
    const totalManureKg = Number(manureSalesStats?.totalKg || 0);
    const totalManureRevenue = Number(manureSalesStats?.totalRevenue || 0).toFixed(2);

    // FCR calculations (kg feed per unit of output)
    const fcrEggs = totalEggs30 > 0 ? Math.round((totalFeedConsumedKg / totalEggs30) * 100) / 100 : 0;
    const fcrChicks = totalHatched > 0 ? Math.round((totalFeedConsumedKg / totalHatched) * 100) / 100 : 0;
    const fcrMeat = totalMeatKg > 0 ? Math.round((totalFeedConsumedKg / totalMeatKg) * 100) / 100 : 0;
    const incubationEfficiency = incubationStats?.totalEggsSet > 0
      ? Math.round((totalHatched / incubationStats.totalEggsSet) * 100)
      : 0;

    // Feed consumption chart data (merge with egg production)
    const feedChartMap = new Map<string, { fecha: string; alimento: number; huevos: number }>();
    for (const d of dailyFeed) {
      const key = new Date(d.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
      feedChartMap.set(d.date, { fecha: key, alimento: Number(d.totalKg), huevos: 0 });
    }
    for (const e of recentEggs) {
      const key = new Date(e.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
      const existing = feedChartMap.get(e.date);
      if (existing) {
        existing.huevos = e.total;
      } else {
        feedChartMap.set(e.date, { fecha: key, alimento: 0, huevos: e.total });
      }
    }
    const feedChartData = Array.from(feedChartMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return NextResponse.json({
      hens: { total: totalHens, active: activeHens, broody: broodyHens, sick: sickHens, recommendedForSlaughter: recommendedHens, byStatus: henStats },
      roosters: roosterBalance,
      readyBatches: readyBatchCount[0]?.count || 0,
      eggs: { 
        totalLast30: totalEggs30, 
        avgDaily: eggStats[0]?.avgDaily || 0,
        inventory: {
          produced: eggInventory.summary.produced,
          sold: eggInventory.summary.sold,
          lost: eggInventory.summary.lost,
          available: eggInventory.summary.available,
        }
      },
      sales: { totalSold: salesStats[0]?.totalSold || 0, totalRevenue: salesStats[0]?.totalRevenue || "0" },
      feedAlerts: feedAlerts[0]?.count || 0,
      activeIncubations: activeIncubations[0]?.count || 0,
      pendingMaintenance: pendingMaintenance[0]?.count || 0,
      recentEggs: recentEggs.reverse(),
      finance: { income, expenses, profit: (parseFloat(income) - parseFloat(expenses)).toFixed(2) },
      stages: stageDistribution,
      totalExpectedEggsPerDay: Math.round(totalExpectedEggs * 10) / 10,
      stockProjection,
      fcr: {
        feedConsumed30d: Math.round(totalFeedConsumedKg * 100) / 100,
        fcrEggs,
        fcrChicks,
        fcrMeat,
        incubationEfficiency,
        totalHatched,
        totalMeatKg: Math.round(totalMeatKg * 100) / 100,
        totalMeatRevenue,
        totalBirdsSold: totalBirdsMeat,
      },
      feedChartData,
      manure: {
        ...manure,
        salesLast30d: {
          totalKg: Math.round(totalManureKg * 100) / 100,
          totalRevenue: totalManureRevenue,
        },
      },
      mortality: {
        total30d: totalDeaths30d,
        rate: mortalityRate,
        byCause: mortalityByCause,
      },
      sanitaryAlerts: sanitaryAlerts[0]?.count || 0,
      supplyAlerts: supplyAlerts[0]?.count || 0,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Error loading dashboard" }, { status: 500 });
  }
});
