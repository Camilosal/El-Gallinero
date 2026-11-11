# El Gallinero 🐔

Sistema de gestión para **gallineros pequeños y medianos**: control integral del ciclo avícola — gallinas, pollos y gallos; producción e inventario de huevos por tamaño (PEPS); incubación; alimentación con programas por etapa; gallinaza; ventas con presentaciones; egresos; sacrificio/carne; control sanitario y un panel de finanzas con KPIs y comportamiento en el tiempo.

Todas las operaciones comerciales y de mantenimiento **alimentan automáticamente las finanzas** (cada venta, sacrificio, compra de alimento, tarea de mantenimiento o evento sanitario genera su transacción, con trazabilidad a su fuente).

## Requisitos

- **Node.js ≥ 20.9** (desarrollado con Node 22/24)
- **PostgreSQL** (cualquier versión reciente; desarrollado con la 14)
- **npm**

## Instalación

```bash
git clone https://github.com/Camilosal/El-Gallinero
cd El-Gallinero
npm install
```

### Configurar la base de datos

1. Crea la base de datos en Postgres (ajusta usuario/contraseña a tu entorno):

```bash
createdb app_db
```

2. Copia el archivo de entorno y edítalo con tu conexión:

```bash
cp .env.example .env.local
```

```env
DATABASE_URL=postgresql://TU_USUARIO:TU_CONTRASENA@127.0.0.1:5432/app_db
```

> `.env.local` está excluido del repo por seguridad; cada quien crea el suyo.

### Crear tablas y sembrar datos

```bash
npm run db:push     # crea las tablas (drizzle-kit push)
DEMO_ADMIN_PASSWORD='elige-una-clave-de-12-caracteres' npm run db:seed -- --allow-destructive
```

El seed elimina y recrea datos; está bloqueado en `NODE_ENV=production`. Úsalo solo en una base local descartable.

### Arrancar

```bash
npm run dev         # modo desarrollo → http://localhost:3000
```

Para producción:

```bash
npm run build && npm start
```

## Ejecución local con Docker Compose

Compose levanta la aplicación Next.js y PostgreSQL para desarrollo local. La primera vez, inicializa el esquema explícitamente y luego arranca la aplicación:

```bash
docker compose --profile migrate run --rm migrate
docker compose run --rm -e ADMIN_USERNAME='admin' -e ADMIN_PASSWORD='elige-una-clave-segura-de-12-caracteres' --entrypoint npm app run db:create-admin
docker compose up -d
```

La aplicación queda en `http://localhost:3000`; PostgreSQL solo se publica en `127.0.0.1:5432`. El perfil `migrate` usa una imagen de herramientas de desarrollo y solo corre cuando se invoca explícitamente. La imagen de la aplicación contiene dependencias de producción y `tsx` para sus tareas operativas; no incluye archivos `.env` ni altera el esquema al arrancar.

## Acceso inicial

En producción, crea el primer administrador después de aplicar el esquema con `npm run db:create-admin`, proporcionando `ADMIN_USERNAME` y `ADMIN_PASSWORD` como variables de entorno. La contraseña debe tener al menos 12 caracteres. El comando solo funciona si todavía no existen usuarios y no modifica cuentas existentes. Para datos de demostración local, el seed usa el usuario `Camilosal` y la contraseña indicada en `DEMO_ADMIN_PASSWORD`.

Si una instalación ya usó el seed antiguo, cambia la contraseña con `npm run db:rotate-admin-password`; el comando invalida las sesiones abiertas de esa cuenta.

Para habilitar la recuperación desde la pantalla de acceso, aplica `scripts/add_admin_recovery_code.sql` y emite un código de un solo uso con `ADMIN_USERNAME='admin' npm run db:issue-admin-recovery-code`. Guarda el código cuando se muestre: solo se almacena su hash, vence a los 30 días y se invalida al cambiar la contraseña.

## Módulos

