-- Scopes, perfil de conector ERP y expiración opcional para tokens externos de exportación/integración.

ALTER TABLE export_tokens
  ADD COLUMN IF NOT EXISTS scopes jsonb NOT NULL DEFAULT '["read:finance","read:inventory","read:contacts","read:production"]'::jsonb,
  ADD COLUMN IF NOT EXISTS profile varchar(30) NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS expires_at timestamp;
