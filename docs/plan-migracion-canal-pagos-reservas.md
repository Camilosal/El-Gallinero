# Plan monitoreable: migración del canal de pagos a Reservas

**Iniciativa:** centralizar en Reservas la creación del checkout Wompi y la recepción de sus eventos para las suscripciones de IwaGranja.
**Versión:** 1.0
**Actualizado:** 2026-11-19
**Estado general:** Planificado; implementación no iniciada dentro de este plan.
**Alcance inicial:** pagos prepago de Productor. Organización se gestiona en un frente posterior hasta que su modelo de activación y cuotas esté listo.
**Producción:** no cambiar configuración, llaves ni URL de eventos hasta superar las puertas de salida de este documento.

## Seguimiento

- **Avance:** 0 tareas cerradas con evidencia.
- **Próxima revisión:** por programar.
- **Responsable coordinador:** por asignar.
- **Registro de actualizaciones:** anotar cada cambio de estado, fecha, enlace a PR/commit o evidencia, y bloqueador si existe.

### Estados permitidos

`Pendiente` · `En curso` · `Bloqueado` · `Hecho` · `No aplica`.

Una tarea solo pasa a **Hecho** cuando su criterio de aceptación tiene evidencia enlazada. Cambiar la casilla de la tarea y completar su campo `Evidencia`.

## Resultado y límites de responsabilidad

| Sistema | Responsabilidad que conserva |
|---|---|
| IwaGranja | Catálogo y tarifas; cálculo de precio final; elegibilidad y FarmID de renovación; aceptación y versión de condiciones; asociación del pago con la granja; activación o extensión de la suscripción y sus permisos. |
| Reservas | API autenticada para crear/recuperar intentos de pago; generación del checkout Wompi; registro del estado de la transacción; recepción y verificación del webhook Wompi; entrega reintentable del resultado a la aplicación de origen. |
| Wompi | Procesamiento del pago y notificación de eventos al webhook central de Reservas. |

