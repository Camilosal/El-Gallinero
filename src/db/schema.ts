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
  "granja_fresco",
  "granja_procesado",
  "suplementario",
]);

export const feedTypeEnum = pgEnum("feed_type", [
  "mosca_soldado",
  "pastos_gramineas",
  "maiz_germinado",
  "bore_raices",
  "purinas",
  "maiz_comprado",
  "concentrado_comercial",
  "otro",
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
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("farm_locations_code_unique_idx").on(t.code),
  check("farm_locations_type_valid", sql`${t.type} IN ('corral', 'jaula', 'galpon', 'potrero', 'jardin', 'patio', 'otro')`),
  check("farm_locations_status_valid", sql`${t.status} IN ('activa', 'inactiva')`),
  check("farm_locations_operational_status_valid", sql`${t.operationalStatus} IN ('operativa', 'mantenimiento', 'restringida', 'fuera_servicio')`),
  check("farm_locations_sanitary_status_valid", sql`${t.sanitaryStatus} IN ('pendiente_revision', 'cumple', 'requiere_atencion', 'no_cumple')`),
  check("farm_locations_latitude_range", sql`${t.latitude} IS NULL OR (${t.latitude} >= -90 AND ${t.latitude} <= 90)`),
  check("farm_locations_longitude_range", sql`${t.longitude} IS NULL OR (${t.longitude} >= -180 AND ${t.longitude} <= 180)`),
  check("farm_locations_capacity_nonnegative", sql`${t.capacity} IS NULL OR ${t.capacity} >= 0`),
]);

// ─── Gallinas ───
export const hens = pgTable("hens", {
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
}, (t) => [uniqueIndex("hens_code_unique_idx").on(t.code)]);

