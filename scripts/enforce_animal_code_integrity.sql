-- Adds database-level uniqueness for animal codes and stores the states needed
-- to reverse a sanitary event without guessing the animals' prior status.
-- The duplicate checks stop before any schema change if existing codes conflict.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM hens GROUP BY code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate codes exist in hens; resolve them before applying this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM roosters GROUP BY code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate codes exist in roosters; resolve them before applying this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM broiler_batches GROUP BY code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate codes exist in broiler_batches; resolve them before applying this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hens_code_unique_idx ON hens (code);
CREATE UNIQUE INDEX IF NOT EXISTS roosters_code_unique_idx ON roosters (code);
CREATE UNIQUE INDEX IF NOT EXISTS broiler_batches_code_unique_idx ON broiler_batches (code);

ALTER TABLE health_control
  ADD COLUMN IF NOT EXISTS previous_animal_states JSONB;

COMMIT;
