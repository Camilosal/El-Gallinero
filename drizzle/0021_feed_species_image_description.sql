-- Migración 0021: Ficha multi-especie de alimentos (para qué animales aplica, imagen, descripción, nombres regionales)
-- y tipos de concentrado dedicados para todas las especies soportadas (pollo engorde, patos, cuyes, multiespecie).

ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Concentrado Pollo Engorde';
--> statement-breakpoint
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Concentrado Patos';
--> statement-breakpoint
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Concentrado Cuyes';
--> statement-breakpoint
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Concentrado Multiespecie';
--> statement-breakpoint
ALTER TABLE feed_inventory
  ADD COLUMN IF NOT EXISTS allowed_species jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE feed_inventory
  ADD COLUMN IF NOT EXISTS image_url text;
--> statement-breakpoint
ALTER TABLE feed_inventory
  ADD COLUMN IF NOT EXISTS description text;
--> statement-breakpoint
ALTER TABLE feed_inventory
  ADD COLUMN IF NOT EXISTS regional_names jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
-- Backfill idempotente sobre alimentos existentes sin especies/imagen/descripción asignadas
UPDATE feed_inventory
SET
  allowed_species = CASE
    WHEN standard_catalog_id IN ('IG-001', 'IG-002') THEN '["gallina"]'::jsonb
    WHEN standard_catalog_id = 'IG-003' THEN '["gallina","gallo","pollo"]'::jsonb
    WHEN standard_catalog_id = 'IG-004' THEN '["gallina","gallo","pollo","codorniz","pato"]'::jsonb
    WHEN standard_catalog_id = 'IG-005' THEN '["gallina","gallo"]'::jsonb
    WHEN standard_catalog_id = 'IG-120' OR lower(name) LIKE '%pollo engorde%' THEN '["pollo"]'::jsonb
    WHEN standard_catalog_id IN ('IG-121', 'IG-122') OR feed_type = 'Concentrado Codorniz' OR lower(name) LIKE '%codorniz%' THEN '["codorniz"]'::jsonb
    WHEN standard_catalog_id = 'IG-123' OR feed_type = 'Concentrado Patos' OR lower(name) LIKE '%pato%' THEN '["pato"]'::jsonb
    WHEN standard_catalog_id = 'IG-124' OR (feed_type = 'Concentrado Conejos' AND lower(name) NOT LIKE '%cuy%') THEN '["conejo"]'::jsonb
    WHEN standard_catalog_id = 'IG-125' OR feed_type = 'Concentrado Cuyes' OR (lower(name) LIKE '%cuy%' AND lower(name) NOT LIKE '%conejo%') THEN '["cuy"]'::jsonb
    WHEN standard_catalog_id = 'IG-126' OR feed_type = 'Concentrado Multiespecie' OR (lower(name) LIKE '%conejo%' AND lower(name) LIKE '%cuy%') THEN '["conejo","cuy"]'::jsonb
    WHEN catalog_group = 'Insectos y anélidos' OR feed_type IN ('Mosca Soldado', 'mosca_soldado') THEN '["gallina","gallo","pollo","codorniz","pato"]'::jsonb
    WHEN catalog_group = 'Minerales y aditivos' OR lower(name) LIKE '%calcio%' OR lower(name) LIKE '%conchilla%' THEN '["gallina","gallo","codorniz","pato"]'::jsonb
    WHEN lower(name) LIKE '%pollo%' THEN '["pollo"]'::jsonb
    WHEN lower(name) LIKE '%postura%' OR lower(name) LIKE '%pollita%' OR lower(name) LIKE '%pre-postura%' THEN '["gallina"]'::jsonb
    ELSE '["gallina","gallo","pollo","codorniz","pato","conejo","cuy"]'::jsonb
  END
WHERE allowed_species = '[]'::jsonb;
--> statement-breakpoint
UPDATE feed_inventory
SET
  image_url = CASE
    WHEN standard_catalog_id = 'IG-120' OR lower(name) LIKE '%pollo%' THEN '/images/alimentos/concentrado-pollo.svg'
    WHEN standard_catalog_id IN ('IG-121', 'IG-122') OR feed_type = 'Concentrado Codorniz' OR lower(name) LIKE '%codorniz%' THEN '/images/alimentos/concentrado-codorniz.svg'
    WHEN standard_catalog_id = 'IG-123' OR feed_type = 'Concentrado Patos' OR lower(name) LIKE '%pato%' THEN '/images/alimentos/concentrado-patos.svg'
    WHEN standard_catalog_id = 'IG-126' OR feed_type = 'Concentrado Multiespecie' OR (lower(name) LIKE '%conejo%' AND lower(name) LIKE '%cuy%') THEN '/images/alimentos/concentrado-multiespecie.svg'
    WHEN standard_catalog_id = 'IG-124' OR feed_type = 'Concentrado Conejos' OR lower(name) LIKE '%conejo%' THEN '/images/alimentos/concentrado-conejos.svg'
    WHEN standard_catalog_id = 'IG-125' OR feed_type = 'Concentrado Cuyes' OR lower(name) LIKE '%cuy%' THEN '/images/alimentos/concentrado-cuyes.svg'
    WHEN catalog_group = 'Balanceados' OR category = 'Concentrado' OR feed_type = 'Concentrado Aves' THEN '/images/alimentos/concentrado-aves.svg'
    WHEN catalog_group = 'Insectos y anélidos' OR feed_type IN ('Mosca Soldado', 'mosca_soldado') THEN '/images/alimentos/insectos-proteina.svg'
    WHEN catalog_group = 'Raíces y tubérculos' OR feed_type IN ('Bore o Raices', 'bore_raices') THEN '/images/alimentos/raices-tuberculos.svg'
    WHEN catalog_group = 'Hojas y forrajes' OR feed_type IN ('Forraje Verde', 'Pastos y gramíneas', 'pastos_gramineas') THEN '/images/alimentos/forrajes-hojas.svg'
    WHEN catalog_group = 'Minerales y aditivos' OR lower(name) LIKE '%calcio%' OR lower(name) LIKE '%conchilla%' THEN '/images/alimentos/minerales-aditivos.svg'
    WHEN catalog_group = 'Hortalizas y verduras' THEN '/images/alimentos/hortalizas-verduras.svg'
    WHEN catalog_group = 'Frutas' THEN '/images/alimentos/frutas.svg'
    ELSE '/images/alimentos/cereales-semillas.svg'
  END
WHERE image_url IS NULL OR btrim(image_url) = '';
--> statement-breakpoint
UPDATE feed_inventory
SET
  description = COALESCE(
    NULLIF(btrim(description), ''),
    'Alimento registrado en inventario (' || COALESCE(catalog_group, category::text) || '). Consulta sus aportes en base seca (% MS) y especies recomendadas antes de formular.'
  )
WHERE description IS NULL OR btrim(description) = '';
