CREATE TABLE IF NOT EXISTS offline_mutation_receipts (
  mutation_id varchar(100) PRIMARY KEY,
  method varchar(10) NOT NULL,
  path varchar(255) NOT NULL,
  status_code integer NOT NULL,
  response_body jsonb,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS offline_mutation_receipts_created_at_idx
  ON offline_mutation_receipts (created_at);
