# Plan de ejecución en Reservas para los pagos de IwaGranja

**Instrucción para la instancia de Reservas.** Implementa los pasos R1 a R6 en un checkout editable de Reservas. Trabaja en desarrollo, prepara los cambios para revisión y devuelve la evidencia indicada al final. La primera salida cubre suscripciones prepago de Productor. El corte en producción requiere autorización explícita.

**Contrato entre sistemas.** IwaGranja calcula el importe, valida la aceptación y decide la activación, los permisos y la vigencia. Reservas crea o recupera el intento, abre el checkout Wompi, verifica el resultado del procesador y lo entrega a IwaGranja. Mantén la referencia `IWG-` desde el intento hasta la conciliación. Incluye las órdenes `ORD-` y reservas `RSV-` en la regresión porque comparten el registro de pagos y el webhook.

## R1 · Preparar el entorno y levantar la línea base

- [ ] Ubicar el repositorio que contiene la fuente de Reservas y confirmar el estado de su rama. Abrir un espacio de desarrollo editable para Astro, Strapi y la carpeta `strapi/database/migrations`. Identificar cómo se aplican migraciones y qué archivos generados versiona el proyecto.
- [ ] Preparar Strapi, PostgreSQL y Redis aislados. Usar datos sintéticos para las pruebas y una copia autorizada y minimizada, o un reporte autorizado de solo lectura, para revisar el histórico real. Registrar ambiente, versiones y commit de base.
- [ ] Inventariar IDs Wompi repetidos, nulos, vacíos o con espacios, referencias repetidas, pagos aprobados sin transacción y resultados pendientes de entrega. Cruzar referencia, ambiente, aplicación, estado, importe, moneda e ID Wompi. Separar el informe técnico de cualquier decisión sobre pagos históricos. Si aparecen duplicados, pedir a Operaciones que apruebe la resolución de cada caso antes de activar la unicidad sobre esos datos.

**Cierre.** Entorno reproducible y reporte de línea base con conteos. Si falta acceso al histórico, continuar con la implementación y registrar la revisión histórica como pendiente.

## R2 · Garantizar una sola asociación por transacción Wompi

- [ ] Crear una migración nueva en `strapi/database/migrations`. La migración existente `20261120000100-preflight-payment-uniqueness.js` revisa `reference_id` e `idempotency_key`. Agregar un control previo independiente para `wompi_transaction_id` que detenga la aplicación si encuentra colisiones y emita un mensaje que omita los datos de pago.
- [ ] Actualizar `strapi/src/api/pago/content-types/pago/schema.json` y el esquema físico de PostgreSQL para garantizar la unicidad de los IDs asignados y admitir múltiples pagos que todavía no tienen ID. Probar la creación limpia, la actualización desde el esquema anterior y el reinicio de Strapi. Coordinar el índice con la sincronización de esquema de Strapi para que sobreviva a reinicios.
- [ ] Proteger la asignación bajo concurrencia. Si dos referencias intentan reclamar la misma transacción, la segunda queda registrada como incidencia y conserva su estado financiero. Si una referencia ya tiene otra transacción, registrar el conflicto y conservar la asociación existente. Distinguir el conflicto de este índice de otros errores de base de datos. Documentar cómo revertir el cambio de esquema y preservar los pagos recibidos durante una reversión.

**Cierre.** PostgreSQL real demuestra que una transacción pertenece a una sola referencia, que las filas históricas siguen presentes si el preflight falla y que los pagos sin ID siguen admitidos.

## R3 · Persistir los resultados y las incidencias del webhook

- [ ] Revisar `src/pages/api/pagos/webhook.ts`. Mantener la validación de firma y ambiente, la consulta canónica de Wompi por el ID firmado y el contraste con el intento tipado. Un fallo transitorio de Wompi o de persistencia debe devolver un error recuperable. Una firma inválida se rechaza antes de tocar pagos o crear casos de conciliación.
- [ ] Crear un registro duradero para eventos autenticados que requieran revisión. Debe poder almacenar incidencias sin una fila de pago, como una referencia `IWG-` desconocida. Cubrir diferencias de importe, moneda, ambiente, tipo de pago o transacción, y estados desconocidos o incompatibles con el estado vigente. Guardar identificador del caso, referencia, ID Wompi, ambiente, motivo, fechas, estado, vínculo al pago cuando exista y los campos mínimos para conciliar. Confirmar a Wompi la recepción de una incidencia válida solo después de guardarla.
- [ ] Guardar la transición válida del pago y su evento de salida en una operación atómica. El modelo actual conserva un solo evento en la fila del pago. Implementar una bandeja de salida por evento o demostrar que el modelo elegido conserva cada resultado pendiente y evita que un evento antiguo sobrescriba a uno nuevo. Aplicar deduplicación por identidad estable del evento y actualizaciones condicionadas a la versión o estado leído. El webhook y el worker deben compartir las mismas reglas de entrega.
- [ ] Separar el estado financiero, el estado de entrega y el estado de revisión. Conservar el pago aprobado y abrir una revisión ante un resultado tardío incompatible. Reservar el estado de reembolso para un reembolso verificado y una resolución aprobada. El retorno del navegador consulta o presenta el resultado, mientras que la activación depende del evento procesado por IwaGranja.

**Cierre.** Repetir o recibir eventos fuera de orden deja una sola incidencia por evento y causa, conserva los resultados pendientes y nunca activa una suscripción por inferencia.

## R4 · Acotar reintentos y operar los casos pendientes

- [ ] Ajustar `src/lib/iwagranja-payment-results.ts`, `src/pages/api/pagos/reintentar-resultados.ts` y el worker `scripts/payment-result-retry-worker.mjs`. Documentar y probar el contrato con `POST /api/billing/reservas` de IwaGranja. Interpretar la respuesta estructurada, incluyendo los estados aceptados y los marcadores de revisión que devuelve el receptor. Una respuesta vacía, una página HTML o un JSON inesperado requiere diagnóstico aunque llegue con HTTP 200.

