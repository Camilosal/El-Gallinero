# El Gallinero — Core Abierto Multi-Especie

**Infraestructura Digital Offline-First para la Gestión Zootécnica, Sanitaria y Financiera de Granjas de Aves y Especies Menores en Latinoamérica.**

[![Licencia: GNU AGPLv3](https://img.shields.io/badge/Licencia-GNU%20AGPLv3-emerald.svg)](LICENSE)
[![Licencia Dual: Comercial / Institucional](https://img.shields.io/badge/Enterprise-Licencia%20Comercial-blue.svg)](COMMERCIAL-LICENSE.md)
[![Ecosistema Open-Core](https://img.shields.io/badge/Arquitectura-Open--Core%203%20Capas-amber.svg)](docs/estrategia-open-core.md)
[![PWA Offline-First](https://img.shields.io/badge/Campo-PWA%20Offline--First-green.svg)](#resiliencia-en-campo-y-arquitectura-técnica)

---

**El Gallinero** consolida en este repositorio el **Core Abierto Operativo (Community Edition)** de la plataforma desarrollada por **[Camilo Saldarriaga](https://camilosaldarriaga.com)**: una aplicación web progresiva (*offline-first*) diseñada para granjas familiares, productores medianos, asistentes técnicos y proyectos rurales multi-especie.

Toda operación productiva, sanitaria o de mantenimiento alimenta automáticamente las finanzas e inventarios (FIFO/PEPS) con trazabilidad completa a su origen.

---

## ¿Eres productor, veterinario o diriges un proyecto en una ONG / Cooperativa?

No necesitas instalar servidores ni saber programación para empezar en tu granja o formular un proyecto institucional:

1. **Pequeños y Medianos Productores (en la nube o en campo):** Prueba la instancia en producción en **[gallinero.iwage.co](https://gallinero.iwage.co)** o conoce el proyecto en **[camilosaldarriaga.com](https://camilosaldarriaga.com)**. Arranca en menos de 5 minutos con el **Asistente inicial de 3 pasos** sin historial atrasado y opera incluso sin internet desde tu celular.
2. **Granjas Comerciales (Implementación Llave en Mano):** Para operación multi-galpón o multi-especie con kits físicos de placas QR resistentes al lavado, ajuste zootécnico inicial y soporte técnico, solicita acompañamiento en **[camilosaldarriaga.com](https://camilosaldarriaga.com)**.
3. **ONGs, Cooperativas, Fundaciones y Agencias de Cooperación:** Este repositorio es software libre certificado bajo **GNU AGPLv3** con madurez verificable (**TRL 8–9**), sin bloqueo de proveedor (*vendor lock-in*) y alineado con los principios de **Bienes Públicos Digitales (DPGA)**. Para cohortes de **50 a 500+ predios**, **Torre de Control Multi-Predio (M&E)**, WhatsApp Cloud API o despliegues soberanos Docker bajo contrato B2B2C, consulta [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) y [docs/estrategia-open-core.md](docs/estrategia-open-core.md).
4. **Investigadores, Zootecnistas y Desarrolladores AgroTech:** Revisa [CONTRIBUTING.md](CONTRIBUTING.md) para aportar curvas genéticas, ajustes por altitud o adaptaciones normativas locales (ICA/NTC en Colombia, SENASA Perú, AGROCALIDAD Ecuador, SENASICA México, entre otros).

---

## Arquitectura Open-Core en Tres Capas y Licenciamiento Dual

El proyecto opera bajo una estrategia **Open-Core + Licenciamiento Dual** pensada para maximizar el acceso público e impacto rural sin comprometer la sostenibilidad financiera del mantenimiento normativo, la infraestructura gestionada ni el soporte institucional:

| Capa del ecosistema | Licencia legal | Alcance funcional y técnico | Rol en el ecosistema |
| --- | --- | --- | --- |
| **Capa 1 · Estándar Zootécnico y Normativo Abierto** | **CC-BY-SA 4.0** *(Atribución + Compartir Igual)* | Parámetros de las 6 especies (curvas por altitud y clima), tablas de calibres **NTC 1240**, reglas **POE GAB ICA (Res. 3651/3652)**, bienestar (**Res. 205/2022 y 8452/2025**) y compostaje **AGROSAVIA**. | Estándar técnico auditable en español para universidades, centros de investigación y extensión agropecuaria. |
| **Capa 2 · Core Abierto Operativo (Este repositorio)** | **GNU AGPLv3** *(Copyleft estricto de red)* | Aplicación PWA *offline-first* monopredio completa (`Next.js` + `PostgreSQL`), modelo híbrido Lote/Individuo con consanguinidad de 3 generaciones, **Gina** (asistente operativa con voz y cámara), escáner QR, onboarding progresivo (**Pequeño / Mediano**) y guía interactiva. | Bien Público Digital ejecutable y autoalojable. Bajo **GNU AGPLv3 (Art. 13)**, cualquier servicio en red/SaaS basado en este código debe liberar su código fuente completo bajo AGPLv3 salvo licencia comercial expresa. |
| **Capa 3 · Capa Institucional y Comercial (Enterprise)** | **Licencia Comercial Exenta** *(Contrato B2B2C / SaaS Gestionado)* | **Torre de Control Multi-Predio (M&E)** para 50–500+ granjas y pronóstico de acopio, mensajería omnicanal (WhatsApp Cloud API / SMS / IVR), paquetes llave en mano, **White-Label**, SLA y soporte dedicado. | Financia el desarrollo continuo, las actualizaciones normativas (ICA/INVIMA/ICONTEC/DIAN) y las cohortes rurales. Ver [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md). |

### Comparativa rápida: Núcleo Abierto vs. Implementaciones Comerciales / Cohorte

| Capacidad | Core Abierto (`El-Gallinero`, GNU AGPLv3) | Implementación Granja Comercial | Cohorte ONG / Cooperativa (Enterprise) |
| --- | --- | --- | --- |
| PWA 100% Offline-First (`IndexedDB` + Outbox idempotente) | Incluido (monopredio) | Incluido + configuración y soporte | Incluido (50 a 500+ granjas) |
| Modelo híbrido (Lote + Individuo) para 6 especies | Incluido | Incluido + calibración inicial | Incluido + trazabilidad de capital semilla |
| Bloqueo por tiempo de retiro, POE GAB ICA y compostaje | Incluido | Incluido + acompañamiento en auditoría | Incluido + consolidado sanitario regional |
| **Gina** (asistente con voz, lectura OCR de facturas y memoria) | Incluido *(requiere API key propia)* | Incluido y configurado llave en mano | Incluido + integraciones omnicanal avanzadas |
| Contabilidad analítica, prorrateo de costos, PEPS NTC 1240 y P&L | Incluido | Incluido + paquetes listos para crédito/DIAN | Consolidado económico de impacto M&E |
| Torre de Control Multi-Predio, marca blanca y SLA dedicado | No incluido *(solo núcleo monopredio)* | Soporte prioritario opcional | **Incluido (Nube gestionada o Docker soberano)** |

---

## Especies Soportadas (Modelo Polimórfico Lote + Individuo)

- **Gallinas Ponedoras:** Ficha individual y por lote, curvas de postura (ej. Hy-Line Brown), porcentaje ave-día (HD%), huevo ave alojada (HAA), detección de fin de ciclo y clasificación comercial **NTC 1240** (Jumbo, AAA, AA, A, B, C) en stock **PEPS**.
- **Pollos de Engorde y Gallos Reproductores:** Lotes de engorde (`L-###`) y reproductores (`GA-###`), pesaje muestral, coeficiente de variación (**CV%**), uniformidad, conversión alimenticia (**FCR**), índice **EPEF**, curvas **Ross 308 / Cobb 500** ajustadas por altitud (m.s.n.m.) y ventana óptima de sacrificio.
- **Codornices:** Trazabilidad de postura temprana y ciclo corto de incubación (**16–18 días**).
- **Patos (Pekín / Muscovy):** Incubación extendida (**28–30 días**), manejo por etapas y seguimiento de conversión alimenticia.
- **Conejos:** Ficha individual de reproductores y camadas, empadre, gestación/palpación/nidal, destete hacia engorde y **bloqueo de consanguinidad en 3 generaciones**.
- **Cuyes / Curíes:** Control de empadre por jaula/poza, lactancia, sexado al destete, dietas mixtas con forraje y vitamina C, y seguimiento hasta cosecha.

---

## Capacidades Destacadas del Núcleo Operativo

- **Inicio Progresivo sin Fricción (Pequeño vs. Mediano):**
  - **Asistente inicial (Día 1 · 3 pasos):** carga finca, lugares, inventario vivo actual y alimento en bultos/kg (manual o mediante **plantilla CSV**).
  - **Selector de Escala en tiempo real:** alterna entre **Modo Pequeño (Operación Simple)** y **Modo Mediano (Tecnificado)** desde la barra superior sin perder historial; los 4 módulos esenciales están siempre activos y los 5 módulos avanzados se desbloquean manual o automáticamente según el crecimiento de la finca (`/dashboard/configuracion/modulos`).
  - **Creación Directa (`+ Crear` y Captura Rápida):** cada acceso rápido abre directamente su modal o formulario sin rodeos, y cada registro muestra microcápsulas con costo unitario, días de autonomía o margen.
- **Gina, tu asistente de la granja:** interfaz cercana con avatar propio que consulta datos reales en vivo, lee fotos de facturas o etiquetas con la cámara, graba dictado o notas de voz *offline*, guarda reglas en **Memoria de la granja** y exige confirmación explícita en tarjeta antes de ejecutar cualquier escritura.
- **Escáner QR Unificado (`/dashboard/escanear`):** lee códigos QR o códigos manuales de lugares (`LOC-`), ejemplares (`G-`), lotes (`L-`) y equipos (`ACT-`) para ejecutar movimientos en campo y generar fichas públicas de trazabilidad (`/lote/[id]`).
- **Guía de Usuario Integrada (45 artículos):** accesible dentro de la sesión (`/dashboard/guia`) y como manual público sin login (`/guia`) para capacitación en campo con buscador instantáneo, diagramas y capturas reales.

---

## Flujo de Información y Módulos del Sistema

```mermaid
flowchart LR
    U[Lugares y Animales] --> P[Producción Diaria / QR / Gina]
    P --> I[Inventarios FIFO / PEPS]
    I --> F[Finanzas, CxC/CxP y Prorrateo]
    F --> A[KPIs, Curvas por Altitud y P&L]
```

Las pantallas del tablero principal (`/dashboard`) se agrupan en **7 módulos** más **Inicio**, **Escanear** y **Guía de Usuario**:

| Sección | Rutas principales | Qué cubre |
| --- | --- | --- |
| **Inicio y Escáner** | `/dashboard`, `/dashboard/escanear` | Tablero en grupos enmarcados (**Resumen del día**, **Tareas de hoy**, **Accesos directos**, **Resumen del mes / Tablero técnico** y **Completar configuración**), Asistente Día 1 y escáner QR multiespecie. |
| **Animales y Lugares** | `/dashboard/animales`, `/dashboard/ubicaciones`, `/dashboard/ubicaciones/[id]` | Inventario multiespecie, fichas individuales/lote, capacidad por galpón/jaula/potrero, mapa de ocupación, traslados y etiquetas QR. |
| **Producción** | `/dashboard/produccion`, `adquisiciones`, `peso`, `mortalidad`, `plan-parvada` | Postura NTC 1240, carne/sacrificio, reproducción conejos/cuyes, incubación, alimentación, gallinaza, entradas/linaje 3 gen, biometría CV%/EPEF y proyecciones. |
| **Inventarios** | `/dashboard/inventarios/balance`, `huevos`, `carne`, `gallinaza`, `alimentacion`, `insumos` | Balance patrimonial, stock PEPS/FIFO, días de autonomía de alimento y alertas de reposición. |
| **Almacén y Operaciones** | `/dashboard/almacen`, `/dashboard/operaciones/activos`, `mantenimiento`, `compostaje`, `cierre` | Activos/equipos con CAPEX/ROI y QR, mantenimientos periódicos, pilas térmicas AGROSAVIA, cierre diario auditable y telemetría IoT (ITH, NH3, báscula). |
| **Planeación** | `/dashboard/planeacion`, `calendario`, `/dashboard/soberania` | Calendario Maestro unificado, rutinas auto-ajustables y balance de autoconsumo / soberanía alimentaria. |
| **Sanidad** | `/dashboard/sanidad`, `control`, `calendario`, `alertas`, `bioseguridad` | Plan sanitario por etapa, tratamientos con candado de retiro farmacológico, vacunación automática, bajas y listas POE GAB / Bienestar ICA. |
| **Finanzas y Contactos** | `/dashboard/finanzas`, `ventas`, `egresos`, `finanzas`, `presupuestos`, `cuentas`, `/dashboard/contactos` | 5 líneas de venta, compras con presentación y OCR, catálogo frecuente, CxC/CxP con abonos, presupuestos, flujo acumulado y directorio con crédito/WhatsApp. |
| **Análisis y Configuración** | `/dashboard/analisis`, `kpis`, `razas`, `reportes`, `/dashboard/configuracion`, `modulos`, `catalogos` | KPIs, curvas por raza/altitud, contabilidad analítica Excel/PDF, escala Pequeño/Mediano, 5 flags progresivos y catálogos maestros en 8 pestañas. |

Para una guía detallada de cada módulo, consulta **[docs/features.md](docs/features.md)**, **[docs/data-dictionary.md](docs/data-dictionary.md)** o entra directamente al manual web en `/guia`.

---

## Stack Tecnológico

- **Framework Web:** Next.js 16 (App Router + Turbopack), React 19, TypeScript estricto.
- **Estilos e Interfaz:** Tailwind CSS v4, Lucide Icons, Recharts, JSX limpio responsivo (campo móvil + escritorio).
- **Base de Datos y ORM:** PostgreSQL ≥ 14 + Drizzle ORM (`src/db/schema.ts`).
- **Campo y Resiliencia:** PWA Offline-First con `IndexedDB`, cola de sincronización idempotente, notas de voz y QR (`qrcode` + `html5-qrcode`).
- **Calidad y Pruebas:** Vitest (unitarias e integración contra PostgreSQL), Playwright (E2E en Chromium headless), ESLint 9 y TypeScript `tsc --noEmit`.

---

## Instalación y Desarrollo Local

### Requisitos

- **Node.js ≥ 20.9** (probado con Node 22/24)
- **PostgreSQL ≥ 14**
- **npm**

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/Camilosal/El-Gallinero.git
cd El-Gallinero
npm install
```

### 2. Configurar base de datos y entorno

```bash
createdb app_db
cp .env.example .env.local
```

Edita `.env.local` con tu conexión:

```env
DATABASE_URL=postgresql://TU_USUARIO:TU_CONTRASENA@127.0.0.1:5432/app_db
```

> `.env.local` está ignorado en `.gitignore`. Nunca subas secretos o cadenas de conexión reales al repositorio.

### 3. Aplicar esquema y sembrar datos sintéticos

```bash
npm run db:push          # Crea tablas según src/db/schema.ts
npm run db:seed-config   # Catálogos base (razas, vacunas, parámetros idempotentes)
```

Opcionalmente, solo en una base **local descartable de pruebas** (bloqueado en producción):

```bash
DEMO_ADMIN_PASSWORD='elige-una-clave-de-12-caracteres' npm run db:seed -- --allow-destructive
```

### 4. Ejecutar en desarrollo o producción local

```bash
npm run dev              # Desarrollo → http://localhost:3000
```

```bash
npm run build && npm start
```

---

## Despliegue en Contenedor (Docker Compose)

Para levantar aplicación + PostgreSQL localmente o en un servidor propio:

```bash
docker compose --profile migrate run --rm migrate
docker compose run --rm -e ADMIN_USERNAME='admin' -e ADMIN_PASSWORD='elige-una-clave-segura-de-12-caracteres' --entrypoint npm app run db:create-admin
docker compose up -d
```

- La aplicación queda expuesta en `http://localhost:3000` (y en despliegues con proxy inverso detrás de TLS en tu dominio).
- Para operación en producción, actualización de esquema SQL idempotente y variables opcionales de **Gina** (modelo IA, voz y lectura de documentos), sigue paso a paso **[docs/deployment.md](docs/deployment.md)**.

### Acceso inicial y recuperación de administrador

- **Primer usuario en producción:** `ADMIN_USERNAME='admin' ADMIN_PASSWORD='...' npm run db:create-admin` (mínimo 12 caracteres; aborta si ya existen usuarios).
- **Rotar contraseña:** `npm run db:rotate-admin-password` (revoca sesiones activas).
- **Código de recuperación de un solo uso:** tras aplicar `scripts/add_admin_recovery_code.sql`, ejecuta `ADMIN_USERNAME='admin' npm run db:issue-admin-recovery-code` y utilízalo en `/login/recuperar`.

---

## Verificación y Pruebas

```bash
npm run typecheck   # Verificación estricta de TypeScript (tsc --noEmit)
npm run lint        # Análisis estático ESLint
npm test            # Suite completa Vitest (tests/*.test.ts)
npm run e2e         # Pruebas E2E con Playwright
```

---

## Documentación Asociada del Core Abierto

- [LICENSE](LICENSE) — Licencia completa **GNU Affero General Public License v3 (AGPLv3)**.
- [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) — Alcance del **Licenciamiento Dual**, servicios comerciales e implementación Enterprise.
- [docs/estrategia-open-core.md](docs/estrategia-open-core.md) — Estrategia formal Open-Core en 3 capas, alineación DPGA, madurez TRL 8–9 y protocolo de gobernanza de commits.
- [CONTRIBUTING.md](CONTRIBUTING.md) — Cómo contribuir código, tablas zootécnicas, normativas LATAM y términos de aporte.
- [SECURITY.md](SECURITY.md) — Política de divulgación responsable y reporte de vulnerabilidades.
- [docs/features.md](docs/features.md) — Detalle funcional por módulo y arquitectura multi-especie.
- [docs/data-dictionary.md](docs/data-dictionary.md) — Diccionario de datos y entidades PostgreSQL.
- [docs/development.md](docs/development.md) — Guía de entorno de desarrollo y convenciones técnicas.
- [docs/deployment.md](docs/deployment.md) — Guía de despliegue en producción y scripts SQL.
- [CHANGELOG.md](CHANGELOG.md) — Historial de versiones.

---

## Autoría y Contacto

Desarrollado por **Camilo Saldarriaga** · **[https://camilosaldarriaga.com](https://camilosaldarriaga.com)**  
Instancia de referencia: **[https://gallinero.iwage.co](https://gallinero.iwage.co)**

El uso, bifurcación o despliegue autoalojado bajo **GNU AGPLv3** debe conservar visibles los créditos de autoría originaria y el enlace al repositorio fuente.
