-- Agrega columna species a breed_weight_standards para centralizar y filtrar curvas por especie.
ALTER TABLE breed_weight_standards
  ADD COLUMN IF NOT EXISTS species varchar(20);

UPDATE breed_weight_standards
SET species = CASE
  WHEN LOWER(breed) LIKE '%cuy%' THEN 'cuy'
  WHEN LOWER(breed) LIKE '%conejo%' OR LOWER(breed) LIKE '%nueva zelanda%' OR LOWER(breed) LIKE '%california%' THEN 'conejo'
  WHEN LOWER(breed) LIKE '%pato%' OR LOWER(breed) LIKE '%pekin%' OR LOWER(breed) LIKE '%pekín%' OR LOWER(breed) LIKE '%muscovy%' THEN 'pato'
  WHEN LOWER(breed) LIKE '%codorniz%' OR LOWER(breed) LIKE '%coturnix%' THEN 'codorniz'
  WHEN LOWER(breed) LIKE '%cobb%' OR LOWER(breed) LIKE '%ross%' OR LOWER(breed) LIKE '%campero%' OR LOWER(breed) LIKE '%broiler%' OR LOWER(breed) LIKE '%pollo%' THEN 'pollo'
  ELSE 'gallina'
END
WHERE species IS NULL;