La navegación está agrupada en **7 secciones** con páginas índice que muestran KPIs en tiempo real y accesos rápidos a sub-módulos:

### 🐔 Producción (`/produccion`)
Página índice con KPIs: huevos hoy, huevos semana, gallinas activas, mortalidad semana, consumo de alimento.

| Sub-módulo | Ruta | Funcionalidades |
| --- | --- | --- |
| Gallinas | `/produccion/gallinas` | Registro individual (código, raza, nacimiento, peso, estado, notas); ciclo de vida automático: 8 estados y etapa por edad (pollito → postura); detección de gallinas recomendadas a sacrificio y aviso de motivos; filtros por estado y etapa; edición y eliminación |
| Pollos y Gallos | `/produccion/pollos` | Gallos reproductores (código `GA-###` autogenerado) y lotes de engorde (código `L-###`); balance de parvada con alerta de gallos faltantes (1 por cada 10 gallinas); lotes pasan a "listo sacrificio" al alcanzar semanas o peso objetivo |
| Adquisiciones | `/produccion/adquisiciones` | Entrada de aves al sistema |
| Alimentación | `/produccion/alimentacion` | Inventario de alimentos (categoría, tipo, stock mín/máx, costo, proveedor) con alerta de stock bajo; movimientos de entrada/salida por etapa (bloquea stock negativo); programas de alimentación por etapa (% dieta y g/ave/día); proyección de stock con días restantes y actualización de mínimo sugerido; comparativo planificado vs real (7/14/21/30d) con gráfico; **predicción de stock** (14–365d): fecha de agotamiento, reposición sugerida, compra recomendada y gráfico de evolución por alimento |
| Producción de Huevos | `/produccion/huevos` | Recolección diaria por **tamaño de huevo** (precios del catálogo), rotos y para incubación, con total en vivo; comparación contra producción esperada por etapa (rendimiento %); validación de sobreproducción (1.5× lo esperado) con confirmación; gráfico apilado por tamaño con proyección |
| Incubación | `/produccion/incubacion` | Registro de incubaciones con eclosión a los 21 días y gallina clueca; **asignación automática de nacidos**: hembras → nuevas gallinas, machos → cubren déficit de gallos o lote de engorde; tasa de eclosión (%); historial y métricas |
| Carne / Sacrificio | `/produccion/sacrificio` | Registro de sacrificio por tipo de ave (gallina descarte, pollo, gallo) con pre-selección de la recomendada; peso en canal, destino (consumo, venta, donación); si se vende crea ingreso; revierte estados de las aves |
| Mortalidad | `/produccion/mortalidad` | Registro de bajas por lote |
| Plan Parvada | `/produccion/plan-parvada` | Proyecciones y planificación de la parvada |

### 📦 Inventarios (`/inventarios`)
Página índice con KPIs de stock consolidado.

| Sub-módulo | Ruta | Funcionalidades |
| --- | --- | --- |
| Inventario Huevos | `/inventarios/huevos` | Stock por tamaño (producidos − vendidos) con **PEPS** por talla; edad/envejecimiento con alerta de >21 días; valor estimado en dinero (disponible × precio catálogo); lotes con estado (disponible / vender pronto / por vencer / agotado) |
| Balance de Inventario | `/inventarios/balance` | Balance consolidado de entradas y salidas |
| Insumos | `/inventarios/insumos` | Inventario de insumos (alimento, medicamentos, empaques) |

### 💊 Sanidad (`/sanidad`)
Plan Sanitario proactivo con protocolos por etapa de crecimiento, ejecución con control de recursos y trazabilidad completa.

