-- Seed complementario para features sin datos
-- Cubre: cuentas por pagar, categorías financieras, pagos, proyecciones flujo de caja

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CATEGORÍAS FINANCIERAS JERÁRQUICAS (financial_categories)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO financial_categories (name, parent_id, type, sort_order) VALUES
-- Ingresos
('Ventas', NULL, 'ingreso', 1),
('Venta de huevos', (SELECT id FROM financial_categories WHERE name = 'Ventas' AND parent_id IS NULL), 'ingreso', 1),
('Venta de aves', (SELECT id FROM financial_categories WHERE name = 'Ventas' AND parent_id IS NULL), 'ingreso', 2),
('Venta de carne', (SELECT id FROM financial_categories WHERE name = 'Ventas' AND parent_id IS NULL), 'ingreso', 3),
('Venta de gallinaza', (SELECT id FROM financial_categories WHERE name = 'Ventas' AND parent_id IS NULL), 'ingreso', 4),
('Otros ingresos', (SELECT id FROM financial_categories WHERE name = 'Ventas' AND parent_id IS NULL), 'ingreso', 5),

-- Egresos
('Operaciones', NULL, 'egreso', 2),
('Alimentación', (SELECT id FROM financial_categories WHERE name = 'Operaciones' AND parent_id IS NULL), 'egreso', 1),
('Sanidad', (SELECT id FROM financial_categories WHERE name = 'Operaciones' AND parent_id IS NULL), 'egreso', 2),
('Mantenimiento', (SELECT id FROM financial_categories WHERE name = 'Operaciones' AND parent_id IS NULL), 'egreso', 3),
('Mano de obra', (SELECT id FROM financial_categories WHERE name = 'Operaciones' AND parent_id IS NULL), 'egreso', 4),
('Servicios', (SELECT id FROM financial_categories WHERE name = 'Operaciones' AND parent_id IS NULL), 'egreso', 5),

-- Inversión
('Inversión', NULL, 'egreso', 3),
('Equipamiento', (SELECT id FROM financial_categories WHERE name = 'Inversión' AND parent_id IS NULL), 'egreso', 1),
('Infraestructura', (SELECT id FROM financial_categories WHERE name = 'Inversión' AND parent_id IS NULL), 'egreso', 2),
('Adquisición de aves', (SELECT id FROM financial_categories WHERE name = 'Inversión' AND parent_id IS NULL), 'egreso', 3);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CUENTAS POR PAGAR (accounts_payable)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO accounts_payable (transaction_id, supplier, total_amount, paid_amount, pending_amount, due_date, status) VALUES
-- Vincular a transacciones de egreso existentes
((SELECT id FROM transactions WHERE type = 'egreso' AND category = 'Compra de alimento' LIMIT 1), 'Agrosupply', 150000, 100000, 50000, CURRENT_DATE + INTERVAL '15 days', 'parcial'),
((SELECT id FROM transactions WHERE type = 'egreso' AND category = 'Control sanitario' LIMIT 1), 'Veterinaria', 95000, 0, 95000, CURRENT_DATE + INTERVAL '7 days', 'pendiente'),
((SELECT id FROM transactions WHERE type = 'egreso' AND category = 'Mantenimiento' LIMIT 1), 'Taller local', 35000, 35000, 0, CURRENT_DATE - INTERVAL '5 days', 'pagado'),
((SELECT id FROM transactions WHERE type = 'egreso' AND category = 'Equipamiento' LIMIT 1), 'Agrocentro El Campo', 95000, 50000, 45000, CURRENT_DATE + INTERVAL '30 days', 'parcial');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PAGOS (payments) - Vinculados a cuentas por cobrar y pagar
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO payments (date, type, receivable_id, payable_id, amount, method, reference, notes) VALUES
-- Pagos a cuentas por pagar
(CURRENT_DATE - INTERVAL '10 days', 'pago', NULL, (SELECT id FROM accounts_payable WHERE supplier = 'Taller local'), 35000, 'transferencia', 'PAY-001', 'Pago completo mantenimiento'),
(CURRENT_DATE - INTERVAL '5 days', 'pago', NULL, (SELECT id FROM accounts_payable WHERE supplier = 'Agrosupply'), 100000, 'efectivo', 'PAY-002', 'Pago parcial alimento'),
(CURRENT_DATE - INTERVAL '2 days', 'pago', NULL, (SELECT id FROM accounts_payable WHERE supplier = 'Agrocentro El Campo'), 50000, 'transferencia', 'PAY-003', 'Abono equipamiento'),

