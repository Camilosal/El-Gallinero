-- D1: auditoría del token de integración que originó acciones del agente vía API v1 / MCP.
ALTER TABLE ai_actions ADD COLUMN IF NOT EXISTS token_id uuid;
CREATE INDEX IF NOT EXISTS ai_actions_token_idx ON ai_actions (token_id);