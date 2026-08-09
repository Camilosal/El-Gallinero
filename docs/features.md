# Funcionalidades, Módulos y Características Detalladas de El Gallinero

Este documento proporciona una descripción detallada de las funcionalidades, módulos y características del sistema El Gallinero, complementando la información básica presente en el README.md.

## Visión General del Sistema

El Gallinero es un sistema de gestión integral diseñado específicamente para gallineros pequeños y medianos. Su arquitectura modular permite el control completo del ciclo avícola, con integración automática entre todas las operaciones y el módulo financiero.

### Características Principales del Sistema

1. **Integración Financiera Automática**: Cada operación (venta, sacrificio, compra, mantenimiento, evento sanitario) genera automáticamente su correspondiente transacción financiera con trazabilidad completa a su origen.

2. **Architecture Modular**: El sistema está organizado en 7 módulos principales, cada uno con responsabilidad única y clara según el dominio de negocio.

3. **Tiempo Real**: Los datos se actualizan en tiempo real across all modules, permitiendo toma de decisiones basada en información actual.

4. **PEPS para Huevos**: Implementación del método Primero en Entrar, Primero en Salir para el inventario de huevos por tamaño.

5. **Escalabilidad**: Diseñado para crecer desde operaciones pequeñas hasta medianas sin cambios arquitectónicos mayores.

## Detalle por Módulo

### 1. 🐔 Módulo de Producción

**Objetivo**: Control integral del ciclo de vida aviar y procesos productivos relacionados.

#### Estructura de Submódulos:
- **Gallinas**: Gestión de la parvada activa (parvada activa, lotes)
  - Registro individual de gallinas (código, raza, fecha de nacimiento, peso, estado)
  - Seguimiento del ciclo de vida automático: 8 estados (pollito → postura)
  - Detección automática de gallinas recomendadas para sacrificio basado en edad y producción
  - Etapas según edad: Pollito (0-6 sem), Juvenil (6-18 sem), Pre-postura (18-20 sem), Postura (20+ sem)
  - Alertas para gallinas recomendadas a sacrificio (~80 semanas)
  - Filtros por estado y etapa de producción

- **Pollos y Gallos**: Gestión de reproductores y producción de carne
  - Gallos reproductores (código `GA-###` autogenerado)
  - Lotes de engorde (código `L-###`)
  - Balance de parvada: 1 gallo por cada 10 gallinas
  - Asignación automática de machos nacidos: primero cubren déficit de gallos, resto va a lote de engorde
  - Lotes pasan a "listo para sacrificio" al alcanzar semanas objetivo o peso ≥2.5 kg promedio

- **Adquisiciones**: Entrada de aves al sistema
  - Registro de compra, donación o nacimiento de pollitos
  - Trazabilidad completa: proveedor, fecha, cantidad, costo unitario y total
  - Actualización automática de inventario de aves

- **Alimentación**: Gestión del consumo y programas nutricionales
  - Inventario de alimentos (tipo, categoría, stock mínimo/máximo, costo, proveedor)
  - Alertas de stock bajo
  - Programas de alimentación por etapa (% de dieta y gramos/ave/día)
  - Bloqueo de stock negativo en movimientos
  - Comparativo planificado vs real (7/14/21/30 días) con gráficos
  - Predicción de stock (14-365 días): fecha de agotamiento, reposición sugerida, cantidad recomendada

- **Producción de Huevos**: Recolección y clasificación
  - Registro diario por tamaño de huevo (PEPS por talla)
  - Control de huevos rotos y destinados a incubación
  - Validación de sobreproducción (alertas si supera 1.5× lo esperado por etapa)
  - Comparación con producción esperada por etapa (rendimiento %)
  - Gráficos apilados por tamaño con proyección
  - Actualización automática de inventario de huevos

- **Incubación**: Gestión del proceso reproductivo
  - Registro de incubaciones con asignación automática de gallina clueca
  - Seguimiento de eclosión a los 21 días
  - Asignación automática de nacidos:
    - Hembras → nuevas gallinas de la parvada
    - Machos → cubren déficit de gallos o van a lote de engorde
  - Cálculo de tasa de eclosión (%)
  - Historial y métricas de desempeño

