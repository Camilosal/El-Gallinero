-- C1: briefings del agente proactivo (diario y anomalía), idempotentes por granja/día/tipo.
CREATE TABLE IF NOT EXISTS agent_briefings (
  farm_id uuid NOT NULL DEFAULT COALESCE(
    NULLIF(current_setting('app.current_farm_id', true), '')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  briefing_date date NOT NULL,
  kind varchar(20) DEFAULT 'diario' NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  narrative text DEFAULT '' NOT NULL,
  read_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT agent_briefings_kind_check CHECK (kind IN ('diario', 'anomalia'))
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_briefings_farm_date_kind_idx
  ON agent_briefings (farm_id, briefing_date, kind);
CREATE INDEX IF NOT EXISTS agent_briefings_farm_created_idx
  ON agent_briefings (farm_id, created_at DESC);

ALTER TABLE agent_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_briefings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON agent_briefings;
CREATE POLICY tenant_isolation_policy ON agent_briefings
  USING (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));

GRANT ALL PRIVILEGES ON TABLE agent_briefings TO gallinero_tenant_role;