IwaGranja es la autoridad del importe comercial y del derecho de acceso. Reservas es la autoridad del estado de la transacción Wompi. La redirección del navegador informa al usuario y consulta el estado; nunca concede el plan por sí sola. Wompi recomienda usar el webhook del backend para validar el resultado y mantener referencias únicas por pago ([Web Checkout](https://docs.wompi.co/docs/colombia/widget-checkout-web/), [Eventos](https://docs.wompi.co/docs/colombia/eventos/)).

**Política comercial que no debe alterarse en esta migración:** moneda COP; impuestos según la política aprobada vigente; prepago sin renovación automática; Productor con plazos 3, 6, 12 y 18 meses; fidelidad únicamente en renovaciones elegibles y plazos aprobados. No enviar ni mostrar costos internos o márgenes.

## Arquitectura de destino

1. La confirmación del modal llega al backend de IwaGranja con la selección del usuario y la aceptación de condiciones.
2. IwaGranja verifica FarmID cuando corresponda, calcula el total con el catálogo vigente y guarda localmente el intento pendiente, la versión de precio y la aceptación.
3. IwaGranja solicita a Reservas un intento de pago mediante una credencial entre servidores. Reservas aplica idempotencia y devuelve el mismo intento si la petición se repite.
4. Reservas guarda un pago genérico, crea el checkout con sus credenciales Wompi y devuelve la URL segura. El navegador recibe solo esa URL.
5. Wompi envía `transaction.updated` a Reservas. Reservas valida firma, ambiente, referencia, monto, moneda y estado; persiste el evento y crea una notificación pendiente para IwaGranja.
6. Reservas envía una notificación firmada y reintentable. IwaGranja cruza la referencia con su intento local y activa o extiende la suscripción en una transacción idempotente.
7. La página de retorno consulta el estado propio de IwaGranja y muestra aprobado, pendiente, rechazado o en revisión.

### Contrato de integración propuesto

**Crear o recuperar intento:** `POST /api/payment-intents` (ruta provisional). Solicitud mínima: `sourceApp`, `purpose`, `idempotencyKey`, `reference`, `amountInCents`, `currency`, `description`, `expiresAt`, `returnUrl` y los datos mínimos del pagador. Reservas valida que `currency` sea COP, que el importe sea entero positivo y que el retorno pertenezca a una lista permitida. No confiar en importes enviados por el navegador.

**Respuesta:** `intentId`, `reference`, `status` y `checkoutUrl`.

**Evento de retorno:** `eventId` o clave deduplicable, `sourceApp`, `reference`, `provider`, `providerTransactionId`, `status`, `amountInCents`, `currency`, `paidAt`, `environment` y firma interna con marca de tiempo. El evento no debe llevar secretos Wompi.

El intento genérico puede ser un nuevo tipo de contenido o una ampliación compatible de `pagos`; no se debe crear una reserva falsa. La decisión técnica se cierra en la tarea `API-01`, comprobando también los informes y pantallas administrativas de Reservas.

## Tablero de trabajo

Los responsables están asignados por sistema/función, no por persona. Fechas objetivo quedan por programar según disponibilidad del equipo.

### Fase 0 — Gobierno, alcance y línea base

- [ ] **GOV-01 — Confirmar comercio y ambientes.** Responsable: Administración Wompi + Infra. Prioridad: P0. Depende de: ninguna.
  **Cierre:** comercio, destino de recaudo, llaves por ambiente y URL de eventos Sandbox/Producción quedan confirmados por canal seguro; se documenta quién puede cambiar la configuración. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **GOV-02 — Congelar reglas comerciales de la primera salida.** Responsable: Producto + IwaGranja. Prioridad: P0. Depende de: GOV-01.
  **Cierre:** aprobación escrita de planes, moneda, impuestos, tarifas, descuentos, renovaciones, devoluciones y textos legales; Organización queda marcada como diferida o se amplía expresamente el alcance. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **OPS-01 — Levantar línea base de pagos en curso.** Responsable: IwaGranja + Reservas. Prioridad: P0. Depende de: GOV-01.
  **Cierre:** inventario con referencia, origen, monto, moneda, estado, fecha, ID de transacción si existe y vínculo de suscripción/reserva. No copiar secretos ni datos de tarjeta. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **SEC-01 — Sanear documentación con credenciales y rotar secretos vigentes.** Responsable: Seguridad + Administración Reservas. Prioridad: P0. Depende de: GOV-01.
  **Cierre:** documento local de integración sin credenciales; llaves/tokens potencialmente vigentes rotados; registro de rotación guardado en gestor seguro, nunca en este archivo. **Estado:** Pendiente. **Evidencia:** por agregar.

### Fase 1 — Correcciones de integridad y seguridad en IwaGranja

- [ ] **BUG-01 — Alinear la validación de compra con el plazo de 18 meses.** Responsable: IwaGranja. Prioridad: P0. Depende de: GOV-02.
  **Cierre:** cotizador, snapshot legal, webhook y activación aceptan los períodos aprobados; el caso de 18 meses se activa correctamente tras un evento aprobado. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **SEC-02 — Hacer fail-closed la firma del webhook.** Responsable: IwaGranja + Seguridad. Prioridad: P0. Depende de: GOV-01.
  **Cierre:** sin secreto de eventos configurado, ningún webhook se valida; eliminar el secreto predeterminado conocido; documentar rotación y prueba de firma inválida. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **BUG-02 — Definir y procesar el ciclo completo de estados.** Responsable: Producto + IwaGranja + Reservas. Prioridad: P0. Depende de: GOV-02.
  **Cierre:** estados `created`, `pending`, `approved`, `declined`, `error`, `expired`, `voided` y `refunded` mapeados; decisión documentada sobre el efecto de anulación/reembolso en una suscripción ya activada. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **BUG-03 — Hacer atómica la aprobación y extensión de suscripción.** Responsable: IwaGranja. Prioridad: P0. Depende de: BUG-02.
  **Cierre:** actualización del pago y extensión de período ocurren una sola vez aun con eventos repetidos o concurrentes; queda prueba de concurrencia. **Estado:** Pendiente. **Evidencia:** por agregar.

### Fase 2 — Capacidad genérica de pagos en Reservas

- [ ] **API-01 — Definir el modelo de intento genérico.** Responsable: Reservas. Prioridad: P0. Depende de: GOV-02.
  **Cierre:** modelo con origen, propósito, referencia externa única, importe entero en centavos, moneda, vencimiento, estado, transacción Wompi y metadatos acotados; relaciones de reserva y orden opcionales; administración existente no se rompe. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **API-02 — Autenticar llamadas de servidor a servidor.** Responsable: Reservas + IwaGranja + Seguridad. Prioridad: P0. Depende de: API-01.
  **Cierre:** credencial por aplicación o HMAC con timestamp, comparación segura, rotación y rechazo de replay; secretos solo en backend; límites de uso y auditoría por `sourceApp`. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **API-03 — Implementar creación/recuperación idempotente del checkout.** Responsable: Reservas. Prioridad: P0. Depende de: API-01, API-02.
  **Cierre:** unicidad de `(sourceApp, idempotencyKey)` y de referencia; reintentos devuelven el mismo intento; monto, moneda, entorno y retorno se validan en servidor. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **API-04 — Persistir notificaciones de salida con reintentos.** Responsable: Reservas. Prioridad: P0. Depende de: API-01.
  **Cierre:** evento aprobado/rechazado/anulado se guarda antes de responder a Wompi; despacho reintentable con backoff, ACK de IwaGranja y cola de fallos visibles. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **API-05 — Enrutar webhooks sin romper reservas y órdenes.** Responsable: Reservas. Prioridad: P0. Depende de: API-01, API-04.
  **Cierre:** `ORD-`, `RSV-` y el nuevo propósito de IwaGranja se resuelven por registros tipados; referencias externas sin correspondencia se guardan como no conciliadas, sin activar productos. Reservas y órdenes conservan su comportamiento. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **API-06 — Validar el pago con datos autoritativos.** Responsable: Reservas. Prioridad: P0. Depende de: API-03, API-05.
  **Cierre:** firma Wompi, ambiente, importe exacto, COP y referencia se contrastan con el intento guardado; la URL de retorno usa una lista permitida; el callback visual no cambia el estado financiero. **Estado:** Pendiente. **Evidencia:** por agregar.

### Fase 3 — Integración y experiencia en IwaGranja

- [ ] **IWG-01 — Adaptar el checkout para pedir el enlace a Reservas.** Responsable: IwaGranja. Prioridad: P0. Depende de: API-03.
  **Cierre:** IwaGranja recalcula y conserva quote, FarmID, aceptación legal, usuario y versión de política; crea el intento local y llama al API de Reservas. Ante timeout, recupera el mismo intento. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **IWG-02 — Recibir y validar eventos internos firmados.** Responsable: IwaGranja + Seguridad. Prioridad: P0. Depende de: API-04, API-06, BUG-03.
  **Cierre:** IwaGranja verifica firma, antigüedad, referencia, monto, moneda, ambiente y estado contra su pago local; activa solo al recibir evento auténtico y aprobado. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **IWG-03 — Mostrar estado posterior al checkout.** Responsable: IwaGranja. Prioridad: P1. Depende de: IWG-02.
  **Cierre:** la pantalla de retorno consulta un endpoint autenticado por usuario/granja y muestra pendiente, aprobado, rechazado o en revisión; refrescar la página no crea otro cobro. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **IWG-04 — Mantener compatibilidad durante el corte.** Responsable: IwaGranja + Reservas. Prioridad: P0. Depende de: OPS-01, API-05.
  **Cierre:** cada pago legado `IWG-` pendiente puede terminar o expirar con conciliación; ningún evento se descarta durante el cambio de URL de Wompi. **Estado:** Pendiente. **Evidencia:** por agregar.

### Fase 4 — Duplicados, pagos huérfanos y conciliación

- [ ] **DATA-01 — Construir reporte de conciliación entre los dos registros.** Responsable: IwaGranja + Reservas. Prioridad: P0. Depende de: OPS-01, API-01.
  **Cierre:** reporte por referencia que compara importe, moneda, estado, transacción Wompi, aplicación de origen y efecto de suscripción/reserva. Es de solo lectura y no modifica datos. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **DATA-02 — Detectar y clasificar duplicados.** Responsable: Datos + ambos sistemas. Prioridad: P0. Depende de: DATA-01.
  **Cierre:** identificar referencias repetidas, varias transacciones por intento, dobles intentos activos y aprobaciones repetidas; clasificar como duplicado técnico, reintento legítimo o compra distinta. No fusionar pagos aprobados/reembolsados automáticamente. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **DATA-03 — Registrar y resolver huérfanos.** Responsable: Reservas + IwaGranja. Prioridad: P0. Depende de: API-04, DATA-01.
  **Cierre:** detectar intentos locales sin remoto, intentos remotos sin pago local, eventos sin referencia conocida y pagos aprobados sin suscripción aplicada; asignar causa, responsable y resolución. No conceder acceso a un huérfano sin conciliación. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **DATA-04 — Expirar pendientes antiguos sin borrar auditoría.** Responsable: Reservas + IwaGranja. Prioridad: P1. Depende de: BUG-02, DATA-01.
  **Cierre:** política de expiración coherente entre ambos servicios; liberar solo reservas/cupos que pertenezcan a reservas; guardar historial y reconciliar pagos que lleguen fuera de tiempo. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **DATA-05 — Definir corrección de datos con aprobación.** Responsable: Datos + Finanzas/Operaciones. Prioridad: P1. Depende de: DATA-02, DATA-03.
  **Cierre:** procedimiento para duplicados y huérfanos con antes/después, razón, operador, fecha y respaldo; no borrar registros financieros históricos. **Estado:** Pendiente. **Evidencia:** por agregar.

### Fase 5 — Pruebas de aceptación y seguridad

- [ ] **QA-01 — Probar consistencia de precio y condiciones.** Responsable: QA + IwaGranja. Prioridad: P0. Depende de: BUG-01, IWG-01.
  **Cierre:** Productor con 1, 3, 10 y 25 usuarios; plazos 3, 6, 12 y 18; renovación elegible/no elegible; FarmID válido/inválido; caso aprobado de 10 usuarios por 12 meses produce exactamente el total contractual aprobado. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **QA-02 — Probar estados, firmas y datos incorrectos.** Responsable: QA + ambos sistemas. Prioridad: P0. Depende de: API-06, IWG-02.
  **Cierre:** aprobado, pendiente, rechazado, error y `VOIDED`; firmas inválidas, importe/moneda incorrectos, referencia desconocida y ambiente cruzado no activan la suscripción. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **QA-03 — Probar duplicados, concurrencia y reintentos.** Responsable: QA + ambos sistemas. Prioridad: P0. Depende de: API-03, API-04, BUG-03.
  **Cierre:** doble clic, POST repetido, webhook repetido/concurrente y callback interrumpido generan un solo cobro lógico y una sola extensión; la cola reanuda el evento tras restaurar el servicio. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **QA-04 — Probar regresión de pagos actuales de Reservas.** Responsable: QA + Reservas. Prioridad: P0. Depende de: API-05.
  **Cierre:** checkout y webhook de órdenes y reservas mantienen su comportamiento para `ORD-` y `RSV-`; inventario/cupos y estados no se modifican para pagos de suscripción. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **SEC-03 — Revisar exposición, autenticación y redirecciones.** Responsable: Seguridad. Prioridad: P0. Depende de: API-02, IWG-02.
  **Cierre:** probar API sin credencial, replay de firma, URL de retorno externa, datos sensibles, secretos en logs y acceso cruzado entre granjas. No se expone clave privada, secreto de integridad/eventos, costos internos ni márgenes. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **QA-05 — Ensayar recuperación y reversión.** Responsable: Operaciones + ambos sistemas. Prioridad: P0. Depende de: DATA-03, QA-03.
  **Cierre:** runbook probado para Reservas/IwaGranja fuera de servicio, cola detenida, Wompi lento, conciliación manual y vuelta temporal al flujo anterior sin perder pagos. **Estado:** Pendiente. **Evidencia:** por agregar.

### Fase 6 — Despliegue controlado y operación

- [ ] **REL-01 — Desplegar primero en desarrollo/Sandbox.** Responsable: DevOps + ambos sistemas. Prioridad: P0. Depende de: QA-01 a QA-05.
  **Cierre:** URL de eventos Sandbox dedicada y recorridos completos verificados sin dinero real. Wompi documenta separación de URLs por ambiente ([Eventos](https://docs.wompi.co/docs/colombia/eventos/)). **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **REL-02 — Preparar corte de Producción.** Responsable: DevOps + Administración Wompi. Prioridad: P0. Depende de: REL-01, GOV-01, IWG-04.
  **Cierre:** respaldo de configuración, lista de referencias pendientes, ventana de cambio, responsables de guardia, URL central probada y reversión documentada. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **REL-03 — Habilitar gradualmente Productor.** Responsable: Producto + DevOps. Prioridad: P0. Depende de: REL-02.
  **Cierre:** bandera permite habilitar/deshabilitar nuevos intentos; primeras operaciones conciliadas contra Wompi, Reservas e IwaGranja; no hay pagos huérfanos ni divergencias. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **REL-04 — Retirar checkout directo después del drenaje.** Responsable: DevOps + IwaGranja. Prioridad: P1. Depende de: REL-03, DATA-01.
  **Cierre:** todos los pagos directos pendientes cerrados o encaminados; secretos Wompi retirados de IwaGranja solo tras validar que no sirven a otro flujo; registros históricos siguen disponibles. **Estado:** Pendiente. **Evidencia:** por agregar.

### Fase 7 — Organización (hito separado)

- [ ] **ORG-01 — Definir titular, identificador y estructura del contrato institucional.** Responsable: Producto + Operaciones. Prioridad: P1. Depende de: GOV-02.
  **Cierre:** definido cómo se identifica organización/cohorte, quién acepta condiciones, cómo se verifica continuidad y a qué beneficiarios aplica el pago. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **ORG-02 — Definir y probar la activación de cuotas/beneficiarios.** Responsable: IwaGranja + Producto. Prioridad: P1. Depende de: ORG-01.
  **Cierre:** compra aprobada activa límites y beneficiarios una sola vez; una renovación no duplica implementación ni kit; una ampliación tiene regla explícita. **Estado:** Pendiente. **Evidencia:** por agregar.
- [ ] **ORG-03 — Habilitar checkout de Organización.** Responsable: Reservas + IwaGranja. Prioridad: P1. Depende de: ORG-02, QA-02, QA-03, SEC-03.
  **Cierre:** la cotización, checkout, pago, conciliación, continuidad y permisos coinciden para 25, 50, 150 y 500 beneficiarios; oferta y checkout se habilitan conjuntamente. **Estado:** Pendiente. **Evidencia:** por agregar.

## Duplicados y huérfanos: reglas operativas

| Caso | Detección | Resolución permitida |
|---|---|---|
| Doble envío del navegador | Misma aplicación y clave de idempotencia | Devolver el mismo intento y URL; no crear una nueva referencia. |
| Múltiples intentos pendientes para la misma compra | Misma granja y selección comercial todavía vigente | Recuperar el vigente o marcarlo abandonado antes de permitir uno nuevo. |
| Webhook repetido | Misma referencia/transacción/estado/fecha de evento | Registrar repetición y responder idempotentemente; activar/extender una sola vez. |
| Dos transacciones Wompi para una referencia | Más de un ID de transacción vinculado a la misma referencia | Poner en revisión; no aplicar una segunda extensión ni hacer reembolso automático. |
| Evento Wompi sin pago local/remoto | Referencia sin intento conocido | Guardar en bandeja de no conciliados, alertar y revisar; jamás otorgar acceso por inferencia. |
| Pago aprobado sin notificación a IwaGranja | Outbox pendiente o pago central aprobado sin suscripción aplicada | Reintentar evento firmado; si se agota el mecanismo automático, conciliación manual con auditoría. |
| Intento creado solo en un sistema | Comparación de registros por referencia | Reintentar por idempotencia o marcar fallo/expiración sin borrar historial. |

**Prohibido como limpieza automática:** borrar pagos aprobados o reembolsados, fusionar registros con estados distintos, reutilizar referencias Wompi o activar una suscripción desde el retorno del navegador. Wompi requiere referencias únicas por transacción ([Web Checkout](https://docs.wompi.co/docs/colombia/widget-checkout-web/)).

## Monitoreo después del corte

Reservas e IwaGranja deben poder consultar y alertar por:

- intentos creados, checkout emitido y pagos por estado, ambiente y aplicación;
- eventos Wompi con firma inválida, referencia desconocida, monto/moneda discordantes o ambiente equivocado;
- duplicados detectados, callbacks reintentados y eventos en cola de fallos;
- pagos aprobados sin suscripción activa y suscripciones activadas sin pago aprobado;
- intentos pendientes vencidos y tiempo entre aprobación Wompi y activación;
- proporción de pagos sin conciliar y antigüedad de cada caso.

**Umbrales iniciales propuestos para revisión operativa:** cualquier pago aprobado sin activación o cualquier diferencia de importe genera alerta prioritaria; cualquier callback que agote reintentos queda visible en cola de fallos; pago pendiente más allá de su vencimiento pasa a revisión/expiración. Acordar tiempos exactos de respuesta antes del despliegue.

## Puertas de salida de Producción

No cambiar la URL de eventos de Producción hasta que todas se cumplan:

- [ ] Comercio, destino de recaudo, ambiente y llaves confirmados.
- [ ] No quedan defectos P0 abiertos de seguridad, precio, estado, duplicidad o huérfanos.
- [ ] Sandbox aprobó los casos de aceptación, duplicados, fallos, 18 meses y regresión de Reservas.
- [ ] Los pagos `IWG-` en curso tienen una ruta de finalización demostrada.
- [ ] Existe reconciliación y se ha ensayado la reversión.
- [ ] Equipo responsable y monitoreo están activos para la ventana de corte.
- [ ] Primera transacción de Producción conciliada en Wompi, Reservas e IwaGranja antes de ampliar la habilitación.

## Registro de decisiones

| ID | Decisión | Estado |
|---|---|---|
| DEC-01 | Reservas centraliza checkout y webhook; IwaGranja conserva precio, condiciones y activación de suscripción. | Propuesta del plan; confirmar en GOV-02. |
| DEC-02 | El importe de pago lo calcula IwaGranja en servidor y se envía a Reservas por API autenticada. | Propuesta; confirmar al cerrar API-02/API-03. |
| DEC-03 | Sin reserva ficticia para una suscripción; usar pago genérico tipado. | Propuesta; confirmar al cerrar API-01. |
| DEC-04 | Primer corte de checkout: Productor. Organización requiere completar su modelo de cuotas y activación. | Pendiente de confirmar en GOV-02. |
| DEC-05 | Las renovaciones siguen siendo expresas; no hay cobro automático en esta migración. | Basado en condiciones comerciales actuales; confirmar en GOV-02. |

## Registro de cambios del plan

| Fecha | Cambio | Evidencia/autor |
|---|---|---|
| 2026-11-19 | Primera versión creada a partir de la revisión de código local y documentación oficial de Wompi. | Codex; sin cambios de código ni configuración. |

## Referencias técnicas

- IwaGranja: [`src/app/api/billing/checkout/route.ts`](../src/app/api/billing/checkout/route.ts), [`src/lib/subscription.ts`](../src/lib/subscription.ts), [`src/db/schema.ts`](../src/db/schema.ts), [`src/lib/pricing/quote.ts`](../src/lib/pricing/quote.ts).
- Reservas: [`src/pages/api/pagos/webhook.ts`](../../app_reservas/src/pages/api/pagos/webhook.ts), [`src/pages/api/reservas/index.ts`](../../app_reservas/src/pages/api/reservas/index.ts), [`src/lib/wompi.ts`](../../app_reservas/src/lib/wompi.ts), [`strapi/src/api/pago/content-types/pago/schema.json`](../../app_reservas/strapi/src/api/pago/content-types/pago/schema.json).
- Wompi Colombia: [Widget y Web Checkout](https://docs.wompi.co/docs/colombia/widget-checkout-web/), [Eventos](https://docs.wompi.co/docs/colombia/eventos/), [Transacciones](https://docs.wompi.co/docs/colombia/transacciones/).