- **Sacrificio/Carne**: Procesamiento y distribución
  - Registro por tipo de ave (gallina descarte, pollo, gallo)
  - Pre-selección automática de gallinas recomendadas para sacrificio
  - Peso en canal (kg) y destino (consumo propio, venta, donación)
  - Generación automática de ingreso financiero si se vende
  - Reversión automática de estados de las aves sacrificadas
  - Trazabilidad completa del proceso

- **Mortalidad**: Registro y análisis de pérdidas
  - Registro de bajas por lote o individual
  - Clasificación por causa (enfermedad, depredador, accidente, sacrificio sanitario, causa natural, otro)
  - Vinculación opcional con eventos de control sanitario
  - Análisis de tendencias y tasas de mortalidad

- **Plan Parvada**: Proyección y planificación
  - Proyecciones de población de gallinas y gallos
  - Proyecciones de producción de huevos por semana
  - Proyecciones de consumo de alimento
  - Programación de reemplazos de parvada
  - Simulación de diferentes escenarios

#### Página Índice de Producción (/produccion)
Muestra los siguientes KPIs en tiempo real:
- Huevos producidos hoy / esta semana / este mes
- Consumo de alimento diario (kg)
- Mortalidad semanal (número y tasa %)
- Lotes activos de engorde
- Incubaciones en progreso (número y días restantes)
- Estado general de la parvada (distribución por etapas)

### 2. 📦 Módulo de Inventarios

**Objetivo**: Control completo de todos los stocks y materiales del sistema.

#### Estructura de Submódulos:
- **Huevos**: Inventario de huevos con método PEPS
  - Stock por tamaño de huevo (pequeño, mediano, grande, etc.)
  - Método PEPS (Primero en Entrar, Primero en Salir) por talla
  - Edad/envejecimiento con alerta para huevos >21 días
  - Valor estimado en dinero (stock disponible × precio del catálogo)
  - Estados de lotes: disponible / vender pronto / por vencer / agotado
  - Historial de entradas y salidas por lote

- **Aves**: Inventario vivo de aves
  - Stock por categoría: gallinas en postura, pollitos, juveniles, etc.
  - Trazabilidad completa desde adquisición hasta salida
  - Información de edad, peso promedio, estado productivo
  - Alertas por cambios en la composición de la parvada

- **Insumos**: Gestión de materiales no alimenticios
  - Inventario de insumos (alimento, medicamentos, empaques,etc.)
  - Stock mínimo/máximo y alertas de reposición
  - Fechas de vencimiento y alertas de proximidad
  - Costo por unidad y valor total del inventario
  - Proveedores asociados a cada insumo

- **Gallinaza**: Gestión del subproducto valioso
  - Stock actual de gallinaza (kg)
  - Factores de producción por grupo (etapas, gallos, lotes)
  - Acumulación de stock con ajustes manuales (± con motivo justificado)
  - Ventas con presentación (bulto/costal/grenal) que descuentan stock y generan ingresos
  - Historial de producción y consumo

- **Balance Consolidado**: Vista integrada de todos los stocks
  - Entradas vs salidas por período
  - Valor total del inventario en dinero
  - Rotación de inventario
  - Tendencias de consumo y adquisición

#### Página Índice de Inventarios (/inventarios)
Muestra los siguientes KPIs en tiempo real:
- Stock de huevos por tipo (unidades y valor)
- Stock de aves por categoría (cabezas)
- Stock de insumos críticos (nivel y alertas)
- Stock de gallinaza disponible (kg)
- Alertas de stock bajo (lista de items por debajo del mínimo)
- Valor total estimado del inventario

### 3. 💊 Módulo de Sanidad

**Objetivo**: Prevención, detección y manejo de la salud aviar.

#### Estructura de Submódulos:
- **Control Sanitario**: Registro de intervenciones médicas
  - Eventos: vacunación, desparasitación, tratamiento, inspección, fumigación, vitaminas, otros
  - Información de producto utilizado, costo y próxima aplicación
  - Asociación con aves afectadas (especificas, lote completo o "todas")
  - Los tratamientos marcan automáticamente gallinas como enfermas
  - Próximos eventos a vencer y notificaciones
  - Historial completo con trazabilidad

