-- Migración 0022: Re-alineación multi-especie de concentrados históricos (codorniz, patos, conejos, cuyes, pollo engorde),
-- corrección de imagen en granos clasificados bajo categoría Concentrado, enriquecimiento de alias regionales y
-- provisión idempotente de concentrado dedicado para cuyes/curíes en granjas activas con inventario cargado.

-- 1) Re-alinear concentrados de especies distintas a ponedora que tenían códigos genéricos IG-001..IG-004
UPDATE feed_inventory
SET
  standard_catalog_id = CASE
    WHEN lower(name) LIKE '%conejo%' AND (lower(name) LIKE '%cuy%' OR lower(name) LIKE '%curi%') THEN 'IG-126'
    WHEN lower(name) LIKE '%cuy%' OR lower(name) LIKE '%curi%' OR lower(name) LIKE '%cobayo%' THEN 'IG-125'
    WHEN lower(name) LIKE '%conejo%' THEN 'IG-124'
    WHEN lower(name) LIKE '%pato%' THEN 'IG-123'
    WHEN lower(name) LIKE '%codorniz%' AND (lower(name) LIKE '%cria%' OR lower(name) LIKE '%cría%' OR lower(name) LIKE '%inic%') THEN 'IG-121'
    WHEN lower(name) LIKE '%codorniz%' THEN 'IG-122'
    WHEN lower(name) LIKE '%pollo%' AND (lower(name) LIKE '%engorde%' OR lower(name) LIKE '%finaliz%') THEN 'IG-120'
    ELSE standard_catalog_id
  END,
  feed_type = CASE
    WHEN lower(name) LIKE '%conejo%' AND (lower(name) LIKE '%cuy%' OR lower(name) LIKE '%curi%') THEN 'Concentrado Multiespecie'::feed_type
    WHEN lower(name) LIKE '%cuy%' OR lower(name) LIKE '%curi%' OR lower(name) LIKE '%cobayo%' THEN 'Concentrado Cuyes'::feed_type
    WHEN lower(name) LIKE '%conejo%' AND lower(name) NOT LIKE '%alfalfa%' AND lower(name) NOT LIKE '%forraje%' THEN 'Concentrado Conejos'::feed_type
    WHEN lower(name) LIKE '%pato%' THEN 'Concentrado Patos'::feed_type
    WHEN lower(name) LIKE '%codorniz%' THEN 'Concentrado Codorniz'::feed_type
    WHEN lower(name) LIKE '%pollo%' THEN 'Concentrado Pollo Engorde'::feed_type
    ELSE feed_type
  END,
  allowed_species = CASE
    WHEN lower(name) LIKE '%conejo%' AND (lower(name) LIKE '%cuy%' OR lower(name) LIKE '%curi%') THEN '["conejo","cuy"]'::jsonb
    WHEN lower(name) LIKE '%cuy%' OR lower(name) LIKE '%curi%' OR lower(name) LIKE '%cobayo%' THEN '["cuy"]'::jsonb
    WHEN lower(name) LIKE '%conejo%' THEN '["conejo"]'::jsonb
    WHEN lower(name) LIKE '%pato%' THEN '["pato"]'::jsonb
    WHEN lower(name) LIKE '%codorniz%' THEN '["codorniz"]'::jsonb
    WHEN lower(name) LIKE '%pollo%' AND lower(name) NOT LIKE '%pollita%' THEN '["pollo"]'::jsonb
    ELSE allowed_species
  END,
  image_url = CASE
    WHEN lower(name) LIKE '%conejo%' AND (lower(name) LIKE '%cuy%' OR lower(name) LIKE '%curi%') THEN '/images/alimentos/concentrado-multiespecie.svg'
    WHEN lower(name) LIKE '%cuy%' OR lower(name) LIKE '%curi%' OR lower(name) LIKE '%cobayo%' THEN '/images/alimentos/concentrado-cuyes.svg'
    WHEN lower(name) LIKE '%conejo%' AND lower(name) NOT LIKE '%alfalfa%' AND lower(name) NOT LIKE '%forraje%' THEN '/images/alimentos/concentrado-conejos.svg'
    WHEN lower(name) LIKE '%pato%' THEN '/images/alimentos/concentrado-patos.svg'
    WHEN lower(name) LIKE '%codorniz%' THEN '/images/alimentos/concentrado-codorniz.svg'
    WHEN lower(name) LIKE '%pollo%' THEN '/images/alimentos/concentrado-pollo.svg'
    ELSE image_url
  END,
  updated_at = NOW()
