# 🤖 AGENTS_GALLINERO.md — El Gallinero 🐔

Sistema de gestión para gallineros pequeños y medianos. Control integral del ciclo avícola: gallinas, pollos y gallos; producción e inventario de huevos por tamaño (PEPS); incubación; alimentación; gallinaza; ventas; egresos; sacrificio/carne; control sanitario y panel de finanzas con KPIs.

## 🏛️ Política de Infraestructura

1.  **Configuración Centralizada:**
    - El archivo [`docker-compose.yml`](../../docker-compose.yml) en la raíz del repositorio está pensado para usuarios que descargan el proyecto y desean desplegar rápidamente en su entorno local. Para operaciones internas del servidor (despliegue, pruebas y desarrollo en el entorno de producción interna), se utiliza el `docker-compose.yml` del sistema general ubicado en `/home/ubuntu/negocio/docker-compose.yml`. Ese archivo define servicios como `gallinero_app`, `sostenibilidad_db`, etc., en la red Docker unificada.
    - El archivo [`.env`](../../.env) centraliza credenciales globales para el entorno interno.
    - El archivo [`.env.local`](./.env.local) (excluido del repo) contiene la `DATABASE_URL` local del proyecto para desarrollo individual.
2.  **Uso de Skills:** Consultar prioritariamente [`.agent/skills/`](../../.agent/skills/) antes de tareas complejas.
3.  **Aislamiento de Cambios:** Trabajar dentro de `data/app_gallinero/`. No modificar infraestructura global sin consulta previa.
4.  **Preservación Estricta (Append-Only):** Al expandir archivos de código o conocimiento, inyectar subsecciones puntuales. No reescribir, resumir o eliminar bloques existentes a menos que se ordene explícitamente.

## ⚠️ Anti-Lazy Coding (Tolerancia Cero)

1.  **Completitud:** Si modificas una función o archivo, devuelve el código completo y funcional.
2.  **Calidad sobre Velocidad:** Es preferible consumir más tokens y entregar un archivo 100% listo para producción que un boceto incompleto.

## 🚨 PRÁCTICAS CRÍTICAS (LEER ANTES DE CUALQUIER CAMBIO)

### 1. Reconstrucción de Contenedores Docker

**PROBLEMA FRECUENTE:** Después de modificar código fuente, hacer `docker compose restart` NO aplica los cambios. El contenedor sigue usando el código antiguo.

**SOLUCIÓN CORRECTA:**
```bash
# ❌ INCORRECTO (no aplica cambios de código)
docker compose restart gallinero_app

# ✅ CORRECTO (reconstruye y recrea el contenedor)
docker compose down gallinero_app
docker compose build --no-cache gallinero_app
docker compose up -d gallinero_app
```

**VERIFICAR QUE LOS CAMBIOS SE APLICARON:**
```bash
# Entrar al contenedor y verificar el código fuente
docker exec gallinero_web cat /app/src/app/\(app\)/page.tsx | grep "texto_que_cambiaste"

# Si no aparece el cambio, el contenedor no se actualizó correctamente
```

**POR QUÉ FALLA:**
- `restart` solo reinicia el contenedor existente con la imagen antigua
- `build` crea una nueva imagen pero no actualiza el contenedor en ejecución
- `down` + `up -d` asegura que el contenedor se recrea con la nueva imagen

### 2. Configuración de Red y Contenedores

**RED DOCKER UNIFICADA:**
- Todos los contenedores están en la red `negocio_negocio_default`
- Los contenedores se comunican entre sí usando nombres de servicio (no IPs)
- La base de datos `sostenibilidad_db` es accesible desde cualquier contenedor en la red

**NOMBRES Y PUERTOS CLAVE:**

| Servicio | Nombre Contenedor | Puerto Host | Puerto Contenedor | Red |
|:---|:---|:---|:---|:---|
| **Gallinero App** | `gallinero_web` | `127.0.0.1:4327` | `3000` | `negocio_negocio_default` |
| **Base de Datos** | `sostenibilidad_db` | `127.0.0.1:5432` | `5432` | `negocio_negocio_default` |
| **Strapi (Marca Personal)** | `marca_personal_strapi` | `127.0.0.1:1337` | `1337` | `negocio_negocio_default` |
| **Redis** | `redis_app` | `127.0.0.1:6379` | `6379` | `negocio_negocio_default` |

