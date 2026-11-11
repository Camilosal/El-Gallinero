-- Add origin and genetic lineage details to animal intake records.
-- Safe to run more than once; existing acquisition and incubation history stays intact.

ALTER TABLE bird_acquisitions
  ADD COLUMN IF NOT EXISTS genetic_line VARCHAR(150),
  ADD COLUMN IF NOT EXISTS generation VARCHAR(50),
  ADD COLUMN IF NOT EXISTS origin_farm VARCHAR(200),
  ADD COLUMN IF NOT EXISTS origin_location VARCHAR(200),
  ADD COLUMN IF NOT EXISTS source_batch_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mother_hen_id UUID,
  ADD COLUMN IF NOT EXISTS father_rooster_id UUID,
  ADD COLUMN IF NOT EXISTS mother_identifier VARCHAR(100),
  ADD COLUMN IF NOT EXISTS father_identifier VARCHAR(100),
  ADD COLUMN IF NOT EXISTS genetic_evidence_reference TEXT,
  ADD COLUMN IF NOT EXISTS health_evidence_reference TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bird_acquisitions_mother_hen_id_hens_id_fk'
  ) THEN
    ALTER TABLE bird_acquisitions
      ADD CONSTRAINT bird_acquisitions_mother_hen_id_hens_id_fk
      FOREIGN KEY (mother_hen_id) REFERENCES hens(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bird_acquisitions_father_rooster_id_roosters_id_fk'
  ) THEN
    ALTER TABLE bird_acquisitions
      ADD CONSTRAINT bird_acquisitions_father_rooster_id_roosters_id_fk
      FOREIGN KEY (father_rooster_id) REFERENCES roosters(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE incubation
  ADD COLUMN IF NOT EXISTS rooster_id UUID,
  ADD COLUMN IF NOT EXISTS rooster_code VARCHAR(50);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'incubation_rooster_id_roosters_id_fk'
  ) THEN
    ALTER TABLE incubation
      ADD CONSTRAINT incubation_rooster_id_roosters_id_fk
      FOREIGN KEY (rooster_id) REFERENCES roosters(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bird_acquisitions_genetic_line_idx ON bird_acquisitions(genetic_line);
CREATE INDEX IF NOT EXISTS bird_acquisitions_source_batch_code_idx ON bird_acquisitions(source_batch_code);
