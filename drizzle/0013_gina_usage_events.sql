-- Registro de consumo de Gina por persona y mes de calendario.
CREATE TABLE IF NOT EXISTS gina_usage_events (
  farm_id uuid NOT NULL DEFAULT COALESCE(
    NULLIF(current_setting('app.current_farm_id', true), '')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key varchar(120) NOT NULL,
  request_hash varchar(64) NOT NULL,
  cycle_start date NOT NULL,
  modality varchar(20) NOT NULL,
  message_units integer NOT NULL DEFAULT 1,
  audio_units integer NOT NULL DEFAULT 0,
  attachment_units integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'reserved',
  created_at timestamp NOT NULL DEFAULT now(),
  consumed_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT gina_usage_modality_valid CHECK (modality IN ('message', 'audio', 'attachment')),
  CONSTRAINT gina_usage_status_valid CHECK (status IN ('reserved', 'consumed', 'void')),
  CONSTRAINT gina_usage_units_nonnegative CHECK (message_units >= 0 AND audio_units >= 0 AND attachment_units >= 0),
  CONSTRAINT gina_usage_farm_idempotency_unique UNIQUE (farm_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS gina_usage_user_cycle_idx
  ON gina_usage_events (farm_id, user_id, cycle_start, status);

ALTER TABLE gina_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE gina_usage_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON gina_usage_events;
CREATE POLICY tenant_isolation_policy ON gina_usage_events
  USING (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));

GRANT ALL PRIVILEGES ON TABLE gina_usage_events TO gallinero_tenant_role;
