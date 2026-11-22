-- Migración consolidada 0001: Rol de aplicación RLS, restricciones CHECK, índices parciales y políticas multi-tenant.
-- Es 100% idempotente y segura sobre instalaciones nuevas (tras 0000_baseline.sql / drizzle-kit push) o existentes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gallinero_tenant_role') THEN
    CREATE ROLE gallinero_tenant_role NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

ALTER TYPE animal_species ADD VALUE IF NOT EXISTS 'cuy';

-- Restricciones CHECK adicionales no generadas automáticamente por Drizzle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_inventory_dry_matter_range') THEN
    ALTER TABLE feed_inventory
      ADD CONSTRAINT feed_inventory_dry_matter_range
      CHECK (dry_matter_pct IS NULL OR (dry_matter_pct > 0 AND dry_matter_pct <= 100));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_inventory_protein_range') THEN
    ALTER TABLE feed_inventory
      ADD CONSTRAINT feed_inventory_protein_range
      CHECK (crude_protein_pct IS NULL OR (crude_protein_pct >= 0 AND crude_protein_pct <= 100));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_assets_useful_life_months_positive') THEN
    ALTER TABLE farm_assets
      ADD CONSTRAINT farm_assets_useful_life_months_positive
      CHECK (useful_life_months IS NULL OR useful_life_months > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_assets_useful_life_cycles_positive') THEN
    ALTER TABLE farm_assets
      ADD CONSTRAINT farm_assets_useful_life_cycles_positive
      CHECK (useful_life_cycles IS NULL OR useful_life_cycles > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_assets_residual_value_nonnegative') THEN
    ALTER TABLE farm_assets
      ADD CONSTRAINT farm_assets_residual_value_nonnegative
      CHECK (residual_value >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farm_assets_depreciation_basis_valid') THEN
    ALTER TABLE farm_assets
      ADD CONSTRAINT farm_assets_depreciation_basis_valid
      CHECK (depreciation_basis IN ('meses', 'ciclos'));
  END IF;
END
$$;

-- Índices parciales para tokens activos y reglas únicas de gallinaza
CREATE INDEX IF NOT EXISTS export_tokens_active_idx
  ON export_tokens (farm_id) WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS manure_factor_global_group_idx
  ON manure_factors (farm_id, bird_group) WHERE stage_catalogo_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS manure_auto_daily_unique_idx
  ON manure_production (farm_id, date) WHERE source = 'auto_diario';

-- Activar PostgreSQL RLS estricto en todas las tablas operativas aisladas por granja
-- (users, sessions, farms, farm_subscriptions, billing_payments y export_tokens quedan fuera de RLS para login/tokens/superadmin)
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
    'agent_memories',
    'external_data_snapshots'
  ];
  rls_expr text := $rls$COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid)$rls$;
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
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

-- Catálogos: lectura compartida de catálogos base (granja por defecto) + propios de la finca; escritura solo propia finca
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

-- Permisos completos para el rol no-superusuario usado cuando RLS está activo
GRANT USAGE ON SCHEMA public TO gallinero_tenant_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gallinero_tenant_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gallinero_tenant_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO gallinero_tenant_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO gallinero_tenant_role;