- **Calendario Sanitario**: Programación de intervenciones preventivas
  - Calendario de vacunas y recordatorios sanitarios
  - Frecuencia de aplicaciones (días entre aplicaciones)
  - Próxima fecha programada para cada intervención
  - Días de retiro antes del consumo después de aplicación
  - Vinculación con últimos eventos de control sanitario
  - Estado activo/inactivo de cada medida preventiva

#### Página Índice de Sanidad (/sanidad)
Muestra los siguientes KPIs en tiempo real:
- Próximos eventos sanitarios a vencer (próximos 7 días)
- Intervenciones pendientes de aplicación
- Estado de medidas preventivas activas
- Historial reciente de aplicaciones
- Alertas de eventos vencidos o próximos a vencer

### 4. 🔧 Módulo de Operaciones

**Objetivo**: Mantenimiento de instalaciones y gestión de subproductos.

#### Estructura de Submódulos:
- **Mantenimiento**: Gestión de tareas y equipos
  - Tareas del gallinero (limpieza, reparaciones, mantenimiento preventivo)
  - Estado: pendiente / en progreso / completado
  - Costo asociado (genera egreso automático al completar)
  - Plantillas rápidas para tareas frecuentes
  - Historial completo con trazabilidad financiera
  - No genera egresos duplicados al editar

- **Gallinaza**: Gestión del subproducto fertilizante
  - Factores de producción por grupo de aves (etapas de crecimiento, gallos, lotes de engorde)
  - Estimación de kg de gallinaza producida por ave por día
  - Acumulación de stock diario basado en población y factores
  - Ajustes manuales al stock (agregar o retirar con motivo justificado)
  - Ventas de gallinaza con presentación específica (bulto, costal, granel)
  - Cada venta descuenta stock y genera ingreso financiero automático
  - Historial de producción, ajustes y ventas

#### Página Índice de Operaciones (/operaciones)
Muestra los siguientes KPIs en tiempo real:
- Tareas de mantenimiento pendientes y en progreso
- Costo acumulado de mantenimiento completado
- Producción diaria estimada de gallinaza (kg)
- Stock actual de gallinaza disponible
- Próximos vencimientos de tareas programadas
- Eficiencia de la gestión de gallinaza (producción vs venta)

### 5. 💰 Módulo de Finanzas

**Objetivo**: Control financiero completo con integración automática de todas las operaciones.

#### Estructura de Submódulos:
- **Ventas**: Registro de ingresos
  - Huevos: ventas multi-ítem por tamaño y presentación (unidad, docena, media docena, bandeja/cubeta)
  - Aves: gallinas, gallos y lotes con precio por ave o por kg
  - Validación de disponibilidad por talla y stock
  - Total en vivo durante la captura de la venta
  - Genera automáticamente transacción de ingreso
  - Actualiza inventario y estados de aves según corresponda

- **Egresos**: Registro de gastos
  - Modo compra con presentación: vinculación con inventario (especialmente alimento) y conversión a unidad base
  - Modo general: cantidad × valor o monto manual
  - Métricas, gráficos por fecha y desglose por categoría
  - Cada egreso genera transacción financiera automática

- **Finanzas**: Panel financiero principal
  - KPIs: ingresos, egresos, utilidad, promedios diarios, flujo neto
  - Insights: mejor/peor día, margen de utilidad, proyección mensual
  - Gráficos de evolución temporal, utilidad acumulada y distribución por categoría (períodos 7/30/90/365 días)
  - Historial completo con capacidad de transacción manual
  - Análisis de tendencias y variaciones

- **Presupuestos**: Planificación financiera
  - Creación y seguimiento de presupuestos por período
  - Comparación presupuesto vs real por categoría
  - Alertas de desviaciones significativas
  - Capacidad de ajustes y revisiones

- **Cuentas**: Gestión de CxC y CxP
  - Cuentas por cobrar: tracking de facturas emitidas y pagos recibidos
  - Cuentas por pagar: tracking de facturas recibidas y pagos pendientes
  - Fechas de vencimiento y alertas de pagos próximos o vencidos
  - Conciliación automática con transacciones financieras
  - Reportes de antigüedad y morosidad

#### Página Índice de Finanzas (/finanzas)
Muestra los siguientes KPIs en tiempo real:
- Ingresos del mes (acumulado y proyectado)
- Egresos del mes (acumulado y proyectado)
- Utilidad neta (ingresos - egresos)
- Flujo de caja neto
- Cuentas pendientes de cobro y pago
- Cumplimiento del presupuesto por categoría
- Tendencias mensuales de ingresos y egresos

