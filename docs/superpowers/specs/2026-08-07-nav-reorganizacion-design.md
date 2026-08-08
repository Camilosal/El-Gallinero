# Reorganización de Navegación: Producción, Ventas y Operaciones — Diseño

**Fecha:** 2026-08-07
**Estado:** Aprobado

## Problema

El sidebar tiene 15 entradas planas (Dashboard, Gallinas, Pollos y Gallos, Alimentación, Huevos, Inventario, Incubación, Gallinaza, Ventas, Carne, Egresos, Mantenimiento, Sanidad, Finanzas, Catálogos). Todos los elementos del sistema ya existen; falta organizarlos por componente funcional.

## Objetivo

Reorganizar la interfaz en 3 hojas principales con pestañas por producto/área, reduciendo el sidebar a 8 entradas:

| Sidebar | Contenido |
|---|---|
| 📊 Dashboard | sin cambios |
| 🏭 **Producción** | pestañas: Huevos · Carne · Gallinas · Pollos · Gallinaza · Incubación · Alimentación |
| 💰 **Ventas** | pestañas: Huevos · Aves · Carne · Gallinaza |
| 🔧 **Operaciones** | pestañas: Mantenimiento · Control Sanitario |
| 📦 Inventario Huevos | sin cambios |
| 📤 Egresos | sin cambios |
| 📈 Finanzas | sin cambios |
| 🗂️ Catálogos | sin cambios |

## Mecánica de pestañas

- Cada hoja es una página hub: `/produccion`, `/operaciones` (nuevas) y `/ventas` (existente, se amplía).
- Barra de pestañas con el mismo estilo pill que ya usa `/ventas` (fondo slate, activa blanca/verde).
- La pestaña activa se sincroniza con la URL (`?tab=carne`) usando `useSearchParams` + `router.replace` (con `scroll: false`). Pestaña por defecto: la primera. El componente que lee `useSearchParams` va dentro de `<Suspense>` (requisito de Next.js App Router).
- El contenido de cada módulo existente se **mueve tal cual** (sin reescritura) a componentes de pestaña dentro de carpetas `_components/` de cada hub. Cada pestaña conserva su propio `PageHeader`. Next.js no genera rutas para archivos dentro de carpetas con prefijo `_`.

## Mapeo de contenido

### Hoja Producción (`/produccion`)

| Pestaña | Origen |
|---|---|
| Huevos | contenido actual de `/huevos` |
| Carne | contenido actual de `/sacrificio` (registros con kg de carne, gráfica, CRUD) |
| Gallinas | contenido actual de `/gallinas` |
| Pollos | contenido actual de `/pollos` (pollos y gallos) |
| Gallinaza | contenido actual de `/gallinaza` |
| Incubación | contenido actual de `/incubacion` |
| Alimentación | contenido actual de `/alimentacion` |

### Hoja Ventas (`/ventas`)

La página actual ya tiene pestañas Huevos | Aves; se amplía con dos pestañas nuevas:

- **Carne**: lista solo los registros de sacrificio con `destination="venta"` (vía `/api/sacrificio` existente). StatCards (ingresos, kg vendidos, aves, precio promedio), tabla con editar/eliminar, y formulario de alta/edición reutilizando un **modal compartido** extraído de la página de sacrificio (`src/components/SlaughterFormModal.tsx`) con modo `saleOnly` (destino fijo "venta", precio por kg obligatorio). El registro mantiene la integración existente con finanzas (transacción `Venta de carne`, `sourceType: "sacrificio"`).
- **Gallinaza**: componente autocontenido que consume `/api/gallinaza`: stat cards (ingresos 30 días, kg vendidos, total ventas, stock disponible), tabla de ventas con eliminar, y modal de nueva venta con validación de stock (mismas reglas que la página de gallinaza: `action: "sale"`, categoría financiera `Venta de abono/gallinaza`).

La pestaña Carne de Producción también usa el modal compartido (refactor del modal inline actual de la página de sacrificio — el único cambio de código dentro de los módulos movidos).

### Hoja Operaciones (`/operaciones`)

| Pestaña | Origen |
|---|---|
| Mantenimiento | contenido actual de `/mantenimiento` |
| Control Sanitario | contenido actual de `/sanidad` |

## Rutas antiguas

Las 9 rutas que se mudan se reemplazan por páginas de redirección (`redirect()` de `next/navigation`) hacia su nueva ubicación, para no romper favoritos ni enlaces externos:

| Ruta antigua | Redirige a |
|---|---|
| `/huevos` | `/produccion?tab=huevos` |
| `/sacrificio` | `/produccion?tab=carne` |
| `/gallinas` | `/produccion?tab=gallinas` |
| `/pollos` | `/produccion?tab=pollos` |
| `/gallinaza` | `/produccion?tab=gallinaza` |
| `/incubacion` | `/produccion?tab=incubacion` |
| `/alimentacion` | `/produccion?tab=alimentacion` |
| `/mantenimiento` | `/operaciones?tab=mantenimiento` |
| `/sanidad` | `/operaciones?tab=sanidad` |

Los 4 accesos rápidos del Dashboard que apuntan a rutas mudadas se actualizan a las nuevas URLs (`/inventario` y `/ventas` no cambian).

## Base de datos

**Sin cambios.** Todo se apoya en tablas y APIs existentes (`/api/sacrificio`, `/api/gallinaza`, `/api/ventas`, `/api/ventas-aves`, etc.). El esquema de carne solicitado (kg por sacrificio) ya existe: tabla `slaughter` con `weightKg`, `pricePerKg`, `totalAmount` y `destination`.

## Manejo de errores

- APIs existentes sin cambios → sus validaciones se conservan (stock insuficiente de gallinaza, validación de aves disponibles para sacrificio, etc.).
- `?tab=` con valor desconocido → se muestra la primera pestaña (no hay 404).

## Pruebas

- Las pruebas existentes (`tests/flows.test.ts`, `tests/manure.test.ts`) operan contra APIs y no deben verse afectadas; se corre la suite completa.
- Verificación manual HTTP: las 9 redirecciones responden 307/308, los hubs responden 200 con cada `?tab=`, `tsc --noEmit` limpio y ESLint limpio en archivos nuevos.

## Fuera de alcance

- Cambios de lógica de negocio en los módulos movidos.
- Reescritura visual de las pestañas movidas.
- Cambios en Egresos, Finanzas, Inventario, Catálogos o Dashboard (salvo los 4 enlaces rápidos).
