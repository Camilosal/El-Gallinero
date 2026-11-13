-- Esquema multi-producto para ventas: dimensiones de especie/lugar en chicken_sales
-- y categorías ampliadas de ingresos en catalogos. Idempotente.

ALTER TABLE chicken_sales
  ADD COLUMN IF NOT EXISTS species varchar(20),
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES farm_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chicken_sales_species_idx ON chicken_sales (species);
CREATE INDEX IF NOT EXISTS chicken_sales_location_idx ON chicken_sales (location_id);

-- Retro-llenado desde lote, gallina, gallo o bird_type existente
UPDATE chicken_sales cs
SET
  species = COALESCE(cs.species, b.species::text),
  location_id = COALESCE(cs.location_id, b.location_id)
FROM broiler_batches b
WHERE cs.batch_id = b.id
  AND (cs.species IS NULL OR cs.location_id IS NULL);

UPDATE chicken_sales cs
SET
  species = COALESCE(cs.species, 'gallina'),
  location_id = COALESCE(cs.location_id, h.location_id)
FROM hens h
WHERE cs.hen_id = h.id
  AND (cs.species IS NULL OR cs.location_id IS NULL);

UPDATE chicken_sales cs
SET
  species = COALESCE(cs.species, 'gallo'),
  location_id = COALESCE(cs.location_id, r.location_id)
FROM roosters r
WHERE cs.rooster_id = r.id
  AND (cs.species IS NULL OR cs.location_id IS NULL);

UPDATE chicken_sales
SET species = CASE
  WHEN bird_type IN ('gallina', 'gallina_descarte') THEN 'gallina'
  WHEN bird_type = 'gallo' THEN 'gallo'
  WHEN bird_type IN ('codorniz', 'lote_codornices') THEN 'codorniz'
  WHEN bird_type IN ('pato', 'lote_patos') THEN 'pato'
  WHEN bird_type IN ('conejo', 'lote_conejos') THEN 'conejo'
  WHEN bird_type IN ('cuy', 'lote_cuyes') THEN 'cuy'
  ELSE 'pollo'
END
WHERE species IS NULL;

-- Categorías de ingreso multi-producto (conserva las existentes)
INSERT INTO catalogos (category, value, is_active, sort_order)
SELECT v.category, v.value, true, v.sort_order
FROM (
  VALUES
    ('categoria_ingreso', 'Venta de animales', 2),
    ('categoria_ingreso', 'Venta de carne', 3),
    ('categoria_ingreso', 'Venta de subproductos', 7)
) AS v(category, value, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM catalogos c WHERE c.category = v.category AND c.value = v.value
);

