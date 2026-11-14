-- Idempotent migration: add CapEx depreciation & useful life fields to farm_assets
ALTER TABLE farm_assets
  ADD COLUMN IF NOT EXISTS useful_life_months INTEGER DEFAULT 36,
  ADD COLUMN IF NOT EXISTS useful_life_cycles INTEGER,
  ADD COLUMN IF NOT EXISTS residual_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depreciation_basis VARCHAR(20) NOT NULL DEFAULT 'meses';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farm_assets_useful_life_months_positive'
  ) THEN
    ALTER TABLE farm_assets
      ADD CONSTRAINT farm_assets_useful_life_months_positive
      CHECK (useful_life_months IS NULL OR useful_life_months > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farm_assets_useful_life_cycles_positive'
  ) THEN
    ALTER TABLE farm_assets
      ADD CONSTRAINT farm_assets_useful_life_cycles_positive
      CHECK (useful_life_cycles IS NULL OR useful_life_cycles > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farm_assets_residual_value_nonnegative'
  ) THEN
    ALTER TABLE farm_assets
      ADD CONSTRAINT farm_assets_residual_value_nonnegative
      CHECK (residual_value >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farm_assets_depreciation_basis_valid'
  ) THEN
    ALTER TABLE farm_assets
      ADD CONSTRAINT farm_assets_depreciation_basis_valid
      CHECK (depreciation_basis IN ('meses', 'ciclos'));
  END IF;
END $$;
