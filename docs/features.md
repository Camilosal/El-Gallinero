# Funcionalidades, Módulos y Arquitectura Multi-Especie

Este documento resume la cobertura funcional del **Core Abierto Operativo (`IwaGranja`)**, complementando el [README principal](../README.md) y la **Guía de Usuario interactiva** disponible en `/guia` (pública) y `/manual` (dentro de sesión).

## Visión General

**IwaGranja** es una plataforma *PWA Offline-First* diseñada para la gestión técnica, sanitaria y financiera de granjas multi-especie (**gallinas ponedoras, pollos de engorde, codornices, patos, conejos y cuyes/curíes**). Toda operación comercial, de almacén o mantenimiento alimenta automáticamente el libro financiero e inventarios (FIFO/PEPS) con trazabilidad completa a su origen.

### Pilares del Core Abierto

1. **Modelo Polimórfico Lote + Individuo:** gestiona lotes productivos de aves junto con fichas individuales de postura o pie de cría (incluyendo reproducción y bloqueo de consanguinidad de 3 generaciones en conejos y cuyes).
2. **Onboarding Progresivo (Pequeño vs. Mediano):** sobre una única base de datos puedes operar en **Modo Pequeño (Operación Simple)** o **Modo Mediano (Tecnificado)** mediante 4 módulos esenciales siempre activos y 5 módulos progresivos desbloqueables por crecimiento real o manualmente.
3. **Resiliencia Rural (*Offline-First*):** réplica local navegable en `IndexedDB`, cola de mutaciones idempotente, escáner QR sin conexión y notas de voz grabadas en campo.
4. **Gina (Asistente Operativa de la Granja):** consulta datos en vivo, estructura movimientos diarios desde texto o voz con confirmación humana obligatoria en tarjeta, lee facturas/etiquetas con la cámara, conserva memoria persistente de reglas del predio, entrega un briefing diario proactivo y conversa también por Telegram.
5. **Integración Financiera Automática:** cada venta, compra, baja, evento sanitario o mantenimiento genera trazabilidad de costos, inventarios y cuentas por cobrar/pagar (CxC/CxP).

---

## Detalle por Sección y Módulos

### 1. Inicio, Captura Directa, Escáner QR y Gina
- **Tablero Inicio (`/inicio`):** organizado en grupos enmarcados y sin numeración (**Resumen del día**, **Requiere atención**, **Tareas de hoy** con verificación por evidencia real, **Accesos directos**) y dos paneles plegables estándar (**Resumen del mes / Tablero técnico** y **Completar configuración de finca**).
- **Asistente inicial (Día 1 · 3 pasos):** configura escala, nombre de finca, lugares, animales actuales y saldo inicial de alimento manual o por plantilla CSV.
- **Botón `+ Crear` y Captura Rápida:** apertura directa en modal o formulario exacto sin pasos intermedios + microcápsulas de rentabilidad y cobertura al guardar.
- **Escáner QR Unificado (`/escanear`):** identifica lugares (`LOC-`), ejemplares (`G-`), lotes (`L-`) y activos (`ACT-`), dispara acciones rápidas y enlaza a fichas públicas de trazabilidad (`/lote/[id]`).

### 2. Animales y Lugares de Manejo
- **Directorio Multiespecie (`/animales`):** inventario unificado de las 6 especies con estado, etapa y filtro por lugar.
- **Lugares de Manejo (`/ubicaciones` y `/ubicaciones/[id]`):** gestión de galpones, jaulas, pozas y potreros, capacidad, altitud (m.s.n.m.), tipo de piso, traslados masivos o individuales y etiquetas QR imprimibles.

### 3. Producción (`/produccion`)
- **Huevos (NTC 1240):** registro por tamaño (Jumbo a C) o conteo simple en Modo Pequeño, porcentaje ave-día, autoconsumo, pérdidas y ambiente (T°/HR).
- **Aves y Lotes:** seguimiento de gallinas ponedoras (8 estados y ciclo automático), pollos de engorde (`L-###`) y gallos reproductores (`GA-###`).
- **Reproducción e Incubación:** ciclos de empadre-gestación-parto-destete para conejos y cuyes con alerta de consanguinidad; control de tandas de incubación multi-especie (16–30 días según especie) con nacimientos e índice de eclosión.
- **Adquisiciones, Peso, Mortalidad y Plan de Parvada:** entrada con trazabilidad genética de padres/linaje, pesaje muestral con **CV%** y **EPEF**, registro de bajas con motivo y proyecciones de parvada.
- **Alimentación y Gallinaza:** raciones diarias, dietas mixtas (%MS, %PC, forraje y vitamina C para cuyes), cálculo de FCR y producción automática de gallinaza.

