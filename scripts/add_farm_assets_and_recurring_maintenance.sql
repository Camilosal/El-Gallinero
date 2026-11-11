-- Registro de activos y equipos, y programación periódica de mantenimiento.
-- Migración aditiva e idempotente: conserva tareas existentes y no cambia sus costos.

CREATE TABLE IF NOT EXISTS farm_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  category varchar(30) NOT NULL DEFAULT 'equipo',
  brand varchar(120),
  model varchar(120),
  serial_number varchar(150),
  acquisition_date date,
  acquisition_cost numeric(12,2) NOT NULL DEFAULT 0,
  warranty_until date,
  location_id uuid,
  status varchar(30) NOT NULL DEFAULT 'operativo',
  description text,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT farm_assets_location_id_farm_locations_id_fk
    FOREIGN KEY (location_id) REFERENCES farm_locations(id) ON DELETE SET NULL,
  CONSTRAINT farm_assets_category_valid
    CHECK (category IN ('equipo', 'herramienta', 'estructura', 'vehiculo', 'otro')),
  CONSTRAINT farm_assets_status_valid
    CHECK (status IN ('operativo', 'requiere_mantenimiento', 'fuera_servicio', 'retirado')),
  CONSTRAINT farm_assets_acquisition_cost_nonnegative CHECK (acquisition_cost >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS farm_assets_code_unique_idx ON farm_assets(code);
CREATE INDEX IF NOT EXISTS farm_assets_location_status_idx ON farm_assets(location_id, status);

ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS asset_id uuid;
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS recurrence_series_id uuid DEFAULT gen_random_uuid();
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid;
ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS recurrence_interval_days integer;
UPDATE maintenance SET recurrence_series_id = gen_random_uuid() WHERE recurrence_series_id IS NULL;
ALTER TABLE maintenance ALTER COLUMN recurrence_series_id SET DEFAULT gen_random_uuid();
ALTER TABLE maintenance ALTER COLUMN recurrence_series_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_asset_id_farm_assets_id_fk') THEN
    ALTER TABLE maintenance ADD CONSTRAINT maintenance_asset_id_farm_assets_id_fk
      FOREIGN KEY (asset_id) REFERENCES farm_assets(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_recurrence_interval_valid') THEN
    ALTER TABLE maintenance ADD CONSTRAINT maintenance_recurrence_interval_valid
      CHECK (recurrence_interval_days IS NULL OR recurrence_interval_days BETWEEN 1 AND 3650);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_recurrence_parent_id_maintenance_id_fk') THEN
    ALTER TABLE maintenance ADD CONSTRAINT maintenance_recurrence_parent_id_maintenance_id_fk
      FOREIGN KEY (recurrence_parent_id) REFERENCES maintenance(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS maintenance_asset_status_date_idx ON maintenance(asset_id, status, scheduled_date);
CREATE UNIQUE INDEX IF NOT EXISTS maintenance_series_date_unique_idx
  ON maintenance(recurrence_series_id, scheduled_date);
CREATE UNIQUE INDEX IF NOT EXISTS maintenance_parent_unique_idx ON maintenance(recurrence_parent_id);
