-- C3: chats de Telegram vinculados a usuarios de la granja (canal bidireccional del agente).
CREATE TABLE IF NOT EXISTS telegram_chats (
  farm_id uuid NOT NULL DEFAULT COALESCE(
    NULLIF(current_setting('app.current_farm_id', true), '')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  chat_id bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(20) DEFAULT 'activo' NOT NULL,
  linked_at timestamp DEFAULT now() NOT NULL,
  last_seen_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT telegram_chats_status_check CHECK (status IN ('activo', 'revocado')),
  CONSTRAINT telegram_chats_chat_id_unique UNIQUE (chat_id)
);

CREATE INDEX IF NOT EXISTS telegram_chats_farm_status_idx
  ON telegram_chats (farm_id, status);

ALTER TABLE telegram_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_chats FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON telegram_chats;
CREATE POLICY tenant_isolation_policy ON telegram_chats
  USING (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid))
  WITH CHECK (farm_id = COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid));

GRANT ALL PRIVILEGES ON TABLE telegram_chats TO gallinero_tenant_role;