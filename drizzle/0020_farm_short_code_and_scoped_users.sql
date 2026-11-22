-- Código Corto Alfanumérico de Granja (Mod-31, 6 caracteres ej. 7K4M2P)
-- + tokens IoT por granja + aislamiento de nombres de usuario por granja.

CREATE OR REPLACE FUNCTION public.is_valid_farm_code_mod31(candidate text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  alphabet CONSTANT text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  weights CONSTANT integer[] := ARRAY[3, 7, 11, 17, 23];
  weighted_sum integer := 0;
  char_pos integer;
  expected_pos integer;
  i integer;
BEGIN
  IF char_length(candidate) <> 6 THEN
    RETURN false;
  END IF;

  FOR i IN 1..5 LOOP
    char_pos := strpos(alphabet, substr(candidate, i, 1));
    IF char_pos = 0 THEN
      RETURN false;
    END IF;
    weighted_sum := weighted_sum + ((char_pos - 1) * weights[i]);
  END LOOP;

  expected_pos := strpos(alphabet, substr(candidate, 6, 1));
  IF expected_pos = 0 THEN
    RETURN false;
  END IF;

  RETURN (weighted_sum % 31) = (expected_pos - 1);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.generate_farm_code_mod31()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet CONSTANT text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  weights CONSTANT integer[] := ARRAY[3, 7, 11, 17, 23];
  blocked CONSTANT text[] := ARRAY['PUTA', 'PUTO', 'CACA', 'CULO', 'PENE', 'TETA', 'JOTO', 'MAMA', 'FUCK', 'FVCK', 'SHIT', 'CUNT', 'DICK', 'PORN', 'SEXO', 'KAKA'];
  attempt integer := 0;
  i integer;
  idx integer;
  weighted_sum integer;
  prefix text;
  candidate text;
  bad_word text;
  has_blocked boolean;
BEGIN
  LOOP
    attempt := attempt + 1;
    prefix := '';
    weighted_sum := 0;

    FOR i IN 1..5 LOOP
      idx := floor(random() * 31)::integer;
      IF idx < 0 THEN idx := 0; ELSIF idx > 30 THEN idx := 30; END IF;
      prefix := prefix || substr(alphabet, idx + 1, 1);
      weighted_sum := weighted_sum + (idx * weights[i]);
    END LOOP;

    candidate := prefix || substr(alphabet, (weighted_sum % 31) + 1, 1);

    has_blocked := false;
    FOREACH bad_word IN ARRAY blocked LOOP
      IF position(bad_word IN candidate) > 0 THEN
        has_blocked := true;
        EXIT;
      END IF;
    END LOOP;
    IF has_blocked THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.farms f WHERE f."code" = candidate) THEN
      RETURN candidate;
    END IF;

    IF attempt >= 64 THEN
      RAISE EXCEPTION 'No se pudo generar un código Mod-31 único para farms.code después de % intentos', attempt;
    END IF;
  END LOOP;
END;
$$;
--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "code" varchar(12);
--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "sensor_token_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "sensor_token_prefix" varchar(20);
--> statement-breakpoint
DO $$
DECLARE
  farm_row record;
BEGIN
  FOR farm_row IN
    SELECT "id", "code"
    FROM "farms"
    ORDER BY "created_at" ASC, "id" ASC
  LOOP
    IF farm_row."code" IS NULL OR NOT public.is_valid_farm_code_mod31(farm_row."code") THEN
      UPDATE "farms"
      SET "code" = public.generate_farm_code_mod31()
      WHERE "id" = farm_row."id";
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "farms" ALTER COLUMN "code" SET DEFAULT public.generate_farm_code_mod31();
--> statement-breakpoint
ALTER TABLE "farms" ALTER COLUMN "code" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "farms_code_unique_idx" ON "farms" ("code");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'farms_code_valid_check'
  ) THEN
    ALTER TABLE "farms"
      ADD CONSTRAINT "farms_code_valid_check"
      CHECK (public.is_valid_farm_code_mod31("code"));
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_username_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "users_username_unique";
--> statement-breakpoint
UPDATE "users"
SET "username" = lower(btrim("username"))
WHERE "username" <> lower(btrim("username"));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_farm_username_unique_idx"
  ON "users" ("farm_id", lower("username"));
