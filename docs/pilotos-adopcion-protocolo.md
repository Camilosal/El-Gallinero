# Protocolo de Pilotos Reales de Adopción — Rutas 1 y 2

> Task A3 del [plan de cierre de Rutas 1–2](superpowers/plans/2026-11-17-cierre-rutas-1-2-armonizacion-agente-navegacion.md).
> Tarea **operativa**, no de código: define cómo se reclutan, instalan, acompañan y evalúan los pilotos que llenan de datos reales el tablero [/analisis/adopcion](../src/app/(app)/analisis/adopcion/page.tsx).
> Estado: vigente desde nov-17-2026. La Ruta 3 institucional está congelada y no participa en estos pilotos.

## 1. Objetivo y alcance

Validar en campo, con usuarios reales de los dos extremos del espectro, que:

- El **pequeño productor** (Ruta 1, autoguiada, baja apropiación tecnológica) arranca solo, registra en menos de 2 minutos y sostiene el hábito diario sin acompañamiento permanente.
- El **mediano productor** (Ruta 2, llave en mano) recibe una implementación de 4 semanas con acta de entrega basada en KPIs medibles, no en percepciones.

## 2. Composición de la cohorte

| Piloto | Ruta | Perfil | Acompañamiento |
| :--- | :--- | :--- | :--- |
| P1 | 1 · Autoguiada | Granja pequeña (≤ 150 aves, 1 especie, celular propio, señal intermitente) | Solo soporte remoto |
| P2 | 1 · Autoguiada | Granja pequeña mixta (aves + cuyes/conejos, familiar) | Solo soporte remoto |
| P3 | 1 · Autoguiada | Granja pequeña con operario (el dueño no registra personalmente) | Solo soporte remoto |
| P4 | 2 · Llave en mano | Granja mediana (≥ 2 especies o > 200 aves, equipo de 2+ personas) | Implementador 4 semanas (kit de campo) |

- **Duración mínima: 21 días** por piloto (3 semanas completas de telemetría).
- Los 3 pilotos pequeños deben ser granjas **distintas** a las del equipo desarrollador.
- P4 usa el [Kit de Campo](../src/app/(app)/configuracion/kit-campo/page.tsx) completo: Semana 1 arranque, Semana 2 operación, Semana 3 análisis, Semana 4 marcha blanca y acta.

## 3. Consentimiento y soberanía de datos

Antes del Día 1, cada piloto firma (físico o por mensaje confirmado):

1. **Consentimiento de datos** (Ley 1581 de 2012): qué se registra, que los datos son de la granja, que la telemetría de adopción (duración de captura y wizard, días activos) se usa solo para mejorar el producto y nunca se comparte con terceros.
2. **Canal de soporte**: grupo o bot de **Telegram** vinculado (WhatsApp no está disponible como canal). El vínculo se genera en `/configuracion/modulos` con código de un solo uso; el chat hereda el rol del usuario que lo vincula.
3. **Derecho de salida**: en cualquier momento el piloto puede pedir exportación completa (`/exportar`) y borrado de su granja; el piloto se da de baja sin penalidad.

## 4. Instalación en campo — checklist obligatorio (Día 0–1)

El implementador (P4) o el propio piloto guiado por la guía `primeros-pasos` (P1–P3) verifica y marca:

- [ ] PWA instalada en el celular principal (ícono en pantalla de inicio).
- [ ] Wizard Día 1 completado en **< 10 min** (meta del Plan Maestro; objetivo interno < 5 min) sin transcribir cuadernos antiguos.
- [ ] Plancha QR plastificada pegada en galpón/jaula/poza (kit 7.1) y escaneo probado desde `/escanear`.
- [ ] **Prueba offline real**: modo avión → registrar huevos o bajas → quitar modo avión → verificar sincronización (outbox vacío).
- [ ] Primera micro-cápsula recibida en `/inicio` (utilidad del día o cobertura de alimento).
- [ ] Bot de Telegram vinculado con código de pairing y **parte diario recibido** (`/parte` o briefing automático).
- [ ] Roles creados si hay equipo (P3/P4): operario no puede vender ni cerrar el día sin permiso.
- [ ] Muestras de telemetría visibles en `/analisis/adopcion` (captura y arranque).

## 5. Rutina de seguimiento (21 días)

