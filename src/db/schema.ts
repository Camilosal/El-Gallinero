import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  date,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ───
export const animalSpeciesEnum = pgEnum("animal_species", [
  "gallina",
  "pollo",
  "codorniz",
  "pato",
  "conejo",
  "cuy",
]);

export const batchPurposeEnum = pgEnum("batch_purpose", [
  "engorde_carne",
  "postura_huevo",
  "pie_cria",
  "mixto",
]);

export const henStatusEnum = pgEnum("hen_status", [
  "activa",
  "empollando",
  "enferma",
  "descarte",
  "recomendada_sacrificio",
  "vendida",
  "faena",
  "muerta",
]);

export const feedCategoryEnum = pgEnum("feed_category", [
  // Valores históricos; se mantienen para los registros existentes.
  "granja_fresco",
  "granja_procesado",
  "suplementario",
  // Valores actuales del catálogo categoria_alimento.
  "Concentrado",
  "En Fresco",
  "Preparados",
]);

export const feedTypeEnum = pgEnum("feed_type", [
  // Valores históricos; se mantienen para los registros existentes.
  "mosca_soldado",
  "pastos_gramineas",
  "maiz_germinado",
  "bore_raices",
  "purinas",
  "maiz_comprado",
  "concentrado_comercial",
  "otro",
  // Valores actuales del catálogo tipo_alimento.
  "Bore o Raices",
  "Concentrado Aves",
  "Concentrado Codorniz",
  "Concentrado Conejos",
  "Forraje Verde",
  "Maiz en Grano",
  "Maíz Germinado",
  "Mosca Soldado",
  "Otro",
  "Pastos y gramíneas",
  "Purinas",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "ingreso",
  "egreso",
]);

// Motivo clasificado de un movimiento de alimento/inventario:
// - Entradas (isEntry=true): compra, donacion, traslado, produccion_propia, ajuste
// - Salidas (isEntry=false): consumo_programa, consumo_manual, venta, uso_interno, merma, traslado, ajuste
// 'otro' cubre cualquier motivo no clasificado (default).
export const feedMovementTypeEnum = pgEnum("feed_movement_type", [
  "compra",
  "donacion",
  "traslado",
  "produccion_propia",
  "ajuste",
  "consumo_programa",
  "consumo_manual",
  "venta",
  "uso_interno",
  "merma",
  "otro",
]);

const farmIdCol = () =>
  uuid("farm_id")
    .default(
      sql`COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid)`,
    )
    .notNull();

// ─── Multi-Tenancy & Suscripciones SaaS ───
export const farms = pgTable("farms", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  deploymentMode: varchar("deployment_mode", { length: 20 }).default("saas").notNull(),
  ownerUserId: uuid("owner_user_id"),
  qrSource: varchar("qr_source", { length: 120 }),
  allyCode: varchar("ally_code", { length: 120 }),
  planCode: varchar("plan_code", { length: 40 }).default("FREEMIUM_SEMILLA").notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const farmSubscriptions = pgTable("farm_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id").references(() => farms.id, { onDelete: "cascade" }).notNull(),
  planCode: varchar("plan_code", { length: 40 }).default("FREEMIUM_SEMILLA").notNull(),
  status: varchar("status", { length: 20 }).default("trial").notNull(), // trial | active | grace | expired
  maxActiveBatches: integer("max_active_batches"),
  maxUsers: integer("max_users").default(2).notNull(),
  currentPeriodStart: timestamp("current_period_start").defaultNow().notNull(),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("farm_subscriptions_farm_unique_idx").on(t.farmId),
]);

