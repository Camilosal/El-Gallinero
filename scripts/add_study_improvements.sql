-- Migración consolidada P0/P1/P2 (Contabilidad Analítica, Cuyes/Reproducción, NTC 1240/PEPS, Inocuidad, Bioseguridad ICA/INVIMA, Compostaje, Cierre Diario y Sensores).
-- Aditiva e idempotente. Ejecutar fuera de bloque transaccional si se incluye primero add_analytics_dimensions.sql.

-- 1. farm_locations: zonificación biosegura, especies permitidas, vacío sanitario 21d, altitud y piso
ALTER TABLE farm_locations
  ADD COLUMN IF NOT EXISTS zone_type varchar(30) NOT NULL DEFAULT 'produccion',
  ADD COLUMN IF NOT EXISTS allowed_species jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sanitary_empty_until date,
  ADD COLUMN IF NOT EXISTS altitude_meters integer,
  ADD COLUMN IF NOT EXISTS floor_type varchar(40),
  ADD COLUMN IF NOT EXISTS environmental_temp_c numeric(5,2),
  ADD COLUMN IF NOT EXISTS is_quarantine boolean NOT NULL DEFAULT false;

ALTER TABLE farm_locations DROP CONSTRAINT IF EXISTS farm_locations_type_valid;
ALTER TABLE farm_locations ADD CONSTRAINT farm_locations_type_valid
  CHECK (type IN ('corral', 'jaula', 'galpon', 'potrero', 'jardin', 'patio', 'compostaje', 'bodega', 'cuarentena', 'otro'));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_locations_zone_type_valid') THEN
    ALTER TABLE farm_locations ADD CONSTRAINT farm_locations_zone_type_valid
      CHECK (zone_type IN ('limpia', 'sucia', 'produccion', 'cuarentena', 'almacen', 'forraje'));
  END IF;
END $$;

-- 2. egg_production: descarte, código de lote PEPS, temperatura y humedad de bodega
ALTER TABLE egg_production
  ADD COLUMN IF NOT EXISTS discarded integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lot_code varchar(60),
  ADD COLUMN IF NOT EXISTS storage_temp_c numeric(4,1),
  ADD COLUMN IF NOT EXISTS storage_humidity_pct numeric(5,2);

-- 3. incubation: incubación multiespecie sin gallina individual obligatoria + incubadora/bandeja/ovoscopía
ALTER TABLE incubation
  ADD COLUMN IF NOT EXISTS species animal_species NOT NULL DEFAULT 'gallina',
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS incubator_name varchar(120),
  ADD COLUMN IF NOT EXISTS tray_code varchar(60),
  ADD COLUMN IF NOT EXISTS turn_stop_date date,
  ADD COLUMN IF NOT EXISTS humidity_target_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS temp_target_c numeric(4,1),
  ADD COLUMN IF NOT EXISTS fertile_eggs integer,
  ADD COLUMN IF NOT EXISTS discarded_eggs integer DEFAULT 0;

-- 4. Dimensiones en ventas de huevo, carne, gallinaza y mantenimiento
ALTER TABLE egg_sales
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lot_code varchar(60);

ALTER TABLE maintenance
  ADD COLUMN IF NOT EXISTS species varchar(20),
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL;

ALTER TABLE manure_sales
  ADD COLUMN IF NOT EXISTS species varchar(20),
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL;

ALTER TABLE meat_sales
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL;

-- 5. health_control: tiempo de retiro activo, lote/lab/vencimiento/cadena frío vacunas y especie/lote
ALTER TABLE health_control
  ADD COLUMN IF NOT EXISTS species varchar(20),
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawal_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withdrawal_until_date date,
  ADD COLUMN IF NOT EXISTS vaccine_lot varchar(80),
  ADD COLUMN IF NOT EXISTS vaccine_lab varchar(120),
  ADD COLUMN IF NOT EXISTS vaccine_expiry_date date,
  ADD COLUMN IF NOT EXISTS cold_chain_temp_c numeric(4,1),
  ADD COLUMN IF NOT EXISTS administration_route varchar(60);

CREATE INDEX IF NOT EXISTS health_control_withdrawal_idx ON health_control (withdrawal_until_date);