### 6. 📊 Módulo de Análisis

**Objetivo**: Toma de decisiones basada en datos y reportes personalizados.

#### Estructura de Submódulos:
- **KPIs**: Indicadores clave de desempeño
  - Productividad: huevos por gallina por día, tasa de puesta
  - Mortalidad: tasa semanal y acumulada, causas principales
  - Conversión alimenticia: kg de alimento por docena de huevos o por kg de ave viva
  - Eficiencia reproductiva: tasa de eclosión, pollitos por gallina
  - Rentabilidad: utilidad por ave, por huevo, por kg de carne
  - Tendencias históricas y comparativas

- **Reportes**: Exportables y personalizados
  - Reportes de producción (huevos, alimento, mortalidad)
  - Reportes financieros (ingresos, egresos, utilidad por período)
  - Reportes de inventario (stocks, movimientos, valoraciones)
  - Reportes sanitarios (aplicaciones, coûtos, cumplimiento)
  - Exportación en múltiples formatos (CSV, Excel, PDF)
  - Programación de envío automático por email
  - Filtros avanzados por fecha, rango, categoría, etc.

#### Página Índice de Análisis (/analisis)
Muestra los siguientes KPIs en tiempo real:
- Productividad (huevos/gallina/día)
- Tasa de mortalidad (% semanal)
- Conversión alimenticia (kg alimento/docena huevo)
- Tendencias recientes de indicadores clave
- Accesos rápidos a reportes más utilizados
- Alertas de desviaciones significativas en KPIs

### 7. 🗂 Módulo de Configuración

**Objetivo**: Gestión de datos maestros y parámetros del sistema.

#### Estructura de Submódulos:
- **Catálogos**: Tablas maestras del sistema
  - Tamaños de huevo con precio por presentación
  - Presentaciones con unidades y factores de conversión (ej: docena=12)
  - Razas de aves con características productivas
  - Compradores y proveedores con información de contacto
  - Unidades de medida (kg, g, unidades, litros, etc.)
  - Categorías de ingreso y egreso para finanzas
  - Tipos de sanidad y mantenimiento
  - Funcionalidad de activar/desactivar y orden de presentación
  - Búsqueda y filtrado avanzado

#### Página Índice de Configuración (/configuracion)
Muestra los siguientes KPIs en tiempo real:
- Número de catálogos activos vs total
- Catálogos recientemente modificados
- Alertas de configuraciones incompletas
- Accesos rápidos a los catálogos más utilizados
- Estadísticas de uso del sistema

## Integración Automática de Finanzas

Una característica distintiva de El Gallinero es la integración financiera automática:

### ¿Cómo funciona?
Cada evento significativo en el sistema genera automáticamente su transacción financiera correspondiente:

| Evento del Sistema | Transacción Financiera Generada | Trazabilidad |
|--------------------|---------------------------------|--------------|
| Venta de huevos | Ingreso | sourceType=egg_sales, sourceId=[venta_id] |
| Venta de aves | Ingreso | sourceType=chicken_sales, sourceId=[venta_id] |
| Venta de gallinaza | Ingreso | sourceType=manure_sales, sourceId=[venta_id] |
| Compra de alimento | Egreso | sourceType=feed_purchase, sourceId=[compra_id] |
| Compra de insumos | Egreso | sourceType=supply_purchase, sourceId=[compra_id] |
| Mantenimiento completado | Egreso | sourceType=maintenance, sourceId=[tarea_id] |
| Evento sanitario con costo | Egreso | sourceType=health_control, sourceId=[evento_id] |
| Sacrificio para venta | Ingreso | sourceType=slaughter, sourceId=[sacrificio_id] |

### Características de la Integración:
- **Automática**: No requiere intervención manual del usuario
- **Trazable**: Cada transacción financiera apunta directamente a su evento de origen
- **Consistente**: Evita doble registro o inconsistencias entre módulos
- **Auditables**: Permite auditoría completa desde el evento operativo hasta el impacto financiero
- **Tiempo Real**: Se genera inmediatamente al confirmar la operación
- **Reversible**: Al eliminar o corregir un evento operativo, su transacción financiera se ajusta o elimina automáticamente

## Flujos de Trabajo Clave