WHERE
  (
    lower(name) LIKE '%codorniz%'
    OR (lower(name) LIKE '%conejo%' AND lower(name) NOT LIKE '%alfalfa%' AND lower(name) NOT LIKE '%forraje%')
    OR lower(name) LIKE '%cuy%'
    OR lower(name) LIKE '%curi%'
    OR lower(name) LIKE '%pato%'
    OR (lower(name) LIKE '%pollo%' AND lower(name) NOT LIKE '%pollita%')
  )
  AND (
    standard_catalog_id IS NULL
    OR standard_catalog_id IN ('IG-001', 'IG-002', 'IG-003', 'IG-004', 'IG-005', 'IG-120', 'IG-121', 'IG-122', 'IG-123', 'IG-124', 'IG-125', 'IG-126')
  );
--> statement-breakpoint
-- 2) Corregir ilustración de cereales/granos/forrajes que tenían categoría Concentrado o imagen heredada genérica
UPDATE feed_inventory
SET
  image_url = CASE
    WHEN catalog_group = 'Cereales y semillas' OR feed_type::text IN ('Maiz en Grano', 'Maíz Germinado', 'Purinas', 'maiz_comprado', 'maiz_germinado', 'purinas') THEN '/images/alimentos/cereales-semillas.svg'
    WHEN catalog_group = 'Hojas y forrajes' OR feed_type::text IN ('Forraje Verde', 'Pastos y gramíneas', 'forraje_verde', 'pastos_gramineas') THEN '/images/alimentos/forrajes-hojas.svg'
    ELSE image_url
  END,
  updated_at = NOW()
WHERE
  (
    catalog_group = 'Cereales y semillas'
    OR feed_type::text IN ('Maiz en Grano', 'Maíz Germinado', 'Purinas', 'maiz_comprado', 'maiz_germinado', 'purinas')
    OR catalog_group = 'Hojas y forrajes'
  )
  AND image_url IN ('/images/alimentos/concentrado-aves.svg', '/images/alimentos/concentrado-conejos.svg');
