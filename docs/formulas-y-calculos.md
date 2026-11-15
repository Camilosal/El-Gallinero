# Fórmulas y cálculos — El Corral

> Motor de cálculo del sistema de gestión avícola multi-especie **El Corral**.
> Documento trazable al código de `src/lib/` y de `src/app/api/` el **14 de noviembre de 2026**.

**Alcance.** Este documento describe cada dato calculado del sistema: qué variable es, cómo se define, cuál es su fórmula, cómo la implementa el código, de qué tablas y campos sale y en qué pantalla, reporte o cálculo posterior termina. No inventa fórmulas: cada ficha cita el archivo y la función que la ejecuta. El modelo de datos subyacente está en el [diccionario de datos](data-dictionary.md).

## Cómo leer este documento

Cada cálculo tiene un código estable por dominio (`HUE-03`, `FIN-05`, …) y una ficha con seis campos:

| Campo | Qué contiene |
|---|---|
| **Variable** | Nombre técnico del dato y su unidad. |
| **Definición** | Qué significa en el negocio y cuándo aplica. |
| **Fórmula** | Expresión matemática canónica. |
| **Cálculo** | Decisiones de implementación: redondeos, ventanas de fecha, casos borde y valores por defecto. |
| **Origen** | Tablas y columnas de las que se alimenta. |
| **Destino** | Dónde se muestra o qué cálculo consume el resultado. |

**Convenciones.**

- Los montos están en pesos colombianos (COP) y se redondean a 2 decimales salvo que la ficha indique otra cosa.
- Las fechas de negocio son `date` (día sin hora). Los cálculos de edad usan medianoche o mediodía según el módulo para evitar corrimientos por zona horaria; se indica en cada ficha cuando es relevante.
- `farm_id` limita todas las consultas a la granja activa (RLS). Ninguna fórmula mezcla datos de granjas distintas.
- «Ventana del periodo» significa `[hoy − period, hoy]` inclusive, con `period` en días (por defecto 30). Varias tasas dividen entre `period`, no entre `period + 1`; se advierte en la ficha correspondiente.
- «Presente» significa que el animal no está vendido, faenado ni muerto. La fuente única es [`src/lib/animal-status.ts`](../src/lib/animal-status.ts).
- Los valores marcados como **configurable** se leen de `app_settings` y pueden cambiar sin desplegar código.

## Índice

