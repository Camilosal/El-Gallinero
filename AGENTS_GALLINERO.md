# AGENTS_GALLINERO.md — El Gallinero

Guía técnica de referencia para colaboradores y agentes de código que trabajan en **este repositorio (`El Gallinero`)**: aplicación PWA *offline-first* para gestión integral multi-especie (gallinas ponedoras, pollos de engorde, gallos, codornices, patos, conejos y cuyes/curíes), inventarios PEPS, alimentación, sanidad, operaciones, finanzas, análisis y conectores ERP.

## 🏛️ Principios de Trabajo y Seguridad

1. **Autonomía del repositorio:** toda la configuración vive en este proyecto usando [`.env.example`](./.env.example) como plantilla hacia `.env.local` (desarrollo/pruebas) o `.env` (despliegue Docker). Nunca asumas archivos externos fuera del repositorio ni dependencias a otros servicios no declarados aquí.
2. **Cero secretos o datos privados versionados:** nunca escribas contraseñas, API keys, tokens, correos privados ni cadenas de conexión reales en código, migraciones o documentación.
3. **Solo datos sintéticos en semillas y pruebas:** `src/db/seed.ts`, `src/db/seed-config.ts` y `tests/` deben usar únicamente datos ficticios o estándares técnicos públicos.
4. **Calidad y completitud:** al modificar código o esquemas, entrega implementaciones completas, verificadas con `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build`.

## 🔧 Stack Tecnológico

- **Runtime:** Node.js ≥ 20.9 (contenedor `node:22-alpine`)
- **Framework:** Next.js 16 (App Router + Turbopack) + React 19 + TypeScript estricto
- **Estilos:** Tailwind CSS v4 + Lucide Icons + Recharts
- **Base de Datos y ORM:** PostgreSQL ≥ 14 + Drizzle ORM (`pg`) + políticas RLS multi-tenant (`gallinero_tenant_role`)
- **Tests:** Vitest (`tests/*.test.ts`) y Playwright (`e2e`)

## 🐳 Despliegue Local con Docker

```bash
# Levantar PostgreSQL + aplicación (ejecuta db:bootstrap al arrancar si AUTO_MIGRATE_ON_BOOT=true)
ADMIN_USERNAME='admin' ADMIN_PASSWORD='elige-una-clave-segura-de-12-caracteres' docker compose up -d --build

# Ver logs
docker compose logs -f app

# Reconstruir tras cambios de código (docker compose restart NO recompila la imagen)
docker compose build --no-cache app && docker compose up -d app
```

- La imagen de producción expone el puerto `3000` (`PORT` configurable).
- Todas las variables de entorno soportadas por la aplicación y el `compose` están documentadas en [`.env.example`](./.env.example).

## 🗄️ Base de Datos, Migraciones y Semillas

- **Esquema Drizzle:** `src/db/schema.ts`
- **Conexión y contexto RLS:** `src/db/index.ts` (carga `.env.local` en local) y `src/db/tenant-context.ts`
- **Migraciones unificadas (`drizzle/`):**
  - `drizzle/0000_baseline.sql`: tablas, enums, llaves foráneas e índices generados desde `src/db/schema.ts`.
  - `drizzle/0001_roles_constraints_and_rls.sql`: rol `gallinero_tenant_role`, restricciones `CHECK`, índices parciales y políticas RLS por granja.
  - `src/db/migrate-prod.ts`: ejecuta las migraciones pendientes y adopta automáticamente el baseline en bases existentes.
- **Semilla base obligatoria (idempotente):** `src/db/seed-config.ts` (`runCoreSeed`) crea la granja inicial, suscripción, configuración base, catálogos maestros, parámetros por especie, estándares de peso, vacunas, factores de compostaje y alimentos/planes iniciales.
- **Seed de demostración (destructivo, bloqueado en producción):** `src/db/seed.ts` requiere `--allow-destructive` y `DEMO_ADMIN_PASSWORD` ≥ 12 caracteres.

### Comandos de base de datos

```bash
# Inicializar o actualizar esquema + roles/RLS + semilla base (+ admin opcional si defines ADMIN_USERNAME/ADMIN_PASSWORD)
npm run db:bootstrap

# Crear primer administrador por separado (mín. 12 caracteres; falla si ya existen usuarios)
ADMIN_USERNAME='admin' ADMIN_PASSWORD='elige-una-clave-segura-de-12-caracteres' npm run db:create-admin

# Solo en base local descartable de pruebas: cargar datos demo
DEMO_ADMIN_PASSWORD='elige-una-clave-segura-de-12-caracteres' npm run db:seed -- --allow-destructive
```

- Rotación y recuperación de administrador: `npm run db:rotate-admin-password` y `npm run db:issue-admin-recovery-code`.

