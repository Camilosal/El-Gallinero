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
} from "drizzle-orm/pg-core";

// ─── Enums ───
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

// ─── Movimientos de alimento ───
export const feedMovements = pgTable("feed_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  feedId: uuid("feed_id").references(() => feedInventory.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  isEntry: boolean("is_entry").notNull(), // true = entrada, false = consumo
  stageCatalogoId: uuid("stage_catalogo_id").references(() => catalogos.id), // etapa destino (solo consumo)
  henCount: integer("hen_count"), // gallinas en el grupo al momento del consumo
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Producción de huevos ───
export const eggProduction = pgTable("egg_production", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  totalCollected: integer("total_collected").notNull(),
  broken: integer("broken").default(0).notNull(),
  forIncubation: integer("for_incubation").default(0).notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Lotes de pollo de engorde ───
export const broilerBatches = pgTable("broiler_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  breed: varchar("breed", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  initialQuantity: integer("initial_quantity").notNull(),
  currentQuantity: integer("current_quantity").notNull(),
  targetWeeks: integer("target_weeks").default(7).notNull(),
  targetWeightKg: decimal("target_weight_kg", { precision: 6, scale: 2 }).default("2.5").notNull(),
  avgWeightKg: decimal("avg_weight_kg", { precision: 6, scale: 2 }),
  status: broilerBatchStatusEnum("status").default("activo").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Ventas de huevos ───
export const eggSales = pgTable("egg_sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Control fitosanitario ───
export const healthControl = pgTable("health_control", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  type: varchar("type", { length: 100 }).notNull(), // vacunación, desparasitación, tratamiento, inspección
  description: text("description").notNull(),
  affectedHens: text("affected_hens"), // JSON array of hen IDs or "todas"
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
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Usuarios ───
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 100 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
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
  minWeeks: integer("min_weeks"), // solo para category = 'etapa_crecimiento'
  maxWeeks: integer("max_weeks"), // solo para category = 'etapa_crecimiento' (null = abierto)
  expectedEggsPerHen: decimal("expected_eggs_per_hen", { precision: 4, scale: 2 }), // huevos/gallina/día (solo etapa_crecimiento)
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
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sacrificio / Producción de carne ───
export const slaughter = pgTable("slaughter", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  birdType: varchar("bird_type", { length: 50 }).notNull(), // gallina_descarte, pollo, gallo
  quantity: integer("quantity").notNull(), // número de aves sacrificadas
  weightKg: decimal("weight_kg", { precision: 8, scale: 2 }).notNull(), // peso en canal (kg)
  destination: varchar("destination", { length: 50 }).notNull().default("consumo_propio"), // venta, consumo_propio, donacion
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }), // precio por kg si se vende
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }), // total si se vende
  henId: uuid("hen_id").references(() => hens.id), // gallina específica (opcional)
  roosterId: uuid("rooster_id").references(() => roosters.id), // gallo específico (opcional)
  batchId: uuid("batch_id").references(() => broilerBatches.id), // lote de engorde (opcional)
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
  uniqueIndex("manure_factor_stage_group_idx").on(t.stageCatalogoId, t.birdGroup),
]);

// ─── Gallinaza: inventario (fila única) ───
export const manureInventory = pgTable("manure_inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  currentStockKg: decimal("current_stock_kg", { precision: 12, scale: 2 }).default("0").notNull(),
  lastAccumulatedDate: date("last_accumulated_date").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