| Cuándo | Qué | Quién |
| :--- | :--- | :--- |
| Diario | El piloto registra con captura rápida (huevos, alimentación, bajas, gasto/venta si aplica) y cierre diario cuando exista el hábito | Piloto |
| Diario 06:00 | Briefing proactivo de Gina (inbox + push/Telegram si el piloto lo activó) | Sistema |
| Semanal (lunes) | Revisión de `/analisis/adopcion` y `/configuracion/fallas` de cada granja piloto; llamada o mensaje de 15 min si algún semáforo está en rojo | Implementador |
| Semana 3 | Verificación de adherencia ≥ 85 % (criterio temprano; si no se cumple, intervención de hábito antes de seguir) | Implementador |
| Semana 4 (P4) | Marcha blanca en vivo con el panel de KPIs embebido en kit-campo y firma del acta de entrega | Implementador + dueño |

## 6. Criterios de éxito / fracaso por KPI (Plan Maestro §8)

| KPI | Meta (éxito) | Zona gris | Fracaso → acción |
| :--- | :--- | :--- | :--- |
| Time-to-Value (arranque Día 1) | < 10 min | 10–30 min | > 30 min o wizard abandonado: revisar pasos del wizard con el piloto y corregir fricción antes que cualquier feature nueva |
| Velocidad de captura (mediana) | < 120 s | 120–240 s | > 240 s sostenido: simplificar el flujo del modo usado (menos interacciones, defaults más inteligentes) |
| Adherencia semanal de cierre/registro | ≥ 85 % desde semana 3 | 60–85 % | < 60 % en 2 semanas seguidas: el hábito no prendió; rediseñar recordatorios/parte diario con el piloto |
| Racha de días con captura | ≥ 7 días | 3–6 días | Racha rota 2+ veces por semana: revisar valor percibido del registro (¿la micro-cápsula le sirve?) |
| Integridad sanitaria | ≥ 90 % y **0 despachos que violen retiro** | 60–90 % | Cualquier despacho violado es fracaso crítico: bug prioritario inmediato |
| Visibilidad financiera (P4 y P2/P3 si aplica) | ≥ 1 centro de costo activo con prorrateo | — | Sin centros de costo en semana 4 (P4): no se firma el acta |

**Criterio global de la cohorte:** al menos **2 de las 3 granjas pequeñas** con adherencia ≥ 85 % en la semana 3, y P4 con acta firmada. Si no se cumple, el plan de cierre no se da por terminado (ver G2 del plan).

## 7. Bucle de corrección — prioridad absoluta de pilotos

1. Toda falla reportada por un piloto se etiqueta **`piloto-r1`** o **`piloto-r2`** en `/configuracion/fallas` (además de los tags de módulo existentes).
2. Las fallas etiquetadas de piloto entran como **bug prioritario por encima de cualquier funcionalidad nueva** de los bloques B–D del plan (regla de merge del plan).
3. Cada corrección se verifica con el piloto que la reportó (mensaje por Telegram o llamada) y se registra la evidencia en la ficha de la falla.
4. Los hallazgos de usabilidad que no son bugs (p. ej. "no entiendo qué es prorrateo") se convierten en mejoras de guías (`/manual`) o de sinónimos del buscador, no en código nuevo.

## 8. Registro de resultados

Al cierre de los 21 días de cada piloto, el implementador documenta en este archivo (anexo) o en la bitácora:

- Granja (seudónimo), ruta, fechas, dispositivo y condiciones de señal.
- Los 6 KPIs finales tomados de `/analisis/adopcion` (captura de pantalla o valores).
- Fallas reportadas, etiquetas y estado de corrección.
- Veredicto: **éxito / zona gris / fracaso** por KPI y global.
- Lecciones que alimentan guías, sinónimos del buscador y prompt del agente.

El anexo de aceptación de la marcha blanca de los dos extremos (checklists manuales de G2) está en el **Anexo B** de este documento.

---

## Anexo A — Resultados de pilotos

_(Pendiente: se llena durante la ejecución operativa de los pilotos. Ningún dato inventado: solo resultados reales con fecha y evidencia.)_

| Piloto | Ruta | Inicio | Fin | TTV | Captura mediana | Adherencia sem. 3 | Racha máx. | Integridad | Veredicto |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| P1 | 1 | — | — | — | — | — | — | — | — |
| P2 | 1 | — | — | — | — | — | — | — | — |
| P3 | 1 | — | — | — | — | — | — | — | — |
| P4 | 2 | — | — | — | — | — | — | — | — |

---

## Anexo B — Aceptación de marcha blanca de los dos extremos (G2)

> Task G2 del [plan de cierre](superpowers/plans/2026-11-17-cierre-rutas-1-2-armonizacion-agente-navegacion.md).
> Checklists **manuales** que se ejecutan en una granja real de cada perfil (no en el entorno de desarrollo).
> **Cualquier fallo bloquea el cierre del plan**: se corrige, se verifica con el piloto que lo reportó y se repite el checklist completo antes de dar por terminada la Ola 5.

### B.1 Perfil baja apropiación (Ruta 1 · granja pequeña)