| Sub-módulo | Ruta | Funcionalidades |
| --- | --- | --- |
| Plan Sanitario | `/sanidad` | **Sistema proactivo** con 5 pestañas: Plan de Acción (pendientes por urgencia), Protocolos por Etapa (Pollito, Juvenil, Pre-postura, Postura con acciones definidas), Ejecutar (confirma recursos y aplica), Historial (registro completo), Recursos (inventario de insumos sanitarios). Genera eventos automáticamente en el calendario según los protocolos de cada etapa. |
| Control Sanitario | `/sanidad/control` | Eventos manuales (vacunación, desparasitación, tratamiento, inspección, fumigación, vitaminas) con producto, costo y próxima aplicación. Pre-llenado automático desde eventos pendientes del calendario. |
| Calendario Sanitario | `/sanidad/calendario` | Calendario de eventos sanitarios programados (automáticos y manuales). Eventos vencidos en rojo, próximos en amarillo. |
| Alertas | `/sanidad/alertas` | Monitoreo automático de transiciones de etapa, vacunación pendiente y niveles de producción. |

### 🔧 Operaciones (`/operaciones`)
Página índice con accesos rápidos a mantenimiento y gallinaza.

| Sub-módulo | Ruta | Funcionalidades |
| --- | --- | --- |
| Mantenimiento | `/operaciones/mantenimiento` | Tareas del gallinero con estado (pendiente/en progreso/completado), costo y plantillas rápidas; al completar con costo genera egreso automático (sin duplicados al editar) |
| Gallinaza | `/operaciones/gallinaza` | Factores de producción por grupo (etapas, gallos, lotes) para estimar kg/día; acumulación de stock con ajustes (± con motivo); ventas con presentación (bulto/costal/granel) que descuentan stock y generan ingreso |

### 💰 Finanzas (`/finanzas`)
Página índice con KPIs financieros.

| Sub-módulo | Ruta | Funcionalidades |
| --- | --- | --- |
| Ventas | `/finanzas/ventas` | **Huevos**: ventas multi-ítem por tamaño y presentación (unidad, docena, media docena, bandeja/cubeta) con precios del catálogo y total en vivo; validación de disponibilidad por talla. **Aves**: gallinas/gallos/lotes con precio por ave o por kg. Cada venta crea su ingreso y actualiza inventario/estados |
| Egresos | `/finanzas/egresos` | Registro de gastos en dos modos: **compra con presentación** (categorías de compra; para alimento vincula el inventario y convierte a unidad base) y **general** (cantidad × valor o monto manual); métricas, gráfico por fecha y desglose por categoría |
| Finanzas | `/finanzas/finanzas` | Panel con KPIs (ingresos, egresos, utilidad, promedios diarios, flujo neto) e insights (mejor/peor día, margen, proyección mensual); gráficos de evolución temporal, utilidad acumulada y distribución por categoría (períodos 7/30/90/365); historial completo con nueva transacción manual |
| Presupuestos | `/finanzas/presupuestos` | Planificación financiera y presupuestos |
| Cuentas | `/finanzas/cuentas` | Cuentas por cobrar y cuentas por pagar |

### 📊 Análisis (`/analisis`)
Página índice con accesos rápidos a KPIs y reportes.

| Sub-módulo | Ruta | Funcionalidades |
| --- | --- | --- |
| KPIs | `/analisis/kpis` | Indicadores clave de productividad, mortalidad, conversión alimenticia |
| Reportes | `/analisis/reportes` | Reportes exportables del sistema |

### 🗂️ Configuración (`/configuracion`)
Página índice con accesos rápidos a catálogos.

| Sub-módulo | Ruta | Funcionalidades |
| --- | --- | --- |
| Catálogos | `/configuracion/catalogos` | Datos maestros (16 categorías): tamaños de huevo con precio, presentaciones con unidades/factores, razas, compradores, proveedores, unidades de medida, categorías de ingreso/egreso, tipos de sanidad/mantenimiento… Con activar/desactivar y orden |

## Reglas de negocio clave

