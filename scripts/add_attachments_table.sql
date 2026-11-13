-- Fase 1 + 2: Tabla polimórfica de adjuntos y soportes documentales / fotográficos (Offline-First + OCR)
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(50) NOT NULL,
  entity_id varchar(120) NOT NULL,
  category varchar(60) NOT NULL DEFAULT 'general',
  file_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  data_url text NOT NULL,
  extracted_text text,
  extracted_data jsonb,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_entity_lookup_idx ON attachments (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS attachments_category_idx ON attachments (category);

