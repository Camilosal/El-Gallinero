-- Extend the feed enums to accept the active values configured in catalogos.
-- Keep the legacy labels because existing feed_inventory rows still use them.
ALTER TYPE feed_category ADD VALUE IF NOT EXISTS 'Concentrado';
ALTER TYPE feed_category ADD VALUE IF NOT EXISTS 'En Fresco';
ALTER TYPE feed_category ADD VALUE IF NOT EXISTS 'Preparados';

ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Bore o Raices';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Concentrado Aves';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Concentrado Codorniz';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Concentrado Conejos';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Forraje Verde';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Maiz en Grano';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Maíz Germinado';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Mosca Soldado';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Otro';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Pastos y gramíneas';
ALTER TYPE feed_type ADD VALUE IF NOT EXISTS 'Purinas';