## 🧩 Módulos y Rutas Principales

| Módulo | Ruta principal | Funcionalidad |
|:--- |:--- |:--- |
| Tablero Inicio | `/inicio` | Resumen diario, alertas biológicas, tareas verificables y captura rápida |
| Animales y Lugares | `/animales`, `/ubicaciones` | Inventario multi-especie (6 especies), lotes, ejemplares, traslados y capacidad |
| Producción | `/produccion` | Postura NTC 1240 (`huevos`), `pollos`, `gallinas`, `incubacion`, `alimentacion`, `peso`, `mortalidad`, `sacrificio`, `plan-parvada` |
| Inventarios | `/inventarios` | Stock PEPS/FIFO de `huevos`, `carne`, `alimentacion`, `insumos`, `gallinaza` y `balance` |
| Almacén y Operaciones | `/almacen`, `/operaciones` | Raciones, activos (`activos`), `mantenimiento`, `compostaje`, `cierre` diario auditable y sensores IoT |
| Planeación y Soberanía | `/planeacion`, `/soberania` | Calendario Maestro de rutinas (`/planeacion/calendario`) y autoconsumo/soberanía alimentaria |
| Sanidad | `/sanidad` | `control` con bloqueo por retiro, `calendario` vacunal, `alertas` y `bioseguridad` |
| Finanzas y Contactos | `/finanzas`, `/contactos` | `ventas`, `egresos`, `finanzas`, `cuentas` CxC/CxP, `presupuestos` y directorio comercial |
| Análisis y Exportación | `/analisis`, `/exportar` | KPIs, curvas (`razas`), `fuentes-externas`, `normas`, `reportes`, descarga CSV/XLSX y tokens para `/api/v1/integrations/*` |
| Herramientas y Config | `/escanear`, `/configuracion` | Escáner QR de campo, manuales (`/guia`, `/manual`), `usuarios`, `granjas`, `modulos`, `catalogos`, `plan`, `kit-campo`, `fallas` |

## 📐 Reglas de Negocio Clave

- **Ciclo de vida:** etapa automática por edad (Pollito, Juvenil, Pre-postura, Postura); estados terminales (vendida, faena, muerta) nunca se sobreescriben.
- **Balance e incubación:** control de balance macho/hembra y trazabilidad genética con bloqueo de consanguinidad en 3 generaciones.
- **Inventario PEPS/FIFO:** ventas descuentan del lote más antiguo por tamaño; alertas por envejecimiento (>21 días).
- **Retiro sanitario:** candados automáticos impiden comercializar huevos o carne durante periodo de carencia farmacológica.
- **Trazabilidad financiera:** cada venta, sacrificio, compra, mantenimiento y evento sanitario genera su transacción asociada (`sourceType`/`sourceId`).

## 🧠 Lógica de Negocio (`src/lib/`)

- `src/lib/auth.ts` — hashing de contraseñas y gestión de sesiones
- `src/lib/inventory.ts` — lógica de stock y PEPS de huevos
- `src/lib/flock.ts`, `src/lib/lifecycle.ts` — ciclo de vida y balance de parvada
- `src/lib/manure.ts`, `src/lib/feeding/` — compostaje y planes de alimentación multi-especie
- `src/lib/sanitary-locks.ts`, `src/lib/ntc1240.ts`, `src/lib/birdExit.ts` — reglas normativas y salidas
- `src/lib/export.ts`, `src/lib/integrations/` — exportadores CSV/XLSX y API v1 de conectores ERP
- `src/lib/agent/` — asistente operativa Gina (chat, OCR y STT)

## 📦 Scripts (`package.json`)

| Script | Descripción |
|:--- |:--- |
| `npm run dev` | Servidor de desarrollo (`http://localhost:3000`) |
| `npm run build` / `start` | Compilar y servir en producción |
| `npm run db:bootstrap` | Migraciones unificadas + semilla base + admin opcional |
| `npm run db:migrate` | Aplicar migraciones SQL de `drizzle/` |
| `npm run db:seed-config` | Semilla base obligatoria e idempotente |
| `npm run db:seed` | Datos demo (`--allow-destructive`, solo BD local descartable) |
| `npm run db:generate` | Generar nueva migración SQL en `drizzle/` |
| `npm run db:push` | Sincronización rápida de esquema en desarrollo |
| `npm run db:create-admin` | Crear primer usuario administrador |
| `npm run db:rotate-admin-password` | Rotar contraseña de administrador y revocar sesiones |
| `npm run db:issue-admin-recovery-code` | Emitir código de recuperación de un solo uso |
| `npm run typecheck` / `lint` | Verificación estricta de TypeScript y ESLint |
| `npm run test` / `e2e` | Pruebas Vitest (`tests/`) y E2E Playwright |