| Resultado de entrega | Tratamiento en Reservas |
|---|---|
| Confirmación válida de recepción y aplicación o repetición idempotente | Registrar la entrega y conservar el resultado. |
| Confirmación válida con `reviewRequired` o `paymentStatus: "review"` | Registrar recepción y marcar el caso para conciliación. El acuse detiene los reintentos de ese evento. |
| Corte de red, timeout, 429 o fallo temporal del receptor | Reintentar con demoras crecientes y límite explícito. Respetar `Retry-After` cuando corresponda y esté dentro del presupuesto de reintentos. Al agotar el límite, guardar y alertar. |
| Referencia desconocida confirmada por el receptor o evento inválido | Guardar el caso para revisión. Diferenciar una referencia ausente de una ruta mal configurada. Si puede haber una demora de creación, permitir una ventana acotada antes de escalar. |
| Firma rechazada, destino incorrecto, ambiente equivocado o respuesta inesperada | Registrar el fallo de integración y alertar. Permitir recuperar el mismo evento después de corregir la configuración. |

- [ ] Mantener las demoras actuales como punto de partida y documentar el máximo de intentos, contando el despacho inicial. Seleccionar trabajos por próxima ejecución con orden estable y límite de lote. Asegurar que el webhook y el worker no puedan sobrescribir el avance del mismo evento. El contador y la fecha deben corresponder al evento entregado.
- [ ] Habilitar el scheduler en desarrollo con el bloqueo Redis y la identidad de servicio. Probar dos workers simultáneos, expiración del bloqueo, caída del receptor y pérdida de la respuesta después de que IwaGranja persistió el resultado. Cada recuperación debe conservar referencia e identidad del evento.
- [ ] Exponer a Operaciones los casos pendientes, en revisión y agotados, con búsqueda por referencia o ID Wompi, motivo, antigüedad e intentos. Habilitar reenvío autorizado del mismo evento y cierre auditado con actor, motivo y evidencia. Definir alertas para aprobados sin activación, casos agotados y cola atrasada. Mantener el registro de revisiones separado de las acciones financieras de reembolso.

**Cierre.** Un operador puede seguir, recuperar o escalar un evento desde Reservas. Un fallo temporal se recupera sin duplicar el cobro lógico ni extender dos veces la vigencia.

## R5 · Habilitar conciliación entre Reservas e IwaGranja

- [ ] Acordar con la instancia de IwaGranja una consulta interna de solo lectura o un exporte operativo, con acceso restringido y alcance `iwagranja/subscription`. Incluir referencia, ambiente, importe en centavos, moneda, estado financiero, ID Wompi, resultado de entrega, última fecha y estado de revisión. Usar paginación estable y filtros para investigación, sin incluir secretos, datos de tarjeta ni cuerpos completos de webhooks.
- [ ] Comparar contra los intentos y eventos de activación de IwaGranja y, cuando corresponda, contra la transacción canónica de Wompi. Registrar los casos que solo existan en uno de los sistemas, las referencias que compitan por una transacción y los pagos aprobados sin activación. Documentar quién atiende cada caso, cómo se registra la resolución y cuándo procede volver a entregar el evento.

**Cierre.** Un reporte de desarrollo permite seguir cada caso por referencia de punta a punta. La revisión histórica real queda pendiente si falta una fuente autorizada.

## R6 · Validar la integración y entregar evidencia

Configurar los pares HMAC por ambiente mediante el gestor de secretos. En Reservas se usan `IWAGRANJA_PAYMENT_API_SECRET`, `IWAGRANJA_PAYMENT_RESULT_SECRET` e `IWAGRANJA_PAYMENT_OUTBOX_SECRET`. Coordinar `IWAGRANJA_PAYMENT_RESULT_URL`, `IWAGRANJA_RETURN_ORIGINS` y la URL de `POST /api/pagos/intentos` con IwaGranja. Las llaves pública y privada y los secretos de eventos e integridad de Wompi deben pertenecer a Sandbox en este entorno. Registrar únicamente nombres y presencia de variables. Confirmar que IwaGranja de prueba está configurada para aceptar el ambiente `test`.

| Prueba | Evidencia requerida |
|---|---|
| Creación concurrente, pérdida de respuesta y recuperación del intento | Una fila y un enlace por clave. Repetir el intento recupera la referencia. Usar la misma clave con otro importe devuelve conflicto. |
| Migración y webhook con PostgreSQL real | Prueba en esquema limpio y existente. Colisión simultánea entre dos referencias. Incidencia persistida sin cambiar el pago perdedor. |
| Checkout completo en Wompi Sandbox | Para Productor, probar aprobación, rechazo y pendiente, ambos órdenes de retorno y webhook, y retorno con sesión vencida o destino manipulado. Registrar las ramas simuladas, como fallos inducidos, por separado. |
| Eventos tardíos, inválidos y huérfanos | Probar monto, moneda, ambiente, firma, referencia inexistente, transacción conflictiva y estado desconocido. Verificar que no se concede acceso indebido. |
| Despacho, reintento y recuperación | Probar receptor caído, pérdida de respuesta tras persistencia, repetición concurrente, acuse de revisión y agotamiento. Registrar una sola activación para la aprobación válida. |
| Regresión `ORD-` y `RSV-` | Probar pago, confirmación, estados del registro y efectos asociados de reservas y órdenes, incluida la compatibilidad con el índice compartido. |

Reutilizar las suites de `tests/payment-index-preflight.test.mjs`, `tests/payment-intents-api-postgres.test.mjs` y `tests/wompi-webhook-verification.test.mjs`. Agregar los casos faltantes para la bandeja de salida, el worker y la conciliación. Para la entrega final, adjuntar rama y commit o PR, archivos y migraciones, comandos y resultados, referencias de prueba, conteos de conciliación, pasos de reversión y pendientes con responsable. Registrar cada paso R1–R6 como pendiente, en curso, bloqueado o verificado. Actualizar en el plan maestro los puntos API-03–09, DATA-01–03, OPS-03/04 y QA-02/03 con los resultados que correspondan.

**Criterio de entrega.** La instancia de Reservas entrega cambios y evidencia reproducible en desarrollo. El cierre conjunto requiere confirmar un pago Productor que activa una sola vez, una incidencia que puede conciliarse y la regresión de los pagos existentes. Cualquier paso que dependa de datos históricos, acceso de Operaciones o Wompi Sandbox debe quedar identificado con su evidencia pendiente.

