-- Vinculación estandarizada de egresos, partidas de presupuesto, productos frecuentes y prorrateos
-- con el Catálogo Maestro de Egresos (CST-001..CST-303 · 26 Familias / centros).
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_catalog_id varchar(20);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_family varchar(120);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_concept varchar(200);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_treatment varchar(30);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expense_driver varchar(30);

CREATE INDEX IF NOT EXISTS transactions_expense_family_idx
  ON transactions (farm_id, expense_family)
  WHERE expense_family IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_expense_catalog_idx
  ON transactions (farm_id, expense_catalog_id)
  WHERE expense_catalog_id IS NOT NULL;

ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS expense_catalog_id varchar(20);
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS expense_family varchar(120);

ALTER TABLE purchase_products ADD COLUMN IF NOT EXISTS expense_catalog_id varchar(20);
ALTER TABLE purchase_products ADD COLUMN IF NOT EXISTS expense_family varchar(120);

ALTER TABLE cost_allocations ADD COLUMN IF NOT EXISTS expense_catalog_id varchar(20);
ALTER TABLE cost_allocations ADD COLUMN IF NOT EXISTS expense_family varchar(120);
