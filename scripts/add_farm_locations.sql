-- Ubicaciones georreferenciadas, alojamiento actual y trazabilidad de traslados.
-- Aditiva e idempotente: no asigna una ubicación ficticia a registros antiguos.

CREATE TABLE IF NOT EXISTS farm_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(150) NOT NULL,
  type varchar(30) NOT NULL,
  parent_location_id uuid,
  description text,
  local_reference text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  area_m2 numeric(12,2),
  capacity integer,
  status varchar(20) NOT NULL DEFAULT 'activa',
  operational_status varchar(30) NOT NULL DEFAULT 'operativa',
  sanitary_status varchar(30) NOT NULL DEFAULT 'pendiente_revision',
  sanitary_requirements text,
  sanitary_reviewed_at date,
  operational_reviewed_at date,
  maintenance_needs text,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT farm_locations_parent_location_id_fk FOREIGN KEY (parent_location_id)
    REFERENCES farm_locations(id) ON DELETE SET NULL,
  CONSTRAINT farm_locations_type_valid CHECK (type IN ('corral', 'jaula', 'galpon', 'potrero', 'jardin', 'patio', 'otro')),
  CONSTRAINT farm_locations_status_valid CHECK (status IN ('activa', 'inactiva')),
  CONSTRAINT farm_locations_operational_status_valid CHECK (operational_status IN ('operativa', 'mantenimiento', 'restringida', 'fuera_servicio')),
  CONSTRAINT farm_locations_sanitary_status_valid CHECK (sanitary_status IN ('pendiente_revision', 'cumple', 'requiere_atencion', 'no_cumple')),
  CONSTRAINT farm_locations_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT farm_locations_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  CONSTRAINT farm_locations_capacity_nonnegative CHECK (capacity IS NULL OR capacity >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS farm_locations_code_unique_idx ON farm_locations(code);
CREATE INDEX IF NOT EXISTS farm_locations_parent_idx ON farm_locations(parent_location_id);

ALTER TABLE hens ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE roosters ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE broiler_batches ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE bird_acquisitions ADD COLUMN IF NOT EXISTS destination_location_id uuid;
ALTER TABLE egg_production ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE feed_movements ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE mortality_records ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE health_control ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS location_id uuid;
ALTER TABLE slaughter ADD COLUMN IF NOT EXISTS location_id uuid;

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('hens', 'hens_location_id_farm_locations_id_fk', 'location_id'),
    ('roosters', 'roosters_location_id_farm_locations_id_fk', 'location_id'),
    ('broiler_batches', 'broiler_batches_location_id_farm_locations_id_fk', 'location_id'),
    ('bird_acquisitions', 'bird_acquisitions_destination_location_id_farm_locations_id_fk', 'destination_location_id'),
    ('egg_production', 'egg_production_location_id_farm_locations_id_fk', 'location_id'),
    ('feed_movements', 'feed_movements_location_id_farm_locations_id_fk', 'location_id'),
    ('mortality_records', 'mortality_records_location_id_farm_locations_id_fk', 'location_id'),
    ('weight_logs', 'weight_logs_location_id_farm_locations_id_fk', 'location_id'),
    ('health_control', 'health_control_location_id_farm_locations_id_fk', 'location_id'),
    ('maintenance', 'maintenance_location_id_farm_locations_id_fk', 'location_id'),
    ('slaughter', 'slaughter_location_id_farm_locations_id_fk', 'location_id')
  ) AS refs(table_name, constraint_name, column_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = item.constraint_name) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES farm_locations(id) ON DELETE SET NULL',
        item.table_name, item.constraint_name, item.column_name);
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS hens_location_status_idx ON hens(location_id, status);
CREATE INDEX IF NOT EXISTS roosters_location_status_idx ON roosters(location_id, status);
CREATE INDEX IF NOT EXISTS broiler_batches_location_status_idx ON broiler_batches(location_id, status);
CREATE INDEX IF NOT EXISTS egg_production_location_date_idx ON egg_production(location_id, date);
CREATE INDEX IF NOT EXISTS feed_movements_location_date_idx ON feed_movements(location_id, date);
CREATE INDEX IF NOT EXISTS mortality_records_location_date_idx ON mortality_records(location_id, date);
CREATE INDEX IF NOT EXISTS weight_logs_location_date_idx ON weight_logs(location_id, date);
CREATE INDEX IF NOT EXISTS health_control_location_date_idx ON health_control(location_id, date);
CREATE INDEX IF NOT EXISTS maintenance_location_status_idx ON maintenance(location_id, status);
CREATE INDEX IF NOT EXISTS slaughter_location_date_idx ON slaughter(location_id, date);

CREATE TABLE IF NOT EXISTS animal_location_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hen_id uuid REFERENCES hens(id),
  rooster_id uuid REFERENCES roosters(id),
  batch_id uuid REFERENCES broiler_batches(id),
  from_location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  to_location_id uuid NOT NULL REFERENCES farm_locations(id),
  quantity integer NOT NULL DEFAULT 1,
  date date NOT NULL,
  reason varchar(100) NOT NULL,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT animal_location_movement_single_target CHECK (num_nonnulls(hen_id, rooster_id, batch_id) = 1),
  CONSTRAINT animal_location_movement_distinct_places CHECK (from_location_id IS NULL OR from_location_id <> to_location_id),
  CONSTRAINT animal_location_movement_quantity_positive CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS animal_location_movement_hen_idx ON animal_location_movements(hen_id, date DESC);
CREATE INDEX IF NOT EXISTS animal_location_movement_rooster_idx ON animal_location_movements(rooster_id, date DESC);
CREATE INDEX IF NOT EXISTS animal_location_movement_batch_idx ON animal_location_movements(batch_id, date DESC);
CREATE INDEX IF NOT EXISTS animal_location_movement_to_idx ON animal_location_movements(to_location_id, date DESC);