## Seguimiento de implementación local — 2026-11-24

Este seguimiento registra el código y las verificaciones locales de esta ejecución. “En curso” significa que hay implementación revisable, pero falta al menos una evidencia de cierre definida arriba. No se habilitó Producción.

| Paso | Estado | Evidencia local | Pendiente para cerrar |
|---|---|---|---|
| R1 | En curso | Se trabajó en `/home/ubuntu/negocio/data/app_reservas`. La fuente Astro/Strapi y pruebas están disponibles para revisión. | `app_reservas` no es un checkout Git independiente y no tiene rama/commit propio; la carpeta de migraciones está protegida contra escritura. No se obtuvo reporte histórico ni conexión de PostgreSQL/Redis aislados. `pg_isready` respondió en `127.0.0.1:5432`, pero el acceso autenticado falló por falta de credenciales de prueba. |
| R2 | Verificado en desarrollo | La migración explícita y su prueba están en el código fuente de Reservas. Pasaron 17 pruebas de migración y preflight. PostgreSQL de pruebas confirmó creación, reejecución, preservación de filas, rechazo de duplicados y admisión de varios nulos. | Incorporar el cambio al control de versiones y evaluar su despliegue por separado. |
| R3 | En curso | Outbox durable `pago-evento`, casos `pago-revision`, persistencia atómica del resultado IWG, deduplicación y protección de estados finales. Los tests del webhook IWG y el `VOIDED` tardío ORD pasaron. | Repetir carreras/transiciones en PostgreSQL real y verificar el reinicio de Strapi con el esquema previo. No se infiere reembolso desde `VOIDED`. |
| R4 | En curso | Acuse JSON estructurado, clasificación de receptor, hasta 7 intentos automáticos, `Retry-After` acotado, lease/token, cuarentena de referencias desconocidas y herramientas administrativas con motivo/evidencia. El worker informa fallos, revisiones y agotamientos. | Probar Redis, scheduler, dos workers, caída y recuperación del receptor y alertas integradas en un entorno aislado. La validación local usa dobles/pruebas unitarias. |
| R5 | En curso | Reporte de solo lectura `iwagranja/subscription` en Reservas, paginación estable por fecha/ID, filtros por estado/ambiente/referencia y pantalla administrativa. Tres pruebas ejercitan filtros, límites y cursor con Knex simulado. | Acordar un exporte o consulta restringida de IwaGranja y comparar pagos/eventos de activación contra Reservas y, cuando aplique, Wompi. La ruta existente de IwaGranja solo expone una conciliación local con sesión Super-Admin. |
| R6 | En curso | `npm test`: 92 aprobadas, 0 fallidas, 2 omitidas; `npx tsc --noEmit --pretty false` en Strapi y `npm run build` en Astro terminaron correctamente. | Las dos omitidas requieren PostgreSQL de prueba. Falta Wompi Sandbox, la entrega entre servicios y la regresión integrada `ORD-`/`RSV-` con base real. |

### Artefactos de esta ejecución

- Reservas: [runbook local](../../app_reservas/PAGOS_IWAGRANJA_IMPLEMENTACION.md), [preflight de unicidad](../../app_reservas/strapi/database/migrations/20261124000100-preflight-wompi-transaction-uniqueness.js), [esquema de pagos](../../app_reservas/strapi/src/api/pago/content-types/pago/schema.json), [pruebas de conciliación](../../app_reservas/tests/payment-reconciliation-report.test.mjs).
- El proceso usó datos sintéticos y no imprimió secretos. `RESERVAS_TEST_DATABASE_URL` y `REDIS_URL` no estaban disponibles en el entorno. PostgreSQL respondió al chequeo de disponibilidad en `127.0.0.1:5432`, pero la conexión de prueba falló por falta de credenciales; no se consultó ni modificó ninguna base. No se modificó Producción, la infraestructura global ni la configuración de Docker.
- El seguimiento relacionado con API-03–09, DATA-01–03, OPS-03/04 y QA-02/03 quedó añadido al final de [plan-migracion-canal-pagos-reservas.md](./plan-migracion-canal-pagos-reservas.md). Ninguna de esas puertas se marca como `Hecho` sin su evidencia integral.

## Adenda R5 · Exportación HMAC conectada en desarrollo — 2026-11-24

IwaGranja ahora expone `GET /api/v1/integrations/billing/reconciliation` para el alcance `iwagranja/subscription`. Verifica HMAC-SHA256 sobre timestamp, método, ruta y query; rechaza relojes con más de cinco minutos de diferencia y limita cada flujo de datos a 100 filas por página. Exporta solo referencia, ambiente, importe en centavos, moneda, estado, ID Wompi y fechas, junto con eventos de activación/revisión. No incluye FarmID, `rawPayload`, secretos ni datos de tarjeta. `payment_review_required` también se incluye en el reporte local de Super-Administración.

Reservas consume el exporte desde el BFF protegido por sesión administrativa, mantiene paginación independiente de pagos y eventos y compara por referencia los resultados visibles. Marca discrepancias de importe, moneda, ambiente y transacción; detecta pagos aprobados sin evento de activación aplicado y eventos en revisión. La interfaz advierte que la ausencia en una página parcial no demuestra ausencia en el sistema. Wompi canónico e históricos no se consultan.

La configuración queda pendiente: `RESERVAS_RECONCILIATION_HMAC_SECRET` en IwaGranja debe compartir valor con `IWAGRANJA_RECONCILIATION_HMAC_SECRET` en Reservas; `IWAGRANJA_RECONCILIATION_URL` debe apuntar al endpoint HTTPS. Solo se añadieron los nombres a `.env.example`; no se leyeron ni cambiaron archivos con credenciales. El Proxy permite pasar este endpoint a su verificación HMAC propia. También se corrigió su allowlist para que `POST /api/billing/reservas` alcance el handler que ya verifica la firma del receptor.

El estado R5 avanza, pero sigue **En curso**: faltan configurar el par HMAC de prueba, hacer una consulta cruzada real con datos sintéticos compartidos, incorporar la fuente canónica de Wompi y ejecutar la conciliación histórica autorizada. El resultado de pruebas y compilación se agrega al registro de evidencia al final del plan maestro.

