-- Dimensiones analíticas (especie / lugar / lote), costo del alimento consumido
-- y composición del alimento. Aditivo e idempotente.
-- Aplicar fuera de transacción por el ALTER TYPE: psql -f scripts/add_analytics_dimensions.sql

ALTER TYPE animal_species ADD VALUE IF NOT EXISTS 'cuy';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS species varchar(20),
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES broiler_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_species_idx ON transactions (species);
CREATE INDEX IF NOT EXISTS transactions_location_idx ON transactions (location_id);
CREATE INDEX IF NOT EXISTS transactions_batch_idx ON transactions (batch_id);

ALTER TABLE feed_movements
  ADD COLUMN IF NOT EXISTS species varchar(20),
  ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2);

CREATE INDEX IF NOT EXISTS feed_movements_species_idx ON feed_movements (species);
CREATE INDEX IF NOT EXISTS feed_movements_location_idx ON feed_movements (location_id);

ALTER TABLE feed_inventory
  ADD COLUMN IF NOT EXISTS dry_matter_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS crude_protein_pct numeric(5,2);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_inventory_dry_matter_range') THEN
    ALTER TABLE feed_inventory ADD CONSTRAINT feed_inventory_dry_matter_range
      CHECK (dry_matter_pct IS NULL OR (dry_matter_pct > 0 AND dry_matter_pct <= 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feed_inventory_protein_range') THEN
    ALTER TABLE feed_inventory ADD CONSTRAINT feed_inventory_protein_range
      CHECK (crude_protein_pct IS NULL OR (crude_protein_pct >= 0 AND crude_protein_pct <= 100));
  END IF;
END $$;

-- Retro-llenado de la especie en consumos de programa a partir de la etapa.
UPDATE feed_movements m
SET species = lower(c.tipo)
FROM catalogos c
WHERE m.species IS NULL
  AND m.stage_catalogo_id = c.id
  AND lower(c.tipo) IN ('gallina','gallo','pollo','codorniz','pato','conejo','cuy');

