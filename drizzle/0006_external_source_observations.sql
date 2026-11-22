CREATE TABLE IF NOT EXISTS external_source_observations (
  farm_id uuid NOT NULL DEFAULT COALESCE(
    NULLIF(current_setting('app.current_farm_id', true), '')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  source_key varchar(60) NOT NULL,
  observation_key varchar(200) NOT NULL,
  observed_at timestamp NOT NULL,
  value numeric(18, 6) NOT NULL,
  unit varchar(60),
  provider_name varchar(120) NOT NULL,
  source_url varchar(500),
  dimensions jsonb DEFAULT '{}'::jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  ingested_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS external_source_observations_farm_source_key_idx
  ON external_source_observations (farm_id, source_key, observation_key);
CREATE INDEX IF NOT EXISTS external_source_observations_farm_source_observed_idx
  ON external_source_observations (farm_id, source_key, observed_at DESC);

ALTER TABLE external_source_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_source_observations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON external_source_observations;
CREATE POLICY tenant_isolation_policy ON external_source_observations
  USING (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));

GRANT ALL PRIVILEGES ON TABLE external_source_observations TO gallinero_tenant_role;
