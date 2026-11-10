-- Adds a durable source link for egg autoconsumption logs.
-- Safe to run more than once. Unambiguous legacy rows are linked; ambiguous
-- same-day rows are intentionally left untouched to avoid assigning them to
-- the wrong production record.

ALTER TABLE autoconsumo_logs
  ADD COLUMN IF NOT EXISTS egg_production_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'autoconsumo_logs_egg_production_id_fkey'
  ) THEN
    ALTER TABLE autoconsumo_logs
      ADD CONSTRAINT autoconsumo_logs_egg_production_id_fkey
      FOREIGN KEY (egg_production_id) REFERENCES egg_production(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS autoconsumo_egg_production_idx
  ON autoconsumo_logs (egg_production_id);

WITH candidates AS (
  SELECT
    log.id AS log_id,
    production.id AS production_id,
    count(*) OVER (PARTITION BY log.id) AS log_match_count,
    count(*) OVER (PARTITION BY production.id) AS production_match_count
  FROM autoconsumo_logs AS log
  JOIN egg_production AS production
    ON production.date = log.date
   AND production.species = log.species
   AND production.batch_id IS NOT DISTINCT FROM log.batch_id
   AND production.quantity_autoconsumo::numeric = log.quantity
   AND production.reference_unit_price IS NOT NULL
   AND production.reference_unit_price = log.market_reference_price
  WHERE log.product_type = 'huevo'
    AND log.egg_production_id IS NULL
), unambiguous AS (
  SELECT log_id, production_id
  FROM candidates
  WHERE log_match_count = 1 AND production_match_count = 1
)
UPDATE autoconsumo_logs AS log
SET egg_production_id = unambiguous.production_id
FROM unambiguous
WHERE log.id = unambiguous.log_id
  AND log.egg_production_id IS NULL;
