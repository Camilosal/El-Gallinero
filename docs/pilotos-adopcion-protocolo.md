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

El anexo de aceptación de la marcha blanca de los dos extremos (checklists manuales de G2) se agrega a este documento al ejecutar la Ola 5 del plan.

---

## Anexo A — Resultados de pilotos

_(Pendiente: se llena durante la ejecución operativa de los pilotos. Ningún dato inventado: solo resultados reales con fecha y evidencia.)_

| Piloto | Ruta | Inicio | Fin | TTV | Captura mediana | Adherencia sem. 3 | Racha máx. | Integridad | Veredicto |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| P1 | 1 | — | — | — | — | — | — | — | — |
| P2 | 1 | — | — | — | — | — | — | — | — |
| P3 | 1 | — | — | — | — | — | — | — | — |
| P4 | 2 | — | — | — | — | — | — | — | — |