-- Estandarización del Catálogo de CapEx e Inversiones (CAP-001..CAP-242)
-- Agrega clasificación jerárquica estándar (Familia, Subfamilia, Clasificación, Destino, Driver)
-- sobre farm_assets y vinculación opcional sobre transactions.

ALTER TABLE "farm_assets"
  ADD COLUMN IF NOT EXISTS "capex_catalog_id" varchar(20),
  ADD COLUMN IF NOT EXISTS "capex_family" varchar(120),
  ADD COLUMN IF NOT EXISTS "capex_subfamily" varchar(120),
  ADD COLUMN IF NOT EXISTS "capex_classification" varchar(40),
  ADD COLUMN IF NOT EXISTS "capex_destination" varchar(40),
  ADD COLUMN IF NOT EXISTS "capex_driver" varchar(60);

DO $$ BEGIN
  ALTER TABLE "farm_assets" DROP CONSTRAINT IF EXISTS "farm_assets_useful_life_months_positive";
  ALTER TABLE "farm_assets" ADD CONSTRAINT "farm_assets_useful_life_months_positive"
    CHECK (
      "useful_life_months" IS NULL
      OR "useful_life_months" > 0
      OR ("useful_life_months" = 0 AND "capex_classification" = 'CAPEX_NO_DEPRECIABLE')
    );
END $$;

DO $$ BEGIN
  ALTER TABLE "farm_assets" DROP CONSTRAINT IF EXISTS "farm_assets_capex_catalog_id_valid";
  ALTER TABLE "farm_assets" ADD CONSTRAINT "farm_assets_capex_catalog_id_valid"
    CHECK ("capex_catalog_id" IS NULL OR "capex_catalog_id" ~ '^CAP-[0-9]{3}$');
END $$;

DO $$ BEGIN
  ALTER TABLE "farm_assets" DROP CONSTRAINT IF EXISTS "farm_assets_capex_classification_valid";
  ALTER TABLE "farm_assets" ADD CONSTRAINT "farm_assets_capex_classification_valid"
    CHECK ("capex_classification" IS NULL OR "capex_classification" IN (
      'CAPEX_DEPRECIABLE',
      'CAPEX_NO_DEPRECIABLE',
      'INTANGIBLE_AMORTIZABLE',
      'ACTIVO_BIOLOGICO',
      'INVENTARIO',
      'OPEX_NO_CAPEX',
      'FINANCIACION'
    ));
END $$;

DO $$ BEGIN
  ALTER TABLE "farm_assets" DROP CONSTRAINT IF EXISTS "farm_assets_capex_destination_valid";
  ALTER TABLE "farm_assets" ADD CONSTRAINT "farm_assets_capex_destination_valid"
    CHECK ("capex_destination" IS NULL OR "capex_destination" IN (
      'Compartido',
      'Huevos',
      'Aves/carne',
      'Reproducción',
      'Gallinaza/compost'
    ));
END $$;

CREATE INDEX IF NOT EXISTS "farm_assets_capex_family_idx"
  ON "farm_assets" ("farm_id", "capex_family");

CREATE INDEX IF NOT EXISTS "farm_assets_capex_catalog_idx"
  ON "farm_assets" ("farm_id", "capex_catalog_id");

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "capex_catalog_id" varchar(20),
  ADD COLUMN IF NOT EXISTS "capex_family" varchar(120);

DO $$ BEGIN
  ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_capex_catalog_id_valid";
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_capex_catalog_id_valid"
    CHECK ("capex_catalog_id" IS NULL OR "capex_catalog_id" ~ '^CAP-[0-9]{3}$');
END $$;