### 4. Inventarios y Almacén / Operaciones
- **Inventarios (`/inventarios/...`):** balance patrimonial consolidado, inventario **PEPS/FIFO** de huevos (alertas de envejecimiento), carne, gallinaza, alimento por bultos/kg con días de autonomía e insumos operativos.
- **Almacén y Operaciones (`/almacen`, `/operaciones/...`):** registro de activos/equipos con **CAPEX/ROI** y QR, mantenimiento preventivo/correctivo periódico, **pilas de compostaje térmico (AGROSAVIA)**, **cierre diario auditable** con hash de integridad y lecturas **IoT** (`ITH`, `NH3`, temperatura, humedad y báscula).

### 5. Planeación y Soberanía Alimentaria
- **Calendario Maestro (`/planeacion/calendario`):** agenda consolidada con rutinas diarias auto-ajustables, hitos de incubación/reproducción, vacunas, retiros, compostaje y vencimientos de cartera.
- **Soberanía Alimentaria (`/soberania`):** trazabilidad de autoconsumo familiar y balance nutricional producido en la finca.

### 6. Sanidad y Bioseguridad
- **Plan Sanitario, Control y Vacunación (`/sanidad/...`):** protocolos por etapa, aplicación de vacunas con deducción de insumos, historial clínico y **candado automático de tiempo de retiro farmacológico** (impide comercializar huevo o carne en carencia).
- **Bioseguridad POE GAB y Bienestar Animal:** listas de chequeo alineadas con **ICA Res. 3651/3652** y **Res. 205/2022 y 8452/2025**.