export const billingPayments = pgTable("billing_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  farmId: uuid("farm_id").references(() => farms.id, { onDelete: "cascade" }).notNull(),
  provider: varchar("provider", { length: 30 }).default("wompi").notNull(),
  externalReference: varchar("external_reference", { length: 120 }).unique().notNull(),
  providerTxId: varchar("provider_tx_id", { length: 120 }),
  method: varchar("method", { length: 30 }).notNull(), // nequi | daviplata | pse
  amountCop: integer("amount_cop").notNull(),
  planCode: varchar("plan_code", { length: 40 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending | approved | declined
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const maintenanceStatusEnum = pgEnum("maintenance_status", [
  "pendiente",
  "en_progreso",
  "completado",
]);

export const roosterStatusEnum = pgEnum("rooster_status", [
  "activo",
  "enfermo",
  "vendido",
  "faena",
  "muerto",
]);

export const broilerBatchStatusEnum = pgEnum("broiler_batch_status", [
  "activo",
  "listo_sacrificio",
  "vendido",
  "faena",
]);

export const mortalityCauseEnum = pgEnum("mortality_cause", [
  "enfermedad",
  "depredador",
  "accidente",
  "sacrificio_sanitario",
  "causa_natural",
  "otro",
]);

// ─── Ubicaciones físicas de la finca ───
export const farmLocations = pgTable("farm_locations", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(), // corral, jaula, galpon, potrero, jardin, patio, otro
  parentLocationId: uuid("parent_location_id").references((): AnyPgColumn => farmLocations.id, { onDelete: "set null" }),
  description: text("description"),
  localReference: text("local_reference"), // instrucciones para encontrarla dentro del predio
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  areaM2: decimal("area_m2", { precision: 12, scale: 2 }),
  capacity: integer("capacity"),
  status: varchar("status", { length: 20 }).default("activa").notNull(),
  operationalStatus: varchar("operational_status", { length: 30 }).default("operativa").notNull(),
  sanitaryStatus: varchar("sanitary_status", { length: 30 }).default("pendiente_revision").notNull(),
  sanitaryRequirements: text("sanitary_requirements"),
  sanitaryReviewedAt: date("sanitary_reviewed_at"),
  operationalReviewedAt: date("operational_reviewed_at"),
  maintenanceNeeds: text("maintenance_needs"),
  zoneType: varchar("zone_type", { length: 30 }).default("produccion").notNull(), // limpia | sucia | produccion | cuarentena | almacen | forraje
  allowedSpecies: jsonb("allowed_species").$type<string[]>().default([]).notNull(),
  sanitaryEmptyUntil: date("sanitary_empty_until"),
  altitudeMeters: integer("altitude_meters"),
  floorType: varchar("floor_type", { length: 40 }),
  environmentalTempC: decimal("environmental_temp_c", { precision: 5, scale: 2 }),
  isQuarantine: boolean("is_quarantine").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("farm_locations_code_unique_idx").on(t.farmId, t.code),
  check("farm_locations_type_valid", sql`${t.type} IN ('corral', 'jaula', 'galpon', 'potrero', 'jardin', 'patio', 'compostaje', 'bodega', 'cuarentena', 'otro')`),
  check("farm_locations_zone_type_valid", sql`${t.zoneType} IN ('limpia', 'sucia', 'produccion', 'cuarentena', 'almacen', 'forraje')`),
  check("farm_locations_status_valid", sql`${t.status} IN ('activa', 'inactiva')`),
  check("farm_locations_operational_status_valid", sql`${t.operationalStatus} IN ('operativa', 'mantenimiento', 'restringida', 'fuera_servicio')`),
  check("farm_locations_sanitary_status_valid", sql`${t.sanitaryStatus} IN ('pendiente_revision', 'cumple', 'requiere_atencion', 'no_cumple')`),
  check("farm_locations_latitude_range", sql`${t.latitude} IS NULL OR (${t.latitude} >= -90 AND ${t.latitude} <= 90)`),
  check("farm_locations_longitude_range", sql`${t.longitude} IS NULL OR (${t.longitude} >= -180 AND ${t.longitude} <= 180)`),
  check("farm_locations_capacity_nonnegative", sql`${t.capacity} IS NULL OR ${t.capacity} >= 0`),
]);

// ─── Gallinas ───
export const hens = pgTable("hens", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  breed: varchar("breed", { length: 100 }).notNull(),
  birthDate: date("birth_date").notNull(),
  status: henStatusEnum("status").default("activa").notNull(),
  weight: decimal("weight", { precision: 6, scale: 2 }),
  notes: text("notes"),
  isBroody: boolean("is_broody").default(false).notNull(),
  clutchSize: integer("clutch_size").default(0),
  acquisitionId: uuid("acquisition_id").references((): AnyPgColumn => birdAcquisitions.id),
  acquisitionCost: decimal("acquisition_cost", { precision: 10, scale: 2 }),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("hens_code_unique_idx").on(t.farmId, t.code)]);

// ─── Alimentos / Feed inventory ───
export const feedInventory = pgTable("feed_inventory", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  category: feedCategoryEnum("category").notNull(),
  feedType: feedTypeEnum("feed_type").notNull(),
  unit: varchar("unit", { length: 30 }).notNull(), // kg, lb, litros
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).default("0").notNull(),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).default("0").notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).default("0").notNull(),
  supplier: varchar("supplier", { length: 200 }),
  dryMatterPct: decimal("dry_matter_pct", { precision: 5, scale: 2 }), // % materia seca (forrajes frescos ~20-30, concentrado ~88-90)
  crudeProteinPct: decimal("crude_protein_pct", { precision: 5, scale: 2 }), // % proteína cruda en base fresca
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Activos y equipos de la finca ───
export const farmAssets = pgTable("farm_assets", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 30 }).default("equipo").notNull(),
  brand: varchar("brand", { length: 120 }),
  model: varchar("model", { length: 120 }),
  serialNumber: varchar("serial_number", { length: 150 }),
  acquisitionDate: date("acquisition_date"),
  acquisitionCost: decimal("acquisition_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  warrantyUntil: date("warranty_until"),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  status: varchar("status", { length: 30 }).default("operativo").notNull(),
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("farm_assets_code_unique_idx").on(t.farmId, t.code),
  check("farm_assets_category_valid", sql`${t.category} IN ('equipo', 'herramienta', 'estructura', 'vehiculo', 'otro')`),
  check("farm_assets_status_valid", sql`${t.status} IN ('operativo', 'requiere_mantenimiento', 'fuera_servicio', 'retirado')`),
  check("farm_assets_acquisition_cost_nonnegative", sql`${t.acquisitionCost} >= 0`),
]);

