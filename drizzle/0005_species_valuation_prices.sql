ALTER TABLE catalogos
  ADD COLUMN IF NOT EXISTS initial_unit_cost_cop numeric(12, 2),
  ADD COLUMN IF NOT EXISTS point_of_lay_unit_value_cop numeric(12, 2),
  ADD COLUMN IF NOT EXISTS breeder_unit_value_cop numeric(12, 2);

-- Monetary values stay NULL until each farm enters a supported current price in Catálogos.
-- This avoids seeding illustrative COP amounts as if they were real master prices.
