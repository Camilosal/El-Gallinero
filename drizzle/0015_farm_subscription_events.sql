-- Bitácora inmutable del ciclo de suscripción. No almacena payloads de tarjeta ni secretos.
CREATE TABLE IF NOT EXISTS farm_subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  farm_id uuid NOT NULL DEFAULT COALESCE(
    NULLIF(current_setting('app.current_farm_id', true), '')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  subscription_id uuid,
  event_key varchar(180) NOT NULL UNIQUE,
  event_type varchar(48) NOT NULL,
  actor_type varchar(30) NOT NULL DEFAULT 'system',
  actor_id uuid,
  source varchar(48) NOT NULL,
  reason varchar(500),
  before_snapshot jsonb,
  after_snapshot jsonb NOT NULL,
  policy_version varchar(80),
  terms_version varchar(80),
  payment_id uuid,
  external_reference varchar(120),
  result_status varchar(30) NOT NULL DEFAULT 'applied',
  occurred_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS farm_subscription_events_farm_time_idx
  ON farm_subscription_events (farm_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS farm_subscription_events_payment_idx
  ON farm_subscription_events (payment_id)
  WHERE payment_id IS NOT NULL;

ALTER TABLE farm_subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_subscription_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON farm_subscription_events;
CREATE POLICY tenant_isolation_policy ON farm_subscription_events
  USING (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));

REVOKE ALL PRIVILEGES ON TABLE farm_subscription_events FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE farm_subscription_events FROM gallinero_tenant_role;
GRANT SELECT, INSERT ON TABLE farm_subscription_events TO gallinero_tenant_role;

CREATE OR REPLACE FUNCTION reject_farm_subscription_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'farm_subscription_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS farm_subscription_events_no_update_delete ON farm_subscription_events;
CREATE TRIGGER farm_subscription_events_no_update_delete
  BEFORE UPDATE OR DELETE ON farm_subscription_events
  FOR EACH ROW EXECUTE FUNCTION reject_farm_subscription_event_mutation();

DROP TRIGGER IF EXISTS farm_subscription_events_no_truncate ON farm_subscription_events;
CREATE TRIGGER farm_subscription_events_no_truncate
  BEFORE TRUNCATE ON farm_subscription_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_farm_subscription_event_mutation();
