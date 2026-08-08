# GalliGranja — Sistema Gallinero 🐔

Sistema de gestión para una micro-granja avícola: control de gallinas, pollos y gallos, producción de huevos por tamaño, inventario FIFO, incubación, alimentación, gallinaza, ventas con presentaciones, egresos, sacrificio/carne, control sanitario y panel de finanzas con KPIs.

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
DATABASE_URL=postgresql://TU_USUARIO@127.0.0.1:5432/app_db
```

> `.env.local` está excluido del repo por seguridad; cada quien crea el suyo.

### Crear tablas y sembrar datos

```bash
npm run db:push     # crea las tablas (drizzle-kit push)
npm run db:seed     # datos demo: usuarios, catálogos, producción, ventas y finanzas
```

El seed es idempotente: puedes ejecutarlo de nuevo sin problema.

### Arrancar

```bash
npm run dev         # modo desarrollo → http://localhost:3000
```

Para producción:

```bash
npm run build && npm start
```

## Acceso

El seed crea el usuario administrador:

- **Usuario:** `admin`
- **Contraseña:** `admin123`

## Módulos

| Módulo | Ruta | Descripción |
| --- | --- | --- |
| Dashboard | `/` | Resumen general del negocio |
| Gallinas | `/gallinas` | Registro individual, peso, estado (activa, empollando, descarte…) |
| Pollos y Gallos | `/pollos` | Reproductores y lotes de engorde por etapa |
| Alimentación | `/alimentacion` | Inventario de alimento, consumos, programas por etapa |
| Producción Huevos | `/huevos` | Recolección diaria por tamaño de huevo (precios del catálogo) |
| Inventario Huevos | `/inventario` | Stock por tamaño con PEPS, envejecimiento y valor |
| Incubación | `/incubacion` | Huevos incubados, nacimientos, machos/hembras |
| Gallinaza | `/gallinaza` | Acumulación por kg/día, ajustes y ventas |
| Ventas | `/ventas` | Ventas de huevos por presentación (docena, caja x30…) |
| Carne | `/sacrificio` | Sacrificio, peso en canal, destino (venta/consumo) |
| Egresos | `/egresos` | Flujo de gastos con categoría, proveedor y cantidad |
| Mantenimiento | `/mantenimiento` | Tareas y costos del gallinero |
| Control Sanitario | `/sanidad` | Vacunas, desparasitación, tratamientos |
| Finanzas | `/finanzas` | Panel de KPIs y comportamiento en el tiempo |
| Catálogos | `/catalogos` | Datos maestros: tamaños con precio, presentaciones con unidades, razas, compradores… |

## Estructura del proyecto

```
├── src/
│   ├── app/
│   │   ├── (app)/            # Páginas del sistema (dashboard, gallinas, huevos, ventas…)
│   │   │   ├── produccion/   # Vista por pestañas de alimentación, huevos, carne…
│   │   │   └── layout.tsx    # Layout con Sidebar y autenticación
│   │   ├── api/              # API Routes (Next.js)
│   │   │   ├── auth/         # login, logout, me
│   │   │   ├── huevos/       # producción por tamaño + inventario
│   │   │   ├── ventas/       # ventas de huevos con presentación
│   │   │   ├── finanzas/     # transacciones, serie temporal y KPIs
│   │   │   └── …             # gallinas, pollos, alimentacion, gallinaza, sanidad…
│   │   ├── login/            # Página de acceso
│   │   └── layout.tsx
│   ├── components/           # Sidebar y componentes UI (Card, StatCard…)
│   ├── db/
│   │   ├── schema.ts         # Modelo de datos (Drizzle ORM)
│   │   ├── seed.ts           # Datos demo idempotentes
│   │   └── index.ts          # Conexión a Postgres
│   └── lib/                  # auth (sesiones), inventory (PEPS), flock, helpers
├── docs/                     # Especificaciones y planes de diseño
├── tests/                    # Pruebas de flujo (vitest)
└── drizzle.config.ts
```

## Modelo de datos (resumen)

- **Aves:** `hens`, `roosters`, `broiler_batches`
- **Producción:** `egg_production` + `egg_production_details` (por tamaño), `incubation`
- **Comercial:** `egg_sales`, `egg_sales_items`, `chicken_sales`, `manure_sales`
- **Finanzas:** `transactions` (ingresos y egresos, enlazadas a su fuente)
- **Apoyo:** `feed_inventory`, `feed_movements`, `feed_programs`, `maintenance`, `health_control`, `manure_factors`, `manure_inventory`, `manure_adjustments`, `catalogos` (maestros), `users`, `sessions`

El esquema completo está en [`src/db/schema.ts`](src/db/schema.ts).

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Compilar y servir en producción |
| `npm run db:push` | Aplicar el esquema a la BD |
| `npm run db:seed` | Datos demo (idempotente) |
| `npm run db:generate` | Generar migración SQL |
| `npm run test` | Pruebas con vitest |
| `npm run typecheck` / `lint` | Verificación de tipos y estilo |

## Tecnologías

- **Next.js 16** (App Router) + **React 19**
- **Drizzle ORM** con **PostgreSQL** (`pg`)
- **Recharts** (gráficos del panel financiero)
- **Tailwind CSS 4** (estilos)
- **Vitest** (pruebas)