### Verificación local posterior de R5 — 2026-11-24

- Reservas: `npm test` completó 97 pruebas (95 aprobadas, 0 fallidas y 2 omitidas porque no existe PostgreSQL aislado); `npm run build` finalizó correctamente. La vista Astro incluye el estado del exporte HMAC y el cruce paginado.
- IwaGranja: `npm run typecheck`, ESLint focalizado y las cuatro suites relacionadas pasaron. Vitest terminó con 14/14 pruebas usando `DATABASE_URL` sintética para que el guard del proyecto no cargara la base de producción.
- No se configuraron secretos ni se invocó el endpoint entre servicios. La prueba de HMAC usa un fetch simulado; PostgreSQL, Redis, Wompi Sandbox y el cotejo histórico permanecen pendientes.

### Build de IwaGranja — 2026-11-24

`DATABASE_URL='postgresql://127.0.0.1:15432/gallinero_test' npm run build` terminó correctamente: compilación, TypeScript y 209 páginas generadas; Next incluyó la nueva ruta HMAC como dinámica. Se usó una URL sintética para el proceso y no se conectó una base. Reservas también mantiene el build Astro aprobado.

## Adenda de verificación ampliada — 2026-11-24

Para ejecutar las puertas PostgreSQL se creó un contenedor temporal sin volumen, publicado solo en `127.0.0.1:25433`, con las bases `gallinero_test_db` y `reservas_test`. IwaGranja aplicó 23 migraciones y cargó catálogos sintéticos. Ninguna prueba usó Producción, el PostgreSQL persistente de desarrollo ni Redis compartido.

| Área | Resultado | Alcance y límite |
|---|---|---|
| Reservas, suite completa | 96 aprobadas, 0 fallidas, 1 omitida de 97 | `RESERVAS_TEST_DATABASE_URL` habilitó la carrera y recuperación contra PostgreSQL sintético. La segunda prueba que requiere una instancia real de Strapi local quedó omitida. |
| Reservas, API de intentos PostgreSQL | 1 aprobada, 0 fallidas, 1 omitida | Verifica concurrencia, respuesta perdida y recuperación en un esquema temporal; no sustituye la migración física protegida ni la prueba contra Strapi real. |
| IwaGranja, facturación | 11/11 aprobadas | Incluye la prueba HTTP IwaGranja→handler de Reservas→adaptador PostgreSQL sintético y la carrera de estado `review`. |
| IwaGranja, conciliación y Proxy | 28/28 aprobadas | Exportación HMAC, filtros, clasificación, reporte Super-Admin y allowlist. La conexión remota aún usa un fetch de prueba; no se configuró un par HMAC real. |
| IwaGranja, estático y build | Typecheck y ESLint focalizado aprobados; build aprobado | Next generó 209 páginas e incluyó `/api/v1/integrations/billing/reconciliation` como ruta dinámica. |

La pasada completa de Vitest anterior a las dos correcciones terminó con 575 aprobadas y 7 fallidas en 6 archivos. Se corrigieron y verificaron en la suite dirigida los dos fallos de pagos: las fixtures HTTP omitían la llave privada sintética de Wompi, y la respuesta idempotente de un pago ya en revisión no devolvía `reviewRequired: true`. No se repitió la suite global después de esas correcciones. Quedaron sin investigar cinco fallos de otras áreas: timeout en `external-sources-waves.test.ts`, grupo de gallinaza ausente en `flows.test.ts`, expectativa legal en `launch-legal.test.ts`, conflicto 409 en `superadmin-tenants.test.ts` y mock de voz en `telegram-agent-channel.test.ts`.

Se corrigió la respuesta idempotente para que los reintentos concurrentes de un estado desconocido mantengan el marcador de revisión, sin modificar la suscripción. Los fixtures PostgreSQL de ambos repositorios ahora entregan una llave privada Sandbox sintética y restauran el entorno original después de cada caso.

R1–R6 permanecen **En curso**. Faltan el inventario histórico autorizado, la aplicación y comprobación del índice físico de Reservas desde un checkout editable, Redis/scheduler aislados, la conexión HMAC real entre servicios, Wompi Sandbox y la regresión conjunta `ORD-`/`RSV-`. La prueba de checkout hacia el endpoint de intentos no constituye una aprobación de Wompi ni activa datos reales.

### Verificación PostgreSQL del preflight R2 — 2026-11-24

Se invocó la migración `20261124000100-preflight-wompi-transaction-uniqueness.js` sobre un esquema temporal de PostgreSQL 16: IDs válidos y varios `NULL` pasaron; una vez creado el índice único declarado por el esquema, PostgreSQL rechazó una transacción repetida; al retirar el índice e insertar duplicados de prueba, el preflight detuvo la ejecución sin incluir el valor en el error y el conteo de filas quedó igual. El índice se creó manualmente para comprobar el comportamiento de PostgreSQL; no se ejecutó la sincronización real de Strapi ni se tocó el archivo de migración de solo lectura. El contenedor se detuvo y eliminó al terminar. R2 sigue en curso hasta validar Strapi, reinicio y esquema previo.

### Verificación del lease Redis de R4 — 2026-11-24

Con un Redis 7 efímero, limitado a loopback y sin volumen, dos adquisiciones simultáneas del helper compartieron una sola concesión. Se comprobó que el lease vence y que liberar con un token expirado no elimina el lease que obtuvo después otro worker. El contenedor se detuvo al terminar. Esto valida el bloqueo/fencing, pero no la ruta de scheduler completa ni el ciclo de claim/entrega/cierre contra Strapi; R4 sigue **En curso**.

## Adenda de sandbox integrado y sincronización Strapi — 2026-11-24

Se preparó un entorno desechable en `/tmp/codex-pagos-sandbox-20261124/`, con copias de los dos proyectos, secretos ficticios y servicios publicados solo en loopback. No se leyó ni copió ningún `.env` real y no se usó Docker Compose global.

