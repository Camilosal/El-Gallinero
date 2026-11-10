-- Preserve the state of linked animals before sale, slaughter, or mortality
-- so editing or deleting an exit can restore inventory without guessing.

BEGIN;

ALTER TABLE chicken_sales
  ADD COLUMN IF NOT EXISTS previous_animal_states JSONB;

ALTER TABLE slaughter
  ADD COLUMN IF NOT EXISTS previous_animal_states JSONB;

ALTER TABLE mortality_records
  ADD COLUMN IF NOT EXISTS previous_animal_states JSONB;

COMMIT;
