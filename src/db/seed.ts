import { config } from "dotenv";
config({ path: ".env.local" });

import { db, pool } from "./index";
import { hens, feedInventory, feedMovements, feedPrograms, eggProduction, eggProductionDetails, eggSales, eggSalesItems, transactions, maintenance, healthControl, incubation, users, sessions, catalogos, chickenSales, slaughter, roosters, broilerBatches, manureFactors, manureSales, manureAdjustments, birdAcquisitions, mortalityRecords, eggLosses, supplyInventory, supplyMovements, meatSales, meatLosses, manureProduction, budgets, budgetItems, accountsReceivable, accountsPayable, payments, sanitaryCalendar, flockPlans, flockPlanMilestones, weightLogs, breedWeightStandards } from "./schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

async function main() {
  console.log("🌱 Sembrando datos de ejemplo...");

  // Limpia datos previos (seed idempotente, orden por FK)
  await db.delete(flockPlanMilestones);
  await db.delete(flockPlans);
  await db.delete(sanitaryCalendar);
  await db.delete(payments);
  await db.delete(accountsReceivable);
  await db.delete(accountsPayable);
  await db.delete(budgetItems);
  await db.delete(budgets);
  await db.delete(supplyMovements);
  await db.delete(supplyInventory);
  await db.delete(eggLosses);
  await db.delete(mortalityRecords);
  await db.delete(birdAcquisitions);
  await db.delete(slaughter);
  await db.delete(chickenSales);
  await db.delete(meatSales);
  await db.delete(meatLosses);
  await db.delete(manureProduction);
  await db.delete(sessions);
  await db.delete(manureSales);
  await db.delete(manureAdjustments);
  await db.delete(manureFactors);
  await db.delete(eggSalesItems);
  await db.delete(feedPrograms);
  await db.delete(feedMovements);
  await db.delete(eggSales);
  await db.delete(incubation);
  await db.delete(healthControl);
  await db.delete(maintenance);
  await db.delete(transactions);
  await db.delete(eggProductionDetails);
  await db.delete(eggProduction);
  await db.delete(feedInventory);
  await db.delete(hens);
  await db.delete(weightLogs);
  await db.delete(breedWeightStandards);
  await db.delete(roosters);
  await db.delete(broilerBatches);
  await db.delete(catalogos);
  await db.delete(users);

  // ——— Catálogos / Datos maestros ———
  const catalogDefaults: { category: string; values: string[]; prices?: number[]; units?: number[] }[] = [
    {
      category: "raza",
      values: ["Rhode Island Red", "Leghorn", "Plymouth Rock", "Sussex", "Marans", "Araucana", "Isa Brown", "Criolla", "Otra"],
    },
    {
      category: "comprador",
      values: ["Tienda Doña Rosa", "Venta callejera", "Restaurante La Granja", "Mercado Don Juan", "Pedidos por encargo"],
    },
    {
      category: "proveedor",
      values: ["Producción propia", "Agrosupply", "Mercado local", "Agrocentro El Campo", "Tienda veterinaria"],
    },
    {
      category: "tamano_huevo",
      values: ["Jumbo", "Extra", "Grande", "Mediano", "Pequeño"],
      prices: [800, 700, 600, 500, 400],
    },
    {
      category: "presentacion_venta",
      values: ["Unidad", "Docena", "Media docena", "1/2 Bandeja", "Bandeja/Cubeta"],
      units: [1, 12, 6, 15, 30],
    },
    {
      category: "enfermedad",
      values: ["Newcastle", "Coccidiosis", "Viruela aviar", "Mycoplasma", "Ácaros / piojos", "Cólera aviar", "Marek", "Coriza"],
    },
    {
      category: "unidad_medida",
      values: ["unidades", "kg", "lb", "litros", "docenas", "gramos", "otro"],
    },
    {
      category: "categoria_ingreso",
      values: ["Venta de huevos", "Venta de gallinas", "Venta de pollitos", "Venta de abono/gallinaza", "Otro ingreso"],
    },
    {
      category: "categoria_egreso",
      values: ["Compra de alimento", "Compra de insumos", "Control sanitario", "Mantenimiento", "Mano de obra", "Servicios (agua/luz)", "Compra de gallinas", "Equipamiento", "Transporte", "Otro egreso"],
    },
    {
      category: "tipo_sanidad",
      values: ["vacunacion", "desparasitacion", "tratamiento", "inspeccion", "fumigacion", "vitaminas", "otro"],
    },
    {
      category: "tipo_mantenimiento",
      values: [
        "Limpieza y desinfección del gallinero",
        "Revisión y reparación de nidales",
        "Cambio de cama / viruta",
        "Revisión del sistema de agua",
        "Reparación de cercas y malla",
        "Poda de vegetación alrededor",
        "Revisión de techos y drenajes",
        "Mantenimiento de comederos",
        "Fumigación preventiva",
        "Pintura y protección de estructuras",
      ],
    },
    {
      category: "presentacion_compra",
      values: ["Kg", "Bulto 25kg", "Bulto 50kg", "Arpilla 5kg", "Litro", "Galón", "Unidad"],
      units: [1, 25, 50, 5, 1, 4, 1],
    },
    {
      category: "estado_gallina",
      values: ["activa", "empollando", "enferma", "descarte", "vendida", "muerta"],
    },
    {
      category: "categoria_alimento",
      values: ["granja_fresco", "granja_procesado", "suplementario"],
    },
    {
      category: "tipo_alimento",
      values: [
        "pastos_gramineas",
        "bore_raices",
        "mosca_soldado",
        "maiz_germinado",
        "purinas",
        "maiz_comprado",
        "concentrado_comercial",
        "otro",
      ],
    },
    {
      category: "tipo_ave",
      values: ["gallina_descarte", "pollo", "gallo", "pollito"],
    },
  ];
  const catalogRows = catalogDefaults.flatMap((c) =>
    c.values.map((v, i) => ({
      category: c.category,
      value: v,
      price: c.prices?.[i] != null ? String(c.prices[i]) : null,
      units: c.units?.[i] != null ? Number(c.units[i]) : null,
      sortOrder: i,
    }))
  );
  await db.insert(catalogos).values(catalogRows);

  // ——— Etapas de crecimiento (avícola estándar) ———
  const createdStages = await db.insert(catalogos).values([
    { category: "etapa_crecimiento", value: "Pollito", minWeeks: 0, maxWeeks: 6, expectedEggsPerHen: "0", sortOrder: 0 },
    { category: "etapa_crecimiento", value: "Juvenil", minWeeks: 6, maxWeeks: 18, expectedEggsPerHen: "0", sortOrder: 1 },
    { category: "etapa_crecimiento", value: "Pre-postura", minWeeks: 18, maxWeeks: 20, expectedEggsPerHen: "0.3", sortOrder: 2 },
    { category: "etapa_crecimiento", value: "Postura", minWeeks: 20, maxWeeks: null, expectedEggsPerHen: "0.85", sortOrder: 3 },
  ]).returning();

  // ——— Usuario administrador ———
  await db.insert(users).values({
    username: "Camilosal",
    passwordHash: await hashPassword("Pr@yectos123"),
    name: "Administrador",
    role: "admin",
  });

  // ——— 32 Gallinas distribuidas en etapas de crecimiento ———
  // Pollitos (0-6 semanas): nacidos ~4 semanas atrás → 5 unidades
  // Juveniles tempranos (7-12 sem): nacidos ~2 meses atrás → 4 unidades
  // Juveniles tardíos (13-18 sem): nacidos ~3.5 meses atrás → 3 unidades
  // Pre-postura (18-20 sem): nacidos ~4.5 meses atrás → 3 unidades
  // Postura (20+ sem): nacidos 6-10 meses atrás → 15 unidades
  // Fin de postura (>80 sem): recomendación automática de sacrificio → 2 unidades
  const createdHens = await db.insert(hens).values([
    // === POLLITOS (5) — etapa Pollito ===
    { code: "G-001", breed: "Isa Brown", birthDate: daysAgo(28), status: "activa", weight: "0.6", isBroody: false },
    { code: "G-002", breed: "Rhode Island Red", birthDate: daysAgo(30), status: "activa", weight: "0.5", isBroody: false },
    { code: "G-003", breed: "Leghorn", birthDate: daysAgo(25), status: "activa", weight: "0.7", isBroody: false },
    { code: "G-004", breed: "Criolla", birthDate: daysAgo(32), status: "activa", weight: "0.5", isBroody: false },
    { code: "G-005", breed: "Sussex", birthDate: daysAgo(27), status: "activa", weight: "0.6", isBroody: false },
    // === JUVENILES TEMPRANOS (4) — etapa Juvenil ===
    { code: "G-006", breed: "Isa Brown", birthDate: daysAgo(60), status: "activa", weight: "1.2", isBroody: false },
    { code: "G-007", breed: "Plymouth Rock", birthDate: daysAgo(65), status: "activa", weight: "1.3", isBroody: false },
    { code: "G-008", breed: "Marans", birthDate: daysAgo(58), status: "activa", weight: "1.1", isBroody: false },
    { code: "G-009", breed: "Rhode Island Red", birthDate: daysAgo(63), status: "activa", weight: "1.2", isBroody: false },
    // === JUVENILES TARDÍOS (3) — etapa Juvenil ===
    { code: "G-010", breed: "Leghorn", birthDate: daysAgo(100), status: "activa", weight: "1.7", isBroody: false },
    { code: "G-011", breed: "Isa Brown", birthDate: daysAgo(105), status: "activa", weight: "1.8", isBroody: false },
    { code: "G-012", breed: "Criolla", birthDate: daysAgo(95), status: "activa", weight: "1.6", isBroody: false },
    // === PRE-POSTURA (3) — etapa Pre-postura ===
    { code: "G-013", breed: "Rhode Island Red", birthDate: daysAgo(130), status: "activa", weight: "2.0", isBroody: false },
    { code: "G-014", breed: "Sussex", birthDate: daysAgo(135), status: "activa", weight: "2.1", isBroody: false },
    { code: "G-015", breed: "Isa Brown", birthDate: daysAgo(128), status: "activa", weight: "1.9", isBroody: false },
    // === POSTURA (15) — etapa Postura ===
    { code: "G-016", breed: "Rhode Island Red", birthDate: daysAgo(200), status: "activa", weight: "2.8", isBroody: false },
    { code: "G-017", breed: "Isa Brown", birthDate: daysAgo(210), status: "activa", weight: "2.1", isBroody: false },
    { code: "G-018", breed: "Leghorn", birthDate: daysAgo(190), status: "activa", weight: "1.9", isBroody: false },
    { code: "G-019", breed: "Plymouth Rock", birthDate: daysAgo(220), status: "activa", weight: "2.6", isBroody: false },
    { code: "G-020", breed: "Marans", birthDate: daysAgo(205), status: "activa", weight: "2.3", isBroody: false },
    { code: "G-021", breed: "Sussex", birthDate: daysAgo(230), status: "activa", weight: "2.5", isBroody: false },
    { code: "G-022", breed: "Criolla", birthDate: daysAgo(180), status: "activa", weight: "2.2", isBroody: false },
    { code: "G-023", breed: "Isa Brown", birthDate: daysAgo(240), status: "activa", weight: "2.0", isBroody: false },
    { code: "G-024", breed: "Rhode Island Red", birthDate: daysAgo(250), status: "activa", weight: "2.7", isBroody: false },
    { code: "G-025", breed: "Leghorn", birthDate: daysAgo(195), status: "activa", weight: "1.8", isBroody: false },
    { code: "G-026", breed: "Araucana", birthDate: daysAgo(215), status: "activa", weight: "2.1", isBroody: false },
    { code: "G-027", breed: "Isa Brown", birthDate: daysAgo(260), status: "activa", weight: "2.3", isBroody: false },
    { code: "G-028", breed: "Plymouth Rock", birthDate: daysAgo(200), status: "empollando", weight: "2.4", isBroody: true, clutchSize: 10 },
    { code: "G-029", breed: "Marans", birthDate: daysAgo(225), status: "activa", weight: "2.2", isBroody: false },
    { code: "G-030", breed: "Criolla", birthDate: daysAgo(270), status: "enferma", weight: "1.9", isBroody: false },
    // === FIN DE POSTURA (2) — edad > 80 semanas → recomendación de sacrificio ===
    { code: "G-031", breed: "Rhode Island Red", birthDate: daysAgo(600), status: "recomendada_sacrificio", weight: "2.6", isBroody: false },
    { code: "G-032", breed: "Criolla", birthDate: daysAgo(650), status: "recomendada_sacrificio", weight: "2.4", isBroody: false },
  ]).returning();

  // ——— Gallos reproductores (1 por cada 10 gallinas) ———
  await db.insert(roosters).values([
    { code: "GA-001", breed: "Rhode Island Red", birthDate: daysAgo(300), status: "activo", weight: "3.2" },
    { code: "GA-002", breed: "Criolla", birthDate: daysAgo(320), status: "activo", weight: "3.4" },
    { code: "GA-003", breed: "Plymouth Rock", birthDate: daysAgo(280), status: "activo", weight: "3.0" },
  ]);

  // ——— Lote de pollos de engorde (5 semanas de edad, aún no listo) ———
  const [createdBatch] = await db.insert(broilerBatches).values([
    { code: "L-001", breed: "Cobb 500", startDate: daysAgo(35), initialQuantity: 20, currentQuantity: 20, targetWeeks: 7, targetWeightKg: "2.5", avgWeightKg: "2.1", status: "activo", notes: "Lote de engorde comprado" },
  ]).returning();

  // ——— Alimentos / Inventario (stock INICIAL antes de los movimientos) ———
  // Los movimientos (compras y consumos) se insertan después y el stock final
  // se recalcula como: stock_inicial + entradas − consumos.
  // Consumo diario total estimado (acorde a 30 gallinas):
  //   Concentrado: ~0.94 kg/día | BSF: ~0.35 kg/día | Pastos: ~0.45 kg/día
  //   Maíz germinado: ~0.23 kg/día | Bore: ~0.09 kg/día | Maíz comprado: ~0.26 kg/día
  await db.insert(feedInventory).values([
    { name: "Larvas de BSF deshidratadas", category: "granja_procesado", feedType: "mosca_soldado", unit: "kg", currentStock: "20", minStock: "20", costPerUnit: "8000", supplier: null },
    { name: "Maíz germinado", category: "granja_procesado", feedType: "maiz_germinado", unit: "kg", currentStock: "15", minStock: "8", costPerUnit: "3000", supplier: null },
    { name: "Pastos y gramíneas", category: "granja_fresco", feedType: "pastos_gramineas", unit: "kg", currentStock: "35", minStock: "40", costPerUnit: "0", supplier: "Producción propia" },
    { name: "Bore / Raíces", category: "granja_fresco", feedType: "bore_raices", unit: "kg", currentStock: "8", minStock: "5", costPerUnit: "0", supplier: "Producción propia" },
    { name: "Concentrado comercial", category: "suplementario", feedType: "concentrado_comercial", unit: "kg", currentStock: "40", minStock: "60", costPerUnit: "9500", supplier: "Agrosupply" },
    { name: "Maíz comprado", category: "suplementario", feedType: "maiz_comprado", unit: "kg", currentStock: "12", minStock: "18", costPerUnit: "4500", supplier: "Mercado local" },
  ]);

  // ——— Programas de alimentación por etapa ———
  const feeds = await db.select().from(feedInventory);
  const bsf = feeds.find((f) => f.feedType === "mosca_soldado")!;
  const maizGerminado = feeds.find((f) => f.feedType === "maiz_germinado")!;
  const pastos = feeds.find((f) => f.feedType === "pastos_gramineas")!;
  const bore = feeds.find((f) => f.feedType === "bore_raices")!;
  const concentrado = feeds.find((f) => f.feedType === "concentrado_comercial")!;
  const maizComprado = feeds.find((f) => f.feedType === "maiz_comprado")!;

  const pollito = createdStages.find((s) => s.value === "Pollito")!;
  const juvenil = createdStages.find((s) => s.value === "Juvenil")!;
  const prePostura = createdStages.find((s) => s.value === "Pre-postura")!;
  const postura = createdStages.find((s) => s.value === "Postura")!;

  await db.insert(feedPrograms).values([
    // Pollito (0-6 sem): SOLO concentrado comercial, alta proteína, ración pequeña
    { stageCatalogoId: pollito.id, feedId: concentrado.id, percentage: "100", dailyAmountPerHen: "30" },
    // Juvenil (6-18 sem): se introducen pastos, BSF y maíz germinado de forma progresiva
    { stageCatalogoId: juvenil.id, feedId: concentrado.id, percentage: "40", dailyAmountPerHen: "24" },
    { stageCatalogoId: juvenil.id, feedId: pastos.id, percentage: "25", dailyAmountPerHen: "15" },
    { stageCatalogoId: juvenil.id, feedId: bsf.id, percentage: "20", dailyAmountPerHen: "12" },
    { stageCatalogoId: juvenil.id, feedId: maizGerminado.id, percentage: "15", dailyAmountPerHen: "9" },
    // Pre-postura (18-20 sem): dieta completa pre-puesta (se suma maíz comprado y bore)
    { stageCatalogoId: prePostura.id, feedId: concentrado.id, percentage: "40", dailyAmountPerHen: "32" },
    { stageCatalogoId: prePostura.id, feedId: pastos.id, percentage: "20", dailyAmountPerHen: "16" },
    { stageCatalogoId: prePostura.id, feedId: bsf.id, percentage: "15", dailyAmountPerHen: "12" },
    { stageCatalogoId: prePostura.id, feedId: maizComprado.id, percentage: "15", dailyAmountPerHen: "12" },
    { stageCatalogoId: prePostura.id, feedId: maizGerminado.id, percentage: "5", dailyAmountPerHen: "4" },
    { stageCatalogoId: prePostura.id, feedId: bore.id, percentage: "5", dailyAmountPerHen: "4" },
    // Postura (20+ sem): come de todo, máximo consumo, dieta de producción
    { stageCatalogoId: postura.id, feedId: concentrado.id, percentage: "35", dailyAmountPerHen: "35" },
    { stageCatalogoId: postura.id, feedId: pastos.id, percentage: "20", dailyAmountPerHen: "20" },
    { stageCatalogoId: postura.id, feedId: bsf.id, percentage: "15", dailyAmountPerHen: "15" },
    { stageCatalogoId: postura.id, feedId: maizComprado.id, percentage: "15", dailyAmountPerHen: "15" },
    { stageCatalogoId: postura.id, feedId: maizGerminado.id, percentage: "10", dailyAmountPerHen: "10" },
    { stageCatalogoId: postura.id, feedId: bore.id, percentage: "5", dailyAmountPerHen: "5" },
  ]);

  // ——— Gallinaza: factores de producción (kg/ave/día, editables desde la UI) ———
  await db.insert(manureFactors).values([
    { stageCatalogoId: pollito.id, birdGroup: "etapa", kgPerBirdPerDay: "0.05" },
    { stageCatalogoId: juvenil.id, birdGroup: "etapa", kgPerBirdPerDay: "0.08" },
    { stageCatalogoId: prePostura.id, birdGroup: "etapa", kgPerBirdPerDay: "0.11" },
    { stageCatalogoId: postura.id, birdGroup: "etapa", kgPerBirdPerDay: "0.13" },
    { birdGroup: "gallo", kgPerBirdPerDay: "0.15" },
    { birdGroup: "lote", kgPerBirdPerDay: "0.10" },
  ]);

  // ——— Gallinaza: venta de ejemplo + transacción vinculada ———
  const [manureSale] = await db.insert(manureSales).values({
    date: daysAgo(3),
    quantityKg: "25",
    pricePerKg: "800",
    totalAmount: "20000",
    presentation: "Bulto 25 kg",
    buyer: "Finca La Esperanza",
    notes: "Abono compostado",
  }).returning();
  await db.insert(transactions).values({
    date: daysAgo(3),
    type: "ingreso",
    category: "Venta de abono/gallinaza",
    description: "Venta de gallinaza (25 kg)",
    counterparty: "Finca La Esperanza",
    amount: "20000",
    quantity: "25",
    unitPrice: "800",
    unit: "kg",
    sourceType: "gallinaza",
    sourceId: manureSale.id,
  });

  // ——— Gallinaza: ajuste de ejemplo ———
  await db.insert(manureAdjustments).values({
    date: daysAgo(2),
    deltaKg: "5",
    reason: "Medición real de la pila de compostaje",
  });

  // ——— Movimientos de alimento (últimos 30 días, acordes a 30 gallinas) ———
  // Distribución por etapa: Pollito=5, Juvenil=7, Pre-postura=3, Postura=15
  // La dieta replica los programas: Pollito solo concentrado; el resto progresa
  // hasta que Pre-postura y Postura comen de todos los alimentos.
  const feedIds = await db.select().from(feedInventory);
  const movData = [];
  for (let d = 29; d >= 1; d--) {
    const date = daysAgo(d);
    // Consumo Postura (15 gallinas, come de todo)
    movData.push({ feedId: concentrado.id, quantity: "0.525", isEntry: false, stageCatalogoId: postura.id, henCount: 15, date, notes: "Consumo diario postura" });
    movData.push({ feedId: pastos.id, quantity: "0.30", isEntry: false, stageCatalogoId: postura.id, henCount: 15, date, notes: "Pastos postura" });
    movData.push({ feedId: bsf.id, quantity: "0.225", isEntry: false, stageCatalogoId: postura.id, henCount: 15, date, notes: "BSF postura" });
    movData.push({ feedId: maizComprado.id, quantity: "0.225", isEntry: false, stageCatalogoId: postura.id, henCount: 15, date, notes: "Maíz comprado postura" });
    movData.push({ feedId: maizGerminado.id, quantity: "0.15", isEntry: false, stageCatalogoId: postura.id, henCount: 15, date, notes: "Maíz germinado postura" });
    movData.push({ feedId: bore.id, quantity: "0.075", isEntry: false, stageCatalogoId: postura.id, henCount: 15, date, notes: "Bore postura" });
    // Consumo Pre-postura (3 gallinas, come de todo en menor cantidad)
    movData.push({ feedId: concentrado.id, quantity: "0.096", isEntry: false, stageCatalogoId: prePostura.id, henCount: 3, date, notes: "Consumo pre-postura" });
    movData.push({ feedId: pastos.id, quantity: "0.048", isEntry: false, stageCatalogoId: prePostura.id, henCount: 3, date, notes: "Pastos pre-postura" });
    movData.push({ feedId: bsf.id, quantity: "0.036", isEntry: false, stageCatalogoId: prePostura.id, henCount: 3, date, notes: "BSF pre-postura" });
    movData.push({ feedId: maizComprado.id, quantity: "0.036", isEntry: false, stageCatalogoId: prePostura.id, henCount: 3, date, notes: "Maíz comprado pre-postura" });
    movData.push({ feedId: maizGerminado.id, quantity: "0.012", isEntry: false, stageCatalogoId: prePostura.id, henCount: 3, date, notes: "Maíz germinado pre-postura" });
    movData.push({ feedId: bore.id, quantity: "0.012", isEntry: false, stageCatalogoId: prePostura.id, henCount: 3, date, notes: "Bore pre-postura" });
    // Consumo Juvenil (7 gallinas: pastos, BSF y maíz germinado introducidos)
    movData.push({ feedId: concentrado.id, quantity: "0.168", isEntry: false, stageCatalogoId: juvenil.id, henCount: 7, date, notes: "Consumo juvenil" });
    movData.push({ feedId: pastos.id, quantity: "0.105", isEntry: false, stageCatalogoId: juvenil.id, henCount: 7, date, notes: "Pastos juvenil" });
    movData.push({ feedId: bsf.id, quantity: "0.084", isEntry: false, stageCatalogoId: juvenil.id, henCount: 7, date, notes: "BSF juvenil" });
    movData.push({ feedId: maizGerminado.id, quantity: "0.063", isEntry: false, stageCatalogoId: juvenil.id, henCount: 7, date, notes: "Maíz germinado juvenil" });
    // Consumo Pollito (5 gallinas: SOLO concentrado)
    movData.push({ feedId: concentrado.id, quantity: "0.15", isEntry: false, stageCatalogoId: pollito.id, henCount: 5, date, notes: "Consumo pollito" });
  }
  // Entradas de compra (reposición de stock)
  movData.push({ feedId: concentrado.id, quantity: "50", isEntry: true, date: daysAgo(10), notes: "Compra de concentrado comercial" });
  movData.push({ feedId: maizComprado.id, quantity: "40", isEntry: true, date: daysAgo(15), notes: "Compra de maíz" });
  movData.push({ feedId: bsf.id, quantity: "10", isEntry: true, date: daysAgo(8), notes: "Compra de larvas BSF" });
  movData.push({ feedId: pastos.id, quantity: "30", isEntry: true, date: daysAgo(5), notes: "Recolección de pastos" });

  // Los consumos del seed simulan la ejecución del programa: se marcan autoGenerated
  // y el motivo queda clasificado (consumo_programa para salidas, compra para entradas).
  const seededMovements = movData.map((m) => ({
    ...m,
    movementType: m.isEntry ? "compra" : "consumo_programa",
    autoGenerated: m.isEntry ? false : true,
  }));
  await db.insert(feedMovements).values(seededMovements as any).returning();

  // ——— Recalcular stock final = stock_inicial + entradas − consumos ———
  // La suma de movimientos por alimento define el inventario real (misma regla
  // que /api/produccion/alimentacion/movimientos). Los stocks del seed ya incluían
  // movimientos previos; aquí se recalcula para que queden consistentes.
  for (const f of feedIds) {
    const [agg] = await db.select({
      net: sql`COALESCE(SUM(CASE WHEN is_entry THEN quantity::numeric ELSE -quantity::numeric END), 0)`,
    }).from(feedMovements).where(eq(feedMovements.feedId, f.id));
    const final = (Number(f.currentStock) + Number(agg?.net ?? 0)).toFixed(2);
    await db.update(feedInventory).set({ currentStock: final, updatedAt: new Date() }).where(eq(feedInventory.id, f.id));
  }

  // Registrar las entradas de compra como egresos vinculados (misma regla que /api/produccion/alimentacion/movimientos):
  // solo alimentos "suplementario" con costo > 0 generan transacción
  const createdMovements = await db.select().from(feedMovements);
  const feedById = new Map(feedIds.map((f) => [f.id, f]));
  const purchaseTxs = createdMovements
    .filter((m) => {
      const f = feedById.get(m.feedId);
      return m.isEntry && f?.category === "suplementario" && Number(f.costPerUnit) > 0;
    })
    .map((m) => {
      const f = feedById.get(m.feedId)!;
      return {
        date: m.date,
        type: "egreso" as const,
        category: "Compra de alimento",
        description: `Compra de ${m.quantity} ${f.unit} de ${f.name}`,
        counterparty: f.supplier || null,
        amount: (Number(m.quantity) * Number(f.costPerUnit)).toFixed(2),
        quantity: m.quantity,
        unitPrice: f.costPerUnit,
        unit: f.unit,
        sourceType: "alimento",
        sourceId: m.id,
      };
    });

  // ——— Producción de huevos por tamaño (últimos 14 días) ———
  // Esperado: ~13 huevos/día (15 postura × 0.85 + 3 pre-postura × 0.3)
  // Distribución realista por tamaño:
  const EGG_SIZES = ["Jumbo", "Extra", "Grande", "Mediano", "Pequeño"];
  const sizeDistribution = [
    { size: "Jumbo", min: 0, max: 2 },
    { size: "Extra", min: 1, max: 3 },
    { size: "Grande", min: 3, max: 6 },
    { size: "Mediano", min: 2, max: 4 },
    { size: "Pequeño", min: 1, max: 3 },
  ];

  for (let d = 13; d >= 0; d--) {
    const date = daysAgo(d);
    const quantities: Record<string, number> = {};
    let total = 0;
    for (const { size, min, max } of sizeDistribution) {
      const q = min + Math.floor(Math.random() * (max - min + 1));
      quantities[size] = q;
      total += q;
    }
    const broken = Math.floor(Math.random() * 2); // 0-1
    const incub = Math.floor(Math.random() * 2); // 0-1
    const [created] = await db.insert(eggProduction).values({
      date,
      totalCollected: total + broken + incub,
      broken,
      forIncubation: incub,
    }).returning();
    await db.insert(eggProductionDetails).values(
      EGG_SIZES.map((size) => ({ productionId: created.id, size, quantity: quantities[size] }))
    );
  }

  // ——— Ventas (acordes a producción realista, ~13 huevos/día) ———
  // Ventas totales en 14 días: ~100 huevos (de ~180 producidos)
  // Precios por presentación: Docena $7,200, Bandeja/Cubeta $15,000, Unidad $600
  const salesData = [
    { date: daysAgo(2), quantity: 12, size: "Grande", pricePerUnit: "7200", totalAmount: "7200", buyer: "Tienda Doña Rosa", presentation: "Docena" },
    { date: daysAgo(4), quantity: 8, size: "Mediano", pricePerUnit: "600", totalAmount: "4800", buyer: "Venta callejera", presentation: "Unidad" },
    { date: daysAgo(6), quantity: 30, size: "Grande", pricePerUnit: "15000", totalAmount: "15000", buyer: "Restaurante La Granja", presentation: "Bandeja/Cubeta" },
    { date: daysAgo(8), quantity: 6, size: "Extra", pricePerUnit: "3600", totalAmount: "3600", buyer: "Tienda Doña Rosa", presentation: "Media docena" },
    { date: daysAgo(10), quantity: 10, size: "Pequeño", pricePerUnit: "600", totalAmount: "6000", buyer: "Venta callejera", presentation: "Unidad" },
    { date: daysAgo(12), quantity: 5, size: "Jumbo", pricePerUnit: "800", totalAmount: "4000", buyer: null, presentation: "Unidad" },
    { date: daysAgo(13), quantity: 15, size: "Mediano", pricePerUnit: "7500", totalAmount: "7500", buyer: "Mercado Don Juan", presentation: "1/2 Bandeja" },
  ];
  const createdEggSales = await db.insert(eggSales).values(salesData).returning();

  // Detalle por tamaño de cada venta (una sola talla por venta en el seed)
  await db.insert(eggSalesItems).values(
    createdEggSales.map((s) => ({
      saleId: s.id,
      size: s.size!,
      quantity: s.quantity,
      pricePerUnit: s.pricePerUnit,
      totalAmount: s.totalAmount,
      presentation: s.presentation,
    }))
  );

  // ——— Sacrificio / Producción de carne (producción pura, va a inventario) ———
  const createdSlaughter = await db.insert(slaughter).values([
    { date: daysAgo(3), birdType: "pollo", quantity: 3, weightKg: "6.5", destination: "consumo_propio", batchId: createdBatch.id, notes: "Pollos del lote L-001 para consumo de la familia" },
    { date: daysAgo(10), birdType: "gallina_descarte", quantity: 1, weightKg: "2.2", destination: "consumo_propio", henId: createdHens[23]?.id, notes: "Gallina G-024 sacrificada" },
    { date: daysAgo(18), birdType: "pollo", quantity: 5, weightKg: "11.0", destination: "consumo_propio", batchId: createdBatch.id, notes: "Pollos del lote L-001 sacrificados" },
  ]).returning();

  // ——— Ventas de carne (desde inventario, separado del sacrificio) ———
  const createdMeatSales = await db.insert(meatSales).values([
    { date: daysAgo(7), quantityKg: "6.5", pricePerKg: "10000", totalAmount: "65000", presentation: "Pollo entero", buyer: "Restaurante La Granja", notes: "Venta de carne de pollo" },
    { date: daysAgo(15), quantityKg: "2.2", pricePerKg: "12000", totalAmount: "26400", presentation: "Gallina entera", buyer: "Mercado Don Juan", notes: "Carne de gallina de descarte" },
  ]).returning();

  // ——— Pérdidas de carne ———
  await db.insert(meatLosses).values([
    { date: daysAgo(5), quantityKg: "0.8", reason: "deterioro", notes: "Carne que no se vendió a tiempo" },
    { date: daysAgo(12), quantityKg: "0.3", reason: "merma", notes: "Pérdida por procesamiento" },
  ]);

  // ——— Producción de gallinaza (registros diarios) ———
  await db.insert(manureProduction).values([
    { date: daysAgo(1), kgProduced: "4.2", source: "estimado", notes: null },
    { date: daysAgo(2), kgProduced: "4.1", source: "estimado", notes: null },
    { date: daysAgo(3), kgProduced: "4.3", source: "estimado", notes: null },
    { date: daysAgo(4), kgProduced: "4.0", source: "estimado", notes: null },
    { date: daysAgo(5), kgProduced: "4.2", source: "estimado", notes: null },
    { date: daysAgo(6), kgProduced: "4.1", source: "estimado", notes: null },
    { date: daysAgo(7), kgProduced: "4.4", source: "estimado", notes: null },
    { date: daysAgo(10), kgProduced: "5.0", source: "real", notes: "Medición real de la pila" },
    { date: daysAgo(14), kgProduced: "4.5", source: "estimado", notes: null },
    { date: daysAgo(21), kgProduced: "4.3", source: "estimado", notes: null },
  ]);

  // ——— Ventas de aves ———
  const createdChickenSales = await db.insert(chickenSales).values([
    { date: daysAgo(5), birdType: "gallina_descarte", quantity: 1, weightKg: "2.8", pricePerUnit: "25000", priceMode: "por_ave", totalAmount: "25000", buyer: "Mercado Don Juan", henId: createdHens[22]?.id, notes: "Gallina G-023 vendida en descarte" },
    { date: daysAgo(12), birdType: "pollo", quantity: 5, weightKg: "12.5", pricePerUnit: "8000", priceMode: "por_kg", totalAmount: "100000", buyer: "Restaurante La Granja", batchId: createdBatch.id, notes: "Pollos del lote L-001 para asado" },
    { date: daysAgo(20), birdType: "gallina_descarte", quantity: 1, weightKg: "2.8", pricePerUnit: "22000", priceMode: "por_ave", totalAmount: "22000", buyer: null, henId: createdHens[21]?.id, notes: "Gallina G-022 vendida" },
  ]).returning();

  // Aplicar descuentos de inventario de aves (consistente con la API):
  // - Gallinas vendidas/sacrificadas pasan a estado terminal
  // - El lote L-001 descuenta las salidas de pollo registradas
  await db.update(hens).set({ status: "vendida", updatedAt: new Date() }).where(eq(hens.id, createdHens[21]!.id)); // G-022
  await db.update(hens).set({ status: "vendida", updatedAt: new Date() }).where(eq(hens.id, createdHens[22]!.id)); // G-023
  await db.update(hens).set({ status: "faena", updatedAt: new Date() }).where(eq(hens.id, createdHens[23]!.id)); // G-024
  await db.update(broilerBatches).set({ currentQuantity: 20 - (3 + 5 + 5), updatedAt: new Date() }).where(eq(broilerBatches.id, createdBatch.id));

  // ——— Finanzas ———
  // Todas las transacciones vinculadas a sus registros de origen (sourceType/sourceId),
  // igual que lo hacen los módulos al operar, para que ingresos/egresos coincidan con finanzas.
  await db.insert(transactions).values([
    // Ingresos por venta de huevos (una transacción por venta)
    ...createdEggSales.map((s) => ({
      date: s.date,
      type: "ingreso" as const,
      category: "Venta de huevos",
      description: `Venta de ${s.quantity} ${s.size}${s.buyer ? ` a ${s.buyer}` : ""}`,
      amount: s.totalAmount,
      quantity: String(s.quantity),
      unitPrice: s.pricePerUnit,
      unit: "unidades",
      counterparty: s.buyer || null,
      sourceType: "venta",
      sourceId: s.id,
    })),
    // Ingresos por venta de aves
    ...createdChickenSales.map((s) => ({
      date: s.date,
      type: "ingreso" as const,
      category: "Venta de aves",
      description: `Venta de ${s.quantity} ${s.birdType.replace(/_/g, " ")}${s.weightKg ? ` (${s.weightKg} kg)` : ""}${s.buyer ? ` a ${s.buyer}` : ""}`,
      amount: s.totalAmount,
      quantity: String(s.quantity),
      unitPrice: s.pricePerUnit,
      unit: s.priceMode === "por_kg" ? "kg" : "aves",
      counterparty: s.buyer || null,
      sourceType: "venta_ave",
      sourceId: s.id,
    })),
    // Ingresos por venta de carne (desde meat_sales, separado del sacrificio)
    ...createdMeatSales.map((s) => ({
      date: s.date,
      type: "ingreso" as const,
      category: "Venta de carne",
      description: `Venta de ${s.quantityKg} kg de carne${s.buyer ? ` a ${s.buyer}` : ""}`,
      amount: s.totalAmount,
      quantity: s.quantityKg,
      unitPrice: s.pricePerKg,
      unit: "kg",
      counterparty: s.buyer || null,
      sourceType: "venta_carne",
      sourceId: s.id,
    })),
    // Egresos por compra de alimento (vinculados a movimientos de entrada)
    ...purchaseTxs,
    // Egresos manuales varios
    // Control sanitario con presentación: 1 unidad × $80,000
    { date: daysAgo(20), type: "egreso", category: "Control sanitario", description: "Vacuna Newcastle", counterparty: "Tienda veterinaria", amount: "80000", quantity: "1", unitPrice: "80000", unit: "unidades", presentation: "Unidad" },
    // Egreso sin presentación (servicio)
    { date: daysAgo(25), type: "egreso", category: "Mantenimiento", description: "Reparación de cerca perimetral", amount: "120000" },
    // Equipamiento con presentación: 10 unidades × $9,500
    { date: daysAgo(28), type: "egreso", category: "Equipamiento", description: "Comederos nuevos", counterparty: "Agrocentro El Campo", amount: "95000", quantity: "10", unitPrice: "9500", unit: "unidades", presentation: "Unidad" },
  ] as any);

  // ——— Incubación activa ———
  await db.insert(incubation).values({
    henId: (await db.select().from(hens).where(eq(hens.code, "G-028")))[0]?.id,
    startDate: daysAgo(5),
    expectedHatchDate: daysAgo(16),
    eggsSet: 10,
    notes: "Gallina Plymouth Rock empollando",
  });

  // ——— Mantenimiento ———
  await db.insert(maintenance).values([
    { title: "Limpieza y desinfección del gallinero", description: "Limpieza semanal de nidales y piso", scheduledDate: daysAgo(-3), status: "pendiente", cost: "0" },
    { title: "Cambio de cama / viruta", scheduledDate: daysAgo(2), status: "pendiente", cost: "0" },
    { title: "Revisión del sistema de agua", scheduledDate: daysAgo(10), status: "en_progreso", cost: "15000" },
    { title: "Reparación de cercas y malla", scheduledDate: daysAgo(20), status: "completado", completedDate: daysAgo(18), cost: "120000" },
  ]);

  // ——— Control sanitario ———
  await db.insert(healthControl).values([
    { date: daysAgo(20), type: "vacunacion", description: "Vacuna Newcastle viva - lote completo (30 gallinas)", affectedHens: "todas", product: "Newcastle B1", cost: "80000", nextScheduled: daysAgo(-40) },
    { date: daysAgo(3), type: "tratamiento", description: "Tratamiento para G-030 (síntomas respiratorios)", affectedHens: "G-030", product: "Antibiótico enológico", cost: "12000", nextScheduled: daysAgo(4) },
    { date: daysAgo(7), type: "desparasitacion", description: "Desparasitación preventiva - pollitos y juveniles", affectedHens: "G-001,G-002,G-003,G-004,G-005,G-006,G-007,G-008,G-009,G-010,G-011,G-012", product: "Levamisol", cost: "15000", nextScheduled: daysAgo(-30) },
  ]);

  // ——— Adquisiciones de aves ———
  await db.insert(birdAcquisitions).values([
    { date: daysAgo(60), acquisitionType: "compra", birdType: "gallina", quantity: 5, unitCost: "25000", totalCost: "125000", supplier: "Granja La Esperanza", breed: "Rhode Island Red", birthDate: daysAgo(90), notes: "Compra inicial de gallinas ponedoras" },
    { date: daysAgo(45), acquisitionType: "donacion", birdType: "gallo", quantity: 2, unitCost: "0", totalCost: "0", supplier: "Don José", breed: "Criolla", birthDate: daysAgo(120), notes: "Donación de gallos reproductores" },
    { date: daysAgo(35), acquisitionType: "pollito_comprado", birdType: "lote_pollos", quantity: 20, unitCost: "3000", totalCost: "60000", supplier: "Incubadora El Valle", breed: "Cobb 500", notes: "Lote de pollos de engorde" },
  ]);

  // ——— Registros de mortalidad ———
  await db.insert(mortalityRecords).values([
    { date: daysAgo(15), birdType: "gallina", quantity: 1, cause: "enfermedad", description: "Gallina G-018 encontrada muerta - síntomas respiratorios" },
    { date: daysAgo(8), birdType: "gallina", quantity: 1, cause: "depredador", description: "Gallina G-022 atacada por zarigüeya" },
    { date: daysAgo(3), birdType: "pollo_lote", quantity: 2, cause: "causa_natural", description: "2 pollitos del lote L-001 murieron por golpe de calor" },
  ]);

  // ——— Pérdidas de huevo ———
  await db.insert(eggLosses).values([
    { date: daysAgo(5), quantity: 3, size: "Extra", reason: "roto", notes: "Huevos rotos durante recolección" },
    { date: daysAgo(2), quantity: 2, size: "Mediano", reason: "contaminado", notes: "Huevos con cáscara sucia, no aptos para venta" },
    { date: daysAgo(1), quantity: 1, size: "Grande", reason: "deteriorado", notes: "Huevo deteriorado en almacenamiento" },
  ]);

  // ——— Inventario de insumos ———
  await db.insert(supplyInventory).values([
    { name: "Vacuna Newcastle B1", category: "vacuna", unit: "dosis", currentStock: "50", minStock: "20", costPerUnit: "1500", supplier: "VetMarket", expiryDate: daysAgo(-180) },
    { name: "Levamisol 10%", category: "medicina", unit: "ml", currentStock: "200", minStock: "100", costPerUnit: "80", supplier: "VetMarket", expiryDate: daysAgo(-90) },
    { name: "Desinfectante Amonio Cuaternario", category: "material", unit: "litros", currentStock: "5", minStock: "3", costPerUnit: "12000", supplier: "AgroLimpios" },
    { name: "Viruta para cama", category: "material", unit: "bultos", currentStock: "8", minStock: "5", costPerUnit: "8000", supplier: "Maderas del Valle" },
  ]);
  const [supply1] = await db.select({ id: supplyInventory.id }).from(supplyInventory).limit(1);

  // ——— Movimientos de insumos ———
  await db.insert(supplyMovements).values([
    { supplyId: supply1.id, quantity: "50", isEntry: true, movementType: "compra", date: daysAgo(30), notes: "Compra inicial de vacunas" },
    { supplyId: supply1.id, quantity: "30", isEntry: false, movementType: "uso", date: daysAgo(20), notes: "Aplicación en vacunación Newcastle" },
  ]);

  // ——— Presupuestos ———
  await db.insert(budgets).values({
    name: "Presupuesto Mensual Agosto",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    type: "general",
  });
  const [budgetRow] = await db.select({ id: budgets.id }).from(budgets).limit(1);
  const budgetId = budgetRow?.id || "";

  await db.insert(budgetItems).values([
    { budgetId, category: "Venta de huevos", description: "Ingreso mensual esperado", monthlyTarget: "500000", unit: "COP" },
    { budgetId, category: "Compra de alimento", description: "Gasto en alimento", monthlyTarget: "200000", unit: "COP" },
    { budgetId, category: "Control sanitario", description: "Vacunas y medicamentos", monthlyTarget: "50000", unit: "COP" },
    { budgetId, category: "Mantenimiento", description: "Reparaciones e insumos", monthlyTarget: "30000", unit: "COP" },
  ]);

  // ——— Cuentas por cobrar ———
  const [anyTx] = await db.select({ id: transactions.id }).from(transactions).limit(1);
  if (anyTx) {
    await db.update(transactions).set({ isCredit: true }).where(eq(transactions.id, anyTx.id));
    await db.insert(accountsReceivable).values({
      transactionId: anyTx.id,
      buyer: "Tienda La Esquina",
      totalAmount: "85000",
      paidAmount: "0",
      pendingAmount: "85000",
      dueDate: daysAgo(-15),
      status: "pendiente",
    });
  }

  // ——— Calendario sanitario ———
  await db.insert(sanitaryCalendar).values([
    { type: "vacunacion", name: "Vacunación Newcastle", description: "Vacunación contra Newcastle cada 90 días", targetBirds: "todas", frequencyDays: 90, nextDueDate: daysAgo(-20), withdrawalDays: 7, isActive: true },
    { type: "desparasitacion", name: "Desparasitación Interna", description: "Desparasitación preventiva cada 180 días", targetBirds: "todas", frequencyDays: 180, nextDueDate: daysAgo(-10), withdrawalDays: 14, isActive: true },
    { type: "inspeccion", name: "Inspección Sanitaria General", description: "Revisión general mensual", targetBirds: "todas", frequencyDays: 30, nextDueDate: daysAgo(-3), withdrawalDays: 0, isActive: true },
  ]);

  // ——— Plan de parvada ———
  await db.insert(flockPlans).values({
    name: "Parvada 2026",
    startDate: "2026-01-01",
    targetHenCount: 30,
    targetRoosterCount: 3,
    replacementDate: "2027-01-01",
    currentPhase: "postura",
    status: "activo",
  });
  const [planRow] = await db.select({ id: flockPlans.id }).from(flockPlans).limit(1);
  const planId = planRow?.id || "";

  await db.insert(flockPlanMilestones).values([
    { planId, weekNumber: 20, expectedHens: 30, expectedEggsPerWeek: 140, expectedFeedKgPerWeek: "42" },
    { planId, weekNumber: 30, expectedHens: 29, expectedEggsPerWeek: 150, expectedFeedKgPerWeek: "43.5" },
    { planId, weekNumber: 40, expectedHens: 28, expectedEggsPerWeek: 145, expectedFeedKgPerWeek: "42" },
  ]);

  console.log("✅ Datos de ejemplo insertados correctamente.");
  console.log("   📊 30 gallinas: 5 pollitos, 7 juveniles, 3 pre-postura, 15 postura");
  console.log("   🥚 Producción esperada: ~13 huevos/día");
}

function daysAgo(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().split("T")[0];
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
