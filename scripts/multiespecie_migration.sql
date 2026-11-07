-- Migración Multiespecie y Modelo Dual (Autoconsumo + Excedentes)
-- Base de datos: el_gallinero

-- 1. Crear ENUMs de especies y propósitos de lote
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'animal_species') THEN
        CREATE TYPE animal_species AS ENUM ('gallina', 'pollo', 'codorniz', 'pato', 'conejo');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'batch_purpose') THEN
        CREATE TYPE batch_purpose AS ENUM ('engorde_carne', 'postura_huevo', 'pie_cria', 'mixto');
    END IF;
END $$;

-- 2. Lotes de producción multi-especie (broiler_batches)
ALTER TABLE broiler_batches 
  ADD COLUMN IF NOT EXISTS species animal_species NOT NULL DEFAULT 'pollo',
  ADD COLUMN IF NOT EXISTS purpose batch_purpose NOT NULL DEFAULT 'engorde_carne',
  ADD COLUMN IF NOT EXISTS system_type VARCHAR(50) DEFAULT 'piso',
  ADD COLUMN IF NOT EXISTS target_days INTEGER,
  ADD COLUMN IF NOT EXISTS feed_conversion_target DECIMAL(4, 2);

-- 3. Producción de huevos con tracking de especie y destino
ALTER TABLE egg_production
  ADD COLUMN IF NOT EXISTS species animal_species NOT NULL DEFAULT 'gallina',
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES broiler_batches(id),
  ADD COLUMN IF NOT EXISTS quantity_autoconsumo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_excedente INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference_unit_price DECIMAL(10, 2);

-- 4. Ventas de huevos
ALTER TABLE egg_sales
  ADD COLUMN IF NOT EXISTS species animal_species NOT NULL DEFAULT 'gallina';

-- 5. Sacrificio y faena con desglose dual (Hogar vs Venta)
ALTER TABLE slaughter
  ADD COLUMN IF NOT EXISTS species animal_species NOT NULL DEFAULT 'pollo',
  ADD COLUMN IF NOT EXISTS live_weight_kg DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS carcass_yield_percent DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS heads_autoconsumo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight_kg_autoconsumo DECIMAL(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heads_excedente INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight_kg_excedente DECIMAL(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS market_reference_price_per_kg DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS estimated_savings_amount DECIMAL(12, 2);

-- 6. Adquisición de animales menores
ALTER TABLE bird_acquisitions
  ADD COLUMN IF NOT EXISTS species animal_species DEFAULT 'pollo';

-- 7. Mortalidad por especie
ALTER TABLE mortality_records
  ADD COLUMN IF NOT EXISTS species animal_species DEFAULT 'pollo';

-- 8. Ventas de carne
ALTER TABLE meat_sales
  ADD COLUMN IF NOT EXISTS species animal_species NOT NULL DEFAULT 'pollo';

-- 9. Tabla de registro de autoconsumo y soberanía alimentaria familiar
CREATE TABLE IF NOT EXISTS autoconsumo_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  species animal_species NOT NULL,
  product_type VARCHAR(50) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  market_reference_price DECIMAL(10, 2) NOT NULL,
  savings_amount DECIMAL(12, 2) NOT NULL,
  destination_household VARCHAR(100) DEFAULT 'Familia Granja',
  batch_id UUID REFERENCES broiler_batches(id),
  slaughter_id UUID REFERENCES slaughter(id),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. Catálogos maestros zootécnicos y comerciales
INSERT INTO catalogos (category, value, price, units, tipo, sort_order, is_active, created_at)
VALUES
  -- Razas de Codornices, Patos y Conejos
  ('raza', 'Codorniz Japónica (Coturnix)', NULL, NULL, 'codorniz', 10, true, NOW()),
  ('raza', 'Codorniz Bobwhite', NULL, NULL, 'codorniz', 11, true, NOW()),
  ('raza', 'Codorniz Texas White', NULL, NULL, 'codorniz', 12, true, NOW()),
  ('raza', 'Pato Pekín Americano', NULL, NULL, 'pato', 20, true, NOW()),
  ('raza', 'Pato Criollo (Muscovy)', NULL, NULL, 'pato', 21, true, NOW()),
  ('raza', 'Pato Khaki Campbell', NULL, NULL, 'pato', 22, true, NOW()),
  ('raza', 'Conejo Nueva Zelanda Blanco', NULL, NULL, 'conejo', 30, true, NOW()),
  ('raza', 'Conejo California', NULL, NULL, 'conejo', 31, true, NOW()),
  ('raza', 'Conejo Chinchilla', NULL, NULL, 'conejo', 32, true, NOW()),
  ('raza', 'Conejo Mariposa', NULL, NULL, 'conejo', 33, true, NOW()),

  -- Tipos de Animal
  ('tipo_ave', 'codorniz', NULL, NULL, 'ave', 4, true, NOW()),
  ('tipo_ave', 'pato', NULL, NULL, 'ave', 5, true, NOW()),
  ('tipo_ave', 'conejo', NULL, NULL, 'mamifero', 6, true, NOW()),

  -- Presentaciones de venta
  ('presentacion_venta', 'Bandeja x24 Huevos Codorniz', 6500, 24, 'huevos_codorniz', 10, true, NOW()),
  ('presentacion_venta', 'Caja x30 Huevos Codorniz', 8000, 30, 'huevos_codorniz', 11, true, NOW()),
  ('presentacion_venta', 'Bolsa x50 Huevos Codorniz', 12000, 50, 'huevos_codorniz', 12, true, NOW()),
  ('presentacion_venta', 'Canal Conejo Entero (kg)', 28000, 1, 'carne_conejo', 20, true, NOW()),
  ('presentacion_venta', 'Canal Pato Entero (kg)', 24000, 1, 'carne_pato', 21, true, NOW()),
  ('presentacion_venta', 'Bulto Conejaza 25kg', 15000, 25, 'abono', 30, true, NOW()),
  ('presentacion_venta', 'Bulto Codornaza 25kg', 18000, 25, 'abono', 31, true, NOW()),

  -- Categorías de Ingreso por Excedentes
  ('categoria_ingreso', 'Venta de carne de conejo', NULL, NULL, 'carne', 10, true, NOW()),
  ('categoria_ingreso', 'Venta de carne de pato', NULL, NULL, 'carne', 11, true, NOW()),
  ('categoria_ingreso', 'Venta de huevos de codorniz', NULL, NULL, 'huevos', 12, true, NOW()),
  ('categoria_ingreso', 'Venta de abono conejaza/codornaza', NULL, NULL, 'abono', 13, true, NOW()),

  -- Alimentos y Forrajes
  ('tipo_alimento', 'concentrado_conejos', NULL, NULL, 'cunicultura', 10, true, NOW()),
  ('tipo_alimento', 'concentrado_codorniz', NULL, NULL, 'coturnicultura', 11, true, NOW()),
  ('tipo_alimento', 'forraje_ramio_morera', NULL, NULL, 'forraje_fresco', 12, true, NOW())
ON CONFLICT (category, value) DO NOTHING;