| Paso | Evidencia nueva | Estado y pendiente |
|---|---|---|
| R1 | PostgreSQL 16 aislado creó `reservas_test` y `gallinero_test_db`; Gallinero completó `db:bootstrap` con 23 migraciones/catálogos sintéticos. | En curso: no hay histórico autorizado de pagos para cotejar. |
| R2 | Strapi 5.51 arrancó contra `reservas_test`, ejecutó su preflight y sincronizó el esquema. PostgreSQL muestra el índice único `pagos_wompi_transaction_id_unique_idx` y los índices de `pago_eventos` sobre `created_at`. Se corrigieron en `pago-evento/schema.json` dos referencias de índice que usaban el atributo camelCase `createdAt` en vez de la columna SQL `created_at`; `tests/payment-index-preflight.test.mjs` pasó 11/11. Una transacción de prueba confirmó unicidad y varios `NULL`, y se revirtió. | En curso: falta correr el diagnóstico previo sobre una copia autorizada de datos reales y probar el reinicio desde el esquema anterior. |
| R3 | La aplicación real del content type y el arranque de Strapi funcionaron en PostgreSQL aislado. | En curso: la prueba de carrera y entrega transaccional completa del webhook/outbox no se ejecutó aquí. |
| R4 | Redis 7 está disponible sin persistencia en `127.0.0.1:26379`; el helper de lease ya había pasado exclusión y fencing con Redis aislado. | En curso: no se arrancó el scheduler ni dos workers conectados a Strapi en esta sesión. |
| R5 | El cliente de Reservas realizó una petición HTTP GET firmada con HMAC al Next local; Gallinero devolvió una fila sintética aprobada y su evento `subscription_activated`. La comparación de Reservas con una muestra local sintética resultó `both_current_pages`, sin hallazgos. | En curso: la fila local usada para comparación fue una muestra en memoria; falta ejecutar el cruce con la bandeja de Reservas persistida y la fuente canónica/histórica autorizada. |
| R6 | Strapi respondió HTTP 200 en `/admin`, Next respondió HTTP 200 en `/`, y el endpoint HMAC respondió 200 tras validar el secreto ficticio compartido. | En curso: no se generó ni procesó una transacción real de Wompi Sandbox; falta el recorrido completo de pagos y la regresión `ORD-`/`RSV-`. |

Las copias editables y los comandos de inicio/parada están descritos en `/tmp/codex-pagos-sandbox-20261124/README.md`. Servicios: PostgreSQL `127.0.0.1:25433`, Redis `127.0.0.1:26379`, Strapi `127.0.0.1:14337` y Next `127.0.0.1:3200`. Las bases son descartables y no tienen volumen. La clave privada Wompi y el HMAC de estas copias son valores sintéticos; no sirven para una cuenta Sandbox ni para Producción.

R1–R6 siguen **En curso** porque las puertas externas de históricos, Wompi Sandbox y operación integrada no se sustituyen con datos generados. La sincronización real de Strapi y el cruce HTTP HMAC ahora sí cuentan con evidencia reproducible local.

### Nota de persistencia del sandbox — 2026-11-24

Corrección de precisión: `docker inspect` mostró que las imágenes de PostgreSQL y Redis montan volúmenes anónimos, aunque no hay volúmenes persistentes o compartidos. Ambos contenedores tienen `AutoRemove=true`; al detenerlos Docker los elimina junto con esos volúmenes temporales. Las menciones anteriores a “sin volumen” describen que no se configuró persistencia duradera.

### Suite completa y concurrencia del worker — 2026-11-24

Con el sandbox activo, se creó en `reservas_test` un usuario administrador y un API token sintéticos, guardados solo en la copia temporal. `npm test` en `reservas-copy` terminó con **98/98 aprobadas, 0 fallidas y 0 omitidas**. Esto incluyó ambas pruebas de `payment-intents-api-postgres.test.mjs`: carrera/recuperación contra PostgreSQL real de prueba y colisión concurrente contra Strapi 5.51 real normalizada a 409.

También se invocó concurrentemente el handler de `POST /api/pagos/reintentar-resultados` contra el Strapi y Redis aislados. El ganador respondió 200 con conteos en cero (no había eventos pendientes); la segunda llamada respondió 202 con `alreadyRunning: true`. Se valida auth, exclusión con Redis y la ruta de claim vacía. No se probó entrega de un evento pendiente a IwaGranja ni el ciclo de reintentos con receptor caído; R4 sigue **En curso**.

Esta evidencia completa la ejecución local de las suites de Reservas, no el ciclo Wompi oficial. R1–R6 conservan **En curso** hasta ejecutar los pasos restantes de sus criterios, especialmente históricos autorizados, entrega transaccional real de un evento y checkout Wompi Sandbox con aprobación/rechazo/pendiente.

## Corrección R6 · credenciales de Sandbox disponibles — 2026-11-24

La nota anterior que afirmaba que las credenciales oficiales no estaban disponibles queda corregida: `/home/ubuntu/negocio/.env` contiene `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET`. Solo se comprobaron presencia y prefijos (`pub_test_`/`prv_test_`); no se copiaron ni imprimieron sus valores. `GET https://sandbox.wompi.co/v1/merchants/info`, autenticado con la llave pública de prueba en `x-merchant-public-key`, respondió HTTP 200 y devolvió los objetos de aceptación requeridos.

En la copia aislada `reservas-copy`, se inyectaron las variables Wompi de Sandbox al proceso de prueba, manteniendo sintéticos el HMAC interservicio, el token de Strapi y los datos. El handler real `POST /api/pagos/intentos` respondió 201 en la primera petición y 200 al repetirla: conservó referencia e intención, devolvió el mismo checkout y persistió `environment=test` en `reservas_test`. La fila sintética se eliminó después. No se creó una transacción Wompi ni se guardó una llave real en las copias del sandbox.

R6 queda **En curso**: están verificados el acceso a la API oficial Sandbox y el inicio idempotente del checkout con llaves reales, pero no los resultados aprobados/declinados/pendientes ni sus webhooks. La URL de eventos se configura separadamente desde el dashboard de Wompi para cada ambiente; no figura en el `.env` central. Como su destino Sandbox no es verificable desde este entorno, no se envió una transacción que pudiera notificar a un sistema ajeno al sandbox. El `APP_URL` central tampoco se usó para el callback local.

