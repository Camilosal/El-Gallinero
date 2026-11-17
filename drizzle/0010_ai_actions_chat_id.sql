-- C3: auditoría de acciones originadas en Telegram (origin ya existe desde 0007).
ALTER TABLE ai_actions ADD COLUMN IF NOT EXISTS chat_id bigint;

CREATE INDEX IF NOT EXISTS ai_actions_farm_origin_idx
  ON ai_actions (farm_id, origin);