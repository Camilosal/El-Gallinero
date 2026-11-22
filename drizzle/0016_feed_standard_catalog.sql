-- Vinculación opcional de alimentos del inventario con el Catálogo Base Estandarizado (IG-001..IG-119)
-- y perfil nutricional en base seca (MS) para validación de dietas por especie y etapa.
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS standard_catalog_id varchar(20);
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS sanitary_status varchar(24);
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS energy_kcal_kg_dm numeric(7, 2);
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS calcium_dm_pct numeric(5, 2);
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS available_phosphorus_dm_pct numeric(5, 2);
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS lysine_dig_dm_pct numeric(5, 2);
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS met_cys_dig_dm_pct numeric(5, 2);
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS crude_fiber_dm_pct numeric(5, 2);
ALTER TABLE feed_inventory ADD COLUMN IF NOT EXISTS nutrition_profile jsonb;

CREATE INDEX IF NOT EXISTS feed_inventory_standard_catalog_idx
  ON feed_inventory (farm_id, standard_catalog_id)
  WHERE standard_catalog_id IS NOT NULL;
