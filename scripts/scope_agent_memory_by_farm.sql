-- Scope persistent agent memory uniqueness to the active farm.
-- This lets the same platform user keep separate memories per tenant when
-- switching support context, without cross-farm collisions or overwrites.
BEGIN;

DROP INDEX IF EXISTS agent_memories_user_subject_idx;

CREATE UNIQUE INDEX IF NOT EXISTS agent_memories_farm_user_subject_idx
  ON agent_memories (farm_id, user_id, category, subject_key);

COMMIT;