--> statement-breakpoint
-- 3) Completar alias regionales cuando el registro no tiene ninguno definido aún
UPDATE feed_inventory
SET
  regional_names = CASE
    WHEN standard_catalog_id = 'IG-001' THEN '["Cuido ponedora","Purina postura","Concentrado postura","Mash ponedora"]'::jsonb
    WHEN standard_catalog_id = 'IG-002' THEN '["Cuido prepostura","Purina prepostura","Concentrado polla 18 sem"]'::jsonb
    WHEN standard_catalog_id = 'IG-003' THEN '["Cuido levante","Purina desarrollo","Concentrado crecimiento aves"]'::jsonb
    WHEN standard_catalog_id = 'IG-004' THEN '["Cuido iniciación","Preiniciador aves","Migaja pollito","Purina cría"]'::jsonb
    WHEN standard_catalog_id = 'IG-120' THEN '["Cuido engorde","Pollo ceba","Finalizador broiler","Purina pollo"]'::jsonb
    WHEN standard_catalog_id = 'IG-121' THEN '["Cuido codorniz inicio","Iniciador coturnícola","Harina cría codorniz"]'::jsonb
    WHEN standard_catalog_id = 'IG-122' THEN '["Cuido codorniz postura","Concentrado ponedora codorniz"]'::jsonb
    WHEN standard_catalog_id = 'IG-123' THEN '["Cuido patos","Concentrado anseriformes","Pellet para pato"]'::jsonb
    WHEN standard_catalog_id = 'IG-124' THEN '["Cuido conejos","Conejina","Pellet cunícola","Concentrado ceba conejo"]'::jsonb
    WHEN standard_catalog_id = 'IG-125' THEN '["Cuido cuyes","Cuyina","Concentrado curí","Pellet cobayos Vitamina C"]'::jsonb
    WHEN standard_catalog_id = 'IG-126' THEN '["Cuido conejo y cuy","Conejina multiuso","Pellet curí y conejo"]'::jsonb
    WHEN standard_catalog_id = 'IG-007' THEN '["BSF deshidratada","Harina entera de larva","Mosca soldado seca"]'::jsonb
    WHEN standard_catalog_id = 'IG-015' THEN '["Maíz amarillo","Choclo seco","Cucho","Maíz duro"]'::jsonb
    WHEN standard_catalog_id = 'IG-031' THEN '["Maíz germinado","Grano brotado"]'::jsonb
    WHEN standard_catalog_id = 'IG-039' THEN '["Batata","Camote","Boniato","Papa dulce"]'::jsonb
    WHEN standard_catalog_id = 'IG-042' THEN '["Hoja de bore","Chonque","Mafafa","Alocasia tratada"]'::jsonb
    WHEN standard_catalog_id = 'IG-058' THEN '["Alfalfa","Lucerna","Mielga","Heno de alfalfa"]'::jsonb
    WHEN standard_catalog_id = 'IG-071' THEN '["Pasto de corte","Pasto elefante","King grass","Maralfalfa","Kikuyo"]'::jsonb
    WHEN standard_catalog_id = 'IG-115' THEN '["Carbonato de calcio","Caliza alimentaria","CaCO3"]'::jsonb
    ELSE regional_names
  END,
  updated_at = NOW()
WHERE regional_names = '[]'::jsonb
  AND standard_catalog_id IN (
    'IG-001','IG-002','IG-003','IG-004','IG-007','IG-015','IG-031','IG-039','IG-042','IG-058','IG-071','IG-115',
    'IG-120','IG-121','IG-122','IG-123','IG-124','IG-125','IG-126'
  );
--> statement-breakpoint
-- 4) Asegurar concentrado dedicado para cuyes/curíes (IG-125) en granjas activas que ya tienen alimentos registrados
INSERT INTO feed_inventory (
  farm_id,
  name,
  category,
  feed_type,
  unit,
  current_stock,
  min_stock,
  cost_per_unit,
  supplier,
  dry_matter_pct,
  crude_protein_pct,
  standard_catalog_id,
  catalog_group,
  sanitary_status,
  energy_kcal_kg_dm,
  calcium_dm_pct,
  available_phosphorus_dm_pct,
  crude_fiber_dm_pct,
  allowed_species,
  image_url,
  description,
  regional_names
)
SELECT
  f.id,
  'Concentrado Peletizado Cuyes (Vitamina C)',
  'Concentrado'::feed_category,
  'Concentrado Cuyes'::feed_type,
  'kg',
  '0',
  '12',
  '0',
  NULL,
  '88.00',
  '20.00',
  'IG-125',
  'Balanceados',
  'CONDICIONAL',
  '2650.00',
  '1.00',
  '0.52',
  '13.50',
  '["cuy"]'::jsonb,
  '/images/alimentos/concentrado-cuyes.svg',
  'Pellet formulado para cuyes/curíes enriquecido con fibra digestible y Vitamina C protegida (ácido ascórbico esencial que el cobayo no sintetiza).',
  '["Cuido cuyes","Cuyina","Concentrado curí","Pellet cobayos Vitamina C"]'::jsonb
FROM farms f
WHERE EXISTS (
  SELECT 1 FROM feed_inventory fi WHERE fi.farm_id = f.id
)
AND NOT EXISTS (
  SELECT 1 FROM feed_inventory fi2
  WHERE fi2.farm_id = f.id
    AND (
      fi2.standard_catalog_id = 'IG-125'
      OR fi2.feed_type = 'Concentrado Cuyes'
      OR (lower(fi2.name) LIKE '%cuy%' AND lower(fi2.name) NOT LIKE '%conejo%')
    )
);
