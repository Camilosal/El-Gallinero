-- Migración 0002: Personal/Nómina, Impuestos/Deducciones en transacciones y Devengo por consumo de insumos.
-- Idempotente y segura sobre instalaciones nuevas y existentes.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS iva_rate numeric(6, 2),
  ADD COLUMN IF NOT EXISTS iva_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS rete_fuente_rate numeric(6, 2),
  ADD COLUMN IF NOT EXISTS rete_fuente_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS ica_rate numeric(6, 2),
  ADD COLUMN IF NOT EXISTS ica_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS other_deductions_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS net_settlement_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS tax_notes text;

ALTER TABLE supply_movements
  ADD COLUMN IF NOT EXISTS species varchar(20),
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_cost numeric(10, 2);

CREATE TABLE IF NOT EXISTS staff_profiles (
  farm_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name varchar(150) NOT NULL,
  document_id varchar(40),
  worker_kind varchar(30) DEFAULT 'apoyo' NOT NULL,
  contract_type varchar(40) DEFAULT 'jornal' NOT NULL,
  pay_period varchar(20) DEFAULT 'dia' NOT NULL,
  base_rate_cop numeric(12, 2) NOT NULL,
  role_label varchar(100),
  default_species varchar(20),
  default_location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  apply_social_security boolean DEFAULT false NOT NULL,
  employer_burden_pct numeric(6, 2) DEFAULT 0 NOT NULL,
  worker_deduction_pct numeric(6, 2) DEFAULT 0 NOT NULL,
  arl_risk_rate_pct numeric(6, 3) DEFAULT 0.522 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  notes text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS staff_profiles_farm_active_idx ON staff_profiles (farm_id, is_active);

CREATE TABLE IF NOT EXISTS payroll_entries (
  farm_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE RESTRICT,
  date date NOT NULL,
  period_from date,
  period_to date,
  units_worked numeric(10, 2) DEFAULT 1 NOT NULL,
  unit_rate_cop numeric(12, 2) NOT NULL,
  gross_pay_cop numeric(12, 2) NOT NULL,
  bonuses_cop numeric(12, 2) DEFAULT 0 NOT NULL,
  employer_burden_cop numeric(12, 2) DEFAULT 0 NOT NULL,
  worker_deductions_cop numeric(12, 2) DEFAULT 0 NOT NULL,
  rete_fuente_cop numeric(12, 2) DEFAULT 0 NOT NULL,
  net_payable_cop numeric(12, 2) NOT NULL,
  total_employer_cost_cop numeric(12, 2) NOT NULL,
  accounting_mode varchar(30) DEFAULT 'cash_expense' NOT NULL,
  payment_status varchar(20) DEFAULT 'pagado' NOT NULL,
  due_date date,
  species varchar(20),
  location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  proration_basis varchar(30),
  linked_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  linked_allocation_id uuid REFERENCES cost_allocations(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS payroll_entries_farm_date_idx ON payroll_entries (farm_id, date);
CREATE INDEX IF NOT EXISTS payroll_entries_staff_idx ON payroll_entries (staff_id);

DO $$
DECLARE
  t text;
  new_tables text[] := ARRAY['staff_profiles', 'payroll_entries'];
  rls_expr text := $rls$COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid)$rls$;
BEGIN
  FOREACH t IN ARRAY new_tables LOOP
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