**COMUNICACIÓN ENTRE CONTENEDORES:**
```bash
# Desde gallinero_web a sostenibilidad_db
DATABASE_URL=postgresql://admin:password@sostenibilidad_db:5432/el_gallinero
# ✅ Usa el nombre del servicio, NO la IP

# Desde gallinero_web a redis_app
REDIS_URL=redis://redis_app:6379
# ✅ Usa el nombre del servicio, NO localhost
```

### 3. Túnel Cloudflare

**CONFIGURACIÓN:**
- Dominio público: `https://gallinero.iwage.co`
- Túnel Cloudflare apunta a: `http://127.0.0.1:4327`
- El túnel se gestiona con `systemd cloudflared` usando token
- Configuración en: Zero Trust → Networks → Tunnels → Public Hostnames

**ACCESO:**
- **Producción:** `https://gallinero.iwage.co` (a través del túnel)
- **Local (pruebas):** `http://127.0.0.1:4327` (directo al host)
- **Desde otros contenedores:** `http://gallinero_web:3000` (red Docker interna)

**IMPORTANTE:**
- El túnel NO expone otros puertos, solo el 4327
- Para acceder a la base de datos desde fuera, usar el puerto 5432 del host
- Los cambios en el túnel se hacen en el dashboard de Cloudflare, no en el servidor

### 4. Base de Datos

**CONEXIÓN DESDE EL HOST:**
```bash
PGPASSWORD='Pr@yectos123' psql -h 127.0.0.1 -U admin -d el_gallinero
```

**CONEXIÓN DESDE DENTRO DEL CONTENEDOR GALLINERO:**
```bash
docker exec -it gallinero_web sh
# Dentro del contenedor:
PGPASSWORD='Pr@yectos123' psql -h sostenibilidad_db -U admin -d el_gallinero
```

**CONEXIÓN DESDE OTROS CONTENEDORES EN LA RED:**
```bash
postgresql://admin:Pr%40yectos123@sostenibilidad_db:5432/el_gallinero
# Nota: @ en password se codifica como %40
```

### 5. Strapi (CMS de Marca Personal)

**CONFIGURACIÓN:**
- Contenedor: `marca_personal_strapi`
- Puerto: `127.0.0.1:1337`
- Base de datos: `marca_personal` (en `sostenibilidad_db`)
- Directorio: `/home/ubuntu/negocio/data/app_marca_personal/strapi`

**ACCESO:**
- Admin: `http://127.0.0.1:1337/admin`
- API: `http://127.0.0.1:1337/api`

**RECONSTRUIR STRAPI:**
```bash
docker compose down marca_personal_strapi
docker compose build --no-cache marca_personal_strapi
docker compose up -d marca_personal_strapi
```

### 6. Comandos Docker Esenciales

**VER ESTADO DE CONTENEDORES:**
```bash
docker compose ps
docker ps | grep gallinero
```

**VER LOGS EN TIEMPO REAL:**
```bash
docker compose logs -f gallinero_app
docker logs -f gallinero_web
```

**EJECUTAR COMANDOS DENTRO DEL CONTENEDOR:**
```bash
docker exec -it gallinero_web sh
# Luego puedes ejecutar: npm run, node, etc.
```

**INSPECCIONAR RED:**
```bash
docker network inspect negocio_negocio_default
```

**LIMPIAR CACHE DE BUILD:**
```bash
docker builder prune -a
# Libera espacio de imágenes antiguas
```

### 7. Flujo de Trabajo Correcto para Cambios de Código

1. **Modificar código fuente** en `/home/ubuntu/negocio/data/app_gallinero/src/`
2. **Verificar localmente** (opcional): `npm run build`
3. **Reconstruir contenedor:**
   ```bash
   cd /home/ubuntu/negocio
   docker compose down gallinero_app
   docker compose build --no-cache gallinero_app
   docker compose up -d gallinero_app
   ```
4. **Verificar que los cambios se aplicaron:**
   ```bash
   docker exec gallinero_web grep "cambio_clave" /app/src/app/archivo.tsx
   ```
5. **Probar en el navegador** (hacer refresh duro: Ctrl+Shift+R)

**SI LOS CAMBIOS NO SE VEN:**
- Verificar que el archivo fuente local tiene los cambios
- Verificar que el contenedor tiene los cambios (paso 4)
- Si el contenedor no tiene los cambios, repetir desde el paso 3
- Limpiar caché del navegador o usar ventana incógnito

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