### Flujo de Producción de Huevos
1. Gallina puesta registrada en módulo de Producción → Producción de Huevos
2. Huevo recolectado por tamaño y destinado (consumo, incubación, descarte)
3. Inventario de huevos actualizado automáticamente (módulo de Inventarios)
4. Si se vende: registro en Finanzas → Ventas
5. Transacción de ingreso generada automáticamente con trazabilidad a la venta
6. Inventario de huevos disminuido según PEPS
7. Ingresos reflejados en panel financiero en tiempo real

### Flujo de Alimentación y Costo de Producción
1. Consumo de alimento registrado por gallina/día según programa
2. Inventario de alimento disminuido automáticamente
3. Costo del consumo calculado y preparado para integración financiera
4. Al completar el registro: transacción de egreso generada
5. Egreso vinculado al inventario de alimento consumido
6. Costo de producción reflejado en márgenes de utilidad

### Flujo de Sanidad y Productividad
1. Aplicación de tratamiento o vacuna registrada
2. Costo del producto y aplicación registrado
3. Transacción de egreso generada automáticamente
4. Estado de aves afectadas actualizado (si aplica)
5. Próxima aplicación programada en calendario sanitario
6. Costos sanitarios reflejados en análisis de rentabilidad

## Reglas de Negocio Específicas

### Producción y Ciclo de Vida
- Las gallinas cambian de etapa automáticamente según su edad
- Los estados terminales (vendida, faena, muerta) nunca se modifican hacia estados activos
- A las ~80 semanas se recomienda automáticamente el sacrificio
- El balance de parvada mantiene 1 gallo por cada 10 gallinas
- Los machos nacidos cubren primero el déficit de gallos antes de ir a lotes de engorde

### Inventario y Valuación
- Los huevos se valoran usando el método PEPS (Primero en Entrar, Primero en Salir) por tamaño
- Los huevos con más de 21 días generan alerta de vencimiento
- El stock de insumos critica alerta cuando llega al nivel mínimo de reposición
- La gallinaza se valora a costo de producción estimado (no incluye valor de mercado)

### Finanzas y Control
- Todas las transacciones financieras deben tener un origen identificable en el sistema operativo
- Los presupuestos se comparan contra el consumo real en tiempo real
- Las cuentas por cobrar y pagar se concilian automáticamente con las transacciones
- Los reportes financieros muestran tanto datos reales como proyecciones basadas en tendencias

## Características Técnicas Destacadas

### Escalabilidad y Rendimiento
- Arquitectura diseñada para manejar múltiples gallineros en la misma instancia
- Consultas optimizadas para reportes históricos largos
- Caché inteligente para KPIs frecuentemente accedidos
- Procesamiento por lotes para operaciones de cierre periódicas

### Seguridad e Integridad de Datos
- Validaciones en múltiples niveles (frontend, backend, base de datos)
- Transacciones atómicas para operaciones que afectan múltiples módulos
- Backups automáticos programados
- Registro de auditoría para cambios críticos
- Control de acceso basado en roles (administrador, operador, contador)

### Experiencia de Usuario
- Interfaz responsiva que funciona en desktop y tablet
- Navegación intuitiva con menú colapsable por módulo
- Tooltips y ayuda contextual en todas las pantallas
- Atajos de teclado para operaciones frecuentes
- Modo oscuro/claro según preferencia del usuario
- Exportación de reportes en múltiples formatos

## Integraciones y Extensibilidad

### APIs Disponibles
- API RESTful para todas las operaciones principales
- WebSockets para actualizaciones en tiempo real
- Endpoints específicos para reportes y exportaciones
- Interfaz para integración con dispositivos IoT (balanzas, contadores, etc.)

### Posibles Extensiones Futuras
- Integración con marcadores electrónicos para seguimiento individual de aves
- Módulo de comercio electrónico para ventas directas
- Integración con software contable externo (QuickBooks, Xero, etc.)
- Módulo de certificación y trazabilidad para mercados premium
- Análisis predictivo con machine learning para optimización de producción

Este documento proporciona una visión completa y detallada de todas las funcionalidades, módulos y características del sistema El Gallinero, yendo más allá de la información básica presente en el README.md para ofrecer un entendimiento profundo de lo que el sistema puede hacer y cómo sus diferentes componentes interactúan entre sí.