-- Cobros de cuentas por cobrar
(CURRENT_DATE - INTERVAL '3 days', 'cobro', (SELECT id FROM accounts_receivable LIMIT 1), NULL, 25000, 'efectivo', 'REC-001', 'Abono Tienda La Esquina');

-- Actualizar montos pagados en cuentas
UPDATE accounts_payable 
SET paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'pago' AND payable_id = accounts_payable.id),
    pending_amount = total_amount - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'pago' AND payable_id = accounts_payable.id),
    status = CASE 
      WHEN total_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'pago' AND payable_id = accounts_payable.id) THEN 'pagado'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'pago' AND payable_id = accounts_payable.id) > 0 THEN 'parcial'
      ELSE 'pendiente'
    END,
    updated_at = CURRENT_TIMESTAMP;

UPDATE accounts_receivable 
SET paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'cobro' AND receivable_id = accounts_receivable.id),
    pending_amount = total_amount - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'cobro' AND receivable_id = accounts_receivable.id),
    status = CASE 
      WHEN total_amount = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'cobro' AND receivable_id = accounts_receivable.id) THEN 'pagado'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE type = 'cobro' AND receivable_id = accounts_receivable.id) > 0 THEN 'parcial'
      ELSE 'pendiente'
    END,
    updated_at = CURRENT_TIMESTAMP;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. PROYECCIONES DE FLUJO DE CAJA (cashflow_projections)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO cashflow_projections (month, projected_income, projected_expense, actual_income, actual_expense, notes) VALUES
-- Meses pasados (con datos reales)
('2026-05-01', 450000, 320000, 425000, 315000, 'Mayo - producción estable'),
('2026-06-01', 480000, 340000, 465000, 338000, 'Junio - pico de producción'),
('2026-07-01', 460000, 330000, 445000, 328000, 'Julio - declive normal'),

-- Mes actual (parcial)
('2026-08-01', 500000, 350000, 285000, 220000, 'Agosto - en curso'),

-- Próximos meses (solo proyección)
('2026-09-01', 470000, 340000, NULL, NULL, 'Septiembre - estabilización esperada'),
('2026-10-01', 440000, 320000, NULL, NULL, 'Octubre - otoño, menor producción'),
('2026-11-01', 420000, 310000, NULL, NULL, 'Noviembre - mantenimiento preventivo'),
('2026-12-01', 450000, 330000, NULL, NULL, 'Diciembre - demanda navideña');

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. DATOS ADICIONALES PARA MEJORAR COBERTURA
-- ═══════════════════════════════════════════════════════════════════════════

-- Más gallinas en diferentes estados para probar transiciones
INSERT INTO hens (code, breed, birth_date, status, weight, is_broody, notes) VALUES
('G-033', 'ISA Brown', CURRENT_DATE - INTERVAL '180 days', 'empollando', '2.3', true, 'Empollando desde hace 5 días'),
('G-034', 'Rhode Island Red', CURRENT_DATE - INTERVAL '400 days', 'descarte', '2.1', false, 'Baja producción, candidata a sacrificio'),
('G-035', 'Leghorn', CURRENT_DATE - INTERVAL '150 days', 'enferma', '1.8', false, 'Síntomas respiratorios, en tratamiento');

-- Más registros de incubación
INSERT INTO incubation (hen_id, start_date, expected_hatch_date, eggs_set, eggs_hatched, males_hatched, females_hatched, is_complete, notes) VALUES
((SELECT id FROM hens WHERE code = 'G-028'), CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '6 days', 12, 9, 4, 5, true, 'Eclosión exitosa'),
((SELECT id FROM hens WHERE code = 'G-033'), CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '16 days', 10, 0, NULL, NULL, false, 'En proceso');