// ─── Alimentos / Feed inventory ───
export const feedInventory = pgTable("feed_inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  category: feedCategoryEnum("category").notNull(),
  feedType: feedTypeEnum("feed_type").notNull(),
  unit: varchar("unit", { length: 30 }).notNull(), // kg, lb, litros
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).default("0").notNull(),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).default("0").notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).default("0").notNull(),
  supplier: varchar("supplier", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Activos y equipos de la finca ───
export const farmAssets = pgTable("farm_assets", {
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
  uniqueIndex("farm_assets_code_unique_idx").on(t.code),
  check("farm_assets_category_valid", sql`${t.category} IN ('equipo', 'herramienta', 'estructura', 'vehiculo', 'otro')`),
  check("farm_assets_status_valid", sql`${t.status} IN ('operativo', 'requiere_mantenimiento', 'fuera_servicio', 'retirado')`),
  check("farm_assets_acquisition_cost_nonnegative", sql`${t.acquisitionCost} >= 0`),
]);

// ─── Movimientos de alimento ───
export const feedMovements = pgTable("feed_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  feedId: uuid("feed_id").references(() => feedInventory.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  isEntry: boolean("is_entry").notNull(), // true = entrada, false = consumo
  movementType: feedMovementTypeEnum("movement_type").default("otro").notNull(), // motivo clasificado (compra, donación, consumo, merma…)
  autoGenerated: boolean("auto_generated").default(false).notNull(), // true = generado por programa alimenticio
  stageCatalogoId: uuid("stage_catalogo_id").references(() => catalogos.id), // etapa destino (solo consumo)
  henCount: integer("hen_count"), // gallinas en el grupo al momento del consumo
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Producción de huevos ───
export const eggProduction = pgTable("egg_production", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: animalSpeciesEnum("species").default("gallina").notNull(),
  batchId: uuid("batch_id").references(() => broilerBatches.id), // lote atribuible (ej. lote de codornices)
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  totalCollected: integer("total_collected").notNull(),
  broken: integer("broken").default(0).notNull(),
  forIncubation: integer("for_incubation").default(0).notNull(),
  quantityAutoconsumo: integer("quantity_autoconsumo").default(0).notNull(), // asignación a consumo familiar
  quantityExcedente: integer("quantity_excedente").default(0).notNull(),     // excedente para venta
  referenceUnitPrice: decimal("reference_unit_price", { precision: 10, scale: 2 }), // valor de mercado para ahorro de autoconsumo
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Detalle de producción por tamaño de huevo ───
export const eggProductionDetails = pgTable("egg_production_details", {
  id: uuid("id").defaultRandom().primaryKey(),
  productionId: uuid("production_id").references(() => eggProduction.id, { onDelete: "cascade" }).notNull(),
  size: varchar("size", { length: 50 }).notNull(),
  quantity: integer("quantity").default(0).notNull(),
}, (t) => [
  uniqueIndex("egg_prod_size_idx").on(t.productionId, t.size),
]);

// ─── Incubación / Reproducción ───
export const incubation = pgTable("incubation", {
  id: uuid("id").defaultRandom().primaryKey(),
  henId: uuid("hen_id").references(() => hens.id),
  roosterId: uuid("rooster_id").references(() => roosters.id, { onDelete: "set null" }),
  roosterCode: varchar("rooster_code", { length: 50 }), // snapshot in case the rooster is later removed
  startDate: date("start_date").notNull(),
  expectedHatchDate: date("expected_hatch_date").notNull(),
  eggsSet: integer("eggs_set").notNull(),
  eggsHatched: integer("eggs_hatched").default(0),
  malesHatched: integer("males_hatched"),
  femalesHatched: integer("females_hatched"),
  isComplete: boolean("is_complete").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Gallos reproductores ───
export const roosters = pgTable("roosters", {
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
}, (t) => [uniqueIndex("roosters_code_unique_idx").on(t.code)]);

// ─── Lotes de producción / engorde multi-especie ───
export const broilerBatches = pgTable("broiler_batches", {
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
}, (t) => [uniqueIndex("broiler_batches_code_unique_idx").on(t.code)]);

// ─── Traslados entre ubicaciones: una ficha individual o un lote completo ───
export const animalLocationMovements = pgTable("animal_location_movements", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: animalSpeciesEnum("species").default("gallina").notNull(),
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
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  scheduledDate: date("scheduled_date").notNull(),
  completedDate: date("completed_date"),
  status: maintenanceStatusEnum("status").default("pendiente").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
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
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  type: varchar("type", { length: 100 }).notNull(), // vacunación, desparasitación, tratamiento, inspección
  description: text("description").notNull(),
  affectedHens: text("affected_hens"), // JSON array of hen IDs or "todas"
  previousAnimalStates: jsonb("previous_animal_states").$type<Record<string, { status: string; currentQuantity?: number }>>(),
  product: varchar("product", { length: 200 }),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  nextScheduled: date("next_scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Finanzas: transacciones ───
export const transactions = pgTable("transactions", {
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
  isCredit: boolean("is_credit").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Usuarios ───
export const users = pgTable("users", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Catálogos / Datos maestros ───
export const catalogos = pgTable("catalogos", {
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
  uniqueIndex("catalogos_category_value_idx").on(t.category, t.value),
]);

// ─── Venta de aves vivas ───
export const chickenSales = pgTable("chicken_sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  birdType: varchar("bird_type", { length: 50 }).notNull(), // gallina_descarte, pollo, gallo, pollito
  quantity: integer("quantity").notNull(), // número de aves
  weightKg: decimal("weight_kg", { precision: 8, scale: 2 }), // peso total en kg
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }).notNull(), // precio por ave o por kg
  priceMode: varchar("price_mode", { length: 20 }).notNull().default("por_ave"), // por_ave o por_kg
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  buyer: varchar("buyer", { length: 200 }),
  presentation: varchar("presentation", { length: 100 }),
  henId: uuid("hen_id").references(() => hens.id), // gallina específica (opcional)
  roosterId: uuid("rooster_id").references(() => roosters.id), // gallo específico (opcional)
  batchId: uuid("batch_id").references(() => broilerBatches.id), // lote de engorde (opcional)
  previousAnimalStates: jsonb("previous_animal_states").$type<Record<string, { status: string; currentQuantity?: number }>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sacrificio / Producción de carne ───
export const slaughter = pgTable("slaughter", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  stageCatalogoId: uuid("stage_catalogo_id").references(() => catalogos.id, { onDelete: "cascade" }),
  birdGroup: varchar("bird_group", { length: 20 }).notNull(), // 'etapa' | 'gallo' | 'lote'
  kgPerBirdPerDay: decimal("kg_per_bird_per_day", { precision: 6, scale: 3 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("manure_factor_stage_group_idx").on(t.stageCatalogoId, t.birdGroup).where(sql`${t.stageCatalogoId} IS NOT NULL`),
  uniqueIndex("manure_factor_global_group_idx").on(t.birdGroup).where(sql`${t.stageCatalogoId} IS NULL`),
]);

// ─── Gallinaza: ventas ───
export const manureSales = pgTable("manure_sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
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
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  deltaKg: decimal("delta_kg", { precision: 10, scale: 2 }).notNull(), // + agrega, - retira
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Gallinaza: producción diaria registrada ───
export const manureProduction = pgTable("manure_production", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  kgProduced: decimal("kg_produced", { precision: 10, scale: 2 }).notNull(),
  source: varchar("source", { length: 20 }).notNull().default("estimado"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("manure_auto_daily_unique_idx").on(t.date).where(sql`${t.source} = 'auto_diario'`),
]);

// ─── Adquisición de aves y animales menores (compra, donación, cría) ───
export const birdAcquisitions = pgTable("bird_acquisitions", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  species: animalSpeciesEnum("species").default("pollo").notNull(),
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
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  quantityKg: decimal("quantity_kg", { precision: 8, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Registro de Autoconsumo / Soberanía Alimentaria Familiar ───
export const autoconsumoLogs = pgTable("autoconsumo_logs", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  parentId: uuid("parent_id"),
  type: varchar("type", { length: 20 }).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Presupuestos (Fase 6) ───
export const budgets = pgTable("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgetItems = pgTable("budget_items", {
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
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  locationId: uuid("location_id").references(() => farmLocations.id, { onDelete: "set null" }),
  batchId: uuid("batch_id").references(() => broilerBatches.id),
  henGroup: text("hen_group"),
  breed: text("breed"),
  weekNumber: integer("week_number"),
  avgWeightKg: text("avg_weight_kg"),
  sampleSize: integer("sample_size").default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Productos de compra frecuente (Egresos rápidos) ───
// ─── Parámetros globales editables (clave/valor) ───
export const appSettings = pgTable("app_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 200 }).default("Nueva conversación").notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // system | user | assistant | tool
  content: text("content"),
  toolCalls: jsonb("tool_calls"),
  toolCallId: varchar("tool_call_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiActions = pgTable("ai_actions", {
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
