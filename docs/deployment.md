# Despliegue y Operación de Base de Datos

## Inicialización limpia en una instancia nueva

Para levantar cualquier instancia nueva (local, VPS o Docker) desde una base de datos PostgreSQL vacía, usa un único comando idempotente:

```bash
ADMIN_USERNAME='admin' ADMIN_PASSWORD='elige-una-clave-segura-de-12-caracteres' npm run db:bootstrap
```

`npm run db:bootstrap` (`src/db/bootstrap.ts`) ejecuta automáticamente:

1. **Migraciones unificadas (`npm run db:migrate` / `src/db/migrate-prod.ts`):**
   - `drizzle/0000_baseline.sql`: todas las tablas, enums, llaves foráneas e índices definidos en `src/db/schema.ts`.
   - `drizzle/0001_roles_constraints_and_rls.sql`: rol PostgreSQL `gallinero_tenant_role`, restricciones `CHECK`, índices parciales (tokens activos, factores de gallinaza y registro diario único) y políticas estrictas RLS multi-tenant (`tenant_isolation_policy`) más catálogo compartido.
   - Registro en `schema_migrations` para no re-aplicar archivos ya ejecutados.
2. **Semilla base obligatoria (`npm run db:seed-config` / `src/db/seed-config.ts`):**
   - Granja base (`DEFAULT_FARM_ID`) y suscripción activa inicial (`farm_subscriptions`).
   - Configuración global por defecto (`app_settings`), catálogos maestros multi-especie (`catalogos`), parámetros por especie, estándares de peso (`breed_weight_standards`), planes de vacunación (`vaccination_templates`), factores de compostaje (`manure_factors`) y alimentos/planes iniciales de alimentación mixta.
3. **Administrador inicial opcional:**
   - Si `ADMIN_USERNAME` y `ADMIN_PASSWORD` (mínimo 12 caracteres) están configurados y la tabla `users` está vacía, crea el primer usuario `admin`. Si ya existen usuarios, omite este paso sin error.

## Actualización de una instancia existente

1. Haz una copia de seguridad de PostgreSQL antes de desplegar cambios de esquema.
2. Ejecuta `npm run db:bootstrap` (o `npm run db:migrate && npm run db:seed-config`).
   - Si la base existente provenía de `drizzle-kit push` o de migraciones previas (`farms`, `users`, `catalogos`, `export_tokens` y `external_data_snapshots` ya existen sin `schema_migrations`), el runner adopta `drizzle/0000_baseline.sql` de forma segura sin intentar recrear tablas y luego aplica `drizzle/0001_roles_constraints_and_rls.sql` y cualquier migración futura de forma idempotente.
3. En contenedores Docker:
   - El `docker-compose.yml` de ejemplo habilita `AUTO_MIGRATE_ON_BOOT: "true"` para ejecutar `npm run db:bootstrap` automáticamente al iniciar.
   - En despliegues con `AUTO_MIGRATE_ON_BOOT=false`, ejecuta explícitamente:
     ```bash
     docker compose --profile migrate run --rm migrate
     ```

## Variables de entorno

Todas las variables de entorno requeridas y opcionales están documentadas en [`.env.example`](../.env.example):

- **Obligatoria:** `DATABASE_URL` (conexión PostgreSQL).
- **Arranque y admin inicial:** `AUTO_MIGRATE_ON_BOOT`, `PORT`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
- **Asistente Gina (opcional):** `ASSISTANT_AI_*`, `ASSISTANT_STT_*`, `ASSISTANT_VISION_*` (o `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) y `ASSISTANT_INTERNAL_BASE_URL`.
- **Correo, alertas y pagos (opcional):** `SMTP_*`, `NOTIFY_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WOMPI_*`.
- **IoT, analítica y datos legales (opcional):** `SENSOR_WEBHOOK_TOKEN`, `NEXT_PUBLIC_SWETRIX_*`, `LEGAL_*`.

> Asegúrate de definir un `.env` o `.env.local` propio en cada entorno para no heredar variables globales no deseadas del servidor.

## Datos de demostración (solo desarrollo / staging)

No ejecutes `npm run db:seed` en producción. Es un seed de demostración destructivo (requiere `--allow-destructive` y `DEMO_ADMIN_PASSWORD` de al menos 12 caracteres) y está bloqueado cuando `NODE_ENV=production`.
