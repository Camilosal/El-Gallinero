BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM manure_production
    WHERE source = 'auto_diario'
    GROUP BY date
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate automatic manure production exists for a date';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS manure_auto_daily_unique_idx
  ON manure_production (date)
  WHERE source = 'auto_diario';

COMMIT;