Para el ciclo transaccional falta confirmar una URL de eventos accesible que apunte a un receptor aislado de prueba, y disponer en esa instancia de los secretos HMAC de integración de Reservas/IwaGranja. El `.env` central revisado no define `IWAGRANJA_PAYMENT_API_SECRET`, `IWAGRANJA_PAYMENT_RESULT_SECRET`, `IWAGRANJA_PAYMENT_OUTBOX_SECRET`, `IWAGRANJA_PAYMENT_RESULT_URL` ni los secretos HMAC de conciliación; las copias locales conservan valores sintéticos. También siguen pendientes la fuente histórica autorizada de R1 y la regresión integrada `ORD-`/`RSV-`.

Referencia técnica vigente de Wompi: [Ambientes y llaves](https://docs.wompi.co/docs/colombia/ambientes-y-llaves/), [Tokens de aceptación](https://docs.wompi.co/docs/colombia/tokens-de-aceptacion/) y [Eventos](https://docs.wompi.co/docs/colombia/eventos/).

## Adenda R4/R5 · entrega y conciliación con filas persistidas — 2026-11-24

La ejecución integrada amplía la evidencia anterior de R4 y R5. En el sandbox local también se levantó el worker Astro de Reservas en `127.0.0.1:4130`, conectado a Strapi y Redis aislados y al receptor Next de Gallinero en `127.0.0.1:3200`. La configuración de URL y allowlist se inyectó solo al proceso local.

Se sembraron datos completamente sintéticos en las dos bases de prueba: un pago pendiente en Gallinero y su fila de pago y evento de outbox en Strapi. El evento no provino de un webhook Wompi. La primera ejecución detectó el callback fuera del allowlist local, devolvió HTTP 503 con `callback_url_invalid` y abrió una revisión. Tras corregir el allowlist solo en el proceso Astro, se autorizó el reenvío del mismo evento con actor, motivo y evidencia sintéticos. El scheduler registró entrega HTTP 200; la revisión quedó resuelta. PostgreSQL confirma `delivery_status=delivered`, sin error vigente y `manual_resend_count=1`; la revisión conserva actor y referencia de evidencia.

Gallinero persistió el pago como aprobado por **56.715 COP**, ambiente `test`, con el ID de transacción sintético correspondiente. La base contiene exactamente un evento `subscription_activated` aplicado y la suscripción quedó activa en el plan `PRODUCTOR`.

Para R5, el helper real `fetchIwaGranjaReconciliation` firmó una consulta HTTP al endpoint HMAC de Next. El reporte administrativo de Strapi aportó el evento persistido de Reservas. Ambos lados devolvieron una fila para la referencia sintética, con importe, ambiente, moneda y transacción coincidentes; la comparación produjo `both_current_pages` y `findings=[]`. Las dos páginas indicaron que estaban completas para el filtro de esa referencia.

Esta prueba cierra el cruce local persistido y el ciclo worker→receptor para un evento sintético, pero no sustituye el procesamiento del webhook firmado ni una transacción Wompi. Tampoco ensaya en este evento la caída del receptor tras persistir, la pérdida del acuse, dos workers compitiendo por una cola no vacía, las alertas de guardia, la regresión persistida `ORD-`/`RSV-` ni el histórico autorizado. R4 y R5 avanzan y permanecen **En curso**; R1 y R6 siguen pendientes por el histórico autorizado y el destino de eventos Sandbox, respectivamente.

### Confirmación de dependencias externas R1/R6 — 2026-11-24

El responsable confirma que no hay una fuente histórica autorizada disponible y que todavía no está configurada la URL de eventos Sandbox de Wompi. Se continúa con el código y la validación local conforme al cierre alternativo de R1, pero no se afirma haber auditado pagos históricos. R6 queda pendiente: no se enviará una transacción de prueba hasta que el dashboard de Sandbox apunte a un receptor HTTPS aislado y se confirme su destino. La configuración de eventos es separada por ambiente y se administra desde Wompi; las llaves de `.env` no permiten inferir ese destino.

### Revalidación R2/R5 después del reinicio del sandbox — 2026-11-24

Al reanudar los servicios desde las copias temporales, Strapi inició contra `reservas_test` y su `/admin` respondió HTTP 200; Next inició contra Gallinero y `/` respondió HTTP 200 después de la compilación inicial. El worker Astro respondió con su redirección normal. La consulta SQL de solo lectura después del reinicio confirmó que Strapi conserva `pagos_wompi_transaction_id_unique_idx` como índice único y los índices del outbox sobre `created_at`.

El helper real de Reservas volvió a consultar el reporte autenticado de Strapi y el exporte HMAC de Next: una fila local, un pago remoto y un evento de suscripción remoto. La comparación produjo `both_current_pages`, sin hallazgos. La primera lectura remota durante la compilación fría devolvió `unavailable`; tras completar la compilación, el endpoint contestó HTTP 200 y el helper quedó conectado. Esta revalidación no cambia los límites de R1/R6: no existe histórico autorizado y Wompi Sandbox continúa sin URL de eventos configurada.

### Límite de la prueba R2 desde esquema anterior — 2026-11-25

En la base descartable se contaron 24 pagos sintéticos, cinco sin ID Wompi, 19 con ID y cero duplicados. Se retiró la restricción única para simular el esquema previo. El primer arranque de Strapi no llegó a abrir el puerto ni a conectarse a PostgreSQL tras varios minutos de compilación; se canceló sin que ejecutara una sincronización. La restricción se restauró manualmente y se confirmó que las 24 filas seguían presentes. Después Strapi arrancó y el estado final muestra la restricción única y los dos índices del outbox sobre `created_at`.

Por tanto, está verificada la preservación del índice al reiniciar con el esquema vigente, no la recreación automática desde una base sin ese índice. R2 sigue **En curso** hasta repetir esa prueba en un checkout/proceso que arranque correctamente desde el esquema anterior.


### Evidencia R2 con migración explícita y corrección R6 — 2026-11-25

En la base sintética reservas_test se retiró la restricción única con 24 pagos, 19 IDs Wompi y cero duplicados. Un arranque de Strapi sin una migración explícita completó, pero no recreó el índice declarado en el esquema JSON. En la copia aislada se añadió 20261125000100-ensure-wompi-transaction-unique-index.js. El siguiente arranque registró esa migración como aplicada y PostgreSQL confirmó el índice único pagos_wompi_transaction_id_unique_idx; el conteo quedó en 24 filas, 19 IDs y cero duplicados. La prueba unitaria focalizada pasó en la copia temporal.

Esta evidencia valida la solución en /tmp/codex-pagos-sandbox-20261124/reservas-copy, no en el checkout fuente. El sistema de archivos del checkout está montado en solo lectura y rechazó crear el archivo bajo strapi/database/migrations; no se cambiaron propietarios ni permisos. R2 sigue En curso en la fuente hasta trasladar la migración y su prueba a un checkout editable y repetir la verificación allí.

Corrección de R6: una nota anterior atribuye al usuario el reporte de una URL ya registrada en Wompi. Esa atribución es incorrecta; la confirmación recibida fue “Aún no está configurada”. La URL mencionada en esa nota no acredita configuración alguna de Sandbox y debe tratarse como no verificada. No iniciar transacciones hasta confirmar en el dashboard una URL HTTPS aislada para Sandbox. Wompi mantiene una URL de eventos independiente por ambiente ([documentación oficial](https://docs.wompi.co/docs/colombia/eventos/)).


### Decisión de cierre y aplazamientos — 2026-11-25

Por instrucción del responsable, R2 queda como único trabajo activo para este cierre. R6 se aplaza; el usuario informa que ya fue probado externamente y funciona, sin repetir esa prueba en esta sesión. R4 se aplaza por decisión del usuario. R1 y la conciliación histórica de R5 se aplazan porque no hay fuente histórica disponible. Estos puntos quedan registrados como aplazados, no como pruebas locales realizadas. El criterio actual de cierre es aplicar R2 al checkout fuente y conservar el resultado verificable de la migración.

### Cierre de R2 en desarrollo — 2026-11-25 (Bogotá)

Se incorporaron `strapi/database/migrations/20261125000100-ensure-wompi-transaction-unique-index.js` y `tests/wompi-unique-index-migration.test.mjs` al código fuente de Reservas. Ambos archivos coinciden byte por byte con el parche probado. En el checkout fuente, `node --test tests/wompi-unique-index-migration.test.mjs tests/payment-index-preflight.test.mjs` pasó 17 de 17 pruebas.

La migración del código fuente se ejecutó dos veces sobre un esquema previo temporal en PostgreSQL `reservas_test`. Creó el índice único, conservó las filas, permitió varios pagos sin ID y rechazó otro pago con el mismo ID Wompi. Con duplicados preexistentes, devolvió un error sin revelar el identificador y conservó las filas. El ensayo se revirtió al terminar. La evidencia de arranque de Strapi proviene de la prueba previa con el mismo archivo en la copia aislada. El cambio queda local y pendiente de commit y despliegue.


### Zona horaria de las adendas — 2026-11-24

Las adendas fechadas 2026-11-25 en esta sesión usan UTC del host. En hora local America/Bogota corresponden al 24 de noviembre de 2026.

## Reanudación para cerrar el canal — 2026-11-25 (Bogotá)

El usuario pidió continuar con los pendientes del ciclo. Se conserva el cierre de R2 en producción y se vuelve a comprobar qué impide habilitar el flujo completo.

| Área | Evidencia de esta reanudación | Estado |
|---|---|---|
| R2 · índice Wompi | La migración `20261125000100-ensure-wompi-transaction-unique-index.js` figura aplicada en producción; el índice fue verificado válido y único. | Cerrado y desplegado. |
| IwaGranja · pruebas enfocadas | Con PostgreSQL efímera y sus 26 migraciones aplicadas, facturación/checkout/conciliación pasó 41 pruebas y omitió 1 que requiere la integración completa. TypeScript y ESLint enfocado pasaron. El seed demo también pasó después de corregir su orden de borrado de dependencias. | Desarrollo validado parcialmente. |
| Reservas · concurrencia e idempotencia | Las pruebas API/DB seleccionadas pasaron 3 casos contra PostgreSQL efímera y omitieron 1 que requiere una instancia Strapi local. La sesión anterior registra 108 aprobadas y 2 omitidas en la suite completa. | No sustituye el webhook Wompi ni la entrega de un evento real. |
| Suite completa IwaGranja | Se inició con base sintética; se observaron fallos en pruebas de dominios ajenos al canal y la ejecución quedó sin resumen final. No se considera aprobada. | Pendiente de diagnóstico y ejecución completa en CI. |
| Compose central | Se añadieron al Compose raíz las referencias de entorno de ambos servicios y workers de reintento/expiración bajo el perfil optativo `billing`. `docker compose config --quiet` pasó con el perfil normal y con `billing`. | Cambio local validado; no se reiniciaron contenedores. |
| Producción · configuración | La inspección de nombres y prefijos encontró llaves `pub_test_` en IwaGranja y Reservas, una `prv_test_` en Reservas, y ausencia de `WOMPI_ENVIRONMENT`, URLs y secretos HMAC del canal en los contenedores activos. | El checkout no está habilitado para cobros reales. |

El responsable informó previamente que el ensayo Sandbox externo funcionó. Esa confirmación se conserva como evidencia del usuario, pero no se repitió desde esta sesión ni acredita llaves Live. El endpoint de eventos compartido es `https://reservas.iwage.co/api/pagos/webhook`; no se pudo inspeccionar desde aquí a qué ambiente del dashboard de Wompi pertenece.

Para activar producción faltan las credenciales Live de Wompi en el gestor de secretos, los pares HMAC de servicio y conciliación en ambos contenedores, la URL de intentos `https://reservas.iwage.co/api/pagos/intentos`, el callback `https://app.iwage.co/api/billing/reservas`, el origen autorizado `https://app.iwage.co`, iniciar los dos workers con `--profile billing` y verificar el estado del webhook Live en el dashboard. No se habilitaron esos valores ni se reiniciaron servicios porque los contenedores actuales conservan llaves de prueba.

La fuente de Reservas disponible bajo `data/app_reservas` no tiene checkout Git independiente y el repositorio contenedor no tiene remoto configurado. La migración R2 ya está desplegada, pero no hay un destino Git al que enviar cambios nuevos de Reservas desde este checkout.

La compilación local de Next no pudo cerrarse: Turbopack fue bloqueado al crear un proceso/reservar puerto en el sandbox; el intento Webpack terminó con un error al leer `tsc --showConfig`. El chequeo de TypeScript y ESLint enfocado sí pasaron. No se desplegó el checkout mientras estas puertas y la configuración Live sigan pendientes.

### Continuación de cierre y publicación del código — 2026-11-26 (Bogotá)

El commit `44ad406` (`feat(billing): harden reservas subscription payment flow`) quedó publicado en `origin/main` junto con el commit anterior de evidencia R2. Se incluyeron solo los archivos del flujo de facturación, sus pruebas y los documentos de seguimiento; las personalizaciones ajenas que permanecen modificadas en el árbol de Gallinero no se incluyeron.

La validación focalizada de Gallinero terminó con 41 pruebas aprobadas y 1 omitida; TypeScript y ESLint focalizado pasaron. Reservas pasó 3 pruebas de concurrencia/idempotencia contra PostgreSQL temporal y omitió 1 escenario que necesita Strapi real. La suite amplia de Gallinero no terminó con un resultado utilizable y la compilación local quedó bloqueada por restricciones del entorno de Next. No se afirma que la suite completa o la compilación hayan pasado. GitHub no devolvió estados ni ejecuciones para el SHA consultado; la CLI local no está autenticada, por lo que CI queda sin verificar desde esta sesión.

No se desplegó el código ni se reiniciaron servicios: los contenedores productivos todavía presentan llaves Wompi de prueba y carecen de los secretos/URL HMAC interservicio. Activar pagos en esas condiciones no sería seguro. La lista de contenedores confirmó que el PostgreSQL efímero de pruebas fue eliminado; siguen únicamente los servicios habituales `gallinero_web`, `reservas_web`, `reservas_strapi` y `reservas_sync_cron`. No se eliminaron servicios compartidos de staging.

El cableado del Compose raíz se conserva como cambio local pendiente. Ese repositorio no tiene remoto configurado y `docker-compose.yml` contiene numerosas personalizaciones ajenas; por eso no se añadió el archivo completo al commit ni se aplicó el Compose. Para continuar con una activación real faltan credenciales Live de Wompi, URL de eventos confirmada para el ambiente Live, secretos HMAC distintos y coincidentes entre IwaGranja y Reservas, URL de intents y callback de resultado, configuración segura del gestor de secretos, y una ventana de despliegue con monitorización/rollback. El ciclo no queda cerrado hasta validar aprobación, rechazo, pendiente, reintentos y conciliación en el ambiente correspondiente.

### Despliegue de IwaGranja–Reservas sin Wompi Live — 2026-11-25 (Bogotá)

A petición del responsable se puso en producción el código de `f5239b2`, omitiendo deliberadamente Wompi Live. La imagen se construyó desde el commit limpio publicado (sin incluir las 127 personalizaciones locales ajenas) y quedó etiquetada como `negocio-gallinero_app:latest`; se conservó `negocio-gallinero_app:rollback-before-f5239b2` para reversión. Next compiló, TypeScript terminó y generó 209 páginas estáticas. No hay migraciones Drizzle nuevas en este release; el índice R2 de Reservas ya estaba aplicado y verificado.

Se generaron secretos HMAC independientes para solicitud, resultado, outbox, conciliación y cron; los pares entre aplicaciones coinciden y cumplen el mínimo de longitud. Las URLs configuradas son `https://reservas.iwage.co/api/pagos/intentos`, `https://app.iwage.co/api/billing/reservas` y el origen de retorno `https://app.iwage.co`. Los secretos quedaron solo en `/home/ubuntu/negocio/.env` con modo `0600`; el respaldo anterior está en `/home/ubuntu/negocio/.env.before-billing-setup`, también con modo `0600`. Los archivos no se incluyeron en Git.

Antes de recrear los servicios se validaron respaldos de PostgreSQL 16: `/home/ubuntu/negocio/backups/el_gallinero-pre-billing-f5239b2.dump` (711 entradas) y `/home/ubuntu/negocio/backups/reservas-pre-billing-f5239b2.dump` (779 entradas), con permisos `0600`. Se preservó la configuración administrativa vigente de Reservas.

`reservas_web` recibió el entorno HMAC, `gallinero_web` se recreó con la imagen publicada y ambos permanecen activos sin reinicios posteriores. Las pruebas de enlace dieron HTTP 400 al body vacío firmado para intents (autenticación válida; rechazo anterior a crear registros) y HTTP 200 a la consulta HMAC de conciliación con filtro aleatorio sin resultados. La API de salud y la página de planes públicas de IwaGranja respondieron HTTP 200; Reservas conservó su redirección HTTP 302.

Se activó `gallinero_subscription_expiry_scheduler`. Su URL inicial interna no pasó el validador del scheduler; se corrigió a HTTPS público y el proceso quedó estable, con cero reinicios y primer ciclo `vencidas=0 pendientes=0`. No se inició `reservas_payment_retry_worker`: Wompi sigue con llaves de prueba, `WOMPI_ENVIRONMENT` quedó sin configurar y el checkout permanece cerrado en producción. Así no se aplican eventos Sandbox a suscripciones productivas. El ensayo Sandbox reportado por el usuario se conserva como prueba externa; no se configuró ni se usó Live.

El contenedor PostgreSQL efímero y los archivos temporales de build/preflight se retiraron. Se conservaron los contenedores compartidos. El Compose raíz tiene el cableado de runtime aplicado en este host, pero su repositorio local no tiene remoto y el archivo contiene personalizaciones ajenas; no se incorporó completo al commit de Gallinero. GitHub Actions sigue sin estado visible desde esta sesión. El objetivo queda completado para el alcance solicitado sin Live: la integración autenticada y los vencimientos están desplegados; la activación de cobros/reintentos Wompi queda expresamente fuera de este despliegue.