- **Ciclo de vida de la gallina**: etapa según edad (Pollito 0–6, Juvenil 6–18, Pre-postura 18–20, Postura 20+ semanas); estados terminales (vendida, faena, muerta) nunca se sobreescriben; a los ~80 semanas se recomienda sacrificio.
- **Balance de parvada**: 1 gallo por cada 10 gallinas; los machos nacidos cubren primero el déficit y el resto pasa a lote de engorde.
- **Lotes de engorde**: listos a sacrificio al cumplir semanas objetivo o ≥2.5 kg promedio; baja de cantidad validada (0 ≤ actual ≤ inicial).
- **Inventario de huevos PEPS**: las ventas se descuentan del lote más antiguo de cada tamaño; huevos con más de 21 días generan alerta.
- **Producción esperada**: huevos/día = Σ(gallinas por etapa × factor del catálogo); rendimiento % contra lo real y alerta si supera 1.5×.
- **Alimentación**: bloqueo de stock negativo; consumo registrado por etapa con gramos/gallina/día; proyección de días de stock.
- **Plan Sanitario**: protocolos por etapa (Pollito, Juvenil, Pre-postura, Postura) con acciones de vacunación, desparasitación y vitaminas. Genera eventos en el calendario, verifica recursos disponibles y registra períodos de carencia.
- **Trazabilidad financiera**: cada venta, sacrificio, compra de alimento, mantenimiento completado y evento sanitario con costo crea su transacción automáticamente (`sourceType`/`sourceId`); al borrar el origen se revierte la transacción.

## Guía de usuario integrada

El sistema incluye una **guía de usuario completa** accesible desde el sidebar (botón 📖). Contiene guías paso a paso para cada módulo con:
- Diagramas de flujo visuales (arquitectura del sistema, ciclo de vida, flujos de producción, integración financiera)
- Instrucciones detalladas para cada tarea
- Tips, advertencias y notas
- Enlaces directos a la aplicación

## Diagramas de arquitectura

### Flujo de Producción de Huevos
```mermaid
flowchart TD
    A[🐔 Gallina] -->|Pone huevo| B[🥚 Recolección]
    B -->|Clasificar| C[📏 Tamaño: P, M, G, XL, XXL]
    C -->|Almacena| D[📦 Inventario PEPS]
    D -->|Venta| E[💰 Ingreso automático]
    D -->|Incubación| F[🐣 21 días → Pollitos]
    D -->|>21 días| G[⚠️ Alerta vencimiento]
    E --> H[📈 Finanzas]
```

### Ciclo de Vida de la Gallina
```mermaid
flowchart LR
    A[🐤 Pollito\n0–6 sem] -->|6 sem| B[🐔 Juvenil\n6–18 sem]
    B -->|18 sem| C[🥚 Pre-postura\n18–20 sem]
    C -->|20 sem| D[🐔 Postura\n20+ sem]
    D -->|≥80 sem Y ≥2.5kg| E[⚠️ Rec. Sacrificio]
    D -->|Vendida| F[Terminal]
    D -->|Muerta| G[Terminal]
```

### Plan Sanitario Proactivo
```mermaid
flowchart TD
    A[📋 Protocolos por Etapa] -->|Genera| B[📅 Eventos en Calendario]
    B -->|Vencimiento próximo| C[🔔 Alerta de Acción]
    C -->|Verifica recursos| D[✅ Ejecutar Acción]
    D -->|Confirma insumos| E[📊 Historial Sanitario]
    D -->|Deduce stock| F[📦 Inventario Insumos]
    F -->|Stock bajo| G[⚠️ Alerta Reposición]
```

### Integración Automática de Finanzas
```mermaid
flowchart TD
    A[💰 Venta] -->|Ingreso| T[📝 Transacción]
    B[🛒 Compra Alimento] -->|Egreso| T
    C[🔧 Mantenimiento] -->|Egreso| T
    D[💊 Evento Sanitario] -->|Egreso| T
    E[🌱 Venta Gallinaza] -->|Ingreso| T
    T --> F[📈 KPIs y Gráficos]
    T --> G[💵 Balance Financiero]
    G --> H[📊 Análisis]
```

## Estructura del proyecto