-- Más mantenimiento completado
INSERT INTO maintenance (title, description, scheduled_date, completed_date, status, cost) VALUES
('Fumigación preventiva', 'Aplicación de insecticida en gallinero', CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '14 days', 'completado', 45000),
('Poda de vegetación', 'Poda de árboles alrededor del gallinero', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE - INTERVAL '23 days', 'completado', 0),
('Revisión de techos', 'Inspección de goteras antes de lluvias', CURRENT_DATE + INTERVAL '5 days', NULL, 'pendiente', 0);

-- Más control sanitario
INSERT INTO health_control (date, type, description, affected_hens, product, cost, next_scheduled, notes) VALUES
(CURRENT_DATE - INTERVAL '12 days', 'vitaminas', 'Suplemento vitamínico en agua', 'todas', 'Vitaves', 25000, CURRENT_DATE + INTERVAL '18 days', 'Estrés por calor'),
(CURRENT_DATE - INTERVAL '1 day', 'inspeccion', 'Revisión general de gallinas', 'todas', NULL, 0, CURRENT_DATE + INTERVAL '29 days', 'Todo normal');

-- Más mortalidad
INSERT INTO mortality_records (date, bird_type, quantity, cause, description) VALUES
(CURRENT_DATE - INTERVAL '20 days', 'gallina', 1, 'enfermedad', 'Gallina G-018 con síntomas respiratorios'),
(CURRENT_DATE - INTERVAL '12 days', 'pollo_lote', 1, 'accidente', 'Pollo del lote L-001 atrapado en comedero');

-- Más ventas de huevos
INSERT INTO egg_sales (date, quantity, price_per_unit, total_amount, size, presentation, buyer, notes) VALUES
(CURRENT_DATE - INTERVAL '1 day', 18, 7500, 135000, 'Grande', 'Bandeja/Cubeta', 'Restaurante La Granja', 'Venta semanal'),
(CURRENT_DATE - INTERVAL '3 days', 6, 6500, 39000, 'Mediano', 'Media docena', 'Tienda Doña Rosa', NULL);

-- Transacciones para las nuevas ventas
INSERT INTO transactions (date, type, category, description, counterparty, amount, quantity, unit_price, unit, source_type, source_id) VALUES
(CURRENT_DATE - INTERVAL '1 day', 'ingreso', 'Venta de huevos', 'Venta de 18 huevos Grandes', 'Restaurante La Granja', 135000, 18, 7500, 'unidades', 'venta', (SELECT id FROM egg_sales WHERE date = CURRENT_DATE - INTERVAL '1 day')),
(CURRENT_DATE - INTERVAL '3 days', 'ingreso', 'Venta de huevos', 'Venta de 6 huevos Medianos', 'Tienda Doña Rosa', 39000, 6, 6500, 'unidades', 'venta', (SELECT id FROM egg_sales WHERE date = CURRENT_DATE - INTERVAL '3 days'));

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'RESUMEN FINAL' as seccion, '' as detalle
UNION ALL SELECT '---', '---'
UNION ALL SELECT 'financial_categories', count(*) || ' categorías' FROM financial_categories
UNION ALL SELECT 'accounts_payable', count(*) || ' cuentas' FROM accounts_payable
UNION ALL SELECT 'payments', count(*) || ' pagos' FROM payments
UNION ALL SELECT 'cashflow_projections', count(*) || ' meses' FROM cashflow_projections
UNION ALL SELECT 'hens (total)', count(*) || ' gallinas' FROM hens
UNION ALL SELECT 'incubation', count(*) || ' registros' FROM incubation
UNION ALL SELECT 'egg_sales', count(*) || ' ventas' FROM egg_sales
UNION ALL SELECT 'transactions', count(*) || ' transacciones' FROM transactions
ORDER BY seccion;