// ─── Movimientos de alimento ───
export const feedMovements = pgTable("feed_movements", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  feedId: uuid("feed_id").references(() => feedInventory.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  isEntry: boolean("is_entry").notNull(), // true = entrada, false = consumo
  movementType: feedMovementTypeEnum("movement_type").default("otro").notNull(), // motivo clasificado (compra, donación, consumo, merma…)
  autoGenerated: boolean("auto_generated").default(false).notNull(), // true = generado por programa alimenticio
  stageCatalogoId: uuid("stage_catalogo_id").references(() => catalogos.id), // etapa destino (solo consumo)
  henCount: integer("hen_count"), // animales en el grupo al momento del consumo
  species: varchar("species", { length: 20 }), // especie que consumió (consumos de programa)
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }), // costo por unidad del alimento al momento del consumo
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Producción de huevos ───
export const eggProduction = pgTable("egg_production", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: animalSpeciesEnum("species").default("gallina").notNull(),
  batchId: uuid("batch_id").references(() => broilerBatches.id), // lote atribuible (ej. lote de codornices)
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  totalCollected: integer("total_collected").notNull(),
  broken: integer("broken").default(0).notNull(),
  discarded: integer("discarded").default(0).notNull(),
  forIncubation: integer("for_incubation").default(0).notNull(),
  quantityAutoconsumo: integer("quantity_autoconsumo").default(0).notNull(), // asignación a consumo familiar
  quantityExcedente: integer("quantity_excedente").default(0).notNull(),     // excedente para venta
  referenceUnitPrice: decimal("reference_unit_price", { precision: 10, scale: 2 }), // valor de mercado para ahorro de autoconsumo
  lotCode: varchar("lot_code", { length: 60 }), // código de lote PEPS
  storageTempC: decimal("storage_temp_c", { precision: 4, scale: 1 }),
  storageHumidityPct: decimal("storage_humidity_pct", { precision: 5, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Detalle de producción por tamaño de huevo ───
export const eggProductionDetails = pgTable("egg_production_details", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  productionId: uuid("production_id").references(() => eggProduction.id, { onDelete: "cascade" }).notNull(),
  size: varchar("size", { length: 50 }).notNull(),
  quantity: integer("quantity").default(0).notNull(),
}, (t) => [
  uniqueIndex("egg_prod_size_idx").on(t.productionId, t.size),
]);

// ─── Incubación / Reproducción ───
export const incubation = pgTable("incubation", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  species: animalSpeciesEnum("species").default("gallina").notNull(),
  henId: uuid("hen_id").references(() => hens.id),
  roosterId: uuid("rooster_id").references(() => roosters.id, { onDelete: "set null" }),
  roosterCode: varchar("rooster_code", { length: 50 }), // snapshot in case the rooster is later removed
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  incubatorName: varchar("incubator_name", { length: 120 }),
  trayCode: varchar("tray_code", { length: 60 }),
  startDate: date("start_date").notNull(),
  turnStopDate: date("turn_stop_date"),
  expectedHatchDate: date("expected_hatch_date").notNull(),
  humidityTargetPct: decimal("humidity_target_pct", { precision: 5, scale: 2 }),
  tempTargetC: decimal("temp_target_c", { precision: 4, scale: 1 }),
  eggsSet: integer("eggs_set").notNull(),
  fertileEggs: integer("fertile_eggs"),
  discardedEggs: integer("discarded_eggs").default(0),
  eggsHatched: integer("eggs_hatched").default(0),
  malesHatched: integer("males_hatched"),
  femalesHatched: integer("females_hatched"),
  isComplete: boolean("is_complete").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Gallos reproductores ───
export const roosters = pgTable("roosters", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  breed: varchar("breed", { length: 100 }).notNull(),
  birthDate: date("birth_date").notNull(),
  status: roosterStatusEnum("status").default("activo").notNull(),
  weight: decimal("weight", { precision: 6, scale: 2 }),
  notes: text("notes"),
  acquisitionId: uuid("acquisition_id").references((): AnyPgColumn => birdAcquisitions.id),
  acquisitionCost: decimal("acquisition_cost", { precision: 10, scale: 2 }),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("roosters_code_unique_idx").on(t.farmId, t.code)]);

// ─── Lotes de producción / engorde multi-especie ───
export const broilerBatches = pgTable("broiler_batches", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  species: animalSpeciesEnum("species").default("pollo").notNull(),
  purpose: batchPurposeEnum("purpose").default("engorde_carne").notNull(),
  systemType: varchar("system_type", { length: 50 }).default("piso"), // jaula, pastoreo, piso, baterias
  breed: varchar("breed", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  initialQuantity: integer("initial_quantity").notNull(),
  currentQuantity: integer("current_quantity").notNull(),
  targetWeeks: integer("target_weeks").default(7).notNull(),
  targetDays: integer("target_days"),
  targetWeightKg: decimal("target_weight_kg", { precision: 6, scale: 2 }).default("2.5").notNull(),
  avgWeightKg: decimal("avg_weight_kg", { precision: 6, scale: 2 }),
  feedConversionTarget: decimal("feed_conversion_target", { precision: 4, scale: 2 }),
  status: broilerBatchStatusEnum("status").default("activo").notNull(),
  notes: text("notes"),
  acquisitionId: uuid("acquisition_id").references(() => birdAcquisitions.id),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  totalProductionCost: decimal("total_production_cost", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("broiler_batches_code_unique_idx").on(t.farmId, t.code)]);

// ─── Traslados entre ubicaciones: una ficha individual o un lote completo ───
export const animalLocationMovements = pgTable("animal_location_movements", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  henId: uuid("hen_id").references(() => hens.id, { onDelete: "restrict" }),
  roosterId: uuid("rooster_id").references(() => roosters.id, { onDelete: "restrict" }),
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "restrict" }),
  fromLocationId: uuid("from_location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  toLocationId: uuid("to_location_id").references(() => farmLocations.id, { onDelete: "restrict" }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  date: date("date").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  check("animal_location_movement_single_target", sql`num_nonnulls(${t.henId}, ${t.roosterId}, ${t.batchId}) = 1`),
  check("animal_location_movement_distinct_places", sql`${t.fromLocationId} IS NULL OR ${t.fromLocationId} <> ${t.toLocationId}`),
  check("animal_location_movement_quantity_positive", sql`${t.quantity} > 0`),
]);

// ─── Ventas de huevos ───
export const eggSales = pgTable("egg_sales", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: animalSpeciesEnum("species").default("gallina").notNull(),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  lotCode: varchar("lot_code", { length: 60 }),
  quantity: integer("quantity").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  size: varchar("size", { length: 50 }),
  presentation: varchar("presentation", { length: 100 }),
  buyer: varchar("buyer", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Detalle de venta por tamaño de huevo ───
export const eggSalesItems = pgTable("egg_sales_items", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").references(() => eggSales.id, { onDelete: "cascade" }).notNull(),
  size: varchar("size", { length: 50 }).notNull(),
  quantity: integer("quantity").notNull(),
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  presentation: varchar("presentation", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Mantenimiento del gallinero ───
export const maintenance = pgTable("maintenance", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  scheduledDate: date("scheduled_date").notNull(),
  completedDate: date("completed_date"),
  status: maintenanceStatusEnum("status").default("pendiente").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  species: varchar("species", { length: 20 }),
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  assetId: uuid("asset_id").references(() => farmAssets.id, { onDelete: "set null" }),
  recurrenceSeriesId: uuid("recurrence_series_id").defaultRandom().notNull(),
  recurrenceParentId: uuid("recurrence_parent_id").references((): AnyPgColumn => maintenance.id, { onDelete: "set null" }),
  recurrenceIntervalDays: integer("recurrence_interval_days"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("maintenance_series_date_unique_idx").on(t.recurrenceSeriesId, t.scheduledDate),
  uniqueIndex("maintenance_parent_unique_idx").on(t.recurrenceParentId),
  check("maintenance_recurrence_interval_valid", sql`${t.recurrenceIntervalDays} IS NULL OR ${t.recurrenceIntervalDays} BETWEEN 1 AND 3650`),
]);

// ─── Control fitosanitario ───
export const healthControl = pgTable("health_control", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: varchar("species", { length: 20 }),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  type: varchar("type", { length: 100 }).notNull(), // vacunación, desparasitación, tratamiento, inspección
  description: text("description").notNull(),
  affectedHens: text("affected_hens"), // JSON array of hen IDs or "todas"
  previousAnimalStates: jsonb("previous_animal_states").$type<Record<string, { status: string; currentQuantity?: number }>>(),
  product: varchar("product", { length: 200 }),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  nextScheduled: date("next_scheduled"),
  withdrawalDays: integer("withdrawal_days").default(0).notNull(),
  withdrawalUntilDate: date("withdrawal_until_date"),
  vaccineLot: varchar("vaccine_lot", { length: 80 }),
  vaccineLab: varchar("vaccine_lab", { length: 120 }),
  vaccineExpiryDate: date("vaccine_expiry_date"),
  coldChainTempC: decimal("cold_chain_temp_c", { precision: 4, scale: 1 }),
  administrationRoute: varchar("administration_route", { length: 60 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Finanzas: transacciones ───
export const transactions = pgTable("transactions", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  type: transactionTypeEnum("type").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description").notNull(),
  counterparty: varchar("counterparty", { length: 200 }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 2 }),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),
  unit: varchar("unit", { length: 30 }),
  presentation: varchar("presentation", { length: 100 }),
  sourceType: varchar("source_type", { length: 50 }),
  sourceId: uuid("source_id"),
  species: varchar("species", { length: 20 }), // dimensión analítica: especie
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }), // dimensión analítica: lugar
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }), // dimensión analítica: lote
  isCredit: boolean("is_credit").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Usuarios ───
export const users = pgTable("users", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 100 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  recoveryCodeHash: varchar("recovery_code_hash", { length: 64 }),
  recoveryCodeIssuedAt: timestamp("recovery_code_issued_at"),
  name: varchar("name", { length: 200 }).notNull(),
  role: varchar("role", { length: 50 }).default("admin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sesiones ───
export const sessions = pgTable("sessions", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Catálogos / Datos maestros ───
export const catalogos = pgTable("catalogos", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  category: varchar("category", { length: 50 }).notNull(), // raza, comprador, proveedor, unidad_medida, etapa_crecimiento, ...
  value: varchar("value", { length: 200 }).notNull(),
  price: decimal("price", { precision: 12, scale: 2 }),
  units: integer("units"), // unidades por presentación (ej: docena = 12, caja x30 = 30)
  tipo: varchar("tipo", { length: 50 }), // subtipo: ej "huevos", "aves", "general" para presentacion_venta
  minWeeks: integer("min_weeks"), // semanas min (etapa_crecimiento) o semanas ciclo (params_especie)
  maxWeeks: integer("max_weeks"), // semanas max (etapa_crecimiento) o días ciclo (params_especie)
  expectedEggsPerHen: decimal("expected_eggs_per_hen", { precision: 4, scale: 2 }), // huevos/ave/día (etapa_crecimiento o params_especie)
  dailyFeedG: integer("daily_feed_g"), // consumo diario estimado en g/ave/día (params_especie)
  targetWeightKg: decimal("target_weight_kg", { precision: 6, scale: 2 }), // peso vivo objetivo en kg (params_especie)
  feedCostPerKg: decimal("feed_cost_per_kg", { precision: 10, scale: 2 }), // costo alimento estimado $/kg (params_especie)
  feedConversionRatio: decimal("feed_conversion_ratio", { precision: 4, scale: 2 }), // kg alimento / kg peso vivo (params_especie)
  systemType: varchar("system_type", { length: 50 }), // piso, jaula, pastoreo, baterias (params_especie)
  description: text("description"), // descripción / notas del registro
  eggPrice: decimal("egg_price", { precision: 10, scale: 2 }), // precio de referencia por huevo (params_especie)
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("catalogos_category_value_idx").on(t.farmId, t.category, t.value),
]);

// ─── Venta de animales en pie (aves, conejos, cuyes y lotes) ───
export const chickenSales = pgTable("chicken_sales", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: varchar("species", { length: 20 }), // gallina, gallo, pollo, codorniz, pato, conejo, cuy
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  birdType: varchar("bird_type", { length: 50 }).notNull(), // gallina_descarte, pollo, gallo, pollito, codorniz, pato, conejo, cuy
  quantity: integer("quantity").notNull(), // número de animales
  weightKg: decimal("weight_kg", { precision: 8, scale: 2 }), // peso total en kg
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }).notNull(), // precio por animal o por kg
  priceMode: varchar("price_mode", { length: 20 }).notNull().default("por_ave"), // por_ave o por_kg
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  buyer: varchar("buyer", { length: 200 }),
  presentation: varchar("presentation", { length: 100 }),
  henId: uuid("hen_id").references(() => hens.id), // gallina específica (opcional)
  roosterId: uuid("rooster_id").references(() => roosters.id), // gallo específico (opcional)
  batchId: uuid("batch_id").references(() => broilerBatches.id), // lote multiespecie (opcional)
  previousAnimalStates: jsonb("previous_animal_states").$type<Record<string, { status: string; currentQuantity?: number }>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sacrificio / Producción de carne ───
export const slaughter = pgTable("slaughter", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  species: animalSpeciesEnum("species").default("pollo").notNull(),
  birdType: varchar("bird_type", { length: 50 }).notNull(), // gallina_descarte, pollo, gallo, codorniz, pato, conejo
  quantity: integer("quantity").notNull(), // número de animales sacrificados
  liveWeightKg: decimal("live_weight_kg", { precision: 8, scale: 2 }), // peso vivo total antes de faena
  weightKg: decimal("weight_kg", { precision: 8, scale: 2 }).notNull(), // peso en canal limpia (kg)
  carcassYieldPercent: decimal("carcass_yield_percent", { precision: 5, scale: 2 }), // % rendimiento canal
  destination: varchar("destination", { length: 50 }).notNull().default("consumo_propio"), // venta, consumo_propio, mixto, donacion
  headsAutoconsumo: integer("heads_autoconsumo").default(0).notNull(), // cabezas para consumo doméstico
  weightKgAutoconsumo: decimal("weight_kg_autoconsumo", { precision: 8, scale: 2 }).default("0").notNull(), // kg canal para hogar
  headsExcedente: integer("heads_excedente").default(0).notNull(),     // cabezas para venta
  weightKgExcedente: decimal("weight_kg_excedente", { precision: 8, scale: 2 }).default("0").notNull(), // kg canal para venta
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }), // precio por kg si se vende
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }), // total si se vende
  marketReferencePricePerKg: decimal("market_reference_price_per_kg", { precision: 10, scale: 2 }), // precio de ref. de mercado
  estimatedSavingsAmount: decimal("estimated_savings_amount", { precision: 12, scale: 2 }), // valor económico generado para autoconsumo
  henId: uuid("hen_id").references(() => hens.id), // gallina específica (opcional)
  roosterId: uuid("rooster_id").references(() => roosters.id), // gallo específico (opcional)
  batchId: uuid("batch_id").references(() => broilerBatches.id), // lote de engorde (opcional)
  previousAnimalStates: jsonb("previous_animal_states").$type<Record<string, { status: string; currentQuantity?: number }>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Programas de alimentación por etapa ───
export const feedPrograms = pgTable("feed_programs", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  stageCatalogoId: uuid("stage_catalogo_id").references(() => catalogos.id, { onDelete: "cascade" }).notNull(),
  feedId: uuid("feed_id").references(() => feedInventory.id, { onDelete: "cascade" }).notNull(),
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(), // % de la dieta
  dailyAmountPerHen: decimal("daily_amount_per_hen", { precision: 6, scale: 2 }).notNull(), // gramos/gallina/día
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("feed_program_stage_feed_idx").on(t.stageCatalogoId, t.feedId),
]);

