-- Estandarización de enums y restricciones CHECK sobre catálogos de Alimentos (IG-001..IG-119)
-- y Egresos (CST-001..CST-303), preservando compatibilidad de columnas legadas.

-- 1. Normalización de categorías y tipos legados en feed_inventory
UPDATE feed_inventory SET category = 'En Fresco' WHERE category = 'granja_fresco';
UPDATE feed_inventory SET category = 'Preparados' WHERE category = 'granja_procesado';
UPDATE feed_inventory SET category = 'Concentrado' WHERE category = 'suplementario';

UPDATE feed_inventory SET feed_type = 'Concentrado Aves' WHERE feed_type = 'concentrado_comercial';
UPDATE feed_inventory SET feed_type = 'Mosca Soldado' WHERE feed_type = 'mosca_soldado';
UPDATE feed_inventory SET feed_type = 'Pastos y gramíneas' WHERE feed_type = 'pastos_gramineas';
UPDATE feed_inventory SET feed_type = 'Maíz Germinado' WHERE feed_type = 'maiz_germinado';
UPDATE feed_inventory SET feed_type = 'Bore o Raices' WHERE feed_type = 'bore_raices';
UPDATE feed_inventory SET feed_type = 'Purinas' WHERE feed_type = 'purinas';
UPDATE feed_inventory SET feed_type = 'Maiz en Grano' WHERE feed_type = 'maiz_comprado';
UPDATE feed_inventory SET feed_type = 'Otro' WHERE feed_type = 'otro';

-- 2. Grupo estándar del Catálogo de Alimentos (9 grupos de Catalogo Alimentos.csv)
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS catalog_group varchar(80);

CREATE INDEX IF NOT EXISTS feed_inventory_catalog_group_idx
  ON feed_inventory (farm_id, catalog_group)
  WHERE catalog_group IS NOT NULL;

UPDATE feed_inventory
SET catalog_group = nutrition_profile->>'group'
WHERE catalog_group IS NULL
  AND nutrition_profile IS NOT NULL
  AND (nutrition_profile->>'group') IN (
    'Balanceados',
    'Cereales y semillas',
    'Frutas',
    'Hojas y forrajes',
    'Hortalizas y verduras',
    'Insectos y anélidos',
    'Minerales y aditivos',
    'Raíces y tubérculos',
    'Recuperados y subproductos'
  );

-- 3. Saneamiento previo y restricciones CHECK sobre dominios de Alimentos y Egresos
UPDATE feed_inventory
SET catalog_group = NULL
WHERE catalog_group IS NOT NULL
  AND catalog_group NOT IN (
    'Balanceados',
    'Cereales y semillas',
    'Frutas',
    'Hojas y forrajes',
    'Hortalizas y verduras',
    'Insectos y anélidos',
    'Minerales y aditivos',
    'Raíces y tubérculos',
    'Recuperados y subproductos'
  );

UPDATE feed_inventory
SET sanitary_status = NULL
WHERE sanitary_status IS NOT NULL
  AND sanitary_status NOT IN ('CONDICIONAL', 'RESTRINGIDO', 'NO USAR');

UPDATE feed_inventory
SET standard_catalog_id = NULL
WHERE standard_catalog_id IS NOT NULL
  AND standard_catalog_id !~ '^IG-[0-9]{3}$';

UPDATE transactions
SET expense_treatment = NULL
WHERE expense_treatment IS NOT NULL
  AND expense_treatment NOT IN (
    'VARIABLE',
    'FIJO',
    'EXISTENTE_V4',
    'CAPEX',
    'FINANCIERO',
    'BIOLOGICO',
    'ALIMENTO',
    'MERMA',
    'NO_COSTO'
  );

UPDATE transactions
SET expense_driver = NULL
WHERE expense_driver IS NOT NULL
  AND expense_driver NOT IN ('UNIDAD_MENSUAL', 'EVENTO', 'MES', 'HUEVO_VENDIDO');