```
├── src/
│   ├── app/
│   │   ├── dashboard/                    # Páginas del sistema agrupadas por sección
│   │   │   ├── page.tsx              # Dashboard principal (4 tarjetas/día, KPIs, gráficos)
│   │   │   ├── produccion/           # 🐔 Producción
│   │   │   │   ├── page.tsx          # Índice con tabs (Huevos, Gallinas, Pollos, Alimentación, Incubación, Carne, Gallinaza, Inventario)
│   │   │   │   ├── gallinas/         # Gestión de gallinas + detalle individual
│   │   │   │   ├── pollos/           # Pollos y gallos
│   │   │   │   ├── adquisiciones/    # Entrada de aves
│   │   │   │   ├── alimentacion/     # Programas y consumo (5 tabs)
│   │   │   │   ├── huevos/           # Producción de huevos
│   │   │   │   ├── incubacion/       # Incubación
│   │   │   │   ├── sacrificio/       # Carne
│   │   │   │   ├── mortalidad/       # Bajas
│   │   │   │   ├── peso/             # Seguimiento de peso
│   │   │   │   └── plan-parvada/     # Proyecciones
│   │   │   ├── inventarios/          # 📦 Inventarios
│   │   │   │   ├── page.tsx          # Índice con KPIs de stock
│   │   │   │   ├── huevos/           # Inventario PEPS de huevos
│   │   │   │   ├── carne/            # Inventario FIFO de carne
│   │   │   │   ├── gallinaza/        # Inventario de gallinaza
│   │   │   │   ├── balance/          # Balance consolidado
│   │   │   │   └── insumos/          # Insumos (alimento, medicamentos, empaques)
│   │   │   ├── sanidad/              # 💊 Sanidad
│   │   │   │   ├── page.tsx          # Plan Sanitario proactivo (5 tabs)
│   │   │   │   ├── _components/
│   │   │   │   │   └── PlanSanitarioTab.tsx  # Plan de Acción, Protocolos, Ejecutar, Historial, Recursos
│   │   │   │   ├── control/          # Control sanitario manual
│   │   │   │   ├── calendario/       # Calendario sanitario
│   │   │   │   └── alertas/          # Alertas automáticas
│   │   │   ├── operaciones/          # 🔧 Operaciones
│   │   │   │   ├── page.tsx          # Índice
│   │   │   │   ├── mantenimiento/    # Tareas y equipos
│   │   │   │   └── gallinaza/        # Factores y ajustes
│   │   │   ├── finanzas/             # 💰 Finanzas
│   │   │   │   ├── page.tsx          # Índice con KPIs financieros
│   │   │   │   ├── ventas/           # Ventas (huevos, aves, carne, gallinaza)
│   │   │   │   ├── egresos/          # Gastos (compra con presentación + general)
│   │   │   │   ├── finanzas/         # Panel financiero (KPIs, gráficos, proyección)
│   │   │   │   ├── presupuestos/     # Planificación
│   │   │   │   └── cuentas/          # CxC yCxP
│   │   │   ├── analisis/             # 📊 Análisis
│   │   │   │   ├── page.tsx          # Índice
│   │   │   │   ├── kpis/             # Indicadores clave
│   │   │   │   ├── razas/            # Estándares de raza
│   │   │   │   └── reportes/         # Reportes exportables
│   │   │   ├── configuracion/        # ⚙️ Configuración
│   │   │   │   ├── page.tsx          # Índice
│   │   │   │   └── catalogos/        # Datos maestros (16 categorías)
│   │   │   ├── escanear/             # 📷 Escáner QR de aves
│   │   │   └── guia/                 # 📖 Guía de usuario integrada
│   │   │       ├── page.tsx          # Índice de guías por módulo
│   │   │       └── [slug]/           # Vista de guía individual con diagramas
│   │   ├── api/                      # API Routes (Next.js)
│   │   │   ├── auth/                 # login, logout, me
│   │   │   ├── produccion/           # APIs de producción
│   │   │   ├── inventarios/          # APIs de inventarios
│   │   │   ├── sanidad/              # APIs de sanidad (calendario, plan, control, resumen)
│   │   │   ├── operaciones/          # APIs de operaciones
│   │   │   ├── finanzas/             # APIs de finanzas
│   │   │   ├── analisis/             # APIs de análisis
│   │   │   └── configuracion/        # APIs de configuración
│   │   ├── login/                    # Página de acceso
│   │   └── layout.tsx
│   ├── components/                   # Sidebar, UI (Card, StatCard, Modal, Table, renderHelpText…)
│   ├── db/
│   │   ├── schema.ts                 # Modelo de datos (25+ tablas, Drizzle ORM)
│   │   ├── seed.ts                   # Datos demo destructivos, protegidos por confirmación
│   │   └── index.ts                  # Conexión a Postgres
│   └── lib/                          # auth, inventory (PEPS), lifecycle, flock, guide-data, vaccination-schedules
├── docs/                             # Especificaciones y planes de diseño
├── tests/                            # Pruebas de flujo (vitest)
└── drizzle.config.ts
```