Ejecutor: el propio piloto (o el implementador observando sin intervenir). Dispositivo: celular principal del piloto con señal intermitente. **Todo el flujo debe completarse sin tocar un menú de configuración.**

- [ ] 1. Instalar la PWA desde el navegador (ícono en pantalla de inicio) sin ayuda técnica.
- [ ] 2. Completar el wizard Día 1 en **< 5 min** (cronometrado; solo inventario vivo inicial, sin transcribir cuadernos).
- [ ] 3. Escanear la plancha QR del galpón desde `/escanear` y llegar a la ficha correcta.
- [ ] 4. Poner modo avión → registrar huevos en **< 2 min** y ≤ 4 interacciones → verificar que queda en el outbox local.
- [ ] 5. Recibir la primera micro-cápsula en `/inicio` (utilidad del día o cobertura de alimento).
- [ ] 6. Quitar modo avión → verificar sincronización automática (outbox vacío, registro visible en producción).
- [ ] 7. Recibir el briefing proactivo por push o Telegram (según el canal activado durante el Día 1, sin abrir configuración).
- [ ] 8. Pedir por voz al asistente: **"anota 3 bajas en el galpón norte"** → recibir tarjeta de confirmación → confirmar → verificar el registro de mortalidad y la auditoría con origen de voz.

### B.2 Perfil remoto por Telegram (Ruta 1 · dueño que no abre la app)

Ejecutor: piloto con chat de Telegram vinculado. Requiere bot configurado en el servidor (`TELEGRAM_BOT_TOKEN`).

- [ ] 1. Generar código de pairing en `/configuracion/modulos` → enviar `/start <código>` al bot → verificar vínculo activo (el chat hereda el rol del usuario).
- [ ] 2. Enviar nota de voz: **"vendí dos cubetas a doce mil cada una"** → el bot responde con tarjeta de botones **Confirmar / Cancelar** (la venta NO se ejecuta sin confirmación: piso duro).
- [ ] 3. Confirmar desde Telegram → verificar en la app que la venta quedó registrada con el total correcto.
- [ ] 4. Verificar en el historial de acciones la auditoría con **`origin: telegram`** y el chat vinculado.
- [ ] 5. Enviar `/parte` → recibir el parte diario del día con los hallazgos de la granja.

### B.3 Perfil agéntico (Ruta 2 · integración externa / MCP)

Ejecutor: implementador con un cliente MCP o llamadas HTTP a la API v1. Granja mediana con datos operativos.

- [ ] 1. Generar token de integración con scope **`agent:write`** desde `/configuracion/modulos`.
- [ ] 2. Conectar un cliente MCP al endpoint de la granja → listar herramientas → verificar que el manifiesto expone los 68 tools con sus notas de confirmación.
- [ ] 3. Consultar KPIs por herramienta de lectura (p. ej. resumen de granja) → respuesta correcta sin confirmación.
- [ ] 4. Registrar una venta por API/MCP → verificar que queda **pendiente de confirmación** (piso duro inviolable desde canal externo).
- [ ] 5. Confirmar la venta desde la app (sesión humana) → verificar el registro y la auditoría con origen **`human_confirmed`** conservando el **`token_id`** del agente externo que la propuso. Si se confirma con el propio token vía API/MCP, el origen queda **`external_agent`**.
- [ ] 6. Activar delegación de una herramienta rutinaria (no piso duro) en el panel de delegación → ejecutarla por API/MCP → verificar auto-ejecución sin tarjeta, auditada con origen **`external_agent`** y el token (el origen `delegated_auto` aplica a delegaciones del canal asistente dentro de la app).
- [ ] 7. Revocar el token → repetir una llamada → verificar respuesta **401**.

### B.4 Registro de resultados de la marcha blanca

| Checklist | Granja / perfil | Fecha | Ejecutor | Resultado (pasa / fallo) | Fallas y correcciones |
| :--- | :--- | :--- | :--- | :--- | :--- |
| B.1 Baja apropiación | — | — | — | — | — |
| B.2 Remoto Telegram | — | — | — | — | — |
| B.3 Agéntico | — | — | — | — | — |

_(Pendiente de ejecución operativa en granjas reales. Ningún dato inventado: solo resultados reales con fecha y evidencia. Mientras alguna fila no esté en "pasa", el plan de cierre permanece abierto.)_

### B.5 Ensayos técnicos previos (no son aceptación operativa)

Antes de la marcha blanca en granjas reales se ejecutaron **ensayos técnicos end-to-end de los checklists B.3 (agéntico) y B.2 (Telegram)** contra la instancia de pruebas (`el_gallinero_test`, servidor dev en `:3210`), con usuario verificador y datos sintéticos. Su propósito es validar en runtime la pila agéntica D1/D2/B3 y el canal remoto C3, y reducir riesgo antes de los pilotos; **no sustituyen ni cuentan como la aceptación operativa de B.4** (que exige granjas reales, ≥21 días y adherencia medida).

