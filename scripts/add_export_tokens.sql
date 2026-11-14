-- Tokens de solo lectura para exportación CSV/XLSX desde dashboards externos.
-- Esta tabla NO usa RLS a propósito: el token debe resolverse antes de conocer
-- la granja (farm_id) y solo otorga lectura de los datasets de exportación.
CREATE TABLE IF NOT EXISTS export_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL DEFAULT 'Dashboard externo',
  token_hash varchar(64) NOT NULL UNIQUE,
  token_prefix varchar(24) NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  last_used_at timestamp,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_tokens_farm_idx ON export_tokens (farm_id);
CREATE INDEX IF NOT EXISTS export_tokens_active_idx ON export_tokens (farm_id) WHERE revoked_at IS NULL;

-- El rol usado cuando RLS está activo también debe poder validar tokens.
GRANT USAGE ON SCHEMA public TO gallinero_tenant_role;
GRANT ALL PRIVILEGES ON TABLE export_tokens TO gallinero_tenant_role;
