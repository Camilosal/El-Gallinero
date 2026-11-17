-- B3: origen auditable de cada acción del agente (assistant | delegated_auto | telegram | external_agent | human_confirmed)
ALTER TABLE ai_actions ADD COLUMN IF NOT EXISTS origin varchar(30) DEFAULT 'assistant' NOT NULL;

CREATE INDEX IF NOT EXISTS ai_actions_farm_origin_created_idx
  ON ai_actions (farm_id, origin, created_at DESC);