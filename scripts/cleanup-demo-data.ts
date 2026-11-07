import { config } from "dotenv";
config({ path: ".env.local" });

import { db, pool } from "@/db/index";
import { eq, inArray, sql } from "drizzle-orm";
import {
  hens,
  eggProduction,
  eggProductionDetails,
  feedMovements,
  feedInventory,
  feedPrograms,
  healthControl,
  sanitaryCalendar,
  flockPlans,
  flockPlanMilestones,
  catalogos,
  incubation,
  chickenSales,
  slaughter,
  mortalityRecords,
  birdAcquisitions,
  transactions,
  roosters,
  broilerBatches,
  eggSales,
  eggSalesItems,
  manureProduction,
  manureSales,
  manureAdjustments,
  manureFactors,
  eggLosses,
  supplyInventory,
  supplyMovements,
  meatSales,
  meatLosses,
  weightLogs,
  breedWeightStandards,
  maintenance,
  purchaseProducts,
  budgets,
  budgetItems,
  accountsReceivable,
  accountsPayable,
  payments,
  users,
  sessions,
  financialCategories,
} from "@/db/schema";

async function main() {
  console.log("🧹 Iniciando limpieza de datos demo...\n");

  // ──────────────────────────────────────────────
  // Tablas a CONSERVAR (configuración/personalización)
  // ──────────────────────────────────────────────
  // feedInventory - items de inventario (configuración)
  // feedPrograms - programas de alimentación por etapa
  // healthControl - eventos de control sanitario
  // sanitaryCalendar - calendario sanitario
  // flockPlans, flockPlanMilestones - planes de parvada
  // catalogos - todos los catálogos maestros
  // manureFactors - factores de gallinaza
  // users, sessions - usuarios
  // roosters, broilerBatches - otras aves (el usuario solo pidió borrar gallinas)
  // maintenance - mantenimiento
  // purchaseProducts - productos de compra frecuente
  // budgets, budgetItems - presupuestos
  // financialCategories - categorías financieras
  // supplyInventory, supplyMovements - insumos no alimenticios
  // weightLogs, breedWeightStandards - estándares de peso
  // accountsReceivable, accountsPayable, payments - cuentas por cobrar/pagar

  // ──────────────────────────────────────────────
  // Tablas a ELIMINAR (datos demo transaccionales)
  // ──────────────────────────────────────────────
  // 1. hens - gallinas demo
  // 2. egg_production + egg_production_details - posturas demo
  // 3. feed_movements - registros de alimentación demo

  // Tablas que referencian hens y deben limpiarse ANTES de borrar hens:
  // - incubation (henId)
  // - chicken_sales (henId)
  // - slaughter (henId)
  // - mortality_records (henId)

  // Transacciones vinculadas a los registros que se borran:
  // - transactions (sourceType/sourceId)
  // - payments, accounts_receivable, accounts_payable -> transactions

  try {
    // ── Paso 1: Eliminar tablas financieras dependientes de transacciones ─────
    console.log("📋 Eliminando tablas financieras dependientes...");
    await db.delete(payments);
    console.log(`   ✅ Pagos eliminados`);
    await db.delete(accountsReceivable);
    console.log(`   ✅ Cuentas por cobrar eliminadas`);
    await db.delete(accountsPayable);
    console.log(`   ✅ Cuentas por pagar eliminadas`);

    // ── Paso 2: Eliminar transacciones vinculadas a datos demo ──────────
    console.log("📋 Eliminando transacciones vinculadas a datos demo...");
    const deletedTx = await db.delete(transactions);
    console.log(`   ✅ Transacciones eliminadas`);

    // ── Paso 3: Eliminar registros que referencian hens ────────────────
    console.log("🔗 Eliminando registros vinculados a gallinas...");

    await db.delete(incubation);
    console.log(`   ✅ Incubación eliminada`);

    await db.delete(chickenSales);
    console.log(`   ✅ Ventas de aves eliminadas`);

    await db.delete(slaughter);
    console.log(`   ✅ Sacrificios eliminados`);

    await db.delete(mortalityRecords);
    console.log(`   ✅ Registros de mortalidad eliminados`);

    await db.delete(birdAcquisitions);
    console.log(`   ✅ Adquisiciones de aves eliminadas`);

    // ── Paso 4: Eliminar datos de producción de huevos ─────────────────
    console.log("🥚 Eliminando producción de huevos...");
    await db.delete(eggProductionDetails);
    await db.delete(eggProduction);
    console.log(`   ✅ Producción de huevos y detalles eliminados`);

    // ── Paso 5: Eliminar ventas de huevos ──────────────────────────────
    console.log("💰 Eliminando ventas de huevos...");
    await db.delete(eggSalesItems);
    await db.delete(eggSales);
    console.log(`   ✅ Ventas de huevos eliminadas`);

    // ── Paso 6: Eliminar movimientos de alimento ───────────────────────
    console.log("🌾 Eliminando movimientos de alimento (registros de alimentación)...");
    await db.delete(feedMovements);
    console.log(`   ✅ Movimientos de alimento eliminados`);

    // ── Paso 7: Eliminar gallinas ──────────────────────────────────────
    console.log("🐔 Eliminando gallinas demo...");
    await db.delete(hens);
    console.log(`   ✅ Gallinas eliminadas`);

    // ── Paso 8: Eliminar otros datos demo transaccionales ──────────────
    console.log("🗑️ Eliminando otros datos demo transaccionales...");

    await db.delete(manureProduction);
    console.log(`   ✅ Producción de gallinaza eliminada`);

    await db.delete(manureSales);
    console.log(`   ✅ Ventas de gallinaza eliminadas`);

    await db.delete(manureAdjustments);
    console.log(`   ✅ Ajustes de gallinaza eliminados`);

    await db.delete(eggLosses);
    console.log(`   ✅ Pérdidas de huevo eliminadas`);

    await db.delete(meatSales);
    console.log(`   ✅ Ventas de carne eliminadas`);

    await db.delete(meatLosses);
    console.log(`   ✅ Pérdidas de carne eliminadas`);

    await db.delete(weightLogs);
    console.log(`   ✅ Registros de peso eliminados`);

    await db.delete(supplyMovements);
    console.log(`   ✅ Movimientos de insumos eliminados`);

    // ── Verificar qué se conservó ──────────────────────────────────────
    console.log("\n📊 Verificando datos conservados (configuración/personalización):");

    const counts = await Promise.all([
      db.select({ count: sql`count(*)` }).from(feedInventory),
      db.select({ count: sql`count(*)` }).from(feedPrograms),
      db.select({ count: sql`count(*)` }).from(healthControl),
      db.select({ count: sql`count(*)` }).from(sanitaryCalendar),
      db.select({ count: sql`count(*)` }).from(flockPlans),
      db.select({ count: sql`count(*)` }).from(catalogos),
      db.select({ count: sql`count(*)` }).from(manureFactors),
      db.select({ count: sql`count(*)` }).from(roosters),
      db.select({ count: sql`count(*)` }).from(broilerBatches),
      db.select({ count: sql`count(*)` }).from(maintenance),
      db.select({ count: sql`count(*)` }).from(purchaseProducts),
      db.select({ count: sql`count(*)` }).from(budgets),
      db.select({ count: sql`count(*)` }).from(supplyInventory),
      db.select({ count: sql`count(*)` }).from(breedWeightStandards),
      db.select({ count: sql`count(*)` }).from(users),
    ]);

    const labels = [
      "feedInventory (inventario alimentos)",
      "feedPrograms (planes alimentación)",
      "healthControl (control sanitario)",
      "sanitaryCalendar (calendario sanitario)",
      "flockPlans (planes parvada)",
      "catalogos (catálogos maestros)",
      "manureFactors (factores gallinaza)",
      "roosters (gallos)",
      "broilerBatches (lotes engorde)",
      "maintenance (mantenimiento)",
      "purchaseProducts (productos compra)",
      "budgets (presupuestos)",
      "supplyInventory (insumos)",
      "breedWeightStandards (estándares peso)",
      "users (usuarios)",
    ];

    counts.forEach((c, i) => {
      console.log(`   📌 ${labels[i]}: ${c[0]?.count ?? 0} registros`);
    });

    console.log("\n✅ Limpieza completada exitosamente.");
    console.log("\n📝 Resumen de lo ELIMINADO:");
    console.log("   • Gallinas (hens)");
    console.log("   • Producción de huevos (egg_production + details)");
    console.log("   • Movimientos de alimento (feed_movements)");
    console.log("   • Incubación, ventas de aves, sacrificios, mortalidad, adquisiciones");
    console.log("   • Ventas de huevos, gallinaza, carne, pérdidas");
    console.log("   • Transacciones financieras vinculadas");
    console.log("   • Registros de peso, movimientos de insumos");
    console.log("\n📝 Resumen de lo CONSERVADO:");
    console.log("   • Planes de alimentación (feed_programs)");
    console.log("   • Planes sanitarios (health_control + sanitary_calendar)");
    console.log("   • Planes de parvada (flock_plans)");
    console.log("   • Catálogos maestros (catalogos)");
    console.log("   • Inventario de alimentos (feed_inventory - items configurados)");
    console.log("   • Factores de gallinaza (manure_factors)");
    console.log("   • Gallos, lotes de engorde, usuarios, mantenimiento, etc.");
  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});