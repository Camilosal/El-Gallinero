BEGIN;

-- Keep the most recently edited factor if earlier reads created duplicate
-- stage-specific or global rows.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY stage_catalogo_id, bird_group
      ORDER BY updated_at DESC, created_at DESC, id
    ) AS position
  FROM manure_factors
)
DELETE FROM manure_factors AS factor
USING ranked
WHERE factor.id = ranked.id
  AND ranked.position > 1;

DROP INDEX IF EXISTS manure_factor_stage_group_idx;

CREATE UNIQUE INDEX manure_factor_stage_group_idx
  ON manure_factors (stage_catalogo_id, bird_group)
  WHERE stage_catalogo_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS manure_factor_global_group_idx
  ON manure_factors (bird_group)
  WHERE stage_catalogo_id IS NULL;

COMMIT;
