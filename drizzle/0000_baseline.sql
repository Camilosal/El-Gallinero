CREATE TYPE "public"."animal_species" AS ENUM('gallina', 'pollo', 'codorniz', 'pato', 'conejo', 'cuy');--> statement-breakpoint
CREATE TYPE "public"."batch_purpose" AS ENUM('engorde_carne', 'postura_huevo', 'pie_cria', 'mixto');--> statement-breakpoint
CREATE TYPE "public"."broiler_batch_status" AS ENUM('activo', 'listo_sacrificio', 'vendido', 'faena');--> statement-breakpoint
CREATE TYPE "public"."feed_category" AS ENUM('granja_fresco', 'granja_procesado', 'suplementario', 'Concentrado', 'En Fresco', 'Preparados');--> statement-breakpoint
CREATE TYPE "public"."feed_movement_type" AS ENUM('compra', 'donacion', 'traslado', 'produccion_propia', 'ajuste', 'consumo_programa', 'consumo_manual', 'venta', 'uso_interno', 'merma', 'otro');--> statement-breakpoint
CREATE TYPE "public"."feed_type" AS ENUM('mosca_soldado', 'pastos_gramineas', 'maiz_germinado', 'bore_raices', 'purinas', 'maiz_comprado', 'concentrado_comercial', 'otro', 'Bore o Raices', 'Concentrado Aves', 'Concentrado Codorniz', 'Concentrado Conejos', 'Forraje Verde', 'Maiz en Grano', 'Maíz Germinado', 'Mosca Soldado', 'Otro', 'Pastos y gramíneas', 'Purinas');--> statement-breakpoint
CREATE TYPE "public"."hen_status" AS ENUM('activa', 'empollando', 'enferma', 'descarte', 'recomendada_sacrificio', 'vendida', 'faena', 'muerta');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('pendiente', 'en_progreso', 'completado');--> statement-breakpoint
CREATE TYPE "public"."mortality_cause" AS ENUM('enfermedad', 'depredador', 'accidente', 'sacrificio_sanitario', 'causa_natural', 'otro');--> statement-breakpoint
CREATE TYPE "public"."rooster_status" AS ENUM('activo', 'enfermo', 'vendido', 'faena', 'muerto');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('ingreso', 'egreso');--> statement-breakpoint
CREATE TABLE "accounts_payable" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"supplier" varchar(200) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pending_amount" numeric(12, 2) NOT NULL,
	"due_date" date,
	"status" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts_receivable" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"buyer" varchar(200) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pending_amount" numeric(12, 2) NOT NULL,
	"due_date" date,
	"status" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(50) DEFAULT 'hecho' NOT NULL,
	"subject_key" varchar(140) NOT NULL,
	"content" text NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"importance" integer DEFAULT 3 NOT NULL,
	"source_conversation_id" uuid,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_actions" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"user_id" uuid NOT NULL,
	"tool_name" varchar(100) NOT NULL,
	"args" jsonb NOT NULL,
	"summary" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(200) DEFAULT 'Nueva conversación' NOT NULL,
	"summary" text,
	"summary_message_count" integer DEFAULT 0 NOT NULL,
	"summary_updated_at" timestamp,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text,
	"tool_calls" jsonb,
	"tool_call_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_location_movements" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hen_id" uuid,
	"rooster_id" uuid,
	"batch_id" uuid,
	"from_location_id" uuid,
	"to_location_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"date" date NOT NULL,
	"reason" varchar(100) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "animal_location_movement_single_target" CHECK (num_nonnulls("animal_location_movements"."hen_id", "animal_location_movements"."rooster_id", "animal_location_movements"."batch_id") = 1),
	CONSTRAINT "animal_location_movement_distinct_places" CHECK ("animal_location_movements"."from_location_id" IS NULL OR "animal_location_movements"."from_location_id" <> "animal_location_movements"."to_location_id"),
	CONSTRAINT "animal_location_movement_quantity_positive" CHECK ("animal_location_movements"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(120) NOT NULL,
	"category" varchar(60) DEFAULT 'general' NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"data_url" text NOT NULL,
	"extracted_text" text,
	"extracted_data" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autoconsumo_logs" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" "animal_species" NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" varchar(30) NOT NULL,
	"market_reference_price" numeric(10, 2) NOT NULL,
	"savings_amount" numeric(12, 2) NOT NULL,
	"destination_household" varchar(100) DEFAULT 'Familia Granja',
	"batch_id" uuid,
	"slaughter_id" uuid,
	"egg_production_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"provider" varchar(30) DEFAULT 'wompi' NOT NULL,
	"external_reference" varchar(120) NOT NULL,
	"provider_tx_id" varchar(120),
	"method" varchar(30) NOT NULL,
	"amount_cop" integer NOT NULL,
	"plan_code" varchar(40) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"raw_payload" jsonb,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_payments_external_reference_unique" UNIQUE("external_reference")
);
--> statement-breakpoint
CREATE TABLE "biosecurity_logs" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"log_type" varchar(30) NOT NULL,
	"location_id" uuid,
	"species" varchar(20),
	"checklist_items" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"welfare_score" integer,
	"compliance_status" varchar(30) DEFAULT 'cumple' NOT NULL,
	"inspector_name" varchar(150),
	"staff_name" varchar(150),
	"training_topic" varchar(200),
	"training_certificate_until" date,
	"disinfectant_used" varchar(150),
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bird_acquisitions" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" "animal_species" DEFAULT 'pollo',
	"acquisition_type" varchar(50) NOT NULL,
	"bird_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(12, 2),
	"total_cost" numeric(12, 2),
	"supplier" varchar(200),
	"breed" varchar(100),
	"genetic_line" varchar(150),
	"generation" varchar(50),
	"origin_farm" varchar(200),
	"origin_location" varchar(200),
	"source_batch_code" varchar(100),
	"mother_hen_id" uuid,
	"father_rooster_id" uuid,
	"destination_location_id" uuid,
	"mother_identifier" varchar(100),
	"father_identifier" varchar(100),
	"genetic_evidence_reference" text,
	"health_evidence_reference" text,
	"birth_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breed_weight_standards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"species" varchar(20),
	"breed" varchar(100) NOT NULL,
	"gender" varchar(20) DEFAULT 'hembra' NOT NULL,
	"week_number" integer NOT NULL,
	"target_weight_g" numeric(8, 1) NOT NULL,
	"min_weight_g" numeric(8, 1),
	"max_weight_g" numeric(8, 1),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broiler_batches" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"species" "animal_species" DEFAULT 'pollo' NOT NULL,
	"purpose" "batch_purpose" DEFAULT 'engorde_carne' NOT NULL,
	"system_type" varchar(50) DEFAULT 'piso',
	"breed" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"initial_quantity" integer NOT NULL,
	"current_quantity" integer NOT NULL,
	"target_weeks" integer DEFAULT 7 NOT NULL,
	"target_days" integer,
	"target_weight_kg" numeric(6, 2) DEFAULT '2.5' NOT NULL,
	"avg_weight_kg" numeric(6, 2),
	"feed_conversion_target" numeric(4, 2),
	"status" "broiler_batch_status" DEFAULT 'activo' NOT NULL,
	"notes" text,
	"acquisition_id" uuid,
	"location_id" uuid,
	"total_production_cost" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" varchar(200),
	"monthly_target" numeric(12, 2) NOT NULL,
	"unit" varchar(30),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashflow_projections" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" date NOT NULL,
	"projected_income" numeric(12, 2),
	"projected_expense" numeric(12, 2),
	"actual_income" numeric(12, 2),
	"actual_expense" numeric(12, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalogos" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"value" varchar(200) NOT NULL,
	"price" numeric(12, 2),
	"units" integer,
	"tipo" varchar(50),
	"min_weeks" integer,
	"max_weeks" integer,
	"expected_eggs_per_hen" numeric(4, 2),
	"daily_feed_g" integer,
	"target_weight_kg" numeric(6, 2),
	"feed_cost_per_kg" numeric(10, 2),
	"feed_conversion_ratio" numeric(4, 2),
	"system_type" varchar(50),
	"description" text,
	"egg_price" numeric(10, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chicken_sales" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" varchar(20),
	"location_id" uuid,
	"bird_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"weight_kg" numeric(8, 2),
	"price_per_unit" numeric(10, 2) NOT NULL,
	"price_mode" varchar(20) DEFAULT 'por_ave' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"buyer" varchar(200),
	"presentation" varchar(100),
	"hen_id" uuid,
	"rooster_id" uuid,
	"batch_id" uuid,
	"previous_animal_states" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "composting_piles" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(150) NOT NULL,
	"start_date" date NOT NULL,
	"location_id" uuid,
	"species" varchar(20),
	"formula_ratio" varchar(30) DEFAULT '3:1:1' NOT NULL,
	"manure_kg" numeric(10, 2) DEFAULT '0' NOT NULL,
	"mortality_kg" numeric(10, 2) DEFAULT '0' NOT NULL,
	"carbon_material_kg" numeric(10, 2) DEFAULT '0' NOT NULL,
	"carbon_material_type" varchar(120),
	"current_temp_c" numeric(5, 1),
	"moisture_pct" numeric(5, 1),
	"turn_count" integer DEFAULT 0 NOT NULL,
	"last_turn_date" date,
	"next_turn_due_date" date,
	"expected_harvest_date" date,
	"status" varchar(30) DEFAULT 'activa' NOT NULL,
	"harvested_kg" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"role" varchar(20) DEFAULT 'cliente' NOT NULL,
	"person_type" varchar(20) DEFAULT 'natural' NOT NULL,
	"document_type" varchar(20),
	"document_number" varchar(50),
	"contact_name" varchar(150),
	"phone" varchar(40),
	"whatsapp" varchar(40),
	"email" varchar(150),
	"address" text,
	"city" varchar(120),
	"department" varchar(120),
	"zone" varchar(120),
	"location_notes" text,
	"category_tag" varchar(80),
	"payment_method" varchar(40),
	"credit_days" integer DEFAULT 0 NOT NULL,
	"delivery_schedule" varchar(120),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_allocations" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"title" varchar(200) NOT NULL,
	"source_transaction_id" uuid,
	"expense_category" varchar(100),
	"total_amount" numeric(12, 2) NOT NULL,
	"basis" varchar(30) DEFAULT 'head_count' NOT NULL,
	"allocations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"period_from" date,
	"period_to" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_closures" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"closure_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'cerrado' NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp DEFAULT now() NOT NULL,
	"reopened_by" uuid,
	"reopened_at" timestamp,
	"reopen_reason" text,
	"summary_snapshot" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "egg_losses" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"quantity" integer NOT NULL,
	"size" varchar(50),
	"reason" varchar(50) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "egg_production" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" "animal_species" DEFAULT 'gallina' NOT NULL,
	"batch_id" uuid,
	"location_id" uuid,
	"total_collected" integer NOT NULL,
	"broken" integer DEFAULT 0 NOT NULL,
	"discarded" integer DEFAULT 0 NOT NULL,
	"for_incubation" integer DEFAULT 0 NOT NULL,
	"quantity_autoconsumo" integer DEFAULT 0 NOT NULL,
	"quantity_excedente" integer DEFAULT 0 NOT NULL,
	"reference_unit_price" numeric(10, 2),
	"lot_code" varchar(60),
	"storage_temp_c" numeric(4, 1),
	"storage_humidity_pct" numeric(5, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "egg_production_details" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"production_id" uuid NOT NULL,
	"size" varchar(50) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "egg_sales" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" "animal_species" DEFAULT 'gallina' NOT NULL,
	"location_id" uuid,
	"batch_id" uuid,
	"lot_code" varchar(60),
	"quantity" integer NOT NULL,
	"price_per_unit" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"size" varchar(50),
	"presentation" varchar(100),
	"buyer" varchar(200),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "egg_sales_items" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"size" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"price_per_unit" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"presentation" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" varchar(120) DEFAULT 'Dashboard externo' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_prefix" varchar(24) NOT NULL,
	"scopes" jsonb DEFAULT '["read:finance","read:inventory","read:contacts","read:production"]'::jsonb NOT NULL,
	"profile" varchar(30) DEFAULT 'generic' NOT NULL,
	"expires_at" timestamp,
	"created_by" uuid,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "export_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "external_data_snapshots" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_key" varchar(60) NOT NULL,
	"wave" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'ok' NOT NULL,
	"sync_mode" varchar(20) DEFAULT 'auto' NOT NULL,
	"provider_name" varchar(120) NOT NULL,
	"source_url" varchar(500),
	"scope_key" varchar(120) DEFAULT 'global' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"last_error" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_assets" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(30) DEFAULT 'equipo' NOT NULL,
	"brand" varchar(120),
	"model" varchar(120),
	"serial_number" varchar(150),
	"acquisition_date" date,
	"acquisition_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"useful_life_months" integer DEFAULT 36,
	"useful_life_cycles" integer,
	"residual_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"depreciation_basis" varchar(20) DEFAULT 'meses' NOT NULL,
	"warranty_until" date,
	"location_id" uuid,
	"status" varchar(30) DEFAULT 'operativo' NOT NULL,
	"description" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "farm_assets_category_valid" CHECK ("farm_assets"."category" IN ('equipo', 'herramienta', 'estructura', 'vehiculo', 'otro')),
	CONSTRAINT "farm_assets_status_valid" CHECK ("farm_assets"."status" IN ('operativo', 'requiere_mantenimiento', 'fuera_servicio', 'retirado')),
	CONSTRAINT "farm_assets_acquisition_cost_nonnegative" CHECK ("farm_assets"."acquisition_cost" >= 0),
	CONSTRAINT "farm_assets_residual_value_nonnegative" CHECK ("farm_assets"."residual_value" >= 0),
	CONSTRAINT "farm_assets_depreciation_basis_valid" CHECK ("farm_assets"."depreciation_basis" IN ('meses', 'ciclos'))
);
--> statement-breakpoint
CREATE TABLE "farm_locations" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(150) NOT NULL,
	"type" varchar(30) NOT NULL,
	"parent_location_id" uuid,
	"description" text,
	"local_reference" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"area_m2" numeric(12, 2),
	"capacity" integer,
	"status" varchar(20) DEFAULT 'activa' NOT NULL,
	"operational_status" varchar(30) DEFAULT 'operativa' NOT NULL,
	"sanitary_status" varchar(30) DEFAULT 'pendiente_revision' NOT NULL,
	"sanitary_requirements" text,
	"sanitary_reviewed_at" date,
	"operational_reviewed_at" date,
	"maintenance_needs" text,
	"zone_type" varchar(30) DEFAULT 'produccion' NOT NULL,
	"allowed_species" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sanitary_empty_until" date,
	"altitude_meters" integer,
	"floor_type" varchar(40),
	"environmental_temp_c" numeric(5, 2),
	"is_quarantine" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "farm_locations_type_valid" CHECK ("farm_locations"."type" IN ('corral', 'jaula', 'galpon', 'potrero', 'jardin', 'patio', 'compostaje', 'bodega', 'cuarentena', 'otro')),
	CONSTRAINT "farm_locations_zone_type_valid" CHECK ("farm_locations"."zone_type" IN ('limpia', 'sucia', 'produccion', 'cuarentena', 'almacen', 'forraje')),
	CONSTRAINT "farm_locations_status_valid" CHECK ("farm_locations"."status" IN ('activa', 'inactiva')),
	CONSTRAINT "farm_locations_operational_status_valid" CHECK ("farm_locations"."operational_status" IN ('operativa', 'mantenimiento', 'restringida', 'fuera_servicio')),
	CONSTRAINT "farm_locations_sanitary_status_valid" CHECK ("farm_locations"."sanitary_status" IN ('pendiente_revision', 'cumple', 'requiere_atencion', 'no_cumple')),
	CONSTRAINT "farm_locations_latitude_range" CHECK ("farm_locations"."latitude" IS NULL OR ("farm_locations"."latitude" >= -90 AND "farm_locations"."latitude" <= 90)),
	CONSTRAINT "farm_locations_longitude_range" CHECK ("farm_locations"."longitude" IS NULL OR ("farm_locations"."longitude" >= -180 AND "farm_locations"."longitude" <= 180)),
	CONSTRAINT "farm_locations_capacity_nonnegative" CHECK ("farm_locations"."capacity" IS NULL OR "farm_locations"."capacity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "farm_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"plan_code" varchar(40) DEFAULT 'FREEMIUM_SEMILLA' NOT NULL,
	"status" varchar(20) DEFAULT 'trial' NOT NULL,
	"max_active_batches" integer,
	"max_users" integer DEFAULT 2 NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"deployment_mode" varchar(20) DEFAULT 'saas' NOT NULL,
	"owner_user_id" uuid,
	"qr_source" varchar(120),
	"ally_code" varchar(120),
	"plan_code" varchar(40) DEFAULT 'FREEMIUM_SEMILLA' NOT NULL,
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "farms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "feed_inventory" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" "feed_category" NOT NULL,
	"feed_type" "feed_type" NOT NULL,
	"unit" varchar(30) NOT NULL,
	"current_stock" numeric(10, 2) DEFAULT '0' NOT NULL,
	"min_stock" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cost_per_unit" numeric(10, 2) DEFAULT '0' NOT NULL,
	"supplier" varchar(200),
	"dry_matter_pct" numeric(5, 2),
	"crude_protein_pct" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_movements" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feed_id" uuid NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"is_entry" boolean NOT NULL,
	"movement_type" "feed_movement_type" DEFAULT 'otro' NOT NULL,
	"auto_generated" boolean DEFAULT false NOT NULL,
	"stage_catalogo_id" uuid,
	"hen_count" integer,
	"species" varchar(20),
	"unit_cost" numeric(10, 2),
	"location_id" uuid,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_programs" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_catalogo_id" uuid NOT NULL,
	"feed_id" uuid NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"daily_amount_per_hen" numeric(6, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"parent_id" uuid,
	"type" varchar(20) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flock_plan_milestones" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"expected_hens" integer,
	"expected_eggs_per_week" integer,
	"expected_feed_kg_per_week" numeric(10, 2),
	"actual_hens" integer,
	"actual_eggs_per_week" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flock_plans" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"start_date" date NOT NULL,
	"target_hen_count" integer NOT NULL,
	"target_rooster_count" integer,
	"replacement_date" date,
	"current_phase" varchar(50),
	"status" varchar(20) DEFAULT 'activo' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_control" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" varchar(20),
	"location_id" uuid,
	"batch_id" uuid,
	"type" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"affected_hens" text,
	"previous_animal_states" jsonb,
	"product" varchar(200),
	"cost" numeric(10, 2) DEFAULT '0',
	"next_scheduled" date,
	"withdrawal_days" integer DEFAULT 0 NOT NULL,
	"withdrawal_until_date" date,
	"vaccine_lot" varchar(80),
	"vaccine_lab" varchar(120),
	"vaccine_expiry_date" date,
	"cold_chain_temp_c" numeric(4, 1),
	"administration_route" varchar(60),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hens" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"breed" varchar(100) NOT NULL,
	"birth_date" date NOT NULL,
	"status" "hen_status" DEFAULT 'activa' NOT NULL,
	"weight" numeric(6, 2),
	"notes" text,
	"is_broody" boolean DEFAULT false NOT NULL,
	"clutch_size" integer DEFAULT 0,
	"acquisition_id" uuid,
	"acquisition_cost" numeric(10, 2),
	"location_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incubation" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"species" "animal_species" DEFAULT 'gallina' NOT NULL,
	"hen_id" uuid,
	"rooster_id" uuid,
	"rooster_code" varchar(50),
	"batch_id" uuid,
	"location_id" uuid,
	"incubator_name" varchar(120),
	"tray_code" varchar(60),
	"start_date" date NOT NULL,
	"turn_stop_date" date,
	"expected_hatch_date" date NOT NULL,
	"humidity_target_pct" numeric(5, 2),
	"temp_target_c" numeric(4, 1),
	"eggs_set" integer NOT NULL,
	"fertile_eggs" integer,
	"discarded_eggs" integer DEFAULT 0,
	"eggs_hatched" integer DEFAULT 0,
	"males_hatched" integer,
	"females_hatched" integer,
	"is_complete" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"scheduled_date" date NOT NULL,
	"completed_date" date,
	"status" "maintenance_status" DEFAULT 'pendiente' NOT NULL,
	"cost" numeric(10, 2) DEFAULT '0',
	"location_id" uuid,
	"species" varchar(20),
	"batch_id" uuid,
	"asset_id" uuid,
	"recurrence_series_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"recurrence_parent_id" uuid,
	"recurrence_interval_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "maintenance_recurrence_interval_valid" CHECK ("maintenance"."recurrence_interval_days" IS NULL OR "maintenance"."recurrence_interval_days" BETWEEN 1 AND 3650)
);
--> statement-breakpoint
CREATE TABLE "manure_adjustments" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"delta_kg" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manure_factors" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_catalogo_id" uuid,
	"bird_group" varchar(20) NOT NULL,
	"kg_per_bird_per_day" numeric(6, 3) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manure_production" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"kg_produced" numeric(10, 2) NOT NULL,
	"source" varchar(20) DEFAULT 'estimado' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manure_sales" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" varchar(20),
	"location_id" uuid,
	"batch_id" uuid,
	"quantity_kg" numeric(10, 2) NOT NULL,
	"price_per_kg" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"presentation" varchar(100),
	"buyer" varchar(200),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meat_losses" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"quantity_kg" numeric(8, 2) NOT NULL,
	"reason" varchar(50) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meat_sales" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" "animal_species" DEFAULT 'pollo' NOT NULL,
	"location_id" uuid,
	"batch_id" uuid,
	"quantity_kg" numeric(8, 2) NOT NULL,
	"price_per_kg" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"presentation" varchar(100),
	"buyer" varchar(200),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortality_records" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"location_id" uuid,
	"species" "animal_species" DEFAULT 'pollo',
	"bird_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"cause" "mortality_cause" NOT NULL,
	"hen_id" uuid,
	"rooster_id" uuid,
	"batch_id" uuid,
	"health_control_id" uuid,
	"previous_animal_states" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_mutation_receipts" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"mutation_id" varchar(100) PRIMARY KEY NOT NULL,
	"method" varchar(10) NOT NULL,
	"path" varchar(255) NOT NULL,
	"status_code" integer NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"type" varchar(20) NOT NULL,
	"receivable_id" uuid,
	"payable_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"method" varchar(50),
	"reference" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_products" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"expense_category" varchar(100) NOT NULL,
	"default_presentation" varchar(100),
	"default_unit" varchar(30) DEFAULT 'unidades' NOT NULL,
	"last_price_per_presentation" numeric(12, 2),
	"default_supplier" varchar(200),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reproduction_events" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"species" varchar(20) NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"event_date" date NOT NULL,
	"dam_code" varchar(80) NOT NULL,
	"sire_code" varchar(80),
	"dam_mother_code" varchar(80),
	"dam_father_code" varchar(80),
	"sire_mother_code" varchar(80),
	"sire_father_code" varchar(80),
	"batch_id" uuid,
	"location_id" uuid,
	"parent_event_id" uuid,
	"parity_number" integer DEFAULT 1 NOT NULL,
	"expected_palpation_date" date,
	"expected_nestbox_date" date,
	"expected_birth_date" date,
	"palpation_result" varchar(30),
	"born_alive" integer,
	"born_dead" integer DEFAULT 0,
	"litter_birth_weight_g" numeric(8, 1),
	"weaned_total" integer,
	"weaned_males" integer,
	"weaned_females" integer,
	"litter_wean_weight_g" numeric(8, 1),
	"litter_daily_gain_g" numeric(7, 2),
	"weaned_batch_id" uuid,
	"status" varchar(30) DEFAULT 'activo' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roosters" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"breed" varchar(100) NOT NULL,
	"birth_date" date NOT NULL,
	"status" "rooster_status" DEFAULT 'activo' NOT NULL,
	"weight" numeric(6, 2),
	"notes" text,
	"acquisition_id" uuid,
	"acquisition_cost" numeric(10, 2),
	"location_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanitary_calendar" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"target_birds" varchar(50) DEFAULT 'todas',
	"target_stage_id" uuid,
	"frequency_days" integer,
	"next_due_date" date NOT NULL,
	"withdrawal_days" integer,
	"last_health_control_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensor_readings" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"location_id" uuid,
	"batch_id" uuid,
	"device_id" varchar(100) NOT NULL,
	"metric_type" varchar(40) NOT NULL,
	"value" numeric(10, 3) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"ith_index" numeric(6, 2),
	"alert_triggered" boolean DEFAULT false NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slaughter" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"location_id" uuid,
	"species" "animal_species" DEFAULT 'pollo' NOT NULL,
	"bird_type" varchar(50) NOT NULL,
	"quantity" integer NOT NULL,
	"live_weight_kg" numeric(8, 2),
	"weight_kg" numeric(8, 2) NOT NULL,
	"carcass_yield_percent" numeric(5, 2),
	"destination" varchar(50) DEFAULT 'consumo_propio' NOT NULL,
	"heads_autoconsumo" integer DEFAULT 0 NOT NULL,
	"weight_kg_autoconsumo" numeric(8, 2) DEFAULT '0' NOT NULL,
	"heads_excedente" integer DEFAULT 0 NOT NULL,
	"weight_kg_excedente" numeric(8, 2) DEFAULT '0' NOT NULL,
	"price_per_kg" numeric(10, 2),
	"total_amount" numeric(12, 2),
	"market_reference_price_per_kg" numeric(10, 2),
	"estimated_savings_amount" numeric(12, 2),
	"hen_id" uuid,
	"rooster_id" uuid,
	"batch_id" uuid,
	"previous_animal_states" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_inventory" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(50) NOT NULL,
	"unit" varchar(30) NOT NULL,
	"current_stock" numeric(10, 2) DEFAULT '0' NOT NULL,
	"min_stock" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cost_per_unit" numeric(10, 2) DEFAULT '0' NOT NULL,
	"supplier" varchar(200),
	"expiry_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_movements" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supply_id" uuid NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"is_entry" boolean NOT NULL,
	"movement_type" varchar(50) NOT NULL,
	"date" date NOT NULL,
	"health_control_id" uuid,
	"maintenance_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"type" "transaction_type" NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"counterparty" varchar(200),
	"amount" numeric(12, 2) NOT NULL,
	"quantity" numeric(12, 2),
	"unit_price" numeric(12, 2),
	"unit" varchar(30),
	"presentation" varchar(100),
	"source_type" varchar(50),
	"source_id" uuid,
	"species" varchar(20),
	"location_id" uuid,
	"batch_id" uuid,
	"is_credit" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"recovery_code_hash" varchar(64),
	"recovery_code_issued_at" timestamp,
	"name" varchar(200) NOT NULL,
	"role" varchar(50) DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vaccination_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"species" varchar(50) DEFAULT 'gallina' NOT NULL,
	"breed" varchar(100) DEFAULT '' NOT NULL,
	"week_number" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"type" varchar(50) DEFAULT 'vacunacion' NOT NULL,
	"frequency_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_logs" (
	"farm_id" uuid DEFAULT COALESCE(NULLIF(current_setting('app.current_farm_id', true), '')::uuid, '00000000-0000-0000-0000-000000000001'::uuid) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"species" varchar(20),
	"location_id" uuid,
	"batch_id" uuid,
	"hen_group" text,
	"breed" text,
	"week_number" integer,
	"avg_weight_kg" text,
	"sample_size" integer DEFAULT 1,
	"individual_weights_g" jsonb,
	"cv_percent" numeric(5, 2),
	"uniformity_pct" numeric(5, 2),
	"daily_gain_g" numeric(7, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_source_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_movements" ADD CONSTRAINT "animal_location_movements_hen_id_hens_id_fk" FOREIGN KEY ("hen_id") REFERENCES "public"."hens"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_movements" ADD CONSTRAINT "animal_location_movements_rooster_id_roosters_id_fk" FOREIGN KEY ("rooster_id") REFERENCES "public"."roosters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_movements" ADD CONSTRAINT "animal_location_movements_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_movements" ADD CONSTRAINT "animal_location_movements_from_location_id_farm_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_location_movements" ADD CONSTRAINT "animal_location_movements_to_location_id_farm_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."farm_locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autoconsumo_logs" ADD CONSTRAINT "autoconsumo_logs_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autoconsumo_logs" ADD CONSTRAINT "autoconsumo_logs_slaughter_id_slaughter_id_fk" FOREIGN KEY ("slaughter_id") REFERENCES "public"."slaughter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autoconsumo_logs" ADD CONSTRAINT "autoconsumo_logs_egg_production_id_egg_production_id_fk" FOREIGN KEY ("egg_production_id") REFERENCES "public"."egg_production"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biosecurity_logs" ADD CONSTRAINT "biosecurity_logs_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biosecurity_logs" ADD CONSTRAINT "biosecurity_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bird_acquisitions" ADD CONSTRAINT "bird_acquisitions_mother_hen_id_hens_id_fk" FOREIGN KEY ("mother_hen_id") REFERENCES "public"."hens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bird_acquisitions" ADD CONSTRAINT "bird_acquisitions_father_rooster_id_roosters_id_fk" FOREIGN KEY ("father_rooster_id") REFERENCES "public"."roosters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bird_acquisitions" ADD CONSTRAINT "bird_acquisitions_destination_location_id_farm_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broiler_batches" ADD CONSTRAINT "broiler_batches_acquisition_id_bird_acquisitions_id_fk" FOREIGN KEY ("acquisition_id") REFERENCES "public"."bird_acquisitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broiler_batches" ADD CONSTRAINT "broiler_batches_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chicken_sales" ADD CONSTRAINT "chicken_sales_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chicken_sales" ADD CONSTRAINT "chicken_sales_hen_id_hens_id_fk" FOREIGN KEY ("hen_id") REFERENCES "public"."hens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chicken_sales" ADD CONSTRAINT "chicken_sales_rooster_id_roosters_id_fk" FOREIGN KEY ("rooster_id") REFERENCES "public"."roosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chicken_sales" ADD CONSTRAINT "chicken_sales_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "composting_piles" ADD CONSTRAINT "composting_piles_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_source_transaction_id_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_closures" ADD CONSTRAINT "daily_closures_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_closures" ADD CONSTRAINT "daily_closures_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_production" ADD CONSTRAINT "egg_production_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_production" ADD CONSTRAINT "egg_production_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_production_details" ADD CONSTRAINT "egg_production_details_production_id_egg_production_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."egg_production"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_sales" ADD CONSTRAINT "egg_sales_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_sales" ADD CONSTRAINT "egg_sales_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "egg_sales_items" ADD CONSTRAINT "egg_sales_items_sale_id_egg_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."egg_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_tokens" ADD CONSTRAINT "export_tokens_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_tokens" ADD CONSTRAINT "export_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_assets" ADD CONSTRAINT "farm_assets_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_locations" ADD CONSTRAINT "farm_locations_parent_location_id_farm_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_subscriptions" ADD CONSTRAINT "farm_subscriptions_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_movements" ADD CONSTRAINT "feed_movements_feed_id_feed_inventory_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_movements" ADD CONSTRAINT "feed_movements_stage_catalogo_id_catalogos_id_fk" FOREIGN KEY ("stage_catalogo_id") REFERENCES "public"."catalogos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_movements" ADD CONSTRAINT "feed_movements_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_programs" ADD CONSTRAINT "feed_programs_stage_catalogo_id_catalogos_id_fk" FOREIGN KEY ("stage_catalogo_id") REFERENCES "public"."catalogos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_programs" ADD CONSTRAINT "feed_programs_feed_id_feed_inventory_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feed_inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flock_plan_milestones" ADD CONSTRAINT "flock_plan_milestones_plan_id_flock_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."flock_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_control" ADD CONSTRAINT "health_control_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_control" ADD CONSTRAINT "health_control_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hens" ADD CONSTRAINT "hens_acquisition_id_bird_acquisitions_id_fk" FOREIGN KEY ("acquisition_id") REFERENCES "public"."bird_acquisitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hens" ADD CONSTRAINT "hens_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incubation" ADD CONSTRAINT "incubation_hen_id_hens_id_fk" FOREIGN KEY ("hen_id") REFERENCES "public"."hens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incubation" ADD CONSTRAINT "incubation_rooster_id_roosters_id_fk" FOREIGN KEY ("rooster_id") REFERENCES "public"."roosters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incubation" ADD CONSTRAINT "incubation_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incubation" ADD CONSTRAINT "incubation_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_asset_id_farm_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."farm_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance" ADD CONSTRAINT "maintenance_recurrence_parent_id_maintenance_id_fk" FOREIGN KEY ("recurrence_parent_id") REFERENCES "public"."maintenance"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manure_factors" ADD CONSTRAINT "manure_factors_stage_catalogo_id_catalogos_id_fk" FOREIGN KEY ("stage_catalogo_id") REFERENCES "public"."catalogos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manure_sales" ADD CONSTRAINT "manure_sales_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manure_sales" ADD CONSTRAINT "manure_sales_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meat_sales" ADD CONSTRAINT "meat_sales_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meat_sales" ADD CONSTRAINT "meat_sales_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortality_records" ADD CONSTRAINT "mortality_records_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortality_records" ADD CONSTRAINT "mortality_records_hen_id_hens_id_fk" FOREIGN KEY ("hen_id") REFERENCES "public"."hens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortality_records" ADD CONSTRAINT "mortality_records_rooster_id_roosters_id_fk" FOREIGN KEY ("rooster_id") REFERENCES "public"."roosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortality_records" ADD CONSTRAINT "mortality_records_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortality_records" ADD CONSTRAINT "mortality_records_health_control_id_health_control_id_fk" FOREIGN KEY ("health_control_id") REFERENCES "public"."health_control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivable_id_accounts_receivable_id_fk" FOREIGN KEY ("receivable_id") REFERENCES "public"."accounts_receivable"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payable_id_accounts_payable_id_fk" FOREIGN KEY ("payable_id") REFERENCES "public"."accounts_payable"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproduction_events" ADD CONSTRAINT "reproduction_events_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproduction_events" ADD CONSTRAINT "reproduction_events_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproduction_events" ADD CONSTRAINT "reproduction_events_parent_event_id_reproduction_events_id_fk" FOREIGN KEY ("parent_event_id") REFERENCES "public"."reproduction_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reproduction_events" ADD CONSTRAINT "reproduction_events_weaned_batch_id_broiler_batches_id_fk" FOREIGN KEY ("weaned_batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roosters" ADD CONSTRAINT "roosters_acquisition_id_bird_acquisitions_id_fk" FOREIGN KEY ("acquisition_id") REFERENCES "public"."bird_acquisitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roosters" ADD CONSTRAINT "roosters_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanitary_calendar" ADD CONSTRAINT "sanitary_calendar_target_stage_id_catalogos_id_fk" FOREIGN KEY ("target_stage_id") REFERENCES "public"."catalogos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanitary_calendar" ADD CONSTRAINT "sanitary_calendar_last_health_control_id_health_control_id_fk" FOREIGN KEY ("last_health_control_id") REFERENCES "public"."health_control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slaughter" ADD CONSTRAINT "slaughter_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slaughter" ADD CONSTRAINT "slaughter_hen_id_hens_id_fk" FOREIGN KEY ("hen_id") REFERENCES "public"."hens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slaughter" ADD CONSTRAINT "slaughter_rooster_id_roosters_id_fk" FOREIGN KEY ("rooster_id") REFERENCES "public"."roosters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slaughter" ADD CONSTRAINT "slaughter_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_movements" ADD CONSTRAINT "supply_movements_supply_id_supply_inventory_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supply_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_movements" ADD CONSTRAINT "supply_movements_health_control_id_health_control_id_fk" FOREIGN KEY ("health_control_id") REFERENCES "public"."health_control"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supply_movements" ADD CONSTRAINT "supply_movements_maintenance_id_maintenance_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."maintenance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_location_id_farm_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."farm_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_batch_id_broiler_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."broiler_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_memories_user_active_idx" ON "agent_memories" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_memories_farm_user_subject_idx" ON "agent_memories" USING btree ("farm_id","user_id","category","subject_key");--> statement-breakpoint
CREATE UNIQUE INDEX "app_settings_farm_key_unique_idx" ON "app_settings" USING btree ("farm_id","key");--> statement-breakpoint
CREATE INDEX "attachments_entity_lookup_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attachments_category_idx" ON "attachments" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "autoconsumo_egg_production_idx" ON "autoconsumo_logs" USING btree ("egg_production_id");--> statement-breakpoint
CREATE UNIQUE INDEX "breed_weight_breed_week_idx" ON "breed_weight_standards" USING btree ("breed","gender","week_number");--> statement-breakpoint
CREATE UNIQUE INDEX "broiler_batches_code_unique_idx" ON "broiler_batches" USING btree ("farm_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "catalogos_category_value_idx" ON "catalogos" USING btree ("farm_id","category","value");--> statement-breakpoint
CREATE UNIQUE INDEX "composting_piles_code_unique_idx" ON "composting_piles" USING btree ("farm_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_name_idx" ON "contacts" USING btree ("farm_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_closures_date_unique_idx" ON "daily_closures" USING btree ("farm_id","closure_date");--> statement-breakpoint
CREATE UNIQUE INDEX "egg_prod_size_idx" ON "egg_production_details" USING btree ("production_id","size");--> statement-breakpoint
CREATE INDEX "export_tokens_farm_idx" ON "export_tokens" USING btree ("farm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_data_snapshots_farm_source_scope_idx" ON "external_data_snapshots" USING btree ("farm_id","source_key","scope_key");--> statement-breakpoint
CREATE UNIQUE INDEX "farm_assets_code_unique_idx" ON "farm_assets" USING btree ("farm_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "farm_locations_code_unique_idx" ON "farm_locations" USING btree ("farm_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "farm_subscriptions_farm_unique_idx" ON "farm_subscriptions" USING btree ("farm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feed_program_stage_feed_idx" ON "feed_programs" USING btree ("stage_catalogo_id","feed_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hens_code_unique_idx" ON "hens" USING btree ("farm_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_series_date_unique_idx" ON "maintenance" USING btree ("recurrence_series_id","scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "maintenance_parent_unique_idx" ON "maintenance" USING btree ("recurrence_parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "manure_factor_stage_group_idx" ON "manure_factors" USING btree ("stage_catalogo_id","bird_group") WHERE "manure_factors"."stage_catalogo_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "manure_factor_global_group_idx" ON "manure_factors" USING btree ("farm_id","bird_group") WHERE "manure_factors"."stage_catalogo_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "manure_auto_daily_unique_idx" ON "manure_production" USING btree ("farm_id","date") WHERE "manure_production"."source" = 'auto_diario';--> statement-breakpoint
CREATE UNIQUE INDEX "roosters_code_unique_idx" ON "roosters" USING btree ("farm_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "vaccination_template_unique_idx" ON "vaccination_templates" USING btree ("species","breed","week_number","name");