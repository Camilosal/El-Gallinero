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
2. En una base existente, ejecuta únicamente `npm run db:migrate`. No ejecutes `db:bootstrap` ni `db:seed-config` como parte de un despliegue normal: pueden incorporar valores iniciales a una granja que ya tiene configuración propia.
   - Si la base provenía de `drizzle-kit push` o de migraciones previas (`farms`, `users`, `catalogos`, `export_tokens` y `external_data_snapshots` ya existen sin `schema_migrations`), el runner adopta `drizzle/0000_baseline.sql` sin recrear tablas y luego aplica las migraciones pendientes.
3. En contenedores Docker, deja `AUTO_MIGRATE_ON_BOOT=false` en producción y ejecuta explícitamente:
   ```bash
   docker compose --profile migrate run --rm migrate
   ```
   El servicio `migrate` ejecuta solo `db:migrate`. Al arrancar, la aplicación no migra ni siembra datos.

Usa `npm run db:bootstrap` solo para crear una instancia nueva o cuando hayas aprobado por separado la incorporación de configuración inicial. El parámetro `AUTO_MIGRATE_ON_BOOT=true` activa ese flujo completo y no debe usarse para desplegar sobre una granja personalizada.

## Variables de entorno

Todas las variables de entorno requeridas y opcionales están documentadas en [`.env.example`](../.env.example):

- **Obligatoria:** `DATABASE_URL` (conexión PostgreSQL).
- **Arranque y admin inicial:** `AUTO_MIGRATE_ON_BOOT`, `PORT`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
- **Asistente Gina (opcional):** `ASSISTANT_AI_*`, `ASSISTANT_STT_*`, `ASSISTANT_VISION_*` (o `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`) y `ASSISTANT_INTERNAL_BASE_URL`.
- **Correo, alertas y pagos (opcional):** `SMTP_*`, `NOTIFY_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WOMPI_*`.
- **Canal Telegram bidireccional (opcional):** `TELEGRAM_WEBHOOK_SECRET` (secreto del webhook, header `X-Telegram-Bot-Api-Secret-Token`) y `APP_URL` (URL pública para el webhook y los deep-links). Sin ellos, el bot sigue enviando alertas salientes pero no recibe mensajes.
- **Cron del agente proactivo:** `CRON_SECRET` (compartido con el scheduler de fuentes externas) y `AGENT_PROACTIVE_HOUR_BOGOTA` (hora del briefing diario, por defecto 6).
- **IoT, analítica y datos legales (opcional):** `SENSOR_WEBHOOK_TOKEN`, `NEXT_PUBLIC_SWETRIX_*`, `LEGAL_*`.

> **Qué archivo carga cada entorno:** Next.js local suele usar `.env.local`. Docker Compose, si no recibe `--env-file`, carga `.env` junto a los archivos Compose; no carga `.env.local` automáticamente. El comando documentado de staging sí pasa `--env-file .env.staging`, así que staging toma ese archivo. `.env.example` es solo una plantilla. Mantén secretos separados por entorno y no copies los de staging a producción.

## Datos de demostración (solo desarrollo / staging)

No ejecutes `npm run db:seed` en producción. Es un seed de demostración destructivo (requiere `--allow-destructive` y `DEMO_ADMIN_PASSWORD` de al menos 12 caracteres) y está bloqueado cuando `NODE_ENV=production`.

## Staging local aislado con Docker Compose

El perfil de staging usa otro proyecto Compose, una base PostgreSQL y un volumen propios. La aplicación y PostgreSQL solo escuchan en `127.0.0.1` (puertos `3100` y `55432` por defecto), así que no quedan expuestos a la red pública.