-- 6. weight_logs: especie, pesos individuales, CV%, uniformidad y GDP
ALTER TABLE weight_logs
  ADD COLUMN IF NOT EXISTS species varchar(20),
  ADD COLUMN IF NOT EXISTS individual_weights_g jsonb,
  ADD COLUMN IF NOT EXISTS cv_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS uniformity_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS daily_gain_g numeric(7,2);

-- 7. cost_allocations (P0 prorrateo de costos indirectos)
CREATE TABLE IF NOT EXISTS cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  title varchar(200) NOT NULL,
  source_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  expense_category varchar(100),
  total_amount numeric(12,2) NOT NULL,
  basis varchar(30) NOT NULL DEFAULT 'head_count',
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  period_from date,
  period_to date,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- 8. reproduction_events (P1 conejos y cuyes híbridos)
CREATE TABLE IF NOT EXISTS reproduction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species varchar(20) NOT NULL,
  event_type varchar(30) NOT NULL,
  event_date date NOT NULL,
  dam_code varchar(80) NOT NULL,
  sire_code varchar(80),
  dam_mother_code varchar(80),
  dam_father_code varchar(80),
  sire_mother_code varchar(80),
  sire_father_code varchar(80),
  batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL,
  location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  parent_event_id uuid REFERENCES reproduction_events(id) ON DELETE SET NULL,
  parity_number integer NOT NULL DEFAULT 1,
  expected_palpation_date date,
  expected_nestbox_date date,
  expected_birth_date date,
  palpation_result varchar(30),
  born_alive integer,
  born_dead integer DEFAULT 0,
  litter_birth_weight_g numeric(8,1),
  weaned_total integer,
  weaned_males integer,
  weaned_females integer,
  litter_wean_weight_g numeric(8,1),
  litter_daily_gain_g numeric(7,2),
  weaned_batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL,
  status varchar(30) NOT NULL DEFAULT 'activo',
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reproduction_events_dam_idx ON reproduction_events (species, dam_code);

-- 9. biosecurity_logs (P2 POE GAB / Bienestar Animal Res. 8452 / Capacitaciones)
CREATE TABLE IF NOT EXISTS biosecurity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  log_type varchar(30) NOT NULL,
  location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  species varchar(20),
  checklist_items jsonb NOT NULL DEFAULT '{}'::jsonb,
  welfare_score integer,
  compliance_status varchar(30) NOT NULL DEFAULT 'cumple',
  inspector_name varchar(150),
  staff_name varchar(150),
  training_topic varchar(200),
  training_certificate_until date,
  disinfectant_used varchar(150),
  notes text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- 10. composting_piles (P2 compostaje 3:1:1 / 7:2:2)
CREATE TABLE IF NOT EXISTS composting_piles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(150) NOT NULL,
  start_date date NOT NULL,
  location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  species varchar(20),
  formula_ratio varchar(30) NOT NULL DEFAULT '3:1:1',
  manure_kg numeric(10,2) NOT NULL DEFAULT 0,
  mortality_kg numeric(10,2) NOT NULL DEFAULT 0,
  carbon_material_kg numeric(10,2) NOT NULL DEFAULT 0,
  carbon_material_type varchar(120),
  current_temp_c numeric(5,1),
  moisture_pct numeric(5,1),
  turn_count integer NOT NULL DEFAULT 0,
  last_turn_date date,
  next_turn_due_date date,
  expected_harvest_date date,
  status varchar(30) NOT NULL DEFAULT 'activa',
  harvested_kg numeric(10,2),
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS composting_piles_code_unique_idx ON composting_piles (code);

-- 11. daily_closures (P2 cierre diario auditable)
CREATE TABLE IF NOT EXISTS daily_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'cerrado',
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamp NOT NULL DEFAULT now(),
  reopened_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reopened_at timestamp,
  reopen_reason text,
  summary_snapshot jsonb,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_closures_date_unique_idx ON daily_closures (closure_date);

-- 12. sensor_readings (P2 IoT / báscula / ITH / amoniaco)
CREATE TABLE IF NOT EXISTS sensor_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamp NOT NULL DEFAULT now(),
  location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL,
  device_id varchar(100) NOT NULL,
  metric_type varchar(40) NOT NULL,
  value numeric(10,3) NOT NULL,
  unit varchar(20) NOT NULL,
  ith_index numeric(6,2),
  alert_triggered boolean NOT NULL DEFAULT false,
  raw_payload jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sensor_readings_location_time_idx ON sensor_readings (location_id, recorded_at DESC);
