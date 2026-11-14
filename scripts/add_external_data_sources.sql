-- Snapshots cacheados de fuentes externas (Olas 1, 2 y 3) con soporte offline-first y aislamiento RLS multi-granja.
CREATE TABLE IF NOT EXISTS external_data_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid),
  source_key varchar(60) NOT NULL,
  wave integer NOT NULL DEFAULT 1,
  status varchar(20) NOT NULL DEFAULT 'ok',
  sync_mode varchar(20) NOT NULL DEFAULT 'auto',
  provider_name varchar(120) NOT NULL,
  source_url varchar(500),
  scope_key varchar(120) NOT NULL DEFAULT 'global',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  fetched_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp,
  last_error text,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS external_data_snapshots_farm_id_idx ON external_data_snapshots (farm_id);
CREATE UNIQUE INDEX IF NOT EXISTS external_data_snapshots_farm_source_scope_idx
  ON external_data_snapshots (farm_id, source_key, scope_key);

ALTER TABLE external_data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_data_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON external_data_snapshots;
CREATE POLICY tenant_isolation_policy ON external_data_snapshots
  USING (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));

GRANT USAGE ON SCHEMA public TO gallinero_tenant_role;
GRANT ALL PRIVILEGES ON TABLE external_data_snapshots TO gallinero_tenant_role;