1. Crea `.env.staging` a partir de `.env.example` y completa credenciales exclusivas para staging. Genera valores aleatorios para `POSTGRES_PASSWORD` y `CRON_SECRET`; configura también `POSTGRES_USER=iwa_staging`, `POSTGRES_DB=iwagranja_staging`, `ADMIN_USERNAME` y `ADMIN_PASSWORD` únicos para ese entorno. No reutilices credenciales de producción.
2. Valida y activa el entorno:

   ```bash
   docker compose --env-file .env.staging -p iwagranja-staging -f docker-compose.yml -f docker-compose.staging.yml config --quiet
   docker compose --env-file .env.staging -p iwagranja-staging -f docker-compose.yml -f docker-compose.staging.yml up -d --build
   ```

3. Confirma `/api/health` en `http://127.0.0.1:3100/api/health`, revisa los logs de `app` y `external-sources-scheduler`, e inicia sesión con el administrador de staging definido en el archivo local.
4. Para detener o reiniciar staging, conserva el nombre del proyecto `iwagranja-staging`. `down` mantiene el volumen de datos; agrega `-v` solo si deliberadamente quieres borrar la base de staging.

La red bridge de staging debe permanecer con `internal: false` para permitir las consultas externas. Esto no reemplaza las reglas del firewall o del proveedor de nube. Camino A requiere TCP saliente a `appweb.dane.gov.co:9001` y `visualizador.ideam.gov.co:443`; Camino B requiere `www.dane.gov.co:443` para anexos SIPSA y `bart.ideam.gov.co:443` para el CSV de alertas. En la instancia revisada, el anexo SIPSA Excel respondió HTTP 200 desde el contenedor en `www.dane.gov.co:443`. El código del conector IDEAM apunta al archivo directo `https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/alertas_hidrologicas.csv`; la sincronización automática queda registrada por el sincronizador cuando el contenedor alcanza esa URL.

El scheduler requiere `CRON_SECRET`. El sincronizador usa `external.sync_enabled` de la base de staging; si una fuente falla, conserva el último dato válido y reintenta en el siguiente intervalo sin repetir el ciclo completo. Los valores externos se guardan como observaciones y no reemplazan automáticamente los datos maestros.

## API de herramientas del agente y servidor MCP

La instancia expone dos puertas para agentes externos (Claude, orquestadores, n8n, clientes MCP), ambas autenticadas con tokens de integración creados en **Exportar → Conectores**:

- `GET/POST /api/v1/agent/tools[/{name}]` — manifiesto y ejecución de herramientas (scopes `agent:read` / `agent:write`).
- `POST /api/mcp` — servidor MCP (Streamable HTTP, JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`) sobre el mismo ejecutor.

Consideraciones operativas:

1. **Tokens de escritura acotados:** un token con `agent:write` exige fecha de expiración obligatoria de máximo 90 días (validado en servidor). Los conectores ERP legacy siguen siendo de solo lectura por defecto.
2. **Confirmación humana intacta:** las escrituras sensibles (ventas, gastos, cierres, pagos, etc.) devuelven `202` con `actionId` y solo se ejecutan tras `POST /api/asistente/acciones/{id}/confirmar` con el mismo token o desde la app. El piso duro no es configurable ni por MCP.
3. **Rate limit y auditoría:** 60 solicitudes/minuto por token (en memoria, por instancia). Toda acción queda en `ai_actions` con `origin: external_agent` y `token_id`.
4. **Sin configuración extra:** no requiere variables de entorno nuevas; usa la misma base de datos y el mismo puerto de la app. Las rutas se auto-autentican (no necesitan sesión de navegador).
5. **Preparar el token:** en **Exportar → Conectores**, crea un token con `agent:read` para consultas. Añade `agent:write` solo si necesitas que el agente proponga registros; esas acciones sensibles siguen requiriendo confirmación y el token vence en máximo 90 días.
6. **Claude (servidor remoto):** en `Customize → Connectors`, selecciona `Add custom connector`, agrega la URL `https://app.iwage.co/api/mcp` y continúa. Como el servidor usa un token fijo y no OAuth, elige `No sign in`; en `Request headers`, añade `Authorization` con el valor `Bearer <TOKEN>`. Después conecta el conector y habilítalo en la conversación desde `+ → Connectors`. En planes Team/Enterprise, primero debe agregarlo un propietario desde `Organization settings → Connectors`. Para MCP remoto, Claude Desktop se configura desde Connectors; `claude_desktop_config.json` corresponde a servidores locales.

   En **otros clientes**, usa el transporte Streamable HTTP, la URL `https://app.iwage.co/api/mcp` y el encabezado `Authorization: Bearer <TOKEN>`. La forma de configurar ese encabezado depende del cliente. Si solo admite OAuth y no permite encabezados fijos, no podrá autenticarse con esta implementación.

   Verificación rápida sin cliente MCP:

   ```bash
   curl -s https://app.iwage.co/api/mcp -H "Authorization: Bearer glli_exp_TU_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

## Canal Telegram bidireccional (Gina)

El bot envía alertas y el parte diario, y además recibe consultas, notas de voz y confirmaciones de acciones pendientes.

1. **Crear el bot** con @BotFather y definir en el entorno: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (usuario público sin `@`, para el QR), `TELEGRAM_WEBHOOK_SECRET` (cadena aleatoria larga) y `APP_URL` (URL pública HTTPS de la app). `TELEGRAM_CHAT_ID` sigue siendo opcional para alertas salientes heredadas.
2. **Registrar el webhook** con el secret_token (una sola vez por entorno):

   ```bash
   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... APP_URL=https://app.iwage.co \
     node scripts/telegram-setup.mjs
   # Para volver a modo getUpdates en desarrollo:
   node scripts/telegram-setup.mjs --delete
   ```

   El webhook apunta a `POST /api/telegram/webhook` y la app valida el header `X-Telegram-Bot-Api-Secret-Token` contra `TELEGRAM_WEBHOOK_SECRET`; sin secreto configurado el webhook rechaza todo.
3. **Vincular el chat del usuario:** en la app (Configuración → Módulos → Canal Telegram) se genera un QR dinámico con un enlace `https://t.me/<bot>?start=<codigo>`. Al escanearlo, Telegram abre el chat privado y el usuario debe pulsar **Iniciar**; el código de pairing se consume una sola vez y dura 10 minutos. Como alternativa, puede enviar `/start CODIGO` manualmente. El chat queda en `telegram_chats`, hereda el rol y permisos de ese usuario, y puede cortarse con `/desvincular` o revocarse desde la app.
4. **Confirmaciones y auditoría:** las escrituras sensibles llegan como tarjeta con botones Confirmar/Cancelar; al confirmar se ejecutan con el mismo ejecutor del agente y quedan en `ai_actions` con `origin: telegram` y `chat_id`. El piso duro aplica igual que en la app.

## Cron del agente proactivo y schedulers

- **Briefing diario:** el servicio `agent-proactivo-scheduler` de `docker-compose.yml` ejecuta `scripts/agent-proactive-scheduler.mjs`, que dispara una vez al día (06:00 America/Bogota por defecto, configurable con `AGENT_PROACTIVE_HOUR_BOGOTA`) contra `POST /api/cron/agente-proactivo` autenticado con `CRON_SECRET`. Genera briefings idempotentes por granja/día/tipo (`agent_briefings`) y los entrega en inbox, push y chats de Telegram vinculados.
- **Fuentes externas:** el servicio `external-sources-scheduler` ejecuta `scripts/external-sources-scheduler.mjs` contra `/api/cron/fuentes-externas` con el mismo `CRON_SECRET` e intervalo `EXTERNAL_SOURCES_SYNC_INTERVAL_MINUTES` (60 por defecto).
- **Sin Docker:** cualquier cron del sistema puede invocar los mismos endpoints con el header de autorización del `CRON_SECRET`; sin `CRON_SECRET` los schedulers se desactivan sin error.
- Los crons respetan el gating de módulos: un briefing nunca recomienda rutas bloqueadas para la escala de la granja.
