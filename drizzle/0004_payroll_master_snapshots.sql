-- Keep each payroll calculation tied to the master rates and allowance in force when it was created.
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS include_transport_allowance boolean DEFAULT false NOT NULL;

ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS transport_allowance_cop numeric(12, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS employer_burden_pct numeric(6, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS worker_deduction_pct numeric(6, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS rete_fuente_rate_pct numeric(6, 2) DEFAULT 0 NOT NULL;