1. [Constantes y parámetros de referencia](#1-constantes-y-parámetros-de-referencia)
2. [Inventarios](#2-inventarios)
3. [Producción de huevos](#3-producción-de-huevos)
4. [Zootecnia](#4-zootecnia)
5. [Ciclo de vida y parvada](#5-ciclo-de-vida-y-parvada)
6. [Alimentación](#6-alimentación)
7. [Gallinaza y compostaje](#7-gallinaza-y-compostaje)
8. [Sanidad y bioseguridad](#8-sanidad-y-bioseguridad)
9. [Ambiente y sensores](#9-ambiente-y-sensores)
10. [Reproducción e incubación](#10-reproducción-e-incubación)
11. [Finanzas y contabilidad analítica](#11-finanzas-y-contabilidad-analítica)
12. [KPIs y comparativos](#12-kpis-y-comparativos)
13. [Reportes y exportaciones](#13-reportes-y-exportaciones)
14. [Catálogo consolidado de alertas](#14-catálogo-consolidado-de-alertas)
15. [Orden de cálculo y dependencias](#15-orden-de-cálculo-y-dependencias)
16. [Mantenimiento de este documento](#16-mantenimiento-de-este-documento)

---

## 1. Constantes y parámetros de referencia

Estos valores no se calculan: se configuran y alimentan las fórmulas de los demás dominios. Los que viven en `app_settings` se leen con [`src/lib/settings.ts`](../src/lib/settings.ts).

| Constante | Valor vigente | Clave o fuente | Uso |
|---|---:|---|---|
| Gallinas por gallo | 10 | `flock.hens_per_rooster` | `CIC-02` |
| Semanas objetivo de engorde | 7 | `flock.default_target_weeks` | Lotes nuevos |
| Peso objetivo de engorde | 2,5 kg | `flock.default_target_weight_kg` | Lotes nuevos |
| Fin de postura | 80 semanas | `lifecycle.fin_postura_weeks` | `CIC-01`, `PLA-03` |
| Peso de venta de gallina | 2,5 kg | `lifecycle.peso_venta_kg` | `CIC-01` |
| Días de vacío sanitario | 21 | `sanitary.empty_days` | `SAN-05` |
| Umbral de validación de postura | 1,5× | `eggs.validation_threshold` | Alerta de recolección anómala |
| Horizonte de predicción de alimento | 14 días | `feeding.prediction_horizon_days` | `ALI-06` |
| Temperatura ideal de bodega de huevo | 10–15 °C | `eggs.storage_temp_min_c` / `_max_c` | `INV-03` |
| Humedad ideal de bodega de huevo | 75–85 % | `eggs.storage_humidity_min_pct` / `_max_pct` | `INV-03` |
| Tolerancia de uniformidad | 10 % | `alerts.uniformity_tolerance_pct` | `ZOO-06` |
| Caída de postura que alerta | 20 % | `alerts.production_drop_pct` | Alertas de producción |
| Desviación de peso que alerta | 15 % | `alerts.weight_deviation_pct` | Alertas de peso |
| Precio vivo de respaldo | 10.000 COP/kg | `inventory.bird_price_per_kg` | `INV-05` |
| Precio de gallinaza de respaldo | 300 COP/kg | `inventory.manure_price_per_kg` | `GAL-02` |
| Días de incubación | 21 / 28 / 17 | `incubation.days`, `incubation.duck_days`, `incubation.quail_days` | `REP-04` |
| Días antes de eclosión para dejar de voltear | 3 | `incubation.turn_stop_days_before` | `REP-04` |
| Días de cosecha por especie | pollo 42, pato 49, codorniz 42, conejo 75, cuy 80 | `harvest.days_*` | Alertas de cosecha |

**Clasificación NTC 1240** ([`src/lib/ntc1240.ts`](../src/lib/ntc1240.ts)). Es la base de `HUE-06`, `INV-01` y de los márgenes por calibre:

| Calibre | Rango de peso | Alias heredados |
|---|---|---|
| Jumbo | > 78 g | `jumbo` |
| AAA | 67 – 77,9 g | `aaa`, `extra` |
| AA | 60 – 66,9 g | `aa`, `grande` |
| A | 53 – 59,9 g | `a`, `mediano`, `mediana` |
| B | 46 – 52,9 g | `b`, `pequeño`, `pequeña` |
| C | < 46 g | `c`, `descarte` |

**Parámetros productivos por especie** ([`src/lib/species-params.ts`](../src/lib/species-params.ts)). Cada especie y raza declara `dailyFeedGPerHead`, `feedCostPerKgCOP`, `feedConversionRatio`, `carcassYieldPercent`, `marketPriceKgCanalCOP`, `marketPriceEggUnitCOP`, `eggsPerDayPerFemale`, `cycleWeeks` y pesos objetivo. Son la fuente de los valores de respaldo cuando no hay dato real.

---

## 2. Inventarios

Los inventarios son **saldos por movimientos**: no se guarda un campo «stock» que alguien edite, sino que se reconstruye sumando entradas y restando salidas. La excepción es `feed_inventory.current_stock`, que sí es un saldo mantenido y lockeado en cada movimiento.

### INV-01 · Huevo vendible por calibre

| Campo | Contenido |
|---|---|
| **Variable** | `saleableProduced` (huevos) |
| **Definición** | Huevos clasificados que pueden venderse. Quedan por fuera los rotos, los descartados, los destinados a incubación y el autoconsumo. |
| **Fórmula** | `saleableTotal = min(classifiedTotal − autoconsumed, requestedSaleable)` y luego se reparte por calibre con el método del mayor residuo. |
| **Cálculo** | `classifiedTotal` es la suma de `egg_production_details.quantity` de la producción. `autoconsumed = min(classifiedTotal, quantity_autoconsumo)`. `requestedSaleable = quantity_excedente`; si vale 0 y no hay autoconsumo, se asume `classifiedTotal` para no perder registros históricos. El reparto por calibre es proporcional al peso de cada calibre y ajusta enteros por residuo, de modo que la suma cuadre exactamente con `saleableTotal`. |
| **Origen** | `egg_production.quantity_autoconsumo`, `egg_production.quantity_excedente`, `egg_production_details.size`, `egg_production_details.quantity`. |
| **Destino** | `INV-02`, `HUE-02`, valorización del inventario y disponible para venta. |
| **Código** | [`src/lib/inventory.ts`](../src/lib/inventory.ts) → `computeEggInventory()`. |

> **Regla de negocio.** Solo la porción vendible entra al PEPS. Autoconsumo, incubación, rotos y descartados nunca se venden; si se intentara, el saldo book se vuelve negativo y la operación se rechaza.

### INV-02 · Saldo PEPS de huevo

| Campo | Contenido |
|---|---|
| **Variable** | `available` (huevos) |
| **Definición** | Unidades disponibles de un calibre después de vender y registrar pérdidas. |
| **Fórmula** | `available = max(0, saleableProduced − sold − lost)` |
| **Cálculo** | Las ventas se consumen **PEPS** (primero en entrar, primero en salir): cada lote de producción se descuenta en orden de fecha hasta agotar la venta. Las pérdidas (`egg_losses`) no tienen calibre en el modelo y se asignan al stock remanente. El saldo contable global es `saleableProduced − sold − recordedLost` y se usa como invariante para impedir sobreventas. |
| **Origen** | `egg_production`, `egg_production_details`, `egg_sales_items`, `egg_losses`. |
| **Destino** | Pantalla de inventario de huevos, `HUE-07`, validación de venta y cierre diario. |
| **Código** | [`src/lib/inventory.ts`](../src/lib/inventory.ts) → `computeEggInventory()`, `eggInventoryBookBalance()`. |

### INV-03 · Envejecimiento y alertas de bodega de huevo

| Campo | Contenido |
|---|---|
| **Variable** | `ageDays`, `aging[]`, `storageAlerts[]` |
| **Definición** | Edad del lote y cumplimiento de las condiciones ideales de conservación. |
| **Fórmula** | `ageDays = hoy − production.date` (días completos). Buckets: 0–3, 4–7, 8–14, 15–21, > 21 días. Alerta si `tempC < 10` o `> 15`, o `humidity < 75` o `> 85`. |
| **Cálculo** | Se calcula por lote con saldo mayor que cero. El lote más antiguo (`oldestLot`) se usa para priorizar despacho. Cada advertencia se guarda como texto legible en la respuesta; no bloquea la venta, la advierte. |
| **Origen** | `egg_production.date`, `egg_production.storage_temp_c`, `egg_production.storage_humidity_pct`, `egg_production.lot_code`. |
| **Destino** | Inventario, alertas de calidad y recomendación de rotación. |
| **Código** | [`src/lib/inventory.ts`](../src/lib/inventory.ts), [`src/lib/ntc1240.ts`](../src/lib/ntc1240.ts) → `checkEggStorageTelemetry()`. |

### INV-04 · Saldo FIFO de carne

| Campo | Contenido |
|---|---|
| **Variable** | `available` (kg de canal) |
| **Definición** | Kilogramos vendibles en canal después de ventas y pérdidas, separados por especie. |
| **Fórmula** | `saleableWeightKg = total − noVendible`, `available = producido − vendido − perdido` por especie, consumiendo lotes FIFO. |
| **Cálculo** | Si `slaughter.destination = "venta"`, lo vendible es `min(total, excedente)`; si es `"mixto"`, `min(total, excedente o total − autoconsumo)`; si es autoconsumo puro, 0. Las ventas se reparten FIFO entre lotes de la **misma especie**; las pérdidas se asignan FIFO al remanente. |
| **Origen** | `slaughter.weight_kg`, `slaughter.weight_kg_autoconsumo`, `slaughter.weight_kg_excedente`, `slaughter.destination`, `meat_sales`, `meat_losses`. |
| **Destino** | Inventario de carne, `FIN-07`, valorización a precio de canal. |
| **Código** | [`src/lib/inventory.ts`](../src/lib/inventory.ts) → `computeMeatInventory()`. |

### INV-05 · Inventario y valor de animales

| Campo | Contenido |
|---|---|
| **Variable** | `count`, `totalWeightKg`, `estimatedValue` (COP) |
| **Definición** | Animales presentes en la granja y su valor en pie estimado. |
| **Fórmula** | `totalWeightKg = count × avgWeightKg`; `estimatedValue = totalWeightKg × pricePerKg`; `pricePerKg = round(precioCanal × rendimientoCanal / 100)`. |
| **Cálculo** | Gallinas y gallos: promedio de los pesos individuales registrados; si no hay peso, se usa el peso objetivo de la especie (2,5 kg gallina). Lotes: `avg_weight_kg`; si es 0, `target_weight_kg`. Si no hay precio de canal, se usa `inventory.bird_price_per_kg` (10.000 COP/kg). Se agrupa por especie y ubicación, y se suma un consolidado. |
| **Origen** | `hens.weight`, `roosters.weight`, `broiler_batches.avg_weight_kg`, `broiler_batches.target_weight_kg`, `species_params`, `app_settings`. |
| **Destino** | Dashboard, valorización de la granja y KPIs de inventario. |
| **Código** | [`src/lib/animal-inventory.ts`](../src/lib/animal-inventory.ts) → `computeAnimalInventory()`. |

### INV-06 · Stock y valor del alimento

| Campo | Contenido |
|---|---|
| **Variable** | `currentStock`, `estimatedValue`, `isLow`, `daysRemaining` |
| **Definición** | Existencias de cada alimento, su valor y la cobertura estimada. |
| **Fórmula** | `estimatedValue = currentStock × costPerUnit`; `daysRemaining = currentStock / consumoPromedioDiario`. |
| **Cálculo** | El stock se mantiene por movimientos (`feed_movements.is_entry`), nunca baja de 0. El consumo promedio se calcula con los movimientos de salida de los últimos `days` (30 por defecto). `isLow` compara contra `min_stock`. Antes de calcular, el sistema materializa los consumos pendientes del programa (`ALI-05`). |
| **Origen** | `feed_inventory.current_stock`, `feed_inventory.min_stock`, `feed_inventory.cost_per_unit`, `feed_movements`. |
| **Destino** | Bodega, alertas de desabastecimiento y `KPI-05`. |
| **Código** | [`src/lib/feeding/inventory.ts`](../src/lib/feeding/inventory.ts) → `getFeedInventoryProjection()`. |

### INV-07 · Stock de gallinaza

| Campo | Contenido |
|---|---|
| **Variable** | `available` (kg) |
| **Definición** | Gallinaza disponible para venta o compostaje. |
| **Fórmula** | `available = produced + adjusted − sold` |
| **Cálculo** | `produced` suma `manure_production.kg_produced` (incluye la estimación automática diaria); `adjusted` suma `manure_adjustments.delta_kg` (puede ser negativa); `sold` suma `manure_sales.quantity_kg`. El saldo se bloquea con `SELECT … FOR UPDATE` antes de vender para evitar sobreventa concurrente. |
| **Origen** | `manure_production`, `manure_adjustments`, `manure_sales`. |
| **Destino** | Inventario de gallinaza, `GAL-03` y compostaje. |
| **Código** | [`src/lib/inventory.ts`](../src/lib/inventory.ts) → `computeManureInventory()`; [`src/lib/manure-stock.ts`](../src/lib/manure-stock.ts). |

---

## 3. Producción de huevos

### HUE-01 · Total colectado del día

| Campo | Contenido |
|---|---|
| **Variable** | `total_collected` (huevos) |
| **Definición** | Todo huevo recogido en el día, incluido lo que no se vende. |
| **Fórmula** | `total_collected = Σ detalle.quantity + broken + discarded + for_incubation` |
| **Cálculo** | Si el formulario envía clasificación por tamaño, el total se **deriva** de la suma de calibres más las categorías no vendibles; si no, se acepta el total digitado. Se exige entero no negativo. Si el total supera `1,5 ×` la producción esperada, se pide confirmación antes de guardar. |
| **Origen** | `egg_production_details.quantity`, `egg_production.broken`, `discarded`, `for_incubation`. |
| **Destino** | `HUE-03`, `HUE-04`, `HUE-05`, series de postura y reportes. |
| **Código** | [`src/app/api/produccion/huevos/route.ts`](../src/app/api/produccion/huevos/route.ts). |

**Producción esperada (solo para la validación).** Se calcula por etapa del catálogo: para cada etapa con `expected_eggs_per_hen > 0`, se cuentan las gallinas activas cuya edad cae en `[min_weeks, max_weeks)` y se multiplica. El resultado se redondea a 1 decimal. Es un control de captura, no un KPI.

### HUE-02 · Autoconsumo y excedente

| Campo | Contenido |
|---|---|
| **Variable** | `quantity_autoconsumo`, `quantity_excedente` (huevos) |
| **Definición** | Reparto de los huevos buenos entre consumo del hogar y venta. |
| **Fórmula** | `excedente = goodTotal − autoconsumo` (si no se envía) y `autoconsumo + excedente ≤ goodTotal`. |
| **Cálculo** | `goodTotal = Σ calibres`. Ambos valores deben ser enteros no negativos. El autoconsumo se registra además en `autoconsumo_logs` para valorizar el ahorro (`FIN-10`). |
| **Origen** | `egg_production_details`, `egg_production.quantity_autoconsumo`, `quantity_excedente`. |
| **Destino** | `INV-01`, `FIN-10`, soberanía alimentaria. |
| **Código** | [`src/app/api/produccion/huevos/route.ts`](../src/app/api/produccion/huevos/route.ts). |

### HUE-03 · Porcentaje de postura gallina-día (HD %)

| Campo | Contenido |
|---|---|
| **Variable** | `layingRate` (%) |
| **Definición** | Huevos recolectados por ave elegible y por día. Es la medida estándar de postura. |
| **Fórmula** | `HD% = (eligibleEggs / (eligibleAnimals × days)) × 100` |
| **Cálculo** | **Aves elegibles:** gallinas en estado `activa` con edad ≥ la primera etapa que declara `expected_eggs_per_hen > 0` (si no hay catálogo, 20 semanas), más lotes de codorniz o pato con propósito `postura_huevo`, estado activo y edad ≥ `cycleWeeks × 7`. **Huevos elegibles:** los de esas aves, excluyendo registros de otras especies o lotes no elegibles. `days` es el parámetro `period` (30 por defecto); la ventana consultada es `[hoy − period, hoy]`. |
| **Origen** | `egg_production.total_collected`, `hens.birth_date`, `hens.status`, `broiler_batches`, `catalogos`. |
| **Destino** | Dashboard, `KPI-06`, curvas de postura y comparativo de periodo. |
| **Código** | [`src/app/api/analisis/kpis/route.ts`](../src/app/api/analisis/kpis/route.ts). |

### HUE-04 · Postura ave alojada (HAA %)

| Campo | Contenido |
|---|---|
| **Variable** | `haaRate` (%) |
| **Definición** | Huevos por ave **alojada** (población inicial), no solo por ave presente. Refleja el desempeño del lote completo. |
| **Fórmula** | `HAA% = (eligibleEggs / (initialLayerPool × days)) × 100`, con `initialLayerPool = max(eligibleAnimals, gallinasPresentes + Σ initialQuantity de lotes elegibles)`. |
| **Cálculo** | El denominador nunca es menor que las aves elegibles actuales, para que la tasa no supere el 100 % por mortalidad. Se muestra junto a HD % en el KPI `laying_haa`. |
| **Origen** | Igual que `HUE-03` más `broiler_batches.initial_quantity`. |
| **Destino** | KPI de postura HAA, comparativo y reportes gerenciales. |
| **Código** | [`src/app/api/analisis/kpis/route.ts`](../src/app/api/analisis/kpis/route.ts). |

### HUE-05 · Merma de huevo

| Campo | Contenido |
|---|---|
| **Variable** | `mermaPct` (%) |
| **Definición** | Porcentaje de huevo recolectado que no es comercializable por rotura o descarte. |
| **Fórmula** | `mermaPct = ((broken + discarded) / totalCollected) × 100` |
| **Cálculo** | Redondeo a 1 decimal. Umbral de referencia: ≤ 2 % es buen manejo; > 5 % dispara alerta. La incubación **no** cuenta como merma. |
| **Origen** | `egg_production.broken`, `discarded`, `total_collected`. |
| **Destino** | Micro-reporte diario, alertas de calidad y `HUE-07`. |
| **Código** | [`src/lib/micro-insights.ts`](../src/lib/micro-insights.ts) → `buildEggMicroInsight()`. |

### HUE-06 · Clasificación NTC 1240

| Campo | Contenido |
|---|---|
| **Variable** | `caliber.code`, `minWeightG`, `maxWeightG` |
| **Definición** | Asigna un huevo a la categoría comercial colombiana según su peso. |
| **Fórmula** | Búsqueda por rangos: Jumbo ≥ 78,1 g; AAA 67–77,9; AA 60–66,9; A 53–59,9; B 46–52,9; C < 46. |
| **Cálculo** | Acepta el código oficial y los alias heredados (`extra`, `grande`, `mediano`, `pequeño`, etc.). La comparación es insensible a mayúsculas y espacios. |
| **Origen** | `egg_sales_items.size`, `catalogos` de calibres. |
| **Destino** | `FIN-06`, inventario por calibre, etiquetas y reportes. |
| **Código** | [`src/lib/ntc1240.ts`](../src/lib/ntc1240.ts), [`src/lib/analytics/contabilidad-analitica.ts`](../src/lib/analytics/contabilidad-analitica.ts) → `classifyNtc1240Caliber()`. |

### HUE-07 · Valor comercial del día y utilidad neta

| Campo | Contenido |
|---|---|
| **Variable** | `estimatedValue`, `netProfitToday` (COP) |
| **Definición** | Valor de los huevos vendibles del día y utilidad después del alimento. |
| **Fórmula** | `estimatedValue = commercialEggs × unitPrice`; `commercialEggs = max(0, totalCollected − broken − discarded − forIncubation)`; `netProfitToday = estimatedValue − todayFeedCost`. |
| **Cálculo** | `unitPrice` es el precio de referencia del calibre o de la especie. La utilidad solo se calcula si hay costo de alimento del día registrado. |
| **Origen** | `egg_production`, `feed_movements`, precios de `species_params` o catálogo. |
| **Destino** | Micro-reporte diario de huevos y nudge de rentabilidad. |
| **Código** | [`src/lib/micro-insights.ts`](../src/lib/micro-insights.ts) → `buildEggMicroInsight()`. |

### HUE-08 · Código de lote PEPS

| Campo | Contenido |
|---|---|
| **Variable** | `lot_code` |
| **Definición** | Identificador trazable de la producción diaria. |
| **Fórmula** | `H-AAAAMMDD-<3 letras especie>-<4 caracteres>` |
| **Cálculo** | La fecha se compacta sin guiones; la especie usa sus tres primeras letras en mayúscula; el sufijo es un hint único o 4 caracteres aleatorios alfanuméricos. Ejemplo: `H-20261114-GAL-7K2P`. |
| **Origen** | `egg_production.date`, `species`, `lot_code`. |
| **Destino** | Etiquetas, trazabilidad (`EXP-03`) y rotación PEPS. |
| **Código** | [`src/lib/ntc1240.ts`](../src/lib/ntc1240.ts) → `generateEggLotCode()`. |

## 4. Zootecnia

### ZOO-01 · Promedio de pesos (pesaje individual)

| Campo | Contenido |
|---|---|
| **Variable** | `meanG` (g) |
| **Definición** | Peso promedio de un lote de aves pesadas individualmente. |
| **Fórmula** | `meanG = Σ pesos / n` |
| **Cálculo** | Se aceptan pesos separados por coma, espacio, punto y coma o como arreglo numérico. Solo se toman valores finitos y mayores que 0. Se usa como base de `ZOO-02` y `ZOO-04`. |
| **Origen** | Entrada libre del usuario (formulario de pesaje). |
| **Destino** | `weight_logs`, `ZOO-02`, `ZOO-06`. |
| **Código** | [`src/lib/zootechnics.ts`](../src/lib/zootechnics.ts) → `parseIndividualWeightsInput()`. |

### ZOO-02 · Coeficiente de variación (CV %)

| Campo | Contenido |
|---|---|
| **Variable** | `cvPercent` (%) |
| **Definición** | Dispersión relativa de los pesos respecto a la media. Mide uniformidad del lote. |
| **Fórmula** | `CV% = (desviación estándar muestral / media) × 100` |
| **Cálculo** | Varianza muestral = `Σ(w − mean)² / (n − 1)`; si `n = 1`, varianza = 0. Desviación estándar = `√varianza`. Redondeo a 2 decimales. Estado: `excelente` si ≤ 8, `aceptable` si ≤ 12, `desuniforme` si > 12. |
| **Origen** | Pesos individuales (`ZOO-01`). |
| **Destino** | `weight_logs.cv_percent`, KPI `uniformity`, alertas de peso. |
| **Código** | [`src/lib/zootechnics.ts`](../src/lib/zootechnics.ts) → `computeUniformityStats()`. |

### ZOO-03 · Desviación estándar (SD)

| Campo | Contenido |
|---|---|
| **Variable** | `stdDevG` (g) |
| **Definición** | Desviación estándar muestral de los pesos del lote. |
| **Fórmula** | `SD = √(Σ(w − mean)² / (n − 1))` |
| **Cálculo** | Redondeo a 1 decimal. Solo se reporta si `n > 0`. |
| **Origen** | Pesos individuales (`ZOO-01`). |
| **Destino** | `weight_logs.std_dev_g` y estadísticas de lote. |
| **Código** | [`src/lib/zootechnics.ts`](../src/lib/zootechnics.ts) → `computeUniformityStats()`. |

### ZOO-04 · Uniformidad (% dentro de banda)

| Campo | Contenido |
|---|---|
| **Variable** | `uniformityPct` (%) |
| **Definición** | Porcentaje de animales cuyo peso cae dentro de `media ± tolerancia`. |
| **Fórmula** | `uniformidad% = (aves dentro de [mean×(1 − tol/100), mean×(1 + tol/100)] / n) × 100` |
| **Cálculo** | Tolerancia por defecto 10 % (ajustable por `alerts.uniformity_tolerance_pct`). Umbral de referencia objetivo: 80 %. Redondeo a 2 decimales. |
| **Origen** | Pesos individuales (`ZOO-01`). |
| **Destino** | `weight_logs.uniformity_pct`, KPI `uniformity`, `ZOO-02`. |
| **Código** | [`src/lib/zootechnics.ts`](../src/lib/zootechnics.ts) → `computeUniformityStats()`. |

### ZOO-05 · Ganancia diaria (ADG / GDP)

| Campo | Contenido |
|---|---|
| **Variable** | `dailyGainG` (g/día) |
| **Definición** | Aumento de peso diario entre dos pesajes. |
| **Fórmula** | `ADG = (pesoActual − pesoAnterior) / díasTranscurridos` |
| **Cálculo** | Devuelve `null` si falta alguno de los valores o si los días transcurridos ≤ 0. Se guarda en `weight_logs.daily_gain_g` para uso de `ZOO-06` y reportes de crecimiento. |
| **Origen** | `weight_logs` (pesos anteriores y actuales, fechas). |
| **Destino** | Curvas de peso, crecimiento por especie, `REP-06`. |
| **Código** | [`src/lib/zootechnics.ts`](../src/lib/zootechnics.ts) → `computeDailyGainG()`. |

### ZOO-06 · EPEF (Índice de eficiencia productiva)

| Campo | Contenido |
|---|---|
| **Variable** | `epef` (puntos) |
| **Definición** | Índice de eficiencia productiva para lotes de engorde (pollo, pato, codorniz, conejo, cuy). |
| **Fórmula** | `EPEF = ((viabilidad % × peso vivo kg) / (edad días × ICA)) × 100`, donde ICA es la conversión alimenticia (FCR). |
| **Cálculo** | `viabilidad = (cantidad actual / cantidad inicial) × 100` (100 si no hay datos). Si `edad días ≤ 0`, `ICA ≤ 0`, `viabilidad ≤ 0` o `peso ≤ 0`, devuelve `null`. Promedio de EPEFs de los lotes del filtro. Redondeo a 1 decimal. Meta de referencia: 300 puntos. |
| **Origen** | `broiler_batches.initial_quantity`, `current_quantity`, `avg_weight_kg`, `start_date`, `species_params.feed_conversion_ratio`. |
| **Destino** | KPI `epef`, reportes de rentabilidad y recomendación de sacrificio. |
| **Código** | [`src/lib/zootechnics.ts`](../src/lib/zootechnics.ts) → `computeEpef()`; [`src/app/api/analisis/kpis/route.ts`](../src/app/api/analisis/kpis/route.ts). |

### ZOO-07 · Calibración ambiental de peso objetivo

| Campo | Contenido |
|---|---|
| **Variable** | `factor` (multiplicador) |
| **Definición** | Ajuste del peso objetivo según altitud y tipo de piso. |
| **Fórmula** | `pesoAjustado = pesoObjetivo × factor`, con `factor` comenzando en 1,0. |
| **Cálculo** | - Pollo/pato a ≥ 2200 msnm: factor × 0,94 (−6 %).\n- Pollo/pato a ≥ 1600 msnm: factor × 0,97 (−3 %).\n- Cuy a 1800–3400 msnm: sin ajuste (óptimo andino).\n- Piso pastoreo: factor × 0,95 (−5 %).\n- Piso jaula/baterías/pozas: factor × 1,02 (+2 %).\nAltitud de referencia en `farm.altitude_meters` (1850 msnm en producción). Redondeo a 4 decimales. |
| **Origen** | `app_settings.farm.altitude_meters`, piso del lote (`catalogos` / lote). |
| **Destino** | Peso objetivo de curvas y alertas de cosecha. |
| **Código** | [`src/lib/zootechnics.ts`](../src/lib/zootechnics.ts) → `calibrateTargetForEnvironment()`. |

## 5. Ciclo de vida y parvada

### CIC-01 · Evaluación de ciclo de vida de gallina

| Campo | Contenido |
|---|---|
| **Variable** | `status`, `ageWeeks`, `reasons[]` |
| **Definición** | Resuelve el estado automático de una gallina (`activa` o `recomendada_sacrificio`) según edad y peso. |
| **Fórmula** | `recomendada_sacrificio` si `edadSemanas ≥ finPosturaWeeks` **o** `peso ≥ pesoVentaKg`. |
| **Cálculo** | `edadSemanas = (hoy − nacimiento) / (7 × 24 × 60 × 60 × 1000)` (semanas con decimales; se reporta `floor`). Los estados manuales (`enferma`, `descarte`, `empollando`) y terminales (`vendida`, `faena`, `muerta`) nunca son tocados. Recomienda si cualquiera de las dos condiciones se cumple, nunca ambas obligatorias. Valores por defecto: fin de postura 80 semanas, peso venta 2,5 kg. |
| **Origen** | `hens.birth_date`, `hens.weight`, `hens.status`, `catalogos` (etapas), `app_settings`. |
| **Destino** | Estado de gallinas en pantalla y `PLA-03`. |
| **Código** | [`src/lib/lifecycle.ts`](../src/lib/lifecycle.ts) → `evaluateLifecycle()`. |

### CIC-02 · Relación gallos/gallinas

| Campo | Contenido |
|---|---|
| **Variable** | `requiredRoosters`, `deficit`, `surplus` |
| **Definición** | Cantidad de gallos reproductores necesarios y su diferencia con los activos. |
| **Fórmula** | `requeridos = ceil(gallinasActivas / gallinasPorGallo)`; `deficit = max(0, requeridos − activos)`; `surplus = max(0, activos − requeridos)`. |
| **Cálculo** | `gallinasPorGallo` por defecto 10 (`flock.hens_per_rooster`). Si hay excedentes, se destinan a lotes de pollo de sacrificio. |
| **Origen** | `hens` (estado presente), `roosters` (estado presente), `app_settings`. |
| **Destino** | `PLA-04`, distribución de machos recién ingresados. |
| **Código** | [`src/lib/flock.ts`](../src/lib/flock.ts) → `requiredRoosters()`, `assignMales()`. |

### CIC-03 · Etapa de crecimiento por edad

| Campo | Contenido |
|---|---|
| **Variable** | `stage` |
| **Definición** | Etapa de `catalogos` (categoría `etapa_crecimiento`) que corresponde a una edad en semanas. |
| **Fórmula** | Primera etapa tal que `minWeeks ≤ edadSemanas < maxWeeks` (o sin límite superior si `maxWeeks` es nulo). |
| **Cálculo` | Se ordena por `sortOrder`. Si no hay etapa que encaje, devuelve `null`. |
| **Origen** | `catalogos` (etapas de crecimiento), edad del animal (`lifecycle.ageInWeeks`). |
| **Destino** | Alimentación por etapa (`ALI-02`), postura esperada (`PLA-01`). |
| **Código** | [`src/lib/lifecycle.ts`](../src/lib/lifecycle.ts) → `stageForAge()`. |

### CIC-04 · Edad del animal

| Campo | Contenido |
|---|---|
| **Variable** | `ageWeeks` |
| **Definición** | Edad en semanas a partir de la fecha de nacimiento. |
| **Fórmula** | `edadSemanas = (hoy − nacimiento) / (7 × 24 × 60 × 60 × 1000)` |
| **Cálculo` | Las fechas se normalizan a mediodía antes de restar para evitar corrimientos por zona horaria. Devuelve semanas con decimales; `floor` para reportes enteros. |
| **Origen** | `hens.birth_date`, `roosters.birth_date`, `broiler_batches.start_date`. |
| **Destino** | `CIC-01`, `CIC-03`, `PLA-01`, `PLA-03`. |
| **Código** | [`src/lib/lifecycle.ts`](../src/lib/lifecycle.ts) → `ageInWeeks()`. |

### PLA-01 · Postura esperada del plan de parvada

| Campo | Contenido |
|---|---|
| **Variable** | `expectedEggs` (huevos/semana) |
| **Definición** | Huevos que se esperan de la parvada en la semana según edad real y estándares del catálogo. |
| **Fórmula** | `expectedPerDay = Σ expectedEggsPerHen(etapa) × gallinasEnEtapa`; `expectedPerWeek = expectedPerDay × 7` |
| **Cálculo` | Se itera cada gallina presente en ciclo (`edad < finPosturaWeeks`), se resuelve su etapa y se suma su `expected_eggs_per_hen`. Si la etapa no declara valor, se asume 0. |
| **Origen** | `hens`, `catalogos.expected_eggs_per_hen`, `app_settings.lifecycle.fin_postura_weeks`. |
| **Destino** | `PLA-02`, cumplimiento de postura y alertas de bajo rendimiento. |
| **Código** | [`src/lib/flock-plan.ts`](../src/lib/flock-plan.ts) → `buildFlockPlanLive()`. |

### PLA-02 · Cumplimiento de postura

| Campo | Contenido |
|---|---|
| **Variable** | `compliancePct` (%) |
| **Definición` | Grado de cumplimiento de la postura esperada en los últimos 7 días. |
| **Fórmula` | `cumplimiento% = (huevosÚltimos7Días / huevosEsperadosÚltimos7Días) × 100` |
| **Cálculo` | `round1(actual / expected × 100)`. Si esperado ≤ 0, cumplimiento = 0. Alertas: < 90 % warning, > 110 % info, ≥ 90 % success. |
| **Origen** | `egg_production.total_collected` (últimos 7 días), `PLA-01`. |
| **Destino` | Dashboard del plan de parvada y alertas. |
| **Código` | [`src/lib/flock-plan.ts`](../src/lib/flock-plan.ts) → `buildFlockPlanLive()`. |

### PLA-03 · Fecha y avance de reemplazo

| Campo | Contenido |
|---|---|
| **Variable** | `replacementDate`, `progressPct`, `daysToReplacement` |
| **Definición` | Fecha estimada de reemplazo de la parvada y avance hacia ella. |
| **Fórmula` | `replacementDate = startDate + finPosturaWeeks × 7 días`; `progreso% = (díasTranscurridos / díasTotales) × 100` |
| **Cálculo` | `díasTotales` ≥ 1. Si la fecha planificada existe se usa; si no, 80 semanas desde el inicio. Aviso si falta ≤ 8 semanas. `daysToReplacement` redondeado a días enteros. |
| **Origen** | `flock_plans.start_date`, `flock_plans.replacement_date`, `app_settings.lifecycle.fin_postura_weeks`. |
| **Destino` | Plan de parvada, alertas de reposición y `PLA-02`. |
| **Código` | [`src/lib/flock-plan.ts`](../src/lib/flock-plan.ts) → `buildFlockPlan()`. |

## 6. Alimentación

### ALI-01 · Consumo del programa de alimentación

| Campo | Contenido |
|---|---|
| **Variable** | `quantityKg` por movimiento (kg) |
| **Definición` | Cantidad de alimento que el programa asigna a un grupo de animales en un día. |
| **Fórmula` | `kg = (gramosPorAve × cantidadAnimales) / 1000` |
| **Cálculo` | El programa declara `daily_amount_per_hen` en gramos por animal/día por etapa. Se multiplica por el conteo de animales de esa etapa/ubicación a la fecha y se divide entre 1000 para kg. Si el stock disponible es insuficiente, se consume solo lo disponible (el movimiento nunca deja stock negativo). El consumo se materializa solo para fechas pasadas o presentes, nunca futuras. |
| **Origen` | `feed_programs.daily_amount_per_hen`, `feed_programs.stage_catalogo_id`, conteo de animales (`ALI-04`). |
| **Destino` | `feed_movements` (auto-generated), `INV-06`, `KPI-05`, `FIN-08`. |
| **Código` | [`src/lib/feeding/runProgram.ts`](../src/lib/feeding/runProgram.ts) → `runFeedProgramCatchup()`. |

### ALI-02 · Animales por etapa y ubicación

| Campo | Contenido |
|---|---|
| **Variable** | `count` por etapa/ubicación/especie |
| **Definición` | Número de animales de cada etapa, especie y alojamiento a una fecha dada. |
| **Fórmula` | Conteo de `hens`, `roosters` y `broiler_batches` presentes cuya edad cae en cada etapa de crecimiento del catálogo. |
| **Cálculo` | Se ejecuta bajo un advisory lock (`feeding.program_checkpoint_date`) para serializar la ejecución del programa y evitar consumos duplicados. Los animales se asignan por `location_id` o "sin lugar". |
| **Origen` | `hens`, `roosters`, `broiler_batches`, `catalogos` (etapas). |
| **Destino` | `ALI-01`, `INV-06`, predicción de stock (`ALI-06`). |
| **Código` | [`src/lib/feeding/runProgram.ts`](../src/lib/feeding/runProgram.ts) → `countAnimalsByStageAndLocationForDate()`. |

### ALI-03 · Validación y normalización de programa

| Campo | Contenido |
|---|---|
| **Variable** | `entries[]` con `feedId`, `dailyAmountPerHen`, `percentage` |
| **Definición` | Dieta combinada de una etapa: alimentos y dosis diaria. |
| **Fórmula` | `porcentaje = dosis / totalDeLaEtapa × 100` (se deriva de los gramos, no se almacena inconsistente). |
| **Cálculo` | Mínimo 1 alimento, máximo 9999,99 g por entrada. La dosis debe ser número finito > 0. El porcentaje se recalcula siempre, así nunca queda desincronizado con el consumo real, que usa únicamente `dailyAmountPerHen`. |
| **Origen` | `feed_programs`. |
| **Destino` | Pantalla de programas, `ALI-01`. |
| **Código` | [`src/lib/feeding/program-validation.ts`](../src/lib/feeding/program-validation.ts) → `normalizeProgramEntries()`. |

### ALI-04 · Resumen de ración (materia seca y proteína)

| Campo | Contenido |
|---|---|
| **Variable** | `totalGrams`, `dryMatterGrams`, `crudeProteinPctAsFed`, `freshSharePct` |
| **Definición` | Composición nutricional de una dieta combinada. |
| **Fórmula` | `totalGrams = Σ lineas.grams`; `materiaSeca = Σ (grams × materiaSecaPct / 100)`; `proteínaCruda = Σ (grams × proteínaPct / 100)`; `%proteína = proteínaCruda / totalGrams × 100`; `%fresco = gramosFrescos / totalGrams × 100`. |
| **Cálculo` | Solo se suma materia seca/proteína de ingredientes con porcentaje conocido. `dryMatterComplete` y `proteinComplete` indican si todos los ingredientes tienen el dato. Redondeo a 2 decimales. |
| **Origen` | Entrada del usuario (líneas de ración). |
| **Destino` | Formulación de dietas y control nutricional. |
| **Código` | [`src/lib/feeding/ration.ts`](../src/lib/feeding/ration.ts) → `summarizeRation()`. |

### ALI-05 · Proyección de días restantes de alimento

| Campo | Contenido |
|---|---|
| **Variable` | `daysRemaining`, `dailyConsumptionKg`, `currentStockKg` |
| **Definición` | Cuánto durará el stock actual de cada alimento. |
| **Fórmula` | `consumoDiario = consumoRegistradoPeriodo / díasPeriodo`; `díasRestantes = stockActual / consumoDiario`. |
| **Cálculo` | Si hay movimientos de salida en el período, usa el consumo real (`movements`). Si no, estima con la población activa × ración diaria de referencia por especie (`estimated`). Si no hay datos, devuelve `no_data`. El stock se convierte a kg según unidad (`lb` → ×0,453592, `g` → ÷1000, `kg` → sin cambio). Redondeo: días a 1 decimal, consumo a 2. |
| **Origen` | `feed_inventory.current_stock`, `feed_movements.quantity`, `species_params.daily_feed_g_per_head`. |
| **Destino` | `KPI-05` (autonomía de alimento) y alertas de bodega. |
| **Código` | [`src/lib/kpi-dashboard-server.ts`](../src/lib/kpi-dashboard-server.ts) → `computeFeedAutonomy()`. |

### ALI-06 · Predicción de stock y sugerido de compra

| Campo | Contenido |
|---|---|
| **Variable` | `daysRemaining`, `outOfStockDate`, `reorderDate`, `suggestedOrderQty` |
| **Definición` | Proyección diaria de stock por alimento y cuándo pedir reposición. |
| **Fórmula` | Cada día del horizonte: `stock = max(0, stock − consumoDiario)`. `daysRemaining` = primer día en que stock llega a 0. `reorderDate` = primer día en que stock < `minStock`. `suggestedOrderQty = max(consumoDiario × horizonteDías, minStock)`. |
| **Cálculo` | Horizonte configurable (14 días por defecto, `feeding.prediction_horizon_days`). Niveles de alerta: `agotado` (stock 0), `critico` (≤ 3 días), `bajo` (≤ horizonte), `ok`, `sin_programa` (sin consumo diario). Antes de calcular, se materializa el catch-up del programa (`ALI-01`). |
| **Origen` | `feed_programs`, `feed_inventory`, `feed_movements`, conteo de animales (`ALI-04`). |
| **Destino` | Pantalla de predicción de alimento y sugerido de compra. |
| **Código` | [`src/app/api/produccion/alimentacion/prediccion/route.ts`](../src/app/api/produccion/alimentacion/prediccion/route.ts) → `buildPrediction()`. |

### ALI-07 · Costo de alimento consumido y costo por animal-día

| Campo | Contenido |
|---|---|
| **Variable` | `cost`, `programCost`, `costPerAnimalDay` |
| **Definición` | Costo del alimento consumido por especie y lugar, desglosando consumo automático vs manual. |
| **Fórmula` | `costo = Σ cantidad × costoUnitario`; `costoPrograma = Σ cantidadAuto × costoUnitario`; `costoPorAnimalDía = costoPrograma / animalesDía`. |
| **Cálculo` | El costo unitario se congela en cada movimiento (`unit_cost`) y, para registros anteriores, el costo del alimento en inventario. Los animales-día se cuentan por grupo (fecha, etapa, lugar) de movimientos auto-generados. Redondeo a 2 decimales; `costPerAnimalDay` a 4 decimales. |
| **Origen` | `feed_movements.quantity`, `unit_cost`, `feed_inventory.cost_per_unit`, `feed_movements.hen_count`. |
| **Destino` | Reporte de costos de alimento (`FIN-08`). |
| **Código` | [`src/app/api/analisis/reportes/costos-alimento/route.ts`](../src/app/api/analisis/reportes/costos-alimento/route.ts). |

## 7. Gallinaza y compostaje

### GAL-01 · Estimación diaria de producción de gallinaza

| Campo | Contenido |
|---|---|
| **Variable` | `kgPerDay` por grupo y `totalKgPerDay` (kg/día) |
| **Definición` | Producción estimada diaria de gallinaza a partir de los animales presentes. |
| **Fórmula` | `kg/día = Σ (avesDelGrupo × factorKgAveDía)` |
| **Cálculo` | Los factores son editables por el usuario (`manure_factors`) y se aplican por etapa de crecimiento, gallos y lotes de engorde. Se redondea a 2 decimales. Solo se escribe una estimación por día (`source = "auto_diario"`); los días pasados no se rellenan automáticamente. |
| **Origen` | `hens`, `roosters`, `broiler_batches`, `catalogos` (etapas), `manure_factors`. |
| **Destino` | `manure_production` (estimación automática), `GAL-02`, `GAL-03`. |
| **Código` | [`src/lib/manure.ts`](../src/lib/manure.ts), [`src/lib/manure-estimate.ts`](../src/lib/manure-estimate.ts), [`src/lib/manure-stock.ts`](../src/lib/manure-stock.ts). |

### GAL-02 · Inventario de gallinaza

| Campo | Contenido |
|---|---|
| **Variable` | `available` (kg) |
| **Definición` | Gallinaza disponible para venta o compostaje. |
| **Fórmula` | `available = produced + adjusted − sold` |
| **Cálculo` | `produced` suma `manure_production.kg_produced`; `adjusted` suma `manure_adjustments.delta_kg`; `sold` suma `manure_sales.quantity_kg`. El saldo se valida antes de cada venta con `SELECT … FOR UPDATE` para evitar sobreventa concurrente. El valor estimado se reporta en 0 (se usa precio de referencia `inventory.manure_price_per_kg` = 300 COP/kg cuando se necesita valorar). |
| **Origen` | `manure_production`, `manure_adjustments`, `manure_sales`. |
| **Destino` | `GAL-03`, compostaje y cierre diario. |
| **Código` | [`src/lib/inventory.ts`](../src/lib/inventory.ts) → `computeManureInventory()`; [`src/lib/manure-operations.ts`](../src/lib/manure-operations.ts). |

### GAL-03 · Relación de compostaje y carbono requerido

| Campo | Contenido |
|---|---|
| **Variable` | `carbonMaterialKg` (kg) |
| **Definición` | Cantidad de material carbonoso necesario según la relación de mezcla. |
| **Fórmula` | `3:1:1 → carbono = gallinaza / 3` (si no hay gallinaza, usa mortalidad); `7:2:2 → carbono = gallinaza × 2 / 7` (si no hay gallinaza, usa mortalidad); `otra → carbono = (gallinaza + mortalidad) × 0,3` |
| **Cálculo` | Si el usuario ingresa `carbon_material_kg` se usa ese valor; si no, se sugiere por la fórmula. Se asegura que gallinaza + mortalidad > 0. |
| **Origen` | Entrada del usuario (`manure_kg`, `mortality_kg`, `formula_ratio`). |
| **Destino` | `composting_piles` y plan de volteo. |
| **Código` | [`src/app/api/operaciones/compostaje/route.ts`](../src/app/api/operaciones/compostaje/route.ts) → `suggestCarbonKg()`. |

### GAL-04 · Programación de volteo y cosecha de compost

| Campo | Contenido |
|---|---|
| **Variable` | `nextTurnDueDate`, `expectedHarvestDate` |
| **Definición` | Fechas de volteo programado y cosecha estimada de la pila de compost. |
| **Fórmula` | `volteo = fechaInicio + 7 días`; `cosecha = fechaInicio + 56 días` (8 semanas). |
| **Cálculo` | La pila se crea con estas fechas calculadas. Si la temperatura supera 70 °C al actualizar, el estado pasa a `alerta`. |
| **Origen` | `composting_piles.start_date`, `current_temp_c`. |
| **Destino` | Alertas de compostaje y cierre de operación. |
| **Código` | [`src/app/api/operaciones/compostaje/route.ts`](../src/app/api/operaciones/compostaje/route.ts). |

### GAL-05 · Alertas de compostaje

| Campo | Contenido |
|---|---|
| **Variable` | `alerts[]` |
| **Definición` | Condiciones que requieren intervención en una pila de compost. |
| **Fórmula` | Alerta si `temperatura > 70 °C` (sobrecalentamiento, volteo urgente). Alerta si `humedad > 20 %` en estado `madurando` o `cosechada` (secar antes de embolsar). Alerta si el volteo programado está pendiente (`next_turn_due_date ≤ hoy`). Alerta si cumplió 8 semanas (`expected_harvest_date ≤ hoy`). |
| **Origen` | `composting_piles.current_temp_c`, `moisture_pct`, `next_turn_due_date`, `expected_harvest_date`, `status`. |
| **Destino` | Listado de pilas y resumen de operación. |
| **Código` | [`src/app/api/operaciones/compostaje/route.ts`](../src/app/api/operaciones/compostaje/route.ts) → `evaluatePileAlerts()`. |

## 8. Sanidad y bioseguridad

### SAN-01 · Plantillas de vacunación

| Campo | Contenido |
|---|---|
| **Variable` | `weekNumber`, `name`, `frequencyDays` |
| **Definición` | Calendario de vacunación por raza (ejemplo ISA Brown). |
| **Fórmula` | Lista fija de eventos por semana: Marek (sem 1), Newcastle+Bronquitis (sem 1), Gumboro (sem 3 y 5), Coraza/POX (sem 8), etc. `frequencyDays` es nulo salvo refuerzos periódicos. |
| **Cálculo` | Datos de referencia, sin cálculo aritmético. Se usan para generar el calendario sanitario de cada lote. |
| **Origen` | [`src/lib/vaccination-schedules.ts`](../src/lib/vaccination-schedules.ts), `vaccination_templates`. |
| **Destino` | `sanitary_calendar` y recordatorios de vacunación. |
| **Código` | [`src/lib/vaccination-schedules.ts`](../src/lib/vaccination-schedules.ts). |

### SAN-02 · Tiempo de retiro sanitario

| Campo | Contenido |
|---|---|
| **Variable` | `withdrawalDays` |
| **Definición` | Días que deben transcurrir después de un tratamiento antes de vender o trasladar el animal. |
| **Fórmula` | `fechaLiberación = fechaTratamiento + withdrawalDays` |
| **Cálculo` | Una venta o traslado queda bloqueada si `fechaTratamiento + díasDeRetiro > hoy`. Se aplica sobre `health_control` y `sanitary_calendar`. |
| **Origen` | `health_control.date`, `sanitary_calendar.withdrawal_days`. |
| **Destino` | Bloqueo de ventas y traslados. |
| **Código` | [`src/app/api/calendario-sanitario/alertas/route.ts`](../src/app/api/calendario-sanitario/alertas/route.ts). |

### SAN-03 · Días de vacío sanitario

| Campo | Contenido |
|---|---|
| **Variable` | `emptyDays` |
| **Definición` | Días mínimos que debe permanecer vacía una ubicación entre lotes. |
| **Fórmula` | Valor configurado (`sanitary.empty_days`, 21 días en producción). |
| **Cálculo` | Parámetro de `app_settings`, sin cálculo. |
| **Origen` | `app_settings`. |
| **Destino` | Planeación de lotes y bioseguridad. |
| **Código` | [`src/lib/settings.ts`](../src/lib/settings.ts) → `getSanitaryEmptyDays()`. |

### SAN-04 · Resumen sanitario (últimos 30 días)

| Campo | Contenido |
|---|---|
| **Variable` | `eventsCount` |
| **Definición` | Cantidad de eventos sanitarios en la ventana de 30 días. |
| **Fórmula` | Conteo de `health_control` con `date ≥ hoy − 30 días`. |
| **Origen` | `health_control.date`. |
| **Destino` | Resumen de operación y dashboard sanitario. |
| **Código` | [`src/app/api/sanidad/resumen/route.ts`](../src/app/api/sanidad/resumen/route.ts). |

## 9. Ambiente y sensores

### SEN-01 · Índice de Temperatura y Humedad (ITH)

| Campo | Contenido |
|---|---|
| **Variable` | `ith` (índice sin unidades) |
| **Definición` | Índice de estrés calórico que combina temperatura y humedad relativa. |
| **Fórmula` | `ITH = 1,8 × T + 32 − (0,55 − 0,0055 × HR) × (1,8 × T − 26)` |
| **Cálculo` | `T` = temperatura en °C, `HR` = humedad relativa en % (clampada a 0–100). Resultado redondeado a 2 decimales. Si el registro ya trae `ith_index`, se usa directamente; si no, se calcula desde `temperatura` y `humedad`. |
| **Origen` | `sensor_readings.value` (temperatura, humedad) o `sensor_readings.ith_index`. |
| **Destino` | `SEN-02`, resumen de sensores y alertas térmicas. |
| **Código` | [`src/app/api/operaciones/sensores/route.ts`](../src/app/api/operaciones/sensores/route.ts) → `computeIth()`. |

### SEN-02 · Evaluación de alertas de sensores

| Campo | Contenido |
|---|---|
| **Variable` | `triggered`, `reason` |
| **Definición` | Determina si una lectura dispara una alerta y por qué. |
| **Fórmula` | Umbrales: ITH ≥ 72 (alerta moderada) o ≥ 78 (estrés severo); NH₃ ≥ 20 ppm (crítico); temperatura > 32 °C o < 10 °C; humedad > 85 % o < 40 %. |
| **Cálculo` | Si viene `ith_index`, se evalúa primero. Si no, se evalúa por tipo de métrica (`temperatura`, `humedad`, `amoniaco_ppm`, `ith`). |
| **Origen` | `sensor_readings.metric_type`, `value`, `ith_index`. |
| **Destino` | `sensor_readings.alert_triggered`, resumen de alertas y dashboard de sensores. |
| **Código` | [`src/app/api/operaciones/sensores/route.ts`](../src/app/api/operaciones/sensores/route.ts) → `evaluateSensorAlert()`. |

### SEN-03 · Resumen de lecturas de sensores

| Campo | Contenido |
|---|---|
| **Variable` | `maxIth`, `maxNh3Ppm`, `latestScaleKg`, `alertCount` |
| **Definición` | Agregados de las últimas 150 lecturas: ITH máximo, amoníaco máximo, peso de báscula más reciente y cantidad de alertas activas. |
| **Fórmula` | `maxIth = max(ithIndex)` sobre lecturas con ITH; `maxNh3 = max(value)` sobre lecturas de `amoniaco_ppm`; `alertCount = count(alertTriggered = true)`. |
| **Origen` | `sensor_readings` (últimas 150, ordenadas por `recorded_at` descendente). |
| **Destino` | Dashboard de ambiente y resumen de operación. |
| **Código` | [`src/app/api/operaciones/sensores/route.ts`](../src/app/api/operaciones/sensores/route.ts) → `GET`. |

## 10. Reproducción e incubación

### REP-01 · Eventos reproductivos (empadre, parto, destete)

| Campo | Contenido |
|---|---|
| **Variable` | `expectedPalpationDate`, `expectedNestboxDate`, `expectedBirthDate`, `weanedTotal`, `survPct` |
| **Definición` | Fechas esperadas y métricas de eventos de conejos y cuyes. |
| **Fórmula` | Conejo: palpación día 18, nidal día 26, parto +31 días, destete 28–35 días. Cuy: parto +66 días, destete +15–18 días, cosecha 75–90 días. `survPct = (nacidosVivos / (nacidosVivos + nacidosMuertos)) × 100`. |
| **Cálculo` | Si el usuario no ingresa la fecha esperada, se calcula sumando los días de gestación a `event_date`. El destete puede crear un lote de engorde con `initial_quantity = current_quantity = weaned_total`. Madre élite si ganancia diaria ≥ 32 g/día. |
| **Origen` | `reproduction_events`, `species_params` (gestión por especie), `weight_logs`. |
| **Destino` | Calendario reproductivo, lotes de engorde y `REP-03`. |
| **Código` | [`src/app/api/produccion/reproduccion/route.ts`](../src/app/api/produccion/reproduccion/route.ts). |

### REP-02 · Períodos de incubación por especie

| Campo | Contenido |
|---|---|
| **Variable` | `days`, `turnStopDaysBefore` |
| **Definición` | Duración de incubación y día para dejar de voltear los huevos. |
| **Fórmula` | Gallina: 21 días, volteo hasta día 18. Pato: 28 días, volteo hasta día 25. Codorniz: 17 días, volteo hasta día 14. |
| **Cálculo` | Claves `incubation.days`, `incubation.duck_days`, `incubation.quail_days` y `incubation.turn_stop_days_before` de `app_settings`. |
| **Origen` | `app_settings`, `incubation.species`. |
| **Destino` | Cargas de incubadora y fecha esperada de eclosión. |
| **Código` | [`src/lib/settings.ts`](../src/lib/settings.ts) → `getIncubationRulesForSpecies()`. |

### REP-03 · Tasa de eclosión

| Campo | Contenido |
|---|---|
| **Variable` | `hatchPct` (%) |
|**Definición` | Porcentaje de huevos fértiles que eclosionaron. |
|**Fórmula` | `eclosión% = (nacidosVivos / huevosFértiles) × 100`; si no hay datos de fértiles, se usa `huevosCargados`. |
|**Cálculo` | ≥ 75 % es positivo; < 75 % warning. Se registra al completar la incubación y se asignan los pollitos al lote de engorde. |
|**Origen` | `incubation.eggs_hatched`, `fertile_eggs`, `eggs_set`. |
|**Destino` | Micro-reporte de incubación y resultado productivo. |
|**Código` | [`src/lib/micro-insights.ts`](../src/lib/micro-insights.ts) → `buildIncubationMicroInsight()`. |

## 11. Finanzas y contabilidad analítica

### FIN-01 · Libro de movimientos (ingresos y egresos)

| Campo | Contenido |
|---|---|
| **Variable` | `totalIncome`, `totalExpenses`, `netProfit` (COP) |
| **Definición` | Suma de ingresos y egresos en un período y su balance. |
| **Fórmula` | `ingresos = Σ amount WHERE type = "ingreso"`; `egresos = Σ amount WHERE type = "egreso"`; `balance = ingresos − egresos`. |
| **Cálculo` | Por ventana de fechas (por defecto últimos 30 días o año en curso). Se agrupan por categoría para el estado de resultados. Redondeo a 2 decimales. |
| **Origen` | `transactions`, `financial_categories`. |
| **Destino` | `KPI-10`, estado de resultados y resumen financiero. |
| **Código` | [`src/app/api/analisis/reportes/estado-resultados/route.ts`](../src/app/api/analisis/reportes/estado-resultados/route.ts), [`src/app/api/finanzas/resumen/route.ts`](../src/app/api/finanzas/resumen/route.ts). |

### FIN-02 · Prorrateo de costos indirectos

| Campo | Contenido |
|---|---|
| **Variable` | `proratedShare` por especie/lote |
| **Definición` | Porción de gastos indirectos asignada a cada centro de costo (especie, ubicación, lote). |
| **Fórmula` | `asignación = montoDelGasto × proporciónDelCentroDeCosto` |
| **Cálculo` | Los gastos no asignados directamente se distribuyen según las dimensiones de la transacción (`resolveDimensions` derivando especie/lugar/lote). El prorrateo se usa en `FIN-05` y `FIN-06` para evitar subsidios cruzados entre especies. |
| **Origen` | `transactions`, `cost_allocations`, `analytics-dimensions`. |
| **Destino` | `FIN-05`, `FIN-06`, contabilidad analítica. |
| **Código` | [`src/lib/financial-records.ts`](../src/lib/financial-records.ts), [`src/lib/analytics-dimensions.ts`](../src/lib/analytics-dimensions.ts). |

### FIN-03 · Estado de resultados por línea de producto

| Campo | Contenido |
|---|---|
| **Variable` | `revenue`, `cost`, `profit`, `marginPct` por línea |
| **Definición` | Ingresos, costos, utilidad y margen de cada línea de negocio (huevos, carne, gallinaza, aves, alimento, sanidad, otros). |
| **Fórmula` | `utilidad = ingreso − costo`; `margen% = (utilidad / ingreso) × 100` (null si ingreso = 0). |
| **Cálculo` | Las transacciones se clasifican por categoría: si contiene "alimento" → línea alimento; si contiene "sanidad" → sanidad; etc. Los ingresos suman por `type = ingreso`, los costos por `type = egreso`. Se agrupan también por especie y ubicación. |
| **Origen` | `transactions`, `financial_categories`. |
| **Destino` | Reporte de estado de resultados. |
| **Código` | [`src/app/api/analisis/reportes/estado-resultados/route.ts`](../src/app/api/analisis/reportes/estado-resultados/route.ts). |

### FIN-04 · Reporte de rentabilidad por producto

| Campo | Contenido |
|---|---|
| **Variable` | `revenue`, `cost`, `profit`, `marginPct` por línea |
| **Definición` | Igual que `FIN-03` pero con clasificación especializada para rentabilidad (alimento primero, luego sanidad, etc.). |
| **Fórmula` | `profit = revenue − cost`; `marginPct = (profit / revenue) × 100`. |
| **Cálculo` | Clasificación de transacción: categoría con "alimento" → alimento; "sanidad" → sanidad; ventas → línea correspondiente (huevos, carne, gallinaza, aves). |
| **Origen` | `transactions`. |
| **Destino` | Reporte de rentabilidad. |
| **Código` | [`src/app/api/analisis/reportes/rentabilidad/route.ts`](../src/app/api/analisis/reportes/rentabilidad/route.ts). |

### FIN-05 · Costo real por huevo (contabilidad analítica)

| Campo | Contenido |
|---|---|
| **Variable` | `realCostPerEgg`, `realCostPerTray30` (COP) |
| **Definición` | Costo real unitario de un huevo vendible, considerando gastos directos, alimento devengado y prorrateo. |
| **Fórmula` | `pool = max(gastosDirectos, costoAlimentoDevengado) + prorrateo`; `costoReal = pool / huevosVendibles`; `costoPorDocena = costoReal × 30` (bandeja de 30). |
| **Cálculo` | `huevosVendibles = Σ (totalCollected − broken − discarded)`; si es 0, usa `totalCollected`. `gastosDirectos` son egresos relacionados con postura/gallina; `costoAlimentoDevengado` son movimientos de consumo de alimento de especies ponedoras. Se usa `max()` para no subestimar cuando no hay gasto directo registrado. Alerta de punto muerto si `precioVenta < costoReal`. |
| **Origen` | `egg_production`, `feed_movements`, `transactions`, `cost_allocations`, `egg_sales_items`. |
| **Destino` | KPI `cost_per_egg`, margen por calibre NTC 1240 y reporte de costos. |
| **Código` | [`src/lib/analytics/contabilidad-analitica.ts`](../src/lib/analytics/contabilidad-analitica.ts). |

### FIN-06 · Costo real por kg de carne (contabilidad analítica)

| Campo | Contenido |
|---|---|
| **Variable` | `realCostPerLiveKg`, `realCostPerCarcassKg` (COP/kg) |
| **Definición` | Costo real del kilogramo de carne, en peso vivo y en canal. |
| **Fórmula` | `pool = max(gastosDirectos, costoAlimentoDevengado) + prorrateo`; `costoPorKgVivo = pool / kgVivo`; `costoPorKgCanal = pool / kgCanal`. |
| **Cálculo` | `kgVivo = Σ liveWeightKg` (si falta, `pesoCanal / 0,72`); `kgCanal = Σ weightKg`. Gastos directos de carne (pollo, conejo, cuy, pato) y alimento de esas especies. |
| **Origen` | `slaughter`, `meat_sales`, `feed_movements`, `transactions`, `cost_allocations`. |
| **Destino` | KPI `cost_per_kg_meat` y reporte de rentabilidad de carne. |
| **Código` | [`src/lib/analytics/contabilidad-analitica.ts`](../src/lib/analytics/contabilidad-analitica.ts). |

### FIN-07 · Valorización de inventario de carne

| Campo | Contenido |
|---|---|
| **Variable` | `estimatedValue` (COP) |
| **Definición` | Valor del stock de carne al precio de canal de la especie. |
| **Fórmula` | `estimatedValue = remainingKg × estimatedPriceKg` |
| **Cálculo` | El precio por kg vivo se deriva de `precioCanal × rendimientoCanal / 100`; si no hay, `inventory.bird_price_per_kg` (10.000 COP/kg). Se suma por especie. |
| **Origen` | `slaughter`, `meat_sales`, `meat_losses`, `species_params`. |
| **Destino` | Inventario de carne (`INV-04`) y valorización. |
| **Código` | [`src/lib/inventory.ts`](../src/lib/inventory.ts) → `computeMeatInventory()`. |

### FIN-08 · Costo de alimento consumido por especie

| Campo | Contenido |
|---|---|
| **Variable` | `cost`, `programCost`, `costPerAnimalDay` |
| **Definición` | Costo del alimento realmente consumido, separado entre consumo automático (programa) y manual. |
| **Fórmula` | `costo = Σ cantidad × costoUnitario`; `costoPrograma = Σ cantidadAuto × costoUnitario`; `costoPorAnimalDía = costoPrograma / animalesDía`. |
| **Cálculo` | `animalesDía` se cuenta por grupo (fecha, etapa, lugar) de movimientos auto-generados. |
| **Origen` | `feed_movements`, `feed_inventory`, `catalogos`. |
| **Destino` | Reporte de costos de alimento y `KPI-05`. |
| **Código` | [`src/app/api/analisis/reportes/costos-alimento/route.ts`](../src/app/api/analisis/reportes/costos-alimento/route.ts). |

### FIN-09 · Comparativo presupuesto vs real

| Campo | Contenido |
|---|---|
| **Variable` | `actual`, `budget`, `variation` (COP y %) |
| **Definición` | Diferencia entre el gasto real y el presupuestado por ítem. |
| **Fórmula` | `variación = real − presupuesto`; `variación% = (variación / presupuesto) × 100`. |
| **Cálculo` | Por ítem de presupuesto (`budget_items`), se suma el real de `transactions` vinculado por categoría y período. |
| **Origen` | `budgets`, `budget_items`, `transactions`. |
| **Destino` | Reporte comparativo de presupuestos. |
| **Código` | [`src/app/api/presupuestos/comparativo/route.ts`](../src/app/api/presupuestos/comparativo/route.ts). |

### FIN-10 · Ahorro por autoconsumo (soberanía alimentaria)

| Campo | Contenido |
|---|---|
| **Variable` | `ahorroMensual` (COP) |
| **Definición` | Valor del huevo y la carne que el productor consume en lugar de comprar. |
| **Fórmula` | `ahorro = cantidadAutoconsumo × precioUnitarioReferencia` |
| **Cálculo` | Se agrega por especie y mes a partir de `autoconsumo_logs` y `egg_production.quantity_autoconsumo`. El precio de referencia es el de mercado de la especie. |
| **Origen` | `autoconsumo_logs`, `egg_production`, `slaughter`. |
| **Destino` | Reporte de soberanía y ahorro familiar. |
| **Código` | [`src/app/api/soberania/route.ts`](../src/app/api/soberania/route.ts). |

## 12. KPIs y comparativos

Los KPIs se calculan en [`src/app/api/analisis/kpis/route.ts`](../src/app/api/analisis/kpis/route.ts) sobre una ventana de `period` días (por defecto 30) y se enriquecen con comparación al periodo previo en [`src/lib/kpi-dashboard-server.ts`](../src/lib/kpi-dashboard-server.ts).

### KPI-01 · Mortalidad

| Campo | Contenido |
|---|---|
| **Variable` | `mortalityRate` (%) |
| **Definición` | Porcentaje de animales muertos en el período sobre el total del rebaño. |
| **Fórmula` | `mortalidad% = (muertes / totalFlock) × 100` |
| **Cálculo` | `totalFlock` = gallinas presentes + gallos presentes + lotes activos (cantidad actual). Para el período previo, el denominador es `totalFlockActual + muertesPrevias`. Meta de referencia: ≤ 1,5 %. Redondeo a 2 decimales. |
| **Origen` | `mortality_records`, `hens`, `roosters`, `broiler_batches`. |
| **Destino` | KPI `mortality_rate`, comparativo periodo vs previo. |
| **Código` | `kpis/route.ts` y `kpi-dashboard-server.ts` → `computePreviousPeriodComparison()`. |

### KPI-02 · Postura HD %

| Campo | Contenido |
|---|---|
| **Variable` | `layingRate` (%) |
| **Definición` | Igual que `HUE-03`, expuesto como KPI con serie diaria y comparación. |
| **Fórmula` | `HD% = (huevosElegibles / (avesElegibles × días)) × 100` |
| **Cálculo` | Meta de referencia: `eggsPerDayPerFemale × 100` de `species_params` (82 % por defecto si no hay). Serie diaria de huevos elegibles. Deltas vs período anterior. |
| **Origen` | `egg_production`, `hens`, `broiler_batches`, `catalogos`. |
| **Destino` | KPI `laying_rate`, `chart_laying_curve`, comparación. |
| **Código` | `kpis/route.ts`. |

### KPI-03 · Postura HAA %

| Campo | Contenido |
|---|---|
| **Variable` | `haaRate` (%) |
| **Definición` | Igual que `HUE-04`, expuesto como KPI. |
| **Fórmula` | `HAA% = (huevosElegibles / (poblaciónAlojada × días)) × 100` |
| **Cálculo` | Se compara con el período anterior como `laying_haa`. |
| **Origen` | `kpis/route.ts` (mismo cálculo que `HUE-04`). |
| **Destino` | KPI `laying_haa`. |

### KPI-04 · Costo por huevo

| Campo | Contenido |
|---|---|
| **Variable` | `costPerEgg`, `costPerTray30` (COP) |
| **Definición` | Costo alimenticio de un huevo y de una bandeja de 30. |
| **Fórmula` | `costoPorHuevo = costoAlimentoHuevo / huevosElegibles`; `costoPorBandeja = costoPorHuevo × 30`. |
| **Cálculo` | El costo de alimento es el real devengado si hay movimientos, o el estimado por población × ración × costo/kg × días. `breakevenAlertEggs = precioVenta < costoPorHuevo`. Redondeo a 2 decimales. |
| **Origen` | `feed_movements`, `species_params`, `egg_production`. |
| **Destino` | KPI `cost_per_egg`, punto muerto y `FIN-05`. |
| **Código` | `kpis/route.ts`. |

### KPI-05 · Autonomía de alimento

| Campo | Contenido |
|---|---|
| **Variable` | `daysRemaining` (días) |
| **Definición` | Días que durará el stock actual de alimento. Igual que `ALI-05`. |
| **Fórmula` | `díasRestantes = stockActual / consumoDiario` |
| **Cálculo` | Fuente `movements` si hay consumo registrado, `estimated` si no, `no_data` si falta información. Meta mínima: 10 días (`feed_autonomy_min_days`). |
| **Origen` | `feed_inventory`, `feed_movements`, `species_params`. |
| **Destino` | KPI `feed_autonomy`. |
| **Código` | `kpi-dashboard-server.ts` → `computeFeedAutonomy()`. |

### KPI-06 · Costo por kg de carne

| Campo | Contenido |
|---|---|
| **Variable` | `costPerKgMeat` (COP/kg) |
| **Definición` | Costo estimado del kilogramo de canal vendido. |
| **Fórmula` | `costoPorKgCanal = costoEstimadoCarne / kgCanalVendible` |
| **Cálculo` | El costo estimado se construye por lote: precio de adquisición + alimento (edadDías × ración × costo/kg), o `kgVivo × ICA × costo/kg` si no hay lote ni animal vinculado. Redondeo a 2 decimales. |
| **Origen` | `slaughter`, `broiler_batches`, `species_params`, `feed_movements`. |
| **Destino` | KPI `cost_per_kg_meat`. |
| **Código` | `kpis/route.ts`. |

### KPI-07 · Margen por huevo

| Campo | Contenido |
|---|---|
| **Variable` | `eggMargin` (COP) |
| **Definición` | Diferencia entre precio de venta y costo por huevo. |
| **Fórmula` | `margen = precioPromedioVenta − costoPorHuevo` |
| **Cálculo` | `precioPromedioVenta = ingresoHuevos / cantidadVendida`. Solo si ambos > 0. |
| **Origen` | `egg_sales`, `egg_sales_items`, `KPI-04`. |
| **Destino` | KPI `egg_margin`. |
| **Código` | `kpis/route.ts`. |

### KPI-08 · EPEF (promedio de lotes)

| Campo | Contenido |
|---|---|
| **Variable` | `epef` (puntos) |
| **Definición` | Promedio de EPEF de los lotes de engorde activos. Igual que `ZOO-06`. |
| **Fórmula` | `EPEF = ((viabilidad × peso kg) / (edad días × ICA)) × 100` |
| **Cálculo` | Meta de referencia: 300 puntos. Ventana de alerta de sacrificio si `edad ≥ díasObjetivo − 3` o `peso ≥ 0,92 × pesoObjetivo`. |
| **Origen` | `broiler_batches`, `species_params`. |
| **Destino` | KPI `epef` y alertas de lote. |
| **Código` | `kpis/route.ts` → `computeEpef()`. |

### KPI-09 · Uniformidad promedio

| Campo | Contenido |
|---|---|
| **Variable` | `uniformityPct` (%) |
| **Definición` | Promedio de uniformidad de los pesajes recientes. |
| **Fórmula` | `promedio(uniformityPct de weight_logs)` |
| **Cálculo` | Solo valores finitos > 0. Redondeo a 1 decimal. Meta de referencia: 80 %. |
| **Origen` | `weight_logs.uniformity_pct`. |
| **Destino` | KPI `uniformity`. |
| **Código` | `kpis/route.ts`. |

### KPI-10 · ROI de CAPEX y payback

| Campo | Contenido |
|---|---|
| **Variable` | `roiAnnualizedPct` (%), `paybackMonths` (meses) |
| **Definición` | Retorno anualizado de la inversión en activos y meses para recuperar el CAPEX. |
| **Fórmula` | `utilidadMensual = (utilidadNetaPeríodo / días) × 30,4375`; `ROI% = ((utilidadNeta / días) × 365 / CAPEX) × 100`; `payback = CAPEX / utilidadMensual`. |
| **Cálculo` | `utilidadNeta = ingresosPeríodo − gastosPeríodo`. `CAPEX = Σ adquisición de activos` (filtrados por ubicación si aplica). Si `CAPEX = 0` o `utilidadMensual ≤ 0`, los valores son `null`. Redondeo a 1 decimal. |
| **Origen` | `transactions`, `cost_allocations`, `farm_assets`. |
| **Destino` | KPI `capex_roi`. |
| **Código` | `kpis/route.ts`. |

### KPI-11 · Benchmarks de referencia

| Campo | Contenido |
|---|---|
| **Variable` | `layingTargetPct`, `mortalityMaxPct`, `fcrTarget`, `epefTarget`, `uniformityTargetPct`, `feedAutonomyMinDays` |
| **Definición` | Valores de referencia para evaluar el estado de cada KPI. |
| **Fórmula` | `metaPostura = eggsPerDayPerFemale × 100` (82 % por defecto); `mortalidadMax = 1,5 %`; `ICAMeta = 1,9`; `epefMeta = 300`; `uniformidadMeta = 80 %`; `autonomíaMin = 10 días`. |
| **Cálculo` | Tomados de `species_params` de la especie predominante o del lote seleccionado. |
| **Origen` | `species_params`, `broiler_batches`. |
| **Destino` | Evaluación de salud de KPIs (`kpi-dashboard.ts`). |

## 13. Reportes y exportaciones

### EXP-01 · Cierre diario

| Campo | Contenido |
|---|---|
| **Variable` | `huevosRecolectados`, `ingresoHuevos`, `alimentoConsumidoKg`, `balanceDía`, etc. |
| **Definición` | Snapshot operativo de un día: producción, ventas, mortalidad, costos y balance. |
| **Fórmula` | Cada métrica es un `COALESCE(SUM(...), 0)` sobre las tablas del día. `balanceDía = ingresosTotales − egresosTotales`. |
| **Origen` | `daily_closures`, `egg_production`, `egg_sales`, `feed_movements`, `mortality_records`, `transactions`, `health_control`, `meat_sales`, `manure_production`, `manure_sales`. |
| **Destino` | Cierre diario auditable y reporte operativo. |
| **Código` | [`src/app/api/operaciones/cierre-diario/route.ts`](../src/app/api/operaciones/cierre-diario/route.ts). |

### EXP-02 · Trazabilidad de huevos

| Campo | Contenido |
|---|---|
| **Variable` | `saleId`, `size`, `quantity`, `totalAmount`, `lotCode` |
| **Definición` | Qué lote PEPS surtió cada venta de huevo. |
| **Fórmula` | Une `egg_sales` con `egg_sales_items` y `egg_production_details` → `egg_production.lot_code`. Si no hay ítems (formato legacy), usa el calibre y cantidad de la venta directamente. |
| **Origen` | `egg_sales`, `egg_sales_items`, `egg_production_details`, `egg_production`. |
| **Destino` | Reporte de trazabilidad y auditoría. |
| **Código` | [`src/app/api/analisis/reportes/trazabilidad-huevos/route.ts`](../src/app/api/analisis/reportes/trazabilidad-huevos/route.ts). |

### EXP-03 · Datasets de exportación

| Campo | Contenido |
|---|---|
| **Variable` | Filas CSV/XLSX por dataset |
| **Definición` | Exportación tabular de dominios operativos (resumen diario, huevos, alimento, mortalidad, sanidad, finanzas, gallinaza, carne, export tokens). |
| **Fórmula` | Cada dataset ejecuta una consulta SQL agregada sobre su dominio, con filtro de rango de fechas (máximo 731 días / 2 años, tope 50.000 filas). `días = round((to − from) / 86.400.000) + 1`. |
| **Origen` | Todas las tablas operativas según el dataset. |
| **Destino` | Endpoint `/api/export` y descarga de archivos. |
| **Código` | [`src/lib/export/datasets.ts`](../src/lib/export/datasets.ts), [`src/lib/export/xlsx.ts`](../src/lib/export/xlsx.ts). |

### EXP-04 · Resumen diario agregado (dataset)

| Campo | Contenido |
|---|---|
| **Variable` | `huevosRecolectados`, `rotos`, `descartados`, `incubación`, `autoconsumo`, `excedente`, `vendidos`, `ingresoHuevos`, `alimentoConsumidoKg`, `costoAlimento`, `alimentoCompradoKg`, `mortalidad`, `eventosSanitarios`, `costoSanidad`, `ingresosTotales`, `egresosTotales`, `balanceDía`, `carneVendidaKg`, `ingresoCarne`, `gallinazaProducidaKg`, `gallinazaVendidaKg`, `ingresoGallinaza` |
| **Definición` | Una fila por día con los principales indicadores operativos. |
| **Fórmula` | Agregaciones `COALESCE(SUM(...), 0)` sobre `egg_production`, `egg_sales`, `feed_movements`, `mortality_records`, `health_control`, `transactions`, `meat_sales`, `manure_production`, `manure_sales` agrupadas por fecha. |
| **Origen` | Todas las tablas de producción y finanzas. |
| **Destino` | Exportación de resumen diario y reportes gerenciales. |
| **Código` | [`src/lib/export/datasets.ts`](../src/lib/export/datasets.ts) → `loadResumenDiario()`. |

## 14. Catálogo consolidado de alertas

| Código | Origen | Condición | Severidad |
|---|---|---|---|
| `SEN-02` | ITH ≥ 72 | Estrés calórico moderado | warning |
| `SEN-02` | ITH ≥ 78 | Estrés calórico severo | critical |
| `SEN-02` | NH₃ ≥ 20 ppm | Amoníaco crítico | critical |
| `SEN-02` | Temperatura > 32 °C o < 10 °C | Fuera de rango | warning |
| `SEN-02` | Humedad > 85 % o < 40 % | Fuera de rango | warning |
| `GAL-05` | Temperatura compost > 70 °C | Sobrecalentamiento | critical |
| `GAL-05` | Humedad compost > 20 % (madurando/cosechada) | Humedad alta | warning |
| `GAL-05` | Volteo pendiente | Mantenimiento atrasado | info |
| `GAL-05` | 8 semanas cumplidas | Lista para cosechar | info |
| `PLA-02` | Cumplimiento < 90 % | Postura baja | warning |
| `PLA-02` | Cumplimiento > 110 % | Postura superior al estándar | info |
| `PLA-03` | Reemplazo ≤ 8 semanas | Próximo reemplazo | info |
| `CIC-01` | Edad ≥ 80 sem o peso ≥ 2,5 kg | Recomendada para sacrificio | info |
| `CIC-02` | Déficit de gallos | Falta relación 10:1 | warning |
| `ZOO-02` | CV > 12 | Desuniforme | warning |
| `ZOO-02` | CV ≤ 8 | Excelente | info |
| `REP-03` | Eclosión < 75 % | Incubación deficiente | warning |
| `ALI-06` | Días restantes ≤ 3 | Abastecimiento crítico | critical |
| `ALI-06` | Días restantes ≤ 14 | Stock bajo | warning |
| `INV-03` | Fuera de 10–15 °C / 75–85 % HR | Bodega de huevo fuera de rango | warning |
| `HUE-05` | Merma > 5 % | Rotura/descarte alto | warning |
| `KPI-01` | Mortalidad > 1,5 % | Sobre el umbral | warning |
| `KPI-10` | Payback nulo o negativo | Sin utilidad para cubrir CAPEX | warning |

## 15. Orden de cálculo y dependencias

El sistema no tiene un motor de cálculo global único: cada dominio se calcula bajo demanda (API) o en procesos por lotes (programa de alimentación, cierre diario, estimación de gallinaza). El orden lógico de dependencias entre cálculos es:

```
app_settings / especies / catálogos   (valores de referencia y constantes)
        │
        ├─► animal-status (presente/terminal)
        ├─► lifecycle (edad, etapa, ciclo de vida)
        ├─► inventory (huevo PEPS, carne FIFO, gallinaza, animales, alimento)
        ├─► feeding (programa → consumo → stock → días restantes → predicción)
        ├─► manure (estimación → stock → compostaje)
        ├─► zootechnics (CV, uniformidad, ADG, EPEF, calibración ambiental)
        ├─► contabilidad analítica (pool → costo/huevo, costo/kg carne)
        ├─► kpis (mortalidad, postura, costo, EPEF, ROI, autonomía)
        ├─► flock-plan (postura esperada, cumplimiento, reemplazo)
        ├─► micro-insights (métricas diarias y nudges)
        └─► export/datasets (resumen diario agregado)
```

**Dependencias clave a tener en cuenta al modificar:**

- Cambiar `lifecycle.fin_postura_weeks` afecta `CIC-01`, `CIC-03`, `PLA-01`, `PLA-02`, `PLA-03` y `KPI-02`/`KPI-03`.
- Cambiar `flock.hens_per_rooster` afecta `CIC-02` y las alertas de relación gallos/gallinas.
- Cambiar `eggs.storage_*` de `app_settings` afecta `INV-03`.
- Cambiar `species_params` (ración, costo/kg, ICA, precio canal) afecta `ALI-01`, `ALI-05`, `ALI-06`, `FIN-05`, `FIN-06`, `KPI-04`, `KPI-06`, `KPI-08` y `INV-05`.
- Cambiar `feeding.prediction_horizon_days` afecta `ALI-05`, `ALI-06` y `KPI-05`.

## 16. Mantenimiento de este documento

Cuando se agregue, modifique o elimine un cálculo en el código:

1. Leer el código real en `src/lib/` o `src/app/api/` antes de redactar (no inventar fórmulas).
2. Agregar o actualizar la ficha correspondiente en este documento, manteniendo el formato de seis campos (variable, definición, fórmula, cálculo, origen, destino).
3. Verificar que las tablas y columnas citadas existan en el [diccionario de datos](data-dictionary.md).
4. Si el cálculo produce un campo derivado, indicar en el diccionario de datos la fórmula y el módulo que lo calcula.
5. Actualizar el catálogo de alertas (sección 14) si se crea o se modifica un umbral.
6. Ejecutar la aplicación y verificar que las pantallas y reportes relacionados sigan respondiendo.
7. Commitear solo `docs/formulas-y-calculos.md` y, si corresponde, `docs/data-dictionary.md`.

---

*Documento mantenido por el equipo de El Corral. Última verificación: 14 de noviembre de 2026. Código base: `src/lib/` y `src/app/api/`.*
