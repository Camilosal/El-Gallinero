-- Migración idempotente: Suscripciones SaaS (Freemium / Ciclo / Semestral / Anual) y Pagos Wompi (Nequi / Daviplata / PSE)

CREATE TABLE IF NOT EXISTS farm_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  plan_code varchar(40) NOT NULL DEFAULT 'FREEMIUM_SEMILLA',
  status varchar(20) NOT NULL DEFAULT 'trial',
  max_active_batches integer,
  max_users integer NOT NULL DEFAULT 2,
  current_period_start timestamp NOT NULL DEFAULT now(),
  current_period_end timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS farm_subscriptions_farm_unique_idx ON farm_subscriptions (farm_id);

CREATE TABLE IF NOT EXISTS billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  provider varchar(30) NOT NULL DEFAULT 'wompi',
  external_reference varchar(120) UNIQUE NOT NULL,
  provider_tx_id varchar(120),
  method varchar(30) NOT NULL,
  amount_cop integer NOT NULL,
  plan_code varchar(40) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  raw_payload jsonb,
  paid_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO farm_subscriptions (farm_id, plan_code, status, max_active_batches, max_users)
VALUES ('00000000-0000-0000-0000-000000000001', 'COMERCIAL_MEDIANO', 'active', NULL, 8)
ON CONFLICT (farm_id) DO NOTHING;

GRANT ALL PRIVILEGES ON TABLE farm_subscriptions TO gallinero_tenant_role;
GRANT ALL PRIVILEGES ON TABLE billing_payments TO gallinero_tenant_role;