#### B.5.1 Checklist B.3 · perfil agéntico (API v1 / MCP)

- **Fecha:** 17-nov-2026. **Resultado:** 12/12 pasos OK.
- **Cadena verificada:** token de integración (`agent:read`/`agent:write`) → MCP `initialize` + `tools/list` (68 tools con notas de confirmación) → lectura de KPIs sin confirmación → escritura rutinaria de producción auto-ejecutada → venta por MCP queda **pendiente** (piso duro) → confirmación humana desde la app → auditoría `human_confirmed` conservando `token_id` → delegación de herramienta rutinaria (`registrar_presupuesto` confirm→auto) → auto-ejecución por MCP auditada `external_agent` + `token_id` → revocación del token → `tools/list` posterior **401**.
- **Semántica de auditoría confirmada en `src/lib/agent/runtime.ts`:** el canal externo (API v1 / MCP) conserva `external_agent` + `token_id`; `delegated_auto` aplica solo a delegaciones del canal asistente de la app; la confirmación humana desde sesión de app registra `human_confirmed` y retiene el `token_id` del agente que propuso la acción.
- **Higiene del ensayo:** registros de negocio sintéticos eliminados (transacción, producción, presupuesto), gallinas de prueba restauradas a su ubicación original, política de delegación restituida a `confirm`. La auditoría `ai_actions` se conserva como evidencia (3 acciones: producción `external_agent`, venta `human_confirmed`, presupuesto `external_agent`, todas `executed`).
- **Hallazgo de setup (no de producto):** la granja de test no tenía gallinas en etapa productiva asociadas a un lugar de manejo; la validación biológica de postura (`getExpectedDailyProduction`) filtra por lugar y etapa, por lo que el ensayo asignó temporalmente gallinas en postura al lugar creado. Es comportamiento correcto del producto, no un defecto.

#### B.5.2 Checklist B.2 · perfil remoto por Telegram (C3)

- **Fecha:** 18-nov-2026. **Resultado:** 18/18 pasos OK (tras corregir un defecto real de auditoría, ver abajo).
- **Cadena verificada:** webhook con secreto inválido → **401**; chat no vinculado → instrucciones de pairing; generación de código de un solo uso (10 min) → `/start CODIGO` vincula el chat a **ese usuario** (rol/RBAC heredados); reuso del código → rechazado; código inválido → rechazado; comandos deterministas `/estado` `/resumen` `/parte` `/ayuda` sin LLM; venta propuesta por MCP queda **pendiente** (piso duro) → confirmación por **teclado inline** desde Telegram → ejecutada con auditoría `origin: telegram` + `chat_id`; callback de **otro usuario** vinculado → **403** (la acción no es suya); texto libre y nota de voz **degradan con mensaje claro** sin LLM/STT configurados (no crashean); `/desvincular` revoca el vínculo y corta el canal (mensajes y callbacks posteriores → rechazados).
- **Defecto real encontrado y corregido:** la confirmación remota por `callback_query` registraba `origin: telegram` pero **dejaba `chat_id` en null** cuando la acción pendiente había sido creada por otro canal (API v1 / MCP). El plan (C3 paso 8 / criterio 4) exige `origin: telegram` **y** `chat_id` en toda acción originada en Telegram. La ruta de texto libre ya estampaba el chat; la de callback no. **Fix:** `src/lib/agent/telegram-channel.ts` estampa `chat_id` al resolver la acción por teclado inline (confirmación y cancelación). **Prueba de regresión:** `tests/telegram-agent-channel.test.ts` — acción pendiente creada por otro canal (`chat_id` null, `origin external_agent`) confirmada por callback de Telegram → `executed`, `origin telegram`, `chat_id` del chat. Suite del canal 12/12 verde.
- **Higiene del ensayo:** chats de prueba, códigos de pairing, usuario secundario y registros de negocio sintéticos eliminados; gallinas restauradas a su ubicación original; token de integración revocado. La auditoría `ai_actions` se conserva como evidencia (producción `external_agent` y venta `telegram` con `chat_id`, ambas `executed`).
- **Nota de configuración:** el ensayo usó `TELEGRAM_BOT_TOKEN` dummy y `TELEGRAM_WEBHOOK_SECRET` de prueba en el servidor dev; el envío saliente a la Bot API degrada sin reintentos (C2 paso 3). La recepción de voz→agente con STT real y la narración LLM requieren claves reales y se validan en la marcha blanca operativa.