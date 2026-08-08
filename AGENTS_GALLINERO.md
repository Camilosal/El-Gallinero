# 🤖 AGENTS_GALLINERO.md — El Gallinero 🐔

Sistema de gestión para gallineros pequeños y medianos. Control integral del ciclo avícola: gallinas, pollos y gallos; producción e inventario de huevos por tamaño (PEPS); incubación; alimentación; gallinaza; ventas; egresos; sacrificio/carne; control sanitario y panel de finanzas con KPIs.

## 🏛️ Política de Infraestructura

1.  **Configuración Centralizada:**
    - El archivo [`docker-compose.yml`](../../docker-compose.yml) en la raíz del servidor es la fuente de verdad. El servicio es `gallinero_app` → contenedor `gallinero_web`.
    - El archivo [`.env`](../../.env) centraliza credenciales globales.
    - El archivo [`.env.local`](./.env.local) (excluido del repo) contiene la `DATABASE_URL` local del proyecto.
2.  **Uso de Skills:** Consultar prioritariamente [`.agent/skills/`](../../.agent/skills/) antes de tareas complejas.
3.  **Aislamiento de Cambios:** Trabajar dentro de `data/app_gallinero/`. No modificar infraestructura global sin consulta previa.
4.  **Preservación Estricta (Append-Only):** Al expandir archivos de código o conocimiento, inyectar subsecciones puntuales. No reescribir, resumir o eliminar bloques existentes a menos que se ordene explícitamente.

## ⚠️ Anti-Lazy Coding (Tolerancia Cero)

1.  **Completitud:** Si modificas una función o archivo, devuelve el código completo y funcional.
2.  **Calidad sobre Velocidad:** Es preferible consumir más tokens y entregar un archivo 100% listo para producción que un boceto incompleto.

## 🔧 Stack y Despliegue

- **Runtime:** Node.js 22 (contenedor), desarrollado con Node 22/24
- **Frontend/Backend:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- **ORM:** Drizzle ORM + PostgreSQL (`pg`)
- **Gráficos:** Recharts · **Tests:** Vitest
- **DB:** PostgreSQL 16 en host `sostenibilidad_db`, base de datos **`el_gallinero`**, user `admin`
- **Puerto host:** `127.0.0.1:4327` → contenedor `3000`
- **Dominio público:** `https://gallinero.iwage.co` (túnel Cloudflare → `127.0.0.1:4327`)

### Rebuild del Contenedor Web

Cada vez que se modifique el código fuente y se haga commit + push, se debe ejecutar:

```bash
docker compose -f /home/ubuntu/negocio/docker-compose.yml build gallinero_app
docker compose -f /home/ubuntu/negocio/docker-compose.yml up -d gallinero_app
```

### Aplicar cambios de esquema y sembrar datos

```bash
# Esquema (tablas) — el entrypoint ya lo hace en cada arranque
npm run db:push

# Datos demo idempotentes (admin/admin123)
npm run db:seed
```

## 🗄️ Base de Datos

- **Conexión:** `postgresql://admin:Pr%40yectos123@sostenibilidad_db:5432/el_gallinero` (URL-encoded; el `@` de la contraseña se codifica como `%40`).
- El `DATABASE_URL` del compose y del `.env.local` debe mantenerse igual. **No usar `${DB_PASSWORD}` sin URL-encoding** en la URL.
- Acesso directo:

```bash
PGPASSWORD='Pr@yectos123' psql -h 127.0.0.1 -U admin -d el_gallinero
```

- **Esquema:** `src/db/schema.ts` (25 tablas). Conexión: `src/db/index.ts` (lee `.env.local`). Seed: `src/db/seed.ts`.
- **Migas:** `drizzle-kit push` (no hay carpeta de migraciones versionadas).

## 🧩 Módulos y Rutas

