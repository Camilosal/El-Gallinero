-- Migración idempotente: Multi-Tenancy Híbrido (farms + farm_id + PostgreSQL RLS)
-- Mantiene compatibilidad total con Modalidad B (instancia dedicada) y el_gallinero_test
-- usando la granja por defecto 00000000-0000-0000-0000-000000000001.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gallinero_tenant_role') THEN
    CREATE ROLE gallinero_tenant_role NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) UNIQUE NOT NULL,
  name varchar(200) NOT NULL,
  deployment_mode varchar(20) NOT NULL DEFAULT 'saas',
  owner_user_id uuid,
  qr_source varchar(120),
  ally_code varchar(120),
  plan_code varchar(40) NOT NULL DEFAULT 'FREEMIUM_SEMILLA',
  trial_ends_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO farms (id, slug, name, deployment_mode, plan_code)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default',
  'Granja Principal',
  'dedicated',
  'COMERCIAL_MEDIANO'
)
ON CONFLICT (id) DO NOTHING;

-- Añadir farm_id a users y sessions (sin RLS restrictivo para permitir login/registro)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS farm_id uuid NOT NULL
  DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS farm_id uuid NOT NULL
  DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX IF NOT EXISTS users_farm_id_idx ON users (farm_id);
CREATE INDEX IF NOT EXISTS sessions_farm_id_idx ON sessions (farm_id);

-- Añadir farm_id + activar PostgreSQL RLS en todas las tablas operativas por granja
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'app_settings',
    'farm_locations',
    'hens',
    'feed_inventory',
    'farm_assets',
    'feed_movements',
    'egg_production',
    'egg_production_details',
    'incubation',
    'roosters',
    'broiler_batches',
    'animal_location_movements',
    'egg_sales',
    'egg_sales_items',
    'maintenance',
    'health_control',
    'transactions',
    'chicken_sales',
    'slaughter',
    'feed_programs',
    'manure_factors',
    'manure_sales',
    'manure_adjustments',
    'manure_production',
    'bird_acquisitions',
    'mortality_records',
    'egg_losses',
    'supply_inventory',
    'supply_movements',
    'meat_sales',
    'meat_losses',
    'autoconsumo_logs',
    'financial_categories',
    'budgets',
    'budget_items',
    'cashflow_projections',
    'accounts_receivable',
    'accounts_payable',
    'payments',
    'sanitary_calendar',
    'flock_plans',
    'flock_plan_milestones',
    'weight_logs',
    'ai_conversations',
    'ai_messages',
    'ai_actions',
    'purchase_products',
    'offline_mutation_receipts',
    'contacts',
    'cost_allocations',
    'reproduction_events',
    'biosecurity_logs',
    'composting_piles',
    'daily_closures',
    'sensor_readings',
    'attachments',
    'agent_memories'
  ];
  rls_expr text := $rls$COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid)$rls$;
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS farm_id uuid NOT NULL DEFAULT %s',
      t, rls_expr
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (farm_id)',
      t || '_farm_id_idx', t
    );
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I USING (farm_id = %s) WITH CHECK (farm_id = %s)',
      t, rls_expr, rls_expr
    );
  END LOOP;
END
$$;

-- Catálogos: lectura compartida de catálogos base (default farm) + propios de la finca; escritura solo propia finca
ALTER TABLE catalogos
  ADD COLUMN IF NOT EXISTS farm_id uuid NOT NULL
  DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid);
CREATE INDEX IF NOT EXISTS catalogos_farm_id_idx ON catalogos (farm_id);
ALTER TABLE catalogos ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalogos_tenant_select_policy ON catalogos;
DROP POLICY IF EXISTS catalogos_tenant_write_policy ON catalogos;
DROP POLICY IF EXISTS catalogos_tenant_update_policy ON catalogos;
DROP POLICY IF EXISTS catalogos_tenant_delete_policy ON catalogos;

CREATE POLICY catalogos_tenant_select_policy ON catalogos FOR SELECT
  USING (
    farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid)
    OR farm_id = '00000000-0000-0000-0000-000000000001'::uuid
  );
CREATE POLICY catalogos_tenant_write_policy ON catalogos FOR INSERT
  WITH CHECK (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));
CREATE POLICY catalogos_tenant_update_policy ON catalogos FOR UPDATE
  USING (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));
CREATE POLICY catalogos_tenant_delete_policy ON catalogos FOR DELETE
  USING (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));

-- Re-alcance de índices únicos globales por granja (farm_id)
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_key_unique;
DROP INDEX IF EXISTS app_settings_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_farm_key_unique_idx ON app_settings (farm_id, key);

DROP INDEX IF EXISTS farm_locations_code_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS farm_locations_code_unique_idx ON farm_locations (farm_id, code);

DROP INDEX IF EXISTS hens_code_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS hens_code_unique_idx ON hens (farm_id, code);

DROP INDEX IF EXISTS roosters_code_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS roosters_code_unique_idx ON roosters (farm_id, code);

DROP INDEX IF EXISTS broiler_batches_code_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS broiler_batches_code_unique_idx ON broiler_batches (farm_id, code);

DROP INDEX IF EXISTS farm_assets_code_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS farm_assets_code_unique_idx ON farm_assets (farm_id, code);

DROP INDEX IF EXISTS catalogos_category_value_idx;
CREATE UNIQUE INDEX IF NOT EXISTS catalogos_category_value_idx ON catalogos (farm_id, category, value);

DROP INDEX IF EXISTS manure_factor_global_group_idx;
CREATE UNIQUE INDEX IF NOT EXISTS manure_factor_global_group_idx ON manure_factors (farm_id, bird_group) WHERE stage_catalogo_id IS NULL;

DROP INDEX IF EXISTS manure_auto_daily_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS manure_auto_daily_unique_idx ON manure_production (farm_id, date) WHERE source = 'auto_diario';

DROP INDEX IF EXISTS contacts_name_idx;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_name_idx ON contacts (farm_id, name);

DROP INDEX IF EXISTS composting_piles_code_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS composting_piles_code_unique_idx ON composting_piles (farm_id, code);

DROP INDEX IF EXISTS daily_closures_date_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS daily_closures_date_unique_idx ON daily_closures (farm_id, closure_date);

-- Permisos completos para el rol no-superusuario usado cuando RLS está activo
GRANT USAGE ON SCHEMA public TO gallinero_tenant_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gallinero_tenant_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gallinero_tenant_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO gallinero_tenant_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO gallinero_tenant_role;
