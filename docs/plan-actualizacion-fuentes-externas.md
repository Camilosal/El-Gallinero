# Plan de actualización y vinculación de fuentes externas

**Estado del plan:** La integración actual está implementada y operativa en staging: Path B automático de DANE, equivalencias SIPSA-I, revisión humana de referencias normativas e importación manual del CSV oficial IDEAM. App y cron están saludables. Solo quedan dependencias externas: salida automática a `bart.ideam.gov.co:443` y SOAP SIPSA en `appweb.dane.gov.co:9001`; SIPSA-P funciona por XLSX. Producción no se modificó.
**Objetivo:** ofrecer datos oficiales y sectoriales trazables que ayuden a tomar decisiones y actualizar Datos Maestros sin inventar valores, cambiar operaciones históricas ni presentar una referencia como si fuera un precio vigente.

## Estado de avance al 17 de noviembre de 2026

| Frente | Estado implementado | Pendiente para cerrar |
|---|---|---|
| BanRep SDMX | Conector REST SDMX v3.1 en CSV, selección de series permitidas desde Catálogos, persistencia idempotente y pruebas locales del parser. La URL y parámetros siguen la [guía oficial SDMX v3.1](https://suameca.banrep.gov.co/archivos/webservices/sdmx_v_3_1/GUIA_CONSUMO_SDMX_V_3_1.pdf); BanRep anunció CSV en la [actualización de su servicio](https://suameca.banrep.gov.co/estadisticas-economicas/). | La primera consulta en staging terminó en `ok`; revisar observaciones y periodicidad en la interfaz. |
| Alertas IDEAM | El conector y el parser del [CSV oficial de alertas hidrológicas](https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/alertas_hidrologicas.csv) están integrados; el parser pasó 7 pruebas locales. La página oficial de IDEAM enlaza el conjunto `h4gs-wsmg` en Datos Abiertos, pero sus metadatos lo clasifican como enlace externo (`href`), sin tabla para SODA. El cron de staging intenta el CSV y conserva el último dato como `fallback`. | El CSV abre en navegador; desde este host y su contenedor el TCP a `bart.ideam.gov.co:443` expira antes de recibir una respuesta HTTP. Falta resolver esa ruta de salida. |
| Alertas IDEAM | El conector y el parser del [CSV oficial de alertas hidrológicas](https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/alertas_hidrologicas.csv) están integrados; el cron conserva el último dato como `fallback`. Catálogos permite descargar/importar el CSV con vista previa y valida esquema/categorías antes de guardarlo. La prueba de staging procesó una alerta de muestra. | La descarga automática sigue sin ruta desde el host (timeout TCP a `bart.ideam.gov.co:443`). El respaldo por archivo ya está disponible en la app y no requiere cambiar código. |
| SIPSA-P por archivo oficial | El camino B descubre y descarga el anexo diario `.xlsx` más reciente cuando el SOAP falla o no devuelve filas. Valida fecha, mercados y precios; conserva producto, categoría, mercado, `COP/kg`, variación publicada, URL y checksum. El ciclo guardó 422 precios del anexo del 13 de noviembre de 2026. DNS de `appweb.dane.gov.co` resuelve a `170.238.65.186`, pero TCP 9001 agota el tiempo desde el host y el contenedor. | SIPSA-P continúa disponible por XLSX. Resolver la ruta/aceptación de TCP 9001 para recuperar el SOAP; no se ve un bloqueo en el conector ni en la red interna Docker. |
| DANE SIPSA-I | El cron descubre el anexo XLSX mensual por municipio en la página oficial de [históricos del componente de insumos](https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-insumos-1/componente-insumos-historicos), guarda precio, producto, presentación, CPC, municipio, variación y checksum. Staging guarda 2.727 precios de septiembre de 2026 para Cundinamarca, distribuidos en 24 municipios. Catálogos permite vincular cada artículo/presentación DANE a un producto local, sin cambiar costos maestros. | La interfaz está desplegada. La granja staging aún no tiene productos de compra activos (0 equivalencias), así que las comparaciones aparecen al crear productos locales. |
| DANE GEIH | El cron descarga el anexo XLSX mensual de la página oficial de [históricos del mercado laboral](https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo/geih-historicos) y conserva TGP, TO, TD y TS nacionales desde GEIH marco 2018 (2021 en adelante). El parser ahora limita la lectura al bloque `Total Nacional`, sin mezclar `Total Cabeceras`; staging guarda 276 observaciones únicas de enero de 2021 a septiembre de 2026. | Conector, cifras y reimportación comprobados. Son indicadores agregados de contexto; no reemplazan SMLMV, auxilio ni otros valores legales. |
| DANE IPC/IPP | El cron descubre los anexos XLSX mensuales oficiales en las páginas de [IPC](https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc/ipc-informacion-tecnica) e [IPP](https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-del-productor-ipp/ipp-historicos). Staging guardó 66 observaciones IPC únicas (2017-10 a 2026-10) y 292 IPP (2014-12 a 2026-10). Claves estables actualizan revisiones sin duplicar observaciones. | El cron corre cada cinco días. Ninguna serie actualiza automáticamente Datos Maestros. |
| DIAN y trabajo | Referencias de Catálogos con enlaces oficiales, fecha de vigencia y aviso de revisión. Los valores por defecto de 2026 son UVT $52.374, SMLMV $1.750.905, auxilio $249.095 y tope de auxilio 2 SMLMV. Referencias propias nuevas quedan pendientes; Catálogos guarda resultado, fecha y responsable al registrar la revisión. | El monitoreo automático de nuevas normas aún no está conectado. Los parámetros sensibles requieren aprobación humana y no se actualizan automáticamente. |
| Programación e historial | Tabla de observaciones con claves únicas y aislamiento por granja; tarea programada por `CRON_SECRET`; desactivar sincronización detiene consultas; fallos parciales producen resultado 207 y reintento. El ciclo manual validó 9 fuentes: 8 `ok` y solo IDEAM en `fallback`. Pruebas transaccionales de RLS y reimportación oficial repetida pasaron sin duplicar observaciones. | Resolver la ruta de salida de `bart.ideam.gov.co`; el SOAP DANE 9001 queda como ruta A no disponible mientras SIPSA-P usa XLSX. |
| Conectores secundarios | ICA, estándares y puente IoT ya no se presentan como conectores externos programados. Nager.Date se identifica como calendario no oficial. | Mantenerlos como referencia hasta comprobar una fuente oficial estructurada y vigente. |
| Verificación en staging | Imagen final reconstruida con `.env.staging`; app, PostgreSQL y cron están activos y `/api/health` devolvió `200`. El endpoint autenticado devolvió 2.727 observaciones SIPSA-I y el catálogo normativo. Las vistas previas autenticadas de IDEAM y SIPSA-I procesaron una fila cada una (`200`); validaciones de equivalencia/revisión inválidas fueron rechazadas (`400`). Pasaron 13 pruebas enfocadas, TypeScript del cambio y el build global. RLS e idempotencia ya estaban comprobados en transacciones revertidas. | El servidor sigue sin ruta HTTPS directa a IDEAM y SIPSA SOAP 9001. El CSV manual se prueba sin escribir alertas de muestra. Producción no se modificó. |

### Cierre de los pendientes de integración

- SIPSA-I se vincula desde Catálogos con productos de compra activos de la misma granja. La equivalencia conserva la referencia original y no actualiza precios, costos ni operaciones.
- Las referencias normativas propias nuevas quedan `pendiente`; las antiguas que fueron marcadas automáticamente como verificadas se normalizan también a pendiente. El flujo guarda estado, nota, fecha y responsable.
- Las cargas de CSV usan JSON porque Next rechazaba los `POST multipart/form-data` con `409 Server Action unavailable` antes de que las rutas pudieran leer el archivo. IDEAM y las cargas DANE ya pasan por la misma previsualización validada.
- El entorno actualizado de staging usa explícitamente `.env.staging`; la app respondió `200`, el cron inició y no se alteró PostgreSQL ni producción.
- El GET de Catálogos en staging devolvió 2.727 SIPSA-I y 12 referencias normativas. No hay productos de compra locales activos en esa granja, por lo que no se creó equivalencia ficticia.

El archivo `.env.staging` contiene credenciales aleatorias con permisos `0600` y está excluido de Git. La contraseña del administrador y `CRON_SECRET` no se imprimen en logs ni en este plan. El staging está disponible solo en el host por estar enlazado a loopback; no tiene dominio público.

Los valores legales de 2026 se contrastaron con la [Resolución DIAN 000238 de 2025](https://www.dian.gov.co/normatividad/Normatividad/Resoluci%C3%B3n%20000238%20de%2015-12-2025.Pdf), el [Decreto 1469 de 2025 citado por Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=276596) y el [Decreto 1470 de 2025 citado por Función Pública](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=274217). Los enlaces y la marca de revisión aparecen junto a los parámetros; los cambios guardados aplican a nuevas operaciones, que conservan sus valores calculados.

## Reglas de negocio

1. Una fuente externa aporta observaciones y propuestas; no modifica por sí sola los valores maestros usados en operaciones.
2. Cada dato conserva valor original, unidad, periodo, cobertura, fuente, fecha de publicación/consulta y estado de validación.
3. Una operación nueva usa el valor maestro vigente al registrarse. Se permiten ajustes manuales en datos no críticos, con motivo y autor. Impuestos, nómina, parámetros normativos, controles sanitarios y otros valores sensibles requieren aprobación explícita.
4. Las operaciones cerradas conservan el valor y la versión de maestro que aplicaron. Actualizar una tarifa no recalcula el pasado.
5. Cuando una fuente no tenga API estable, se registra como documental/manual y se importa con revisión; no se declara sincronizada por consultar su página web.
6. Los valores publicados por fuentes oficiales pueden ser estadísticas de referencia, no cotizaciones locales ni una recomendación comercial.

## Situación actual observada en el repositorio

| Área | Estado en el código | Corrección o trabajo pendiente |
|---|---|---|
| DANE SIPSA-P y TRM | TRM consulta SODA con 12 s de timeout y SIPSA usa SOAP como camino A más el anexo XLSX diario como camino B. Staging guardó 422 precios del anexo y la TRM del 14-11-2026 (`3.316,7 COP/USD`). | Mantener visible la fuente en Catálogos; datos de referencia no actualizan precios maestros. |
| Banco de la República | Conector SDMX, selección de IBR, DTF, TPM, TIB y UVR desde Catálogos e historial por serie. | Primera consulta de staging `ok`; revisar periodicidad y observaciones desde la interfaz. |
| IDEAM | Parser, cron y carga del CSV oficial con vista previa implementados; si falla la descarga, se conserva el último dato válido. | Solo falta resolver el acceso de red para automatizar la descarga. El operador puede usar el enlace oficial y la carga de Catálogos. |
| SIPSA-I | Cron para anexo mensual XLSX; staging guardó 2.727 precios de septiembre de 2026 para Cundinamarca y 24 municipios; CSV y equivalencias por producto como respaldo. | No hay productos de compra activos en staging para crear equivalencias de datos. La relación ya se puede hacer cuando existan. |
| GEIH | Cron para anexo mensual XLSX; staging guardó 276 observaciones nacionales de TGP, TO, TD y TS entre enero de 2021 y septiembre de 2026. | Mantenerlas como contexto laboral; no vincularlas a liquidaciones ni valores legales. |
| IPC e IPP | Importación automática de anexos oficiales XLSX. IPC conserva variaciones por división e historia total; IPP conserva índices mensuales totales y agropecuarios y sus variaciones. La carga CSV se mantiene como respaldo. | Primer ciclo de staging `ok` para ambas fuentes, con periodo octubre de 2026. |
| UVT y trabajo | Valores de referencia oficiales 2026 con enlaces y revisión explícita en Catálogos; referencias propias guardan responsable, fecha y resultado de revisión. | No hay detección automática de nuevas normas. Calendario DIAN y programas Finagro siguen documentales/manuales; los valores sensibles no cambian sin aprobación humana. |
| ICA y estándares | Catálogos locales/documentales; se quitaron de la lista de sincronización automática. | Automatizar solo cuando exista un feed oficial estable, versionado y validable. |
| DIVIPOLA y clima auxiliar | Conectores DANE y Open-Meteo existentes; IDEAM se añade para alertas hidrológicas oficiales. | Validar frescura y cobertura en staging; Open-Meteo continúa como fuente auxiliar de clima. |
| Historial y operación programada | Modelo, migración `0006`, ruta protegida por `CRON_SECRET`, programador y estados de errores parciales están desplegados; reimportaciones mantuvieron SIPSA-I/GEIH en 2.727/276 observaciones sin duplicados. La política RLS pasó una prueba transaccional entre dos granjas. | Única dependencia técnica: ruta de red directa IDEAM y SOAP SIPSA 9001. Revisiones normativas y equivalencias tienen flujo en app. |

## Fuentes y uso previsto

| Grupo | Fuente primaria o candidata | Datos de interés | Frecuencia objetivo | Política de integración |
|---|---|---|---|---|
| Mercado agropecuario | [DANE SIPSA-P](https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/servicio-web-para-consulta-de-la-base-de-datos-de-sipsa) | Precios mayoristas por producto, mercado/ciudad y periodo. | Según publicación del DANE. | Presentar observaciones originales. Solo asociar a un producto maestro si coinciden producto, presentación y unidad. |
| Insumos y factores rurales | [DANE SIPSA-I · históricos del componente de insumos](https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-insumos-1/componente-insumos-historicos) | Precios promedio y variación por insumo, presentación, municipio y CPC. | Mensual. | Descarga XLSX oficial por cron; conservar presentación, municipio, CPC y periodo. No inferir precio por kg ni actualizar precios maestros automáticamente. |
| Macroeconomía y financiación | [Banco de la República, estadísticas económicas](https://suameca.banrep.gov.co/estadisticas-economicas/) y su [guía SDMX vigente](https://suameca.banrep.gov.co/archivos/webservices/sdmx_v_3_1/GUIA_CONSUMO_SDMX_V_3_1.pdf). | IBR, DTF, tasa de política monetaria, TIB, UVR y otras series aprobadas. | Según periodicidad de cada serie; consultar con TTL adecuado. | El catálogo de series será explícito y seleccionable. Guardar código de serie, unidad, indicador y periodo. No usar una tasa de referencia como oferta de crédito. |
| Inflación y precios de productor | DANE: IPC e IPP, desde el canal oficial que permita descargar series verificables. | Índices y variaciones por periodo y cobertura disponible. | Mensual/publicación oficial. | Incluir como contexto y escenario. No convertir el índice general en precio de alimento, jornal o cotización local. Si no existe API estable, importar archivo oficial con metadatos y revisión. |
| Trabajo | [DANE GEIH · anexos oficiales](https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo/geih-historicos); MinTrabajo/Función Pública para decretos y actos de salario mínimo y auxilio de transporte. | Indicadores nacionales de participación, ocupación, desocupación y subocupación; valores legales por año y vigencia. | GEIH según publicación; normas al publicarse. | GEIH se importa por cron como contexto. Separar esa estadística de las obligaciones legales; para liquidaciones, usar solo parámetros aprobados y vigentes en el periodo trabajado. |
| Impuestos | DIAN y su [Normograma](https://normograma.dian.gov.co/). | UVT, actos tributarios y calendario. | Por vigencia/acto y calendario tributario. | Adjuntar acto o URL oficial, fecha, vigencia y usuario que aprueba. Automatizar solo cuando exista interfaz oficial estable y validable. |
| Crédito agropecuario | Finagro: líneas y circulares vigentes; Banco de la República para tasas de referencia. | Tasas, topes, plazos, subsidios y condiciones por programa. | Por circular o programa. | No extrapolar una línea vencida. Importar la circular y requerir aprobación antes de ofrecer valores en cálculos. |
| Riesgo climático | IDEAM: [CSV oficial de alertas hidrológicas](https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/alertas_hidrologicas.csv), [alertas de deslizamientos e incendios](https://ideam.gov.co/transparencia/datos-abiertos/seccion-de-datos-abiertos?page=1), boletines y pronósticos oficiales. Open-Meteo se conserva como apoyo meteorológico. | Nivel/categoría de alerta, cobertura hidrográfica, hora de consulta, fuente y boletín. | Alertas frecuentes según publicación; boletines según calendario IDEAM. | Ampliar a deslizamientos e incendios tras validar sus esquemas. Mostrar la hora de consulta cuando la fuente no publique fecha de emisión; conservar el enlace al boletín y no sustituir una instrucción oficial de emergencia. |
| Sanidad y medicamentos | ICA: boletines epidemiológicos, alertas y listados vigentes de productos veterinarios. | Alertas por territorio, producto/registro y documentos de soporte. | Al publicarse; revisar vigencia con frecuencia definida. | No desbloquear retiros ni habilitar medicamentos por una lista desactualizada. Si no hay feed estructurado, documentar carga y aprobación manual. |
| Contexto productivo | UPRA EVA y SIPRA. | Área, producción, rendimiento y contexto territorial de oferta. | Semestral/anual según publicación. | Contexto de producción y abastecimiento. Nunca clasificar EVA como fuente de precios. |
| Señales sectoriales complementarias | Fenavi, Fenalce, Fedegán y asociaciones del sector; cotizaciones de proveedores autorizados por la granja. | Tendencias sectoriales y ofertas/cotizaciones locales. | Según publicación o consulta. | Segunda capa, claramente identificada como gremial o comercial. No mezclar con estadística oficial ni reemplazar automáticamente el maestro. |

La fuente de alertas hidrológicas IDEAM aparece en su portal de datos abiertos como el conjunto `h4gs-wsmg`; el conector descarga el CSV oficial publicado por IDEAM, conserva solo las categorías de alerta y muestra la hora de consulta junto con la cobertura que informa el archivo.

## Estrategia de ingesta por fuente: API y archivo oficial

No se debe forzar el mismo mecanismo para todas las fuentes. Cada conector tendrá una estrategia documentada:

1. **Camino A — API directa:** usarlo cuando la entidad publique una interfaz estructurada y accesible con un contrato verificable.
2. **Camino B — archivo oficial:** usar un cron para descubrir y descargar CSV, XLSX o JSON publicado por la entidad cuando no exista API adecuada o cuando la API acumule tres ciclos programados fallidos. Ya está incorporado para SIPSA-P (respaldo diario cuando falla SOAP), IPC/IPP, SIPSA-I y GEIH (anexos XLSX mensuales). En SIPSA-P hay anexos oficiales Excel descargables desde las páginas de [boletines diarios](https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-precios-mayoristas), [semanales](https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/mayoristas-boletin-semanal-1) y [mensuales](https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/mayoristas-boletin-mensual-1). IDEAM publica `alertas_hidrologicas.csv` en su [directorio oficial](https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/).
3. **Carga revisada:** si no hay API ni descarga legible estable, permitir importar el archivo oficial con vista previa y aprobación; no automatizar la lectura de un PDF narrativo como si fuese una tabla confiable.

El archivo se valida antes de importarlo: entidad y URL permitidas, tipo de contenido, tamaño, periodo del dato, frescura, checksum, columnas requeridas, unidades, cobertura, duplicados y valores razonables. Un cambio de esquema o un archivo atrasado se pone en cuarentena; se conserva el último dato válido y se marca como vencido. La ingesta A y B llama al mismo normalizador y persiste en el mismo historial con proveedor, URL, fecha de descarga/publicación, periodo, checksum, modo de sincronización y versión del parser. Los archivos nunca actualizan por sí solos los Datos Maestros sensibles.

La tolerancia a fallos será **por fuente**, no por ciclo general: contar fallos en ejecuciones programadas distintas, abrir el respaldo B después del umbral, limitar las pruebas A durante el modo de respaldo y volver a A después de respuestas válidas consecutivas. El scheduler registra fallos parciales y deja el siguiente intento para el intervalo programado, sin repetir el ciclo completo ni volver a consultar las fuentes que ya respondieron bien.

Estado de conectividad: `www.dane.gov.co:443` y `www.datos.gov.co:443` responden desde el contenedor; staging usa una red Docker `internal=false` y UFW permite salida. El conjunto oficial `h4gs-wsmg` en Datos Abiertos es un enlace externo (`href`), no una tabla SODA: la ruta `/resource/h4gs-wsmg.json` responde que el conjunto no tiene acceso tabular. Por eso el conector descarga el CSV de `bart.ideam.gov.co`; esa conexión HTTPS expira desde el host y el contenedor antes de recibir una respuesta, y la fuente conserva `fallback`. La imagen nueva de staging quedó reconstruida y desplegada; `/api/health` respondió correctamente. La limpieza anterior retiró 4,09 GB de imágenes Docker no asociadas a contenedores; los datos de staging se conservaron.

## Plan de trabajo por fases

### Fase 0 — Confianza, catálogo de conectores y staging

1. Unificar el registro de fuentes para cada conector: entidad, URL/dataset, tipo (API, descarga o documental), periodicidad, unidad/cobertura, permiso/licencia, TTL, estado y responsable.
2. Alinear el estado de la interfaz y del programador: `conectada`, `referencia documental`, `manual`, `vencida`, `fallback` o `error`. Una tarea programada no debe presentarse como una conexión oficial si solo mantiene un catálogo local.
3. **Aplicado y verificado en staging:** `0006_external_source_observations.sql` creó el historial. Una prueba transaccional con dos UUID de granja verificó lectura propia y bloqueo cruzado; otra repitió el UPSERT de una observación sin crear filas duplicadas; ambas transacciones se revirtieron. La sincronización oficial repetida de SIPSA-I/GEIH mantuvo los conteos y claves únicas.
4. Revisar `CRON_SECRET`, autorización 401 sin secreto, resultado por conector, reintentos y conservación del último dato válido.
5. Confirmar que no queden precios, tarifas ni índices ficticios usados por fórmulas, ni una ruta de aplicación automática de observaciones externas a maestros.

**Criterio de salida:** historial aislado por granja; fuente, unidad, periodo y fecha visibles; fallos no borran datos válidos; ninguna referencia externa modifica un maestro por sí sola.

### Fase 1 — Completar conectores oficiales en línea

1. **IDEAM, implementado con respaldo:** parser, cron, conservación de fallback y carga del CSV oficial con vista previa están desplegados. El acceso TCP desde el host expira; la carga manual permite integrar el CSV disponible desde navegador. La descarga automática depende de resolver esa ruta.
2. **SIPSA SOAP, pendiente de ruta:** `appweb.dane.gov.co` resuelve, pero TCP 9001 agota el tiempo tanto desde host como desde staging. El camino B XLSX ya funciona para precios mayoristas; revisar la ruta/aceptación de puerto para recuperar SOAP.
3. **Banco de la República, parcial:** SDMX respondió `ok` en staging. Revisar series, unidad y periodicidad visibles antes de usarlas en escenarios. Mantener consulta separada de TRM si la fuente configurada es SFC.
4. **IDEAM, segunda etapa:** evaluar [Alertas de Deslizamientos (`m3en-ptx7`)](https://www.datos.gov.co/d/m3en-ptx7), [Alertas de Incendios (`vnzc-4d6e`)](https://www.datos.gov.co/d/vnzc-4d6e) y [Alertas Meteomarinas (`3e2y-7ych`)](https://www.datos.gov.co/d/3e2y-7ych), que IDEAM lista en su [catálogo oficial de datos abiertos](https://ideam.gov.co/transparencia/datos-abiertos/seccion-de-datos-abiertos?page=1). Incorporarlos solo después de validar sus metadatos, vigencia y significado de campos con el mismo control de esquema y frescura que Alertas Hidrológicas.

**Criterio de salida:** actualización forzada y programada funcionan; proveedor/URL/periodo visibles; fallos se marcan como vencidos o fallback; pruebas reproducen el contrato observado.

### Fase 2 — Costos, oferta y precios agropecuarios

1. **Completado:** descubrir el anexo municipal mensual de SIPSA-I, parsear producto, presentación, CPC, municipio, precio, variación y periodo, y guardar la huella SHA-256.
2. **Completado:** limitar la copia por granja al departamento configurado, conservar el CSV manual como respaldo y marcar error/fallback ante cambios de esquema.
3. **Completado parcialmente:** staging importó Cundinamarca (24 municipios); falta revisar equivalencias y comparabilidad de unidades/presentaciones antes de sugerir cambios a Datos Maestros.
4. **Implementado:** equivalencias por producto/presentación entre SIPSA-I y productos locales. La equivalencia nunca altera el texto/código original ni actualiza costos maestros. Staging aún no tiene productos locales activos.
5. Exponer comparaciones locales y rangos con su periodo. Proponer ajustes a “Costos de insumos” solo si el usuario confirma que se comparan el mismo insumo, presentación, zona y unidad.

**Criterio de salida:** los costos muestran fuente y periodo, las presentaciones son comparables, una importación repetida no duplica filas y no se transforma un promedio estadístico en cotización vigente.

### Fase 3 — Índices macroeconómicos, tributarios y laborales

1. **Completado:** IPC/IPP se descargan de anexos oficiales, guardan observación/variación, cobertura y periodo, y se ofrecen para consulta y escenarios, no como precio de compra.
2. Completar el catálogo seleccionable del Banco de la República, de forma controlada por series válidas y periodicidad. Incorporar nuevas series solo después de comprobar definición y unidad.
3. Agrupar variables maestras en **Macroeconomía y financiación**, **Impuestos**, **Costos de insumos** y **Costos laborales**; no mezclar tasas de interés, UVT y salarios en un único bloque.
4. **Revisión manual implementada:** las referencias nuevas quedan pendientes; el registro guarda estado, nota, fecha y responsable. No hay vigilancia automática de publicaciones ni extracción automática para UVT, calendario DIAN, salario/auxilio o Finagro. Los valores sensibles requieren aprobación antes de su vigencia.
5. Validar que liquidaciones y fórmulas consulten la versión vigente al crear una operación y guarden una copia de los parámetros aplicados. Bloquear cambios retroactivos silenciosos.

**Criterio de salida:** las nuevas operaciones aplican la vigencia correcta; cambios sensibles tienen aprobación y evidencia; operaciones cerradas reproducen exactamente sus resultados previos.

### Fase 4 — Sanidad, oferta sectorial y fuentes secundarias

1. Registrar fuentes ICA con enlace al boletín/listado, fecha de publicación y última revisión. Primero ofrecer seguimiento documental; automatizar descarga solo con un canal oficial que mantenga formato verificable.
2. Añadir UPRA EVA/SIPRA como series de producción contextual, con su unidad y periodo.
3. Evaluar fuentes gremiales y comerciales por dominio, cobertura, licencia y frecuencia. Identificarlas en la pantalla y los reportes como no oficiales; permitir cotizaciones del proveedor como dato de comparación de la granja.

**Criterio de salida:** fuentes sanitarias no reemplazan controles normativos; series productivas no se tratan como precio; fuentes secundarias no se presentan como oficiales.

### Fase 5 — Verificación y liberación gradual

1. **Build global de staging correcto:** Next compiló, TypeScript terminó y el build reconstruyó app/cron. Pasaron 13 pruebas enfocadas de SIPSA-I, IDEAM, GEIH y scheduler.
2. **Aislamiento RLS e idempotencia comprobados** en staging con transacciones revertidas. Endpoints autenticados de Catálogos, revisión normativa y vista previa CSV respondieron; archivos de muestra no se importaron ni escribieron.
3. Revisar migración sobre copia de staging, reconstruir contenedor, observar al menos un ciclo completo de las fuentes elegidas y conciliar conteos de snapshots/observaciones.
4. Desplegar en producción tras validar backup, variables secretas y ventana de migración; revisar logs y frescura por fuente durante el primer ciclo. Habilitar propuestas a maestros gradualmente.

**Criterio de salida:** sin datos cruzados entre granjas, sin duplicados, con migración aplicada, conectores observados en operación y reversión documentada.

## Requisitos transversales de implementación

### Contrato de observación

Cada observación debe conservar como mínimo: `sourceKey`, clave de origen, valor original o payload, unidad, fecha/periodo observado, fecha de captura, territorio y dimensiones disponibles, proveedor, URL/dataset, versión del esquema y estado de validación. Los valores numéricos normalizados deben mantener también el valor original.

### Catálogos maestros y vigencias

- La ficha maestra debe distinguir `valor vigente`, `propuesta externa`, `última observación`, `fuente`, `unidad`, `vigencia`, `estado de revisión` y `responsable`.
- Los parámetros no críticos pueden tener ajuste manual con justificación y auditoría.
- Parámetros tributarios, laborales, sanitarios y demás valores de alto impacto requieren aprobación explícita antes de entrar en vigor.
- Al crear una operación, guardar valor, versión de parámetro y periodo usado. No recalcular registros cerrados al actualizar un maestro.

### Calidad y monitoreo

- Validar esquema, campos requeridos, periodos, fechas futuras, unidades, duplicados y rangos razonables sin descartar silenciosamente filas.
- Mostrar `última consulta`, `última observación`, `vigente/vencida`, `último error` y enlace de origen por separado.
- Usar TTL por periodicidad de la fuente; un ciclo horario del programador no implica que todas las fuentes publiquen datos cada hora.
- Conservar el último dato válido como fallback, marcado de forma visible y sin confundirlo con información fresca.
- Alertar ante cambios de esquema o respuestas vacías persistentes; no tratar un HTTP 200 como prueba suficiente de una actualización válida.

## Dependencias y puntos que requieren verificación técnica

- SIPSA-I y GEIH se leen desde los anexos XLSX publicados en sus páginas oficiales; sus resultados ya se verificaron en staging. Las equivalencias SIPSA-I se vinculan manualmente desde Catálogos y no afectan costos maestros.
- El endpoint SDMX del Banco respondió `ok` en staging; revisar periodicidad y definición de cada serie antes de usarla en escenarios.
- El conjunto `h4gs-wsmg` de IDEAM es un enlace a un recurso externo, no una tabla Socrata. El conector evita `/resource/h4gs-wsmg.json` y lee el CSV oficial, validando los campos de categoría y cobertura hidrográfica.
- Si DIAN, MinTrabajo, Finagro o ICA ofrecen un formato de descarga oficial estable, puede reemplazarse la carga manual por sincronización sin quitar la revisión requerida para valores normativos.
- La cobertura geográfica debe resolverse con códigos oficiales versionados y no solo por similitud de nombres municipales.