// ─── Gallinaza: factores de producción ───
export const manureFactors = pgTable("manure_factors", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  stageCatalogoId: uuid("stage_catalogo_id").references(() => catalogos.id, { onDelete: "cascade" }),
  birdGroup: varchar("bird_group", { length: 20 }).notNull(), // 'etapa' | 'gallo' | 'lote'
  kgPerBirdPerDay: decimal("kg_per_bird_per_day", { precision: 6, scale: 3 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("manure_factor_stage_group_idx").on(t.stageCatalogoId, t.birdGroup).where(sql`${t.stageCatalogoId} IS NOT NULL`),
  uniqueIndex("manure_factor_global_group_idx").on(t.farmId, t.birdGroup).where(sql`${t.stageCatalogoId} IS NULL`),
]);

// ─── Gallinaza: ventas ───
export const manureSales = pgTable("manure_sales", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: varchar("species", { length: 20 }),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  quantityKg: decimal("quantity_kg", { precision: 10, scale: 2 }).notNull(),
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  presentation: varchar("presentation", { length: 100 }),
  buyer: varchar("buyer", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Gallinaza: ajustes manuales ───
export const manureAdjustments = pgTable("manure_adjustments", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  deltaKg: decimal("delta_kg", { precision: 10, scale: 2 }).notNull(), // + agrega, - retira
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Gallinaza: producción diaria registrada ───
export const manureProduction = pgTable("manure_production", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  kgProduced: decimal("kg_produced", { precision: 10, scale: 2 }).notNull(),
  source: varchar("source", { length: 20 }).notNull().default("estimado"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("manure_auto_daily_unique_idx").on(t.farmId, t.date).where(sql`${t.source} = 'auto_diario'`),
]);

// ─── Adquisición de aves y animales menores (compra, donación, cría) ───
export const birdAcquisitions = pgTable("bird_acquisitions", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: animalSpeciesEnum("species").default("pollo"),
  acquisitionType: varchar("acquisition_type", { length: 50 }).notNull(), // compra, donacion, pollito_comprado, gazapo, etc.
  birdType: varchar("bird_type", { length: 50 }).notNull(), // gallina, gallo, lote_pollos, codorniz, pato, conejo
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 12, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }),
  supplier: varchar("supplier", { length: 200 }),
  breed: varchar("breed", { length: 100 }),
  geneticLine: varchar("genetic_line", { length: 150 }),
  generation: varchar("generation", { length: 50 }),
  originFarm: varchar("origin_farm", { length: 200 }),
  originLocation: varchar("origin_location", { length: 200 }),
  sourceBatchCode: varchar("source_batch_code", { length: 100 }),
  motherHenId: uuid("mother_hen_id").references((): AnyPgColumn => hens.id, { onDelete: "set null" }),
  fatherRoosterId: uuid("father_rooster_id").references((): AnyPgColumn => roosters.id, { onDelete: "set null" }),
  destinationLocationId: uuid("destination_location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  motherIdentifier: varchar("mother_identifier", { length: 100 }),
  fatherIdentifier: varchar("father_identifier", { length: 100 }),
  geneticEvidenceReference: text("genetic_evidence_reference"),
  healthEvidenceReference: text("health_evidence_reference"),
  birthDate: date("birth_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Registros de mortalidad ───
export const mortalityRecords = pgTable("mortality_records", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  species: animalSpeciesEnum("species").default("pollo"),
  birdType: varchar("bird_type", { length: 50 }).notNull(),
  quantity: integer("quantity").notNull(),
  cause: mortalityCauseEnum("cause").notNull(),
  henId: uuid("hen_id").references(() => hens.id),
  roosterId: uuid("rooster_id").references(() => roosters.id),
  batchId: uuid("batch_id").references(() => broilerBatches.id),
  healthControlId: uuid("health_control_id").references(() => healthControl.id),
  previousAnimalStates: jsonb("previous_animal_states").$type<Record<string, { status: string; currentQuantity?: number }>>(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Pérdidas de huevo post-cosecha ───
export const eggLosses = pgTable("egg_losses", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  quantity: integer("quantity").notNull(),
  size: varchar("size", { length: 50 }),
  reason: varchar("reason", { length: 50 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Insumos no alimenticios (Fase 3) ───
export const supplyInventory = pgTable("supply_inventory", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  unit: varchar("unit", { length: 30 }).notNull(),
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).default("0").notNull(),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).default("0").notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).default("0").notNull(),
  supplier: varchar("supplier", { length: 200 }),
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supplyMovements = pgTable("supply_movements", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  supplyId: uuid("supply_id").references(() => supplyInventory.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  isEntry: boolean("is_entry").notNull(),
  movementType: varchar("movement_type", { length: 50 }).notNull(),
  date: date("date").notNull(),
  healthControlId: uuid("health_control_id").references(() => healthControl.id),
  maintenanceId: uuid("maintenance_id").references(() => maintenance.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Ventas de carne (separado de sacrificio) ───
export const meatSales = pgTable("meat_sales", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: animalSpeciesEnum("species").default("pollo").notNull(),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  quantityKg: decimal("quantity_kg", { precision: 8, scale: 2 }).notNull(),
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  presentation: varchar("presentation", { length: 100 }),
  buyer: varchar("buyer", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Pérdidas de carne post-sacrificio ───
export const meatLosses = pgTable("meat_losses", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  quantityKg: decimal("quantity_kg", { precision: 8, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Registro de Autoconsumo / Soberanía Alimentaria Familiar ───
export const autoconsumoLogs = pgTable("autoconsumo_logs", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: animalSpeciesEnum("species").notNull(),
  productType: varchar("product_type", { length: 50 }).notNull(), // 'huevo', 'carne_canal', 'visceras_subproducto', 'abono_huerta'
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(), // unidades o kg
  unit: varchar("unit", { length: 30 }).notNull(), // 'unidades', 'kg', 'docenas'
  marketReferencePrice: decimal("market_reference_price", { precision: 10, scale: 2 }).notNull(),
  savingsAmount: decimal("savings_amount", { precision: 12, scale: 2 }).notNull(), // quantity * marketReferencePrice
  destinationHousehold: varchar("destination_household", { length: 100 }).default("Familia Granja"),
  batchId: uuid("batch_id").references(() => broilerBatches.id),
  slaughterId: uuid("slaughter_id").references(() => slaughter.id),
  eggProductionId: uuid("egg_production_id").references(() => eggProduction.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("autoconsumo_egg_production_idx").on(t.eggProductionId)]);

// ─── Categorías financieras jerárquicas (Fase 5) ───
export const financialCategories = pgTable("financial_categories", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  parentId: uuid("parent_id"),
  type: varchar("type", { length: 20 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Presupuestos (Fase 6) ───
export const budgets = pgTable("budgets", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgetItems = pgTable("budget_items", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  budgetId: uuid("budget_id").references(() => budgets.id, { onDelete: "cascade" }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: varchar("description", { length: 200 }),
  monthlyTarget: decimal("monthly_target", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 30 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cashflowProjections = pgTable("cashflow_projections", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  month: date("month").notNull(),
  projectedIncome: decimal("projected_income", { precision: 12, scale: 2 }),
  projectedExpense: decimal("projected_expense", { precision: 12, scale: 2 }),
  actualIncome: decimal("actual_income", { precision: 12, scale: 2 }),
  actualExpense: decimal("actual_expense", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Cuentas por cobrar/pagar (Fase 7) ───
export const accountsReceivable = pgTable("accounts_receivable", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").references(() => transactions.id).notNull(),
  buyer: varchar("buyer", { length: 200 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  pendingAmount: decimal("pending_amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  status: varchar("status", { length: 20 }).default("pendiente").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accountsPayable = pgTable("accounts_payable", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").references(() => transactions.id).notNull(),
  supplier: varchar("supplier", { length: 200 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  pendingAmount: decimal("pending_amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  status: varchar("status", { length: 20 }).default("pendiente").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  receivableId: uuid("receivable_id").references(() => accountsReceivable.id),
  payableId: uuid("payable_id").references(() => accountsPayable.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  method: varchar("method", { length: 50 }),
  reference: varchar("reference", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Calendario sanitario y plan de parvada (Fase 8) ───
export const sanitaryCalendar = pgTable("sanitary_calendar", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  targetBirds: varchar("target_birds", { length: 50 }).default("todas"),
  targetStageId: uuid("target_stage_id").references(() => catalogos.id),
  frequencyDays: integer("frequency_days"),
  nextDueDate: date("next_due_date").notNull(),
  withdrawalDays: integer("withdrawal_days"),
  lastHealthControlId: uuid("last_health_control_id").references(() => healthControl.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const flockPlans = pgTable("flock_plans", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  startDate: date("start_date").notNull(),
  targetHenCount: integer("target_hen_count").notNull(),
  targetRoosterCount: integer("target_rooster_count"),
  replacementDate: date("replacement_date"),
  currentPhase: varchar("current_phase", { length: 50 }),
  status: varchar("status", { length: 20 }).default("activo").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const flockPlanMilestones = pgTable("flock_plan_milestones", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").references(() => flockPlans.id, { onDelete: "cascade" }).notNull(),
  weekNumber: integer("week_number").notNull(),
  expectedHens: integer("expected_hens"),
  expectedEggsPerWeek: integer("expected_eggs_per_week"),
  expectedFeedKgPerWeek: decimal("expected_feed_kg_per_week", { precision: 10, scale: 2 }),
  actualHens: integer("actual_hens"),
  actualEggsPerWeek: integer("actual_eggs_per_week"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Estándares de peso por raza (curvas de referencia) ───
export const breedWeightStandards = pgTable("breed_weight_standards", {
  id: uuid("id").defaultRandom().primaryKey(),
  breed: varchar("breed", { length: 100 }).notNull(),
  gender: varchar("gender", { length: 20 }).default("hembra").notNull(),
  weekNumber: integer("week_number").notNull(),
  targetWeightG: decimal("target_weight_g", { precision: 8, scale: 1 }).notNull(),
  minWeightG: decimal("min_weight_g", { precision: 8, scale: 1 }),
  maxWeightG: decimal("max_weight_g", { precision: 8, scale: 1 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("breed_weight_breed_week_idx").on(t.breed, t.gender, t.weekNumber),
]);

// ─── Registros de peso (weight logs) ───
export const weightLogs = pgTable("weight_logs", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: varchar("species", { length: 20 }),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => broilerBatches.id),
  henGroup: text("hen_group"),
  breed: text("breed"),
  weekNumber: integer("week_number"),
  avgWeightKg: text("avg_weight_kg"),
  sampleSize: integer("sample_size").default(1),
  individualWeightsG: jsonb("individual_weights_g").$type<number[]>(),
  cvPercent: decimal("cv_percent", { precision: 5, scale: 2 }),
  uniformityPct: decimal("uniformity_pct", { precision: 5, scale: 2 }),
  dailyGainG: decimal("daily_gain_g", { precision: 7, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Productos de compra frecuente (Egresos rápidos) ───
// ─── Parámetros globales editables (clave/valor) ───
export const appSettings = pgTable("app_settings", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("app_settings_farm_key_unique_idx").on(t.farmId, t.key),
]);

// ─── Plantillas de vacunación / plan sanitario por especie o raza ───
export const vaccinationTemplates = pgTable("vaccination_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  species: varchar("species", { length: 50 }).default("gallina").notNull(),
  breed: varchar("breed", { length: 100 }).default("").notNull(),
  weekNumber: integer("week_number").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).default("vacunacion").notNull(),
  frequencyDays: integer("frequency_days"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("vaccination_template_unique_idx").on(t.species, t.breed, t.weekNumber, t.name),
]);

// ─── Agente IA: conversaciones, mensajes y acciones auditables ───
export const aiConversations = pgTable("ai_conversations", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 200 }).default("Nueva conversación").notNull(),
  summary: text("summary"),
  summaryMessageCount: integer("summary_message_count").default(0).notNull(),
  summaryUpdatedAt: timestamp("summary_updated_at"),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // system | user | assistant | tool
  content: text("content"),
  toolCalls: jsonb("tool_calls"),
  toolCallId: varchar("tool_call_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiActions = pgTable("ai_actions", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }).notNull(),
  messageId: uuid("message_id").references(() => aiMessages.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  toolName: varchar("tool_name", { length: 100 }).notNull(),
  args: jsonb("args").notNull(),
  summary: text("summary").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending | executed | failed | cancelled
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedAt: timestamp("executed_at"),
});

export const purchaseProducts = pgTable("purchase_products", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  expenseCategory: varchar("expense_category", { length: 100 }).notNull(),
  defaultPresentation: varchar("default_presentation", { length: 100 }),
  defaultUnit: varchar("default_unit", { length: 30 }).notNull().default("unidades"),
  lastPricePerPresentation: decimal("last_price_per_presentation", { precision: 12, scale: 2 }),
  defaultSupplier: varchar("default_supplier", { length: 200 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Idempotencia para mutaciones offline generales (X-Client-Mutation-Id) ───
export const offlineMutationReceipts = pgTable("offline_mutation_receipts", {
  farmId: farmIdCol(),
  mutationId: varchar("mutation_id", { length: 100 }).primaryKey(),
  method: varchar("method", { length: 10 }).notNull(),
  path: varchar("path", { length: 255 }).notNull(),
  statusCode: integer("status_code").notNull(),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Directorio completo de Clientes y Proveedores ───
export const contacts = pgTable("contacts", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("cliente"), // cliente | proveedor | ambos
  personType: varchar("person_type", { length: 20 }).notNull().default("natural"), // natural | juridica
  documentType: varchar("document_type", { length: 20 }), // CC | NIT | CE | RUT | Otro
  documentNumber: varchar("document_number", { length: 50 }),
  contactName: varchar("contact_name", { length: 150 }),
  phone: varchar("phone", { length: 40 }),
  whatsapp: varchar("whatsapp", { length: 40 }),
  email: varchar("email", { length: 150 }),
  address: text("address"),
  city: varchar("city", { length: 120 }),
  department: varchar("department", { length: 120 }),
  zone: varchar("zone", { length: 120 }),
  locationNotes: text("location_notes"),
  categoryTag: varchar("category_tag", { length: 80 }),
  paymentMethod: varchar("payment_method", { length: 40 }), // contado | transferencia | credito | nequi | daviplata | otro
  creditDays: integer("credit_days").default(0).notNull(),
  deliverySchedule: varchar("delivery_schedule", { length: 120 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("contacts_name_idx").on(t.farmId, t.name),
]);


// ─── P0: Reglas de prorrateo de costos indirectos/compartidos ───
export const costAllocations = pgTable("cost_allocations", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  sourceTransactionId: uuid("source_transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  expenseCategory: varchar("expense_category", { length: 100 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  basis: varchar("basis", { length: 30 }).default("head_count").notNull(), // head_count | biomass | feed_kg | area_m2 | manual
  allocations: jsonb("allocations").$type<Array<{
    species?: string | null;
    locationId?: string | null;
    batchId?: string | null;
    label?: string;
    percentage: number;
    amount: number;
  }>>().default([]).notNull(),
  periodFrom: date("period_from"),
  periodTo: date("period_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── P1: Reproducción de mamíferos menores (conejo y cuy) ───
export const reproductionEvents = pgTable("reproduction_events", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  species: varchar("species", { length: 20 }).notNull(), // conejo | cuy
  eventType: varchar("event_type", { length: 30 }).notNull(), // empadre | palpacion | nidal | parto | destete | diagnostico
  eventDate: date("event_date").notNull(),
  damCode: varchar("dam_code", { length: 80 }).notNull(),
  sireCode: varchar("sire_code", { length: 80 }),
  damMotherCode: varchar("dam_mother_code", { length: 80 }),
  damFatherCode: varchar("dam_father_code", { length: 80 }),
  sireMotherCode: varchar("sire_mother_code", { length: 80 }),
  sireFatherCode: varchar("sire_father_code", { length: 80 }),
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  parentEventId: uuid("parent_event_id").references((): AnyPgColumn => reproductionEvents.id, { onDelete: "set null" }),
  parityNumber: integer("parity_number").default(1).notNull(),
  expectedPalpationDate: date("expected_palpation_date"),
  expectedNestboxDate: date("expected_nestbox_date"),
  expectedBirthDate: date("expected_birth_date"),
  palpationResult: varchar("palpation_result", { length: 30 }),
  bornAlive: integer("born_alive"),
  bornDead: integer("born_dead").default(0),
  litterBirthWeightG: decimal("litter_birth_weight_g", { precision: 8, scale: 1 }),
  weanedTotal: integer("weaned_total"),
  weanedMales: integer("weaned_males"),
  weanedFemales: integer("weaned_females"),
  litterWeanWeightG: decimal("litter_wean_weight_g", { precision: 8, scale: 1 }),
  litterDailyGainG: decimal("litter_daily_gain_g", { precision: 7, scale: 2 }),
  weanedBatchId: uuid("weaned_batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  status: varchar("status", { length: 30 }).default("activo").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── P2: Bitácora de Bioseguridad (POE GAB ICA 3651/3652) y Bienestar Animal (Res. 8452/2025) ───
export const biosecurityLogs = pgTable("biosecurity_logs", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  logType: varchar("log_type", { length: 30 }).notNull(), // poe_gab | bienestar_animal | capacitacion | ingreso_visitante | desinfeccion
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  species: varchar("species", { length: 20 }),
  checklistItems: jsonb("checklist_items").$type<Record<string, boolean | number | string>>().default({}).notNull(),
  welfareScore: integer("welfare_score"), // 0 | 20 | 55 | 100
  complianceStatus: varchar("compliance_status", { length: 30 }).default("cumple").notNull(), // cumple | parcial | no_cumple
  inspectorName: varchar("inspector_name", { length: 150 }),
  staffName: varchar("staff_name", { length: 150 }),
  trainingTopic: varchar("training_topic", { length: 200 }),
  trainingCertificateUntil: date("training_certificate_until"),
  disinfectantUsed: varchar("disinfectant_used", { length: 150 }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── P2: Pilas de compostaje de mortalidad y pollinaza/cuyinaza ───
export const compostingPiles = pgTable("composting_piles", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  startDate: date("start_date").notNull(),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  species: varchar("species", { length: 20 }),
  formulaRatio: varchar("formula_ratio", { length: 30 }).default("3:1:1").notNull(), // 3:1:1 | 7:2:2 | otra
  manureKg: decimal("manure_kg", { precision: 10, scale: 2 }).default("0").notNull(),
  mortalityKg: decimal("mortality_kg", { precision: 10, scale: 2 }).default("0").notNull(),
  carbonMaterialKg: decimal("carbon_material_kg", { precision: 10, scale: 2 }).default("0").notNull(),
  carbonMaterialType: varchar("carbon_material_type", { length: 120 }),
  currentTempC: decimal("current_temp_c", { precision: 5, scale: 1 }),
  moisturePct: decimal("moisture_pct", { precision: 5, scale: 1 }),
  turnCount: integer("turn_count").default(0).notNull(),
  lastTurnDate: date("last_turn_date"),
  nextTurnDueDate: date("next_turn_due_date"),
  expectedHarvestDate: date("expected_harvest_date"),
  status: varchar("status", { length: 30 }).default("activa").notNull(), // activa | madurando | cosechada | alerta
  harvestedKg: decimal("harvested_kg", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("composting_piles_code_unique_idx").on(t.farmId, t.code),
]);

// ─── P2: Cierres diarios auditables ───
export const dailyClosures = pgTable("daily_closures", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  closureDate: date("closure_date").notNull(),
  status: varchar("status", { length: 20 }).default("cerrado").notNull(), // abierto | cerrado | reabierto
  closedBy: uuid("closed_by").references(() => users.id, { onDelete: "set null" }),
  closedAt: timestamp("closed_at").defaultNow().notNull(),
  reopenedBy: uuid("reopened_by").references(() => users.id, { onDelete: "set null" }),
  reopenedAt: timestamp("reopened_at"),
  reopenReason: text("reopen_reason"),
  summarySnapshot: jsonb("summary_snapshot").$type<Record<string, unknown>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("daily_closures_date_unique_idx").on(t.farmId, t.closureDate),
]);

// ─── P2: Telemetría IoT / básculas y sensores ambientales (ITH, NH3, T°, HR%) ───
export const sensorReadings = pgTable("sensor_readings", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => broilerBatches.id, { onDelete: "set null" }),
  deviceId: varchar("device_id", { length: 100 }).notNull(),
  metricType: varchar("metric_type", { length: 40 }).notNull(), // temperatura | humedad | ith | amoniaco_ppm | peso_bascula | consumo_agua | otro
  value: decimal("value", { precision: 10, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  ithIndex: decimal("ith_index", { precision: 6, scale: 2 }),
  alertTriggered: boolean("alert_triggered").default(false).notNull(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Fase 1 + 2: Adjuntos polimórficos offline-first y extracción OCR ───
export const attachments = pgTable("attachments", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // transaction | payment | contact | health_control | acquisition | mortality | asset | maintenance | composting | biosecurity | daily_closure | other
  entityId: varchar("entity_id", { length: 120 }).notNull(), // UUID o draft_<uuid> mientras se guarda el registro padre
  category: varchar("category", { length: 60 }).default("general").notNull(), // factura_dian | etiqueta_ica | comprobante_pago | rut_documento | gsmi_movilizacion | certificado_genetico | signo_clinico | placa_serie | garantia | antes_despues | general
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").default(0).notNull(),
  dataUrl: text("data_url").notNull(), // Imagen comprimida WebP/JPEG (< 250 KB) o PDF en dataURL para soporte offline-first
  extractedText: text("extracted_text"),
  extractedData: jsonb("extracted_data").$type<Record<string, unknown>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("attachments_entity_lookup_idx").on(t.entityType, t.entityId),
  index("attachments_category_idx").on(t.category),
]);

// ─── Agente IA: memoria persistente episódica y operativa ───
export const agentMemories = pgTable("agent_memories", {
  farmId: farmIdCol(),
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  category: varchar("category", { length: 50 }).default("hecho").notNull(),
  subjectKey: varchar("subject_key", { length: 140 }).notNull(),
  content: text("content").notNull(),
  entities: jsonb("entities").$type<string[]>().default([]).notNull(),
  importance: integer("importance").default(3).notNull(),
  sourceConversationId: uuid("source_conversation_id").references(() => aiConversations.id, { onDelete: "set null" }),
  accessCount: integer("access_count").default(0).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("agent_memories_user_active_idx").on(t.userId, t.isActive),
  uniqueIndex("agent_memories_farm_user_subject_idx").on(t.farmId, t.userId, t.category, t.subjectKey),
]);
