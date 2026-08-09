-- Seed mejorado para todas las funcionalidades premium
-- Ejecutar después del seed principal

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. REGISTROS DE PESO (weight_logs) - Para curvas de peso
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO weight_logs (date, batch_id, hen_group, breed, week_number, avg_weight_kg, sample_size, notes)
VALUES
-- Registros para lote de engorde Cobb 500 (semanas 1-5)
(CURRENT_DATE - INTERVAL '35 days', (SELECT id FROM broiler_batches WHERE code = 'L-001'), 'Lote L-001', 'Cobb 500', 1, '0.12', 10, 'Pesaje semanal'),
(CURRENT_DATE - INTERVAL '28 days', (SELECT id FROM broiler_batches WHERE code = 'L-001'), 'Lote L-001', 'Cobb 500', 2, '0.26', 10, 'Pesaje semanal'),
(CURRENT_DATE - INTERVAL '21 days', (SELECT id FROM broiler_batches WHERE code = 'L-001'), 'Lote L-001', 'Cobb 500', 3, '0.47', 10, 'Pesaje semanal'),
(CURRENT_DATE - INTERVAL '14 days', (SELECT id FROM broiler_batches WHERE code = 'L-001'), 'Lote L-001', 'Cobb 500', 4, '0.75', 10, 'Pesaje semanal'),
(CURRENT_DATE - INTERVAL '7 days', (SELECT id FROM broiler_batches WHERE code = 'L-001'), 'Lote L-001', 'Cobb 500', 5, '1.10', 10, 'Pesaje semanal'),

-- Registros para gallinas ISA Brown (postura, semanas 20-30)
(CURRENT_DATE - INTERVAL '60 days', NULL, 'Gallinas postura', 'ISA Brown', 20, '1.57', 5, 'Muestra de 5 gallinas'),
(CURRENT_DATE - INTERVAL '53 days', NULL, 'Gallinas postura', 'ISA Brown', 22, '1.70', 5, 'Muestra de 5 gallinas'),
(CURRENT_DATE - INTERVAL '46 days', NULL, 'Gallinas postura', 'ISA Brown', 24, '1.80', 5, 'Muestra de 5 gallinas'),
(CURRENT_DATE - INTERVAL '39 days', NULL, 'Gallinas postura', 'ISA Brown', 26, '1.87', 5, 'Muestra de 5 gallinas'),
(CURRENT_DATE - INTERVAL '32 days', NULL, 'Gallinas postura', 'ISA Brown', 28, '1.92', 5, 'Muestra de 5 gallinas'),
(CURRENT_DATE - INTERVAL '25 days', NULL, 'Gallinas postura', 'ISA Brown', 30, '1.96', 5, 'Muestra de 5 gallinas'),

-- Registros para gallinas Hy-Line W-36 (juveniles, semanas 12-18)
(CURRENT_DATE - INTERVAL '50 days', NULL, 'Juveniles Hy-Line', 'Hy-Line W-36', 12, '0.68', 4, 'Pesaje juveniles'),
(CURRENT_DATE - INTERVAL '43 days', NULL, 'Juveniles Hy-Line', 'Hy-Line W-36', 14, '0.83', 4, 'Pesaje juveniles'),
(CURRENT_DATE - INTERVAL '36 days', NULL, 'Juveniles Hy-Line', 'Hy-Line W-36', 16, '0.97', 4, 'Pesaje juveniles'),
(CURRENT_DATE - INTERVAL '29 days', NULL, 'Juveniles Hy-Line', 'Hy-Line W-36', 18, '1.12', 4, 'Pesaje juveniles');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ESTANDARES DE PESO POR RAZA (breed_weight_standards)
-- ═══════════════════════════════════════════════════════════════════════════
-- ISA Brown hembra (0-80 semanas)
INSERT INTO breed_weight_standards (breed, gender, week_number, target_weight_g, min_weight_g, max_weight_g) VALUES
('ISA Brown', 'hembra', 0, 40, 36, 44),
('ISA Brown', 'hembra', 1, 60, 54, 66),
('ISA Brown', 'hembra', 2, 90, 81, 99),
('ISA Brown', 'hembra', 3, 130, 117, 143),
('ISA Brown', 'hembra', 4, 180, 162, 198),
('ISA Brown', 'hembra', 5, 240, 216, 264),
('ISA Brown', 'hembra', 6, 310, 279, 341),
('ISA Brown', 'hembra', 7, 390, 351, 429),
('ISA Brown', 'hembra', 8, 470, 423, 517),
('ISA Brown', 'hembra', 9, 550, 495, 605),
('ISA Brown', 'hembra', 10, 640, 576, 704),
('ISA Brown', 'hembra', 11, 730, 657, 803),
('ISA Brown', 'hembra', 12, 820, 738, 902),
('ISA Brown', 'hembra', 13, 910, 819, 1001),
('ISA Brown', 'hembra', 14, 1000, 900, 1100),
('ISA Brown', 'hembra', 15, 1090, 981, 1199),
('ISA Brown', 'hembra', 16, 1180, 1062, 1298),
('ISA Brown', 'hembra', 17, 1270, 1143, 1397),
('ISA Brown', 'hembra', 18, 1370, 1233, 1507),
('ISA Brown', 'hembra', 19, 1470, 1323, 1617),
('ISA Brown', 'hembra', 20, 1570, 1413, 1727),
('ISA Brown', 'hembra', 22, 1700, 1530, 1870),
('ISA Brown', 'hembra', 24, 1800, 1620, 1980),
('ISA Brown', 'hembra', 28, 1900, 1710, 2090),
('ISA Brown', 'hembra', 32, 1950, 1755, 2145),
('ISA Brown', 'hembra', 36, 2000, 1800, 2200),
('ISA Brown', 'hembra', 40, 2050, 1845, 2255),
('ISA Brown', 'hembra', 50, 2100, 1890, 2310),
('ISA Brown', 'hembra', 60, 2150, 1935, 2365),
('ISA Brown', 'hembra', 72, 2200, 1980, 2420),
('ISA Brown', 'hembra', 80, 2200, 1980, 2420)
ON CONFLICT DO NOTHING;

