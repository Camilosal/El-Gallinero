ALTER TABLE users
  ADD COLUMN IF NOT EXISTS recovery_code_hash varchar(64),
  ADD COLUMN IF NOT EXISTS recovery_code_issued_at timestamp;