UPDATE transactions
SET expense_catalog_id = NULL
WHERE expense_catalog_id IS NOT NULL
  AND expense_catalog_id !~ '^CST-[0-9]{3}$';

UPDATE budget_items
SET expense_catalog_id = NULL
WHERE expense_catalog_id IS NOT NULL
  AND expense_catalog_id !~ '^CST-[0-9]{3}$';

UPDATE purchase_products
SET expense_catalog_id = NULL
WHERE expense_catalog_id IS NOT NULL
  AND expense_catalog_id !~ '^CST-[0-9]{3}$';

UPDATE cost_allocations
SET expense_catalog_id = NULL
WHERE expense_catalog_id IS NOT NULL
  AND expense_catalog_id !~ '^CST-[0-9]{3}$';

ALTER TABLE feed_inventory DROP CONSTRAINT IF EXISTS feed_inventory_catalog_group_valid;
ALTER TABLE feed_inventory
  ADD CONSTRAINT feed_inventory_catalog_group_valid CHECK (
    catalog_group IS NULL OR catalog_group IN (
      'Balanceados',
      'Cereales y semillas',
      'Frutas',
      'Hojas y forrajes',
      'Hortalizas y verduras',
      'Insectos y anélidos',
      'Minerales y aditivos',
      'Raíces y tubérculos',
      'Recuperados y subproductos'
    )
  );

ALTER TABLE feed_inventory DROP CONSTRAINT IF EXISTS feed_inventory_sanitary_status_valid;
ALTER TABLE feed_inventory
  ADD CONSTRAINT feed_inventory_sanitary_status_valid CHECK (
    sanitary_status IS NULL OR sanitary_status IN ('CONDICIONAL', 'RESTRINGIDO', 'NO USAR')
  );

ALTER TABLE feed_inventory DROP CONSTRAINT IF EXISTS feed_inventory_standard_catalog_id_valid;
ALTER TABLE feed_inventory
  ADD CONSTRAINT feed_inventory_standard_catalog_id_valid CHECK (
    standard_catalog_id IS NULL OR standard_catalog_id ~ '^IG-[0-9]{3}$'
  );

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_expense_treatment_valid;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_expense_treatment_valid CHECK (
    expense_treatment IS NULL OR expense_treatment IN (
      'VARIABLE',
      'FIJO',
      'EXISTENTE_V4',
      'CAPEX',
      'FINANCIERO',
      'BIOLOGICO',
      'ALIMENTO',
      'MERMA',
      'NO_COSTO'
    )
  );

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_expense_driver_valid;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_expense_driver_valid CHECK (
    expense_driver IS NULL OR expense_driver IN ('UNIDAD_MENSUAL', 'EVENTO', 'MES', 'HUEVO_VENDIDO')
  );

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_expense_catalog_id_valid;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_expense_catalog_id_valid CHECK (
    expense_catalog_id IS NULL OR expense_catalog_id ~ '^CST-[0-9]{3}$'
  );

ALTER TABLE budget_items DROP CONSTRAINT IF EXISTS budget_items_expense_catalog_id_valid;
ALTER TABLE budget_items
  ADD CONSTRAINT budget_items_expense_catalog_id_valid CHECK (
    expense_catalog_id IS NULL OR expense_catalog_id ~ '^CST-[0-9]{3}$'
  );

ALTER TABLE purchase_products DROP CONSTRAINT IF EXISTS purchase_products_expense_catalog_id_valid;
ALTER TABLE purchase_products
  ADD CONSTRAINT purchase_products_expense_catalog_id_valid CHECK (
    expense_catalog_id IS NULL OR expense_catalog_id ~ '^CST-[0-9]{3}$'
  );

ALTER TABLE cost_allocations DROP CONSTRAINT IF EXISTS cost_allocations_expense_catalog_id_valid;
ALTER TABLE cost_allocations
  ADD CONSTRAINT cost_allocations_expense_catalog_id_valid CHECK (
    expense_catalog_id IS NULL OR expense_catalog_id ~ '^CST-[0-9]{3}$'
  );