| Módulo | Ruta | Funcionalidad |
|:--- |:--- |:--- |
| Dashboard | `/` | Gallinas activas, huevos esperados/real, ingresos, ganancia, FCR, gráficos 14d, proyección de stock, mant. pendientes, balance de gallos |
| Gallinas | `/produccion?tab=gallinas` | Registro individual, ciclo de vida (8 estados, etapa por edad), recomendación de sacrificio, filtros |
| Pollos y Gallos | `/produccion?tab=pollos` | Gallos reproductores (GA-###), lotes de engorde (L-###), balance de parvada 1:10 |
| Alimentación | `/produccion?tab=alimentacion` | Inventario, movimientos (bloqueo stock negativo), programas por etapa, proyección |
| Producción de Huevos | `/produccion?tab=huevos` | Recolección por tamaño, producción esperada, alerta de sobreproducción 1.5× |
| Inventario de Huevos | `/inventario` | Stock por tamaño PEPS, envejecimiento >21 días, valor estimado, lotes |
| Incubación | `/produccion?tab=incubacion` | Eclosión a 21 días, asignación automática de nacidos (hembras→gallinas, machos→déficit/lote) |
| Gallinaza | `/produccion?tab=gallinaza` | Factores de producción, stock con ajustes, ventas por presentación |
| Ventas | `/ventas` | Huevos multi-ítem por presentación + aves (por ave o kg); genera ingreso |
| Carne / Sacrificio | `/produccion?tab=carne` | Sacrificio por tipo, peso en canal, destino (consumo/venta/donación) |
| Egresos | `/egresos` | Gastos con presentación o general; alimentación vincula inventario |
| Mantenimiento | `/mantenimiento` | Tareas con costo; completar genera egreso automático (sin duplicados) |
| Control Sanitario | `/sanidad` | Eventos (vacunación, tratamiento…), productos, próximas aplicaciones |
| Finanzas | `/finanzas` | KPIs, gráficos de evolución, utilidad acumulada, distribución por categoría |
| Catálogos | `/catalogos` | Datos maestros (16 categorías) con activar/desactivar |

## 📐 Reglas de Negocio Clave

- **Ciclo de vida de la gallina:** etapa por edad (Pollito 0–6, Juvenil 6–18, Pre-postura 18–20, Postura 20+ semanas); estados terminales (vendida, faena, muerta) nunca se sobreescriben; ~80 semanas → recomendación de sacrificio.
- **Balance de parvada:** 1 gallo por cada 10 gallinas; machos nacidos cubren primero el déficit, el resto a lote de engorde.
- **Lotes de engorde:** listos a sacrificio al cumplir semanas objetivo o ≥2.5 kg promedio; baja de cantidad validada (0 ≤ actual ≤ inicial).
- **Inventario PEPS:** ventas descuentan del lote más antiguo por tamaño; >21 días genera alerta.
- **Producción esperada:** huevos/día = Σ(gallinas por etapa × factor del catálogo); alerta si real supera 1.5× lo esperado.
- **Alimentación:** bloqueo de stock negativo; consumo por etapa con g/gallina/día; proyección de días de stock.
- **Trazabilidad financiera:** cada venta, sacrificio, compra de alimento, mantenimiento y evento sanitario genera su transacción (`sourceType`/`sourceId`); al borrar el origen se revierte.

## 🧬 Modelo de Datos (resumen)

- **Aves:** `hens`, `roosters`, `broiler_batches`
- **Producción:** `egg_production` + `egg_production_details`, `incubation`
- **Comercial:** `egg_sales`, `egg_sales_items`, `chicken_sales`, `manure_sales`
- **Finanzas:** `transactions`
- **Apoyo:** `feed_inventory`, `feed_movements`, `feed_programs`, `maintenance`, `health_control`, `manure_factors`, `manure_inventory`, `manure_adjustments`, `catalogos`, `users`, `sessions`

## 🧠 Lógica de Negocio (libs)

- `src/lib/auth/` — sesiones y autenticación
- `src/lib/inventory/` — PEPS de huevos
- `src/lib/flock/` — ciclo de vida y balance de parvada
- `src/lib/lifecycle/` — etapas y estados
- `src/lib/manure/` — factores y stock de gallinaza
- `src/lib/birdExit/` — salidas de aves (venta/sacrificio)

## 🧪 Tests y Verificación

```bash
npm run test         # Vitest (suites en tests/)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

## 🔗 Proyectos Relacionados en el Servidor

| Proyecto | Descripción | Directorio |
|:--- |:--- |:--- |
| **Sostenty** | Carbon Intelligence & ESG | `data/app_sostenty/` |
| **Iwagé** | Inmobiliaria Rural | `data/app_inmobiliaria/` |

## 🌐 Túnel Cloudflare (gallinero.iwage.co)

- El túnel se gestiona de forma remota por token (`systemd cloudflared` con `--token`).
- El hostname `gallinero.iwage.co` se configura en el dashboard de Zero Trust → Networks → Tunnels → *tunnel* → Public Hostnames → servicio `http://localhost:4327` (o `http://127.0.0.1:4327`).
- El `CLOUDFLARE_API_TOKEN` del `.env` global solo tiene permisos de cache purge (no DNS ni túnel).
- Acceso local para pruebas: `http://127.0.0.1:4327`
- Acceso de producción: `https://gallinero.iwage.co`

## 👤 Acceso

El seed crea el usuario administrador:

- **Usuario:** `admin`
- **Contraseña:** `admin123`

## 📦 Scripts

| Script | Descripción |
|:--- |:--- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Compilar y servir en producción |
| `npm run db:push` | Aplicar esquema a la BD |
| `npm run db:seed` | Datos demo (idempotente) |
| `npm run db:generate` | Generar migración SQL |
| `npm run test` | Pruebas con vitest |
| `npm run typecheck` / `lint` | Verificación de tipos y estilo |