-- Hy-Line W-36 hembra (0-80 semanas)
INSERT INTO breed_weight_standards (breed, gender, week_number, target_weight_g, min_weight_g, max_weight_g) VALUES
('Hy-Line W-36', 'hembra', 0, 38, 34, 42),
('Hy-Line W-36', 'hembra', 2, 80, 72, 88),
('Hy-Line W-36', 'hembra', 4, 155, 140, 170),
('Hy-Line W-36', 'hembra', 6, 260, 234, 286),
('Hy-Line W-36', 'hembra', 8, 390, 351, 429),
('Hy-Line W-36', 'hembra', 10, 530, 477, 583),
('Hy-Line W-36', 'hembra', 12, 680, 612, 748),
('Hy-Line W-36', 'hembra', 14, 830, 747, 913),
('Hy-Line W-36', 'hembra', 16, 970, 873, 1067),
('Hy-Line W-36', 'hembra', 18, 1120, 1008, 1232),
('Hy-Line W-36', 'hembra', 20, 1260, 1134, 1386),
('Hy-Line W-36', 'hembra', 24, 1450, 1305, 1595),
('Hy-Line W-36', 'hembra', 30, 1550, 1395, 1705),
('Hy-Line W-36', 'hembra', 40, 1650, 1485, 1815),
('Hy-Line W-36', 'hembra', 52, 1700, 1530, 1870),
('Hy-Line W-36', 'hembra', 64, 1750, 1575, 1925),
('Hy-Line W-36', 'hembra', 80, 1800, 1620, 1980)
ON CONFLICT DO NOTHING;

-- Cobb 500 macho (0-8 semanas)
INSERT INTO breed_weight_standards (breed, gender, week_number, target_weight_g, min_weight_g, max_weight_g) VALUES
('Cobb 500', 'macho', 0, 42, 38, 46),
('Cobb 500', 'macho', 1, 120, 108, 132),
('Cobb 500', 'macho', 2, 260, 234, 286),
('Cobb 500', 'macho', 3, 470, 423, 517),
('Cobb 500', 'macho', 4, 750, 675, 825),
('Cobb 500', 'macho', 5, 1100, 990, 1210),
('Cobb 500', 'macho', 6, 1500, 1350, 1650),
('Cobb 500', 'macho', 7, 1950, 1755, 2145),
('Cobb 500', 'macho', 8, 2400, 2160, 2640)
ON CONFLICT DO NOTHING;

