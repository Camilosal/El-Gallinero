CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_farm_document_unique_idx
  ON staff_profiles (farm_id, document_id)
  WHERE document_id IS NOT NULL;
