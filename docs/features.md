# Funcionalidades, Módulos y Arquitectura Multi-Especie

Este documento resume la cobertura funcional del **Core Abierto Operativo (`El Gallinero`)**, complementando el [README principal](../README.md) y la **Guía de Usuario interactiva** disponible en `/guia` y `/dashboard/guia`.

## Visión General

**El Gallinero** es una plataforma *PWA Offline-First* diseñada para la gestión técnica, sanitaria y financiera de granjas multi-especie (**gallinas ponedoras, pollos de engorde, codornices, patos, conejos y cuyes/curíes**). Toda operación comercial, de almacén o mantenimiento alimenta automáticamente el libro financiero e inventarios (FIFO/PEPS) con trazabilidad completa a su origen.

### Pilares del Core Abierto

1. **Modelo Polimórfico Lote + Individuo:** gestiona lotes productivos de aves junto con fichas individuales de postura o pie de cría (incluyendo reproducción y bloqueo de consanguinidad de 3 generaciones en conejos y cuyes).
2. **Onboarding Progresivo (Pequeño vs. Mediano):** sobre una única base de datos puedes operar en **Modo Pequeño (Operación Simple)** o **Modo Mediano (Tecnificado)** mediante 4 módulos esenciales siempre activos y 5 módulos progresivos desbloqueables por crecimiento real o manualmente.
3. **Resiliencia Rural (*Offline-First*):** réplica local navegable en `IndexedDB`, cola de mutaciones idempotente, escáner QR sin conexión y notas de voz grabadas en campo.
4. **Gina (Asistente Operativa de la Granja):** consulta datos en vivo, estructura movimientos diarios desde texto o voz con confirmación humana obligatoria en tarjeta, lee facturas/etiquetas con la cámara y conserva memoria persistente de reglas del predio.
5. **Integración Financiera Automática:** cada venta, compra, baja, evento sanitario o mantenimiento genera trazabilidad de costos, inventarios y cuentas por cobrar/pagar (CxC/CxP).

---

## Detalle por Sección y Módulos

### 1. Inicio, Captura Directa, Escáner QR y Gina
- **Tablero Inicio (`/dashboard`):** organizado en grupos enmarcados y sin numeración (**Resumen del día**, **Requiere atención**, **Tareas de hoy** con verificación por evidencia real, **Accesos directos**) y dos paneles plegables estándar (**Resumen del mes / Tablero técnico** y **Completar configuración de finca**).
- **Asistente inicial (Día 1 · 3 pasos):** configura escala, nombre de finca, lugares, animales actuales y saldo inicial de alimento manual o por plantilla CSV.
- **Botón `+ Crear` y Captura Rápida:** apertura directa en modal o formulario exacto sin pasos intermedios + microcápsulas de rentabilidad y cobertura al guardar.
- **Escáner QR Unificado (`/dashboard/escanear`):** identifica lugares (`LOC-`), ejemplares (`G-`), lotes (`L-`) y activos (`ACT-`), dispara acciones rápidas y enlaza a fichas públicas de trazabilidad (`/lote/[id]`).

### 2. Animales y Lugares de Manejo
- **Directorio Multiespecie (`/dashboard/animales`):** inventario unificado de las 6 especies con estado, etapa y filtro por lugar.
- **Lugares de Manejo (`/dashboard/ubicaciones` y `[id]`):** gestión de galpones, jaulas, pozas y potreros, capacidad, altitud (m.s.n.m.), tipo de piso, traslados masivos o individuales y etiquetas QR imprimibles.

### 3. Producción (`/dashboard/produccion`)
- **Huevos (NTC 1240):** registro por tamaño (Jumbo a C) o conteo simple en Modo Pequeño, porcentaje ave-día, autoconsumo, pérdidas y ambiente (T°/HR).
- **Aves y Lotes:** seguimiento de gallinas ponedoras (8 estados y ciclo automático), pollos de engorde (`L-###`) y gallos reproductores (`GA-###`).
- **Reproducción e Incubación:** ciclos de empadre-gestación-parto-destete para conejos y cuyes con alerta de consanguinidad; control de tandas de incubación multi-especie (16–30 días según especie) con nacimientos e índice de eclosión.
- **Adquisiciones, Peso, Mortalidad y Plan de Parvada:** entrada con trazabilidad genética de padres/linaje, pesaje muestral con **CV%** y **EPEF**, registro de bajas con motivo y proyecciones de parvada.
- **Alimentación y Gallinaza:** raciones diarias, dietas mixtas (%MS, %PC, forraje y vitamina C para cuyes), cálculo de FCR y producción automática de gallinaza.

### 4. Inventarios y Almacén / Operaciones
- **Inventarios (`/dashboard/inventarios/...`):** balance patrimonial consolidado, inventario **PEPS/FIFO** de huevos (alertas de envejecimiento), carne, gallinaza, alimento por bultos/kg con días de autonomía e insumos operativos.
- **Almacén y Operaciones (`/dashboard/almacen`, `operaciones/...`):** registro de activos/equipos con **CAPEX/ROI** y QR, mantenimiento preventivo/correctivo periódico, **pilas de compostaje térmico (AGROSAVIA)**, **cierre diario auditable** con hash de integridad y lecturas **IoT** (`ITH`, `NH3`, temperatura, humedad y báscula).

### 5. Planeación y Soberanía Alimentaria
- **Calendario Maestro (`/dashboard/planeacion/calendario`):** agenda consolidada con rutinas diarias auto-ajustables, hitos de incubación/reproducción, vacunas, retiros, compostaje y vencimientos de cartera.
- **Soberanía Alimentaria (`/dashboard/soberania`):** trazabilidad de autoconsumo familiar y balance nutricional producido en la finca.

### 6. Sanidad y Bioseguridad
- **Plan Sanitario, Control y Vacunación (`/dashboard/sanidad/...`):** protocolos por etapa, aplicación de vacunas con deducción de insumos, historial clínico y **candado automático de tiempo de retiro farmacológico** (impide comercializar huevo o carne en carencia).
- **Bioseguridad POE GAB y Bienestar Animal:** listas de chequeo alineadas con **ICA Res. 3651/3652** y **Res. 205/2022 y 8452/2025**.

### 7. Finanzas, Análisis, Contactos y Configuración
- **Finanzas (`/dashboard/finanzas/...`):** ventas en **5 líneas** (huevos, carne, animales en pie, gallinaza y otros), egresos con productos frecuentes y lectura **OCR** de facturas, **CxC/CxP** con abonos, presupuestos con desviación y estado de resultados.
- **Contactos (`/dashboard/contactos`):** directorio unificado de clientes y proveedores con ubicación, WhatsApp y plazo de crédito.
- **Análisis (`/dashboard/analisis/...`):** KPIs zootécnicos, curvas ajustadas por raza y altitud, **contabilidad analítica anti-subsidio cruzado** con prorrateo de indirectos y exportación Excel/PDF.
- **Configuración (`/dashboard/configuracion/...`):** **Módulos Progresivos**, **Catálogos en 8 pestañas** (listas, contactos, parámetros, 6 especies, vacunas, pesos, gallinaza y nutrición) y recuperación segura de acceso (`/login/recuperar`).