-- Cobb 500 hembra (0-8 semanas)
INSERT INTO breed_weight_standards (breed, gender, week_number, target_weight_g, min_weight_g, max_weight_g) VALUES
('Cobb 500', 'hembra', 0, 40, 36, 44),
('Cobb 500', 'hembra', 1, 105, 95, 116),
('Cobb 500', 'hembra', 2, 220, 198, 242),
('Cobb 500', 'hembra', 3, 390, 351, 429),
('Cobb 500', 'hembra', 4, 610, 549, 671),
('Cobb 500', 'hembra', 5, 880, 792, 968),
('Cobb 500', 'hembra', 6, 1180, 1062, 1298),
('Cobb 500', 'hembra', 7, 1500, 1350, 1650),
('Cobb 500', 'hembra', 8, 1820, 1638, 2002)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CALENDARIO SANITARIO ADICIONAL (para alertas de vacunación vencida)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO sanitary_calendar (type, name, description, target_birds, frequency_days, next_due_date, withdrawal_days, is_active) VALUES
('vacunacion', 'Newcastle refuerzo', 'Refuerzo de vacuna Newcastle cada 8-10 semanas', 'todas', 63, CURRENT_DATE - INTERVAL '5 days', 7, true),
('vacunacion', 'Bronquitis infecciosa', 'Vacuna contra bronquitis infecciosa', 'todas', 90, CURRENT_DATE - INTERVAL '15 days', 7, true),
('desparasitacion', 'Desparasitación externa', 'Tratamiento contra ácaros y piojos', 'todas', 60, CURRENT_DATE - INTERVAL '8 days', 3, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. PRODUCCIÓN DE HUEVOS ADICIONAL (para detectar picos de producción)
-- ═══════════════════════════════════════════════════════════════════════════
-- Agregar datos de los últimos 90 días para análisis de pico de producción
INSERT INTO egg_production (date, total_collected, broken, for_incubation, notes)
SELECT
  (CURRENT_DATE - (i || ' days')::interval)::date as date,
  -- Simular producción con pico alrededor del día 30-40
  CASE
    WHEN i BETWEEN 30 AND 40 THEN 18 + floor(random() * 4)  -- Pico: 18-22 huevos
    WHEN i BETWEEN 20 AND 50 THEN 15 + floor(random() * 3)  -- Alta producción
    WHEN i < 10 THEN 10 + floor(random() * 3)               -- Baja reciente
    ELSE 13 + floor(random() * 3)                           -- Normal
  END as total_collected,
  floor(random() * 2) as broken,
  floor(random() * 2) as for_incubation,
  'Producción automática seed' as notes
FROM generate_series(1, 90) as i
WHERE NOT EXISTS (
  SELECT 1 FROM egg_production ep
  WHERE ep.date = (CURRENT_DATE - (i || ' days')::interval)::date
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. TRANSACCIONES ADICIONALES (para métricas de costo)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO transactions (date, type, category, description, counterparty, amount, quantity, unit_price, unit) VALUES
-- Egresos de los últimos 90 días para análisis de costos
(CURRENT_DATE - INTERVAL '85 days', 'egreso', 'alimentacion', 'Compra de alimento concentrado', 'Agrosupply', 150000, 50, 3000, 'kg'),
(CURRENT_DATE - INTERVAL '70 days', 'egreso', 'alimentacion', 'Compra de maíz', 'Mercado local', 80000, 40, 2000, 'kg'),
(CURRENT_DATE - INTERVAL '55 days', 'egreso', 'sanidad', 'Vacunas y medicamentos', 'Veterinaria', 95000, NULL, NULL, NULL),
(CURRENT_DATE - INTERVAL '40 days', 'egreso', 'alimentacion', 'Suplemento vitamínico', 'Agrosupply', 45000, 10, 4500, 'kg'),
(CURRENT_DATE - INTERVAL '25 days', 'egreso', 'mantenimiento', 'Reparación bebederos', 'Taller local', 35000, NULL, NULL, NULL),
(CURRENT_DATE - INTERVAL '10 days', 'egreso', 'alimentacion', 'Concentrado comercial', 'Agrosupply', 180000, 60, 3000, 'kg'),

-- Ingresos adicionales
(CURRENT_DATE - INTERVAL '80 days', 'ingreso', 'venta_huevos', 'Venta de huevos', 'Tienda Doña Rosa', 85000, 12, 7083, 'docena'),
(CURRENT_DATE - INTERVAL '60 days', 'ingreso', 'venta_huevos', 'Venta de huevos', 'Restaurante La Granja', 120000, 30, 4000, 'unidad'),
(CURRENT_DATE - INTERVAL '45 days', 'ingreso', 'venta_aves', 'Venta de gallinas', 'Mercado Don Juan', 95000, 3, 31667, 'ave'),
(CURRENT_DATE - INTERVAL '30 days', 'ingreso', 'venta_huevos', 'Venta de huevos', 'Venta callejera', 65000, 10, 6500, 'unidad');

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ADQUISICIONES ADICIONALES (para costo por ave)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO bird_acquisitions (date, acquisition_type, bird_type, quantity, unit_cost, total_cost, supplier, breed, birth_date, notes) VALUES
(CURRENT_DATE - INTERVAL '75 days', 'compra', 'gallina', 8, 28000, 224000, 'Granja La Esperanza', 'ISA Brown', CURRENT_DATE - INTERVAL '105 days', 'Compra de gallinas jóvenes ISA Brown'),
(CURRENT_DATE - INTERVAL '50 days', 'compra', 'gallo', 2, 35000, 70000, 'Criadero El Valle', 'Rhode Island Red', CURRENT_DATE - INTERVAL '80 days', 'Gallos reproductores'),
(CURRENT_DATE - INTERVAL '20 days', 'donacion', 'gallina', 3, 0, 0, 'Don José', 'Criolla', CURRENT_DATE - INTERVAL '150 days', 'Donación de gallinas criollas')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'weight_logs' as tabla, count(*) as registros FROM weight_logs
UNION ALL SELECT 'breed_weight_standards', count(*) FROM breed_weight_standards
UNION ALL SELECT 'egg_production (total)', count(*) FROM egg_production
UNION ALL SELECT 'transactions (total)', count(*) FROM transactions
UNION ALL SELECT 'sanitary_calendar (vencidas)', count(*) FROM sanitary_calendar WHERE next_due_date < CURRENT_DATE
ORDER BY tabla;