### 7. Finanzas, Análisis, Exportación, Contactos y Configuración
- **Finanzas (`/finanzas/...`):** ventas en **5 líneas** (huevos, carne, animales en pie, gallinaza y otros), egresos con productos frecuentes y lectura **OCR** de facturas, **CxC/CxP** con abonos, presupuestos con desviación y estado de resultados.
- **Contactos (`/contactos`):** directorio unificado de clientes y proveedores con ubicación, WhatsApp y plazo de crédito.
- **Análisis (`/analisis/...`):** KPIs zootécnicos, curvas ajustadas por raza y altitud, fuentes externas y **contabilidad analítica anti-subsidio cruzado** con prorrateo de indirectos.
- **Exportación y Conectores ERP (`/exportar` y `/api/v1/integrations/*`):** exportación CSV/XLSX y tokens Bearer con alcances de solo lectura (`read:finance`, `read:inventory`, `read:contacts`, `read:production`) para integración con ERPs externos (SIIGO, Alegra, Odoo, Zoho, genérico).
- **API v1 de herramientas del agente (`/api/v1/agent/tools`):** manifiesto JSON de las mismas herramientas que usa Gina (schemas, dominio Jev, confirmación requerida) y ejecución `POST /api/v1/agent/tools/{name}` como el usuario delegante dueño del token. Scopes `agent:read` (consultas) y `agent:write` (escrituras, con expiración obligatoria ≤ 90 días). Las escrituras sensibles devuelven `202` con `actionId` pendiente; se confirman con el mismo token en `POST /api/asistente/acciones/{id}/confirmar`. Rate limit 60 req/min por token y auditoría `origin: external_agent` + `token_id` en `ai_actions`.
- **Servidor MCP (`/api/mcp`):** Streamable HTTP con JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`) para Claude y otros clientes MCP, autenticado con el mismo token de integración y delegado en el mismo ejecutor de la API v1 (sin lógica duplicada, mismos candados sanitarios, RBAC/RLS y piso duro de confirmación). Sin token válido no hay lista ni escrituras anónimas.
- **Configuración (`/configuracion/...`):** **Módulos Progresivos**, **Catálogos en 8 pestañas** (listas, contactos, parámetros, 6 especies, vacunas, pesos, gallinaza y nutrición), **Usuarios y Roles** (`/configuracion/usuarios`), **Kit de Campo** (`/configuracion/kit-campo`), **Suscripción/Plan** (`/configuracion/plan`), **Panel Multi-Granja** (`/configuracion/granjas`) y recuperación segura de acceso (`/login/recuperar`).

### 8. Personal y Nómina (`/finanzas/personal`)
- **Perfiles de personal:** productor propio (trabajo imputado) o apoyo contratado, con documento único por granja, tipo de contrato, periodicidad y tarifa base en COP.
- **Liquidación con prestaciones de ley:** carga prestacional del empleador, deducciones de salud/pensión, ARL por clase de riesgo, auxilio de transporte y retefuente; neto a pagar y costo total para la granja.
- **Snapshots maestros:** cada liquidación congela tarifas y porcentajes vigentes; cambiar la tarifa de un perfil no altera liquidaciones pasadas.
- **Contabilidad sin subsidio cruzado:** el trabajo pagado genera egreso de caja (`cash_expense`); el trabajo propio se imputa como costo económico (`imputed_economic`) sin salida de caja, con prorrateo por especie/lote/ubicación.
- **Impuestos en transacciones y devengo de insumos:** IVA, retefuente e ICA por movimiento con neto liquidado; consumos de insumos con especie, ubicación y costo unitario para el devengo analítico.

### 9. Fuentes Externas Oficiales (`/analisis/fuentes-externas`)
- **Conectores DANE/SIPSA/IDEAM/Banrep:** índices DANE (importación CSV con plantilla), precios SIPSA, alertas IDEAM y series Banrep (SDMX), con sincronización automática por scheduler (`scripts/external-sources-scheduler.mjs`, cron `/api/cron/fuentes-externas` con `CRON_SECRET`).
- **Observaciones, no reemplazos:** los valores externos se guardan como observaciones históricas idempotentes (`external_source_observations`) y el último estado válido por fuente (`external_data_snapshots`); nunca reemplazan automáticamente los datos maestros de la granja.
- **Resiliencia:** si una fuente falla se conserva el último dato válido (`fallback`) y se reintenta en el siguiente ciclo sin repetir la ola completa.

### 10. KPIs de Adopción (`/analisis/adopcion`)
- **Los 5 KPIs del Plan Maestro:** Tiempo de Activación (Día 1 < 10 min), Velocidad de Captura en Campo (< 2 min por registro, incluye muestras offline), Adherencia Semanal (≥ 85 % de días con cierre/actividad desde la semana 3), Integridad Sanitaria y Comercial (bloqueos de retiro y consanguinidad) y Visibilidad Financiera Real (sin subsidio cruzado, punto de equilibrio activo), más la racha de registro como señal conductual.
- **Telemetría persistida en servidor:** duración del onboarding y muestras de duración de cada captura (online u offline) en `telemetry.adoption_metrics`; el tablero distingue granjas pequeñas y medianas para el criterio de adherencia de pilotos.
- **Kit de Campo Semana 4 (`/configuracion/kit-campo`):** entregables PDF, plancha QR y acta de entrega con KPIs para la implementación llave en mano del mediano productor.

### 11. Gina Proactiva, Delegación y Canal Telegram
- **Briefing diario proactivo:** el cron `/api/cron/agente-proactivo` (`scripts/agent-proactive-scheduler.mjs`) genera el parte del día con hallazgos, alertas de anomalía y recomendaciones con deep-links; idempotente por granja/día/tipo (`agent_briefings`). Entrega en inbox de la app, notificación push y Telegram.
- **Política de delegación configurable:** el usuario delega herramienta por herramienta las escrituras rutinarias (`assistant.delegation_policy.v1`); las auto-ejecuciones quedan auditadas como `delegated_auto`. **Piso duro inviolable:** ventas, gastos, pagos, cierres y demás acciones sensibles siempre requieren confirmación humana expresa desde cualquier canal (app, voz, Telegram, API v1, MCP).
- **Canal Telegram bidireccional:** vinculación del chat con código de pairing de un solo uso (`telegram_chats`), consultas y notas de voz con el mismo ejecutor del agente, tarjetas con botones Confirmar/Cancelar para acciones pendientes, parte diario con `/parte` y auditoría `origin: telegram` + `chat_id`.
- **Memoria y conocimiento:** memoria persistente por usuario (`agent_memories`) y corpus de conocimiento derivado de las guías (`consultar_conocimiento`), con sinónimos de campo en el buscador global (Ctrl+K).
- **Navegación asistida:** la herramienta `navegar_app` devuelve deep-links a la pantalla exacta; el widget y Telegram los presentan como botones.