## Modelo de datos (resumen)

- **Aves:** `hens`, `roosters`, `broiler_batches`
- **Producción:** `egg_production` + `egg_production_details` (por tamaño), `incubation`
- **Comercial:** `egg_sales`, `egg_sales_items`, `chicken_sales`, `manure_sales`
- **Finanzas:** `transactions` (ingresos y egresos, enlazadas a su fuente)
- **Sanidad:** `sanitary_calendar` (eventos programados), `health_control` (ejecuciones), `flock_plans` + `flock_plan_milestones` (planes proactivos)
- **Apoyo:** `feed_inventory`, `feed_movements`, `feed_programs`, `supply_inventory`, `supply_movements`, `maintenance`, `manure_factors`, `manure_inventory`, `manure_adjustments`, `catalogos` (maestros), `users`, `sessions`

El esquema completo está en [`src/db/schema.ts`](src/db/schema.ts).

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Compilar y servir en producción |
| `npm run db:push` | Aplicar el esquema a la BD |
| `npm run db:seed -- --allow-destructive` | Reemplazar datos con una muestra local (no usar en producción) |
| `npm run db:create-admin` | Crear el primer usuario administrador sin tocar los datos existentes |
| `npm run db:rotate-admin-password` | Cambiar la clave de un administrador y revocar sus sesiones |
| `npm run db:generate` | Generar migración SQL |
| `npm run test` | Pruebas con vitest |
| `npm run typecheck` / `lint` | Verificación de tipos y estilo |

## Tecnologías

- **Next.js 16** (App Router) + **React 19**
- **Drizzle ORM** con **PostgreSQL** (`pg`)
- **Recharts** (gráficos del panel financiero)
- **Tailwind CSS 4** (estilos)
- **Vitest** (pruebas)

## Documentación para desarrolladores

- **[CONTRIBUTING.md](CONTRIBUTING.md)** – Guía para contribuir al proyecto (estilo de código, pull requests, etc.).
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** – Código de conducta esperado en la comunidad.
- **[SECURITY.md](SECURITY.md)** – Política de reporte de vulnerabilidades y procedimientos de seguridad.
- **[CHANGELOG.md](CHANGELOG.md)** – Historial de cambios y versiones del proyecto.
- **[docs/development.md](docs/development.md)** – Instrucciones detalladas de entorno de desarrollo, herramientas y flujos de trabajo.
- **[docs/features.md](docs/features.md)** – Descripción de funcionalidades planeadas y en desarrollo.
- **[docs/data-dictionary.md](docs/data-dictionary.md)** – Diccionario de datos del esquema de base de datos y definiciones de campos.
- **[docs/superpowers/](docs/superpowers/)** – Especificaciones y planes de características avanzadas (superpoderes) en desarrollo.
