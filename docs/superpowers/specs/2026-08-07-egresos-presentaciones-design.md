# Diseño: Presentaciones de Compra en Egresos

**Fecha**: 2026-08-07  
**Estado**: Aprobado

## Resumen

Implementar un sistema de presentaciones de compra genérico para el módulo de egresos que permita registrar compras de insumos en diferentes presentaciones (bultos, arpillas, litros, galones, unidades) con factores de conversión automáticos a la unidad base del insumo. Para compras de alimento, el sistema actualizará automáticamente el stock en el módulo de alimentación y recalculará el costo promedio.

## Contexto

Actualmente el formulario de egresos permite registrar cantidad y precio unitario, pero no maneja el concepto de presentaciones de compra. Los usuarios necesitan poder registrar:
- "2 bultos de 25kg de concentrado" en lugar de "50 kg de concentrado"
- "3 galones de desinfectante" en lugar de "12 litros de desinfectante"
- "10 unidades de comederos" en lugar de "10 comederos"

Además, cuando se compra alimento, el stock debe actualizarse automáticamente en el módulo de alimentación.

## Objetivos

1. **Catálogo genérico de presentaciones**: Crear un catálogo reutilizable con factores de conversión a la unidad base
2. **Formulario adaptativo**: El formulario de egresos muestra campos de presentación solo para categorías de compra
3. **Conversión automática**: Calcular automáticamente la cantidad en unidad base (kg, litros, unidades)
4. **Actualización de stock**: Para compras de alimento, actualizar automáticamente el inventario en alimentación
5. **Costo promedio**: Recalcular el costo promedio por unidad del alimento cuando se compra

## Diseño Detallado

### 1. Modelo de Datos

#### Catálogo `presentacion_compra` en tabla `catalogos`

| category | value | units (factor) |
|---|---|---|
| presentacion_compra | Kg | 1 |
| presentacion_compra | Bulto 25kg | 25 |
| presentacion_compra | Bulto 50kg | 50 |
| presentacion_compra | Arpilla 5kg | 5 |
| presentacion_compra | Litro | 1 |
| presentacion_compra | Galón | 4 |
| presentacion_compra | Unidad | 1 |

El campo `units` representa el factor de conversión a la unidad base del insumo:
- Para insumos en **kg**: Bulto 25kg → 25 kg, Arpilla 5kg → 5 kg
- Para insumos en **litros**: Galón → 4 litros, Litro → 1 litro
- Para insumos en **unidades**: Unidad → 1 unidad

#### Corrección de Schema

**Problema**: El campo `presentation` en la tabla `transactions` está definido como `decimal(10,2)` pero debería almacenar texto (nombres de presentación como "Bulto 25kg").

**Solución**: Cambiar `transactions.presentation` de `decimal(10,2)` a `varchar(100)`.

**Migración**:
```sql
ALTER TABLE transactions 
ALTER COLUMN presentation TYPE varchar(100) 
USING NULL;
```

*Nota*: No se agregan campos nuevos a `feedMovements`. El detalle de la presentación ya queda registrado en la transacción financiera vinculada via `sourceType: "alimento"` y `sourceId: movementId`.

### 2. Formulario de Egresos

#### Categorías de Compra

El formulario se adapta según la categoría seleccionada:

**Categorías de compra** (muestran campos de presentación):
- Compra de alimento
- Compra de insumos
- Control sanitario
- Equipamiento
- Compra de gallinas

**Categorías no-compra** (formulario simple):
- Mano de obra
- Servicios (agua/luz)
- Transporte
- Otro egreso

#### Flujo para Categorías de Compra

```
Categoría: [Compra de alimento ▼]
Descripción: [Concentrado comercial ____________]
Proveedor: [Agrosupply ____________]

─── Detalle de compra ───
Alimento: [Concentrado comercial ▼]  ← solo para "Compra de alimento"
Presentación: [Bulto 25kg ▼]         ← filtrado por unidad del insumo
Cantidad: [2]                        ← cuántas presentaciones
Precio/pres.: [$95,000]              ← precio por presentación

🧮 2 bultos × 25 kg = 50 kg → Total: $190,000
```

#### Filtrado de Presentaciones

El sistema filtra las presentaciones según la unidad del insumo seleccionado:
- Si el insumo es en **kg** → muestra: Kg, Bulto 25kg, Bulto 50kg, Arpilla 5kg
- Si el insumo es en **litros** → muestra: Litro, Galón
- Si el insumo es en **unidades** → muestra: Unidad

Para categorías que no son "Compra de alimento", se asume unidad base "unidades" y se muestra solo "Unidad".

#### Cálculos Automáticos

```typescript
const factor = selectedPresentation.units; // ej: 25 para "Bulto 25kg"
const quantityInBaseUnit = presentations * factor; // ej: 2 * 25 = 50 kg
const totalAmount = presentations * pricePerPresentation; // ej: 2 * $95,000 = $190,000
```

### 3. API e Integración con Stock

#### Endpoint: POST /api/finanzas

**Payload para compra de alimento**:
```json
{
  "type": "egreso",
  "category": "Compra de alimento",
  "description": "Concentrado comercial",
  "counterparty": "Agrosupply",
  "feedId": "abc-123",
  "presentation": "Bulto 25kg",
  "presentations": 2,
  "pricePerPresentation": 95000,
  "factor": 25,
  "date": "2026-08-07"
}
```

**Lógica del API**:
1. Calcular cantidad base: `quantity = presentations × factor` (ej: 2 × 25 = 50 kg)
2. Calcular monto total: `amount = presentations × pricePerPresentation` (ej: 2 × $95,000 = $190,000)
3. Guardar transacción financiera con campos:
   - `amount`: $190,000
   - `quantity`: 50 (en unidad base)
   - `unitPrice`: $3,800 (precio por kg = pricePerPresentation / factor)
   - `unit`: "kg"
   - `presentation`: "Bulto 25kg"
4. Si `category === "Compra de alimento"` y `feedId` está definido:
   - Crear movimiento de alimento (entrada de 50 kg)
   - Actualizar stock del alimento (+50 kg)
   - Recalcular costo promedio por kg del alimento

**Payload para otros egresos de compra**:
```json
{
  "type": "egreso",
  "category": "Control sanitario",
  "description": "Vacuna Newcastle",
  "counterparty": "Tienda veterinaria",
  "presentation": "Unidad",
  "presentations": 1,
  "pricePerPresentation": 80000,
  "factor": 1,
  "date": "2026-08-07"
}
```

Solo guarda la transacción financiera, no actualiza stock.

**Payload para egresos no-compra**:
```json
{
  "type": "egreso",
  "category": "Mano de obra",
  "description": "Pago quincenal",
  "amount": 500000,
  "date": "2026-08-07"
}
```

Mantiene el formato actual (monto fijo o cantidad × precio unitario).

#### Recálculo de Costo Promedio

Cuando se compra alimento, el sistema recalcula el costo promedio por kg:

```typescript
const oldStock = Number(feed.currentStock); // ej: 15 kg
const oldCostPerUnit = Number(feed.costPerUnit); // ej: $9,500/kg
const oldTotalValue = oldStock * oldCostPerUnit; // ej: $142,500

const newQuantity = quantity; // ej: 50 kg
const newCostPerUnit = pricePerPresentation / factor; // ej: $95,000 / 25 = $3,800/kg
const newTotalValue = newQuantity * newCostPerUnit; // ej: $190,000

const avgCostPerUnit = (oldTotalValue + newTotalValue) / (oldStock + newQuantity);
// ej: ($142,500 + $190,000) / (15 + 50) = $332,500 / 65 = $5,115/kg

// Actualizar feedInventory
await db.update(feedInventory).set({
  currentStock: oldStock + newQuantity,
  costPerUnit: avgCostPerUnit.toFixed(2),
  updatedAt: new Date(),
}).where(eq(feedInventory.id, feedId));
```

### 4. Seed Data y Tests

#### Seed Data

Agregar catálogo `presentacion_compra` con las 7 presentaciones.

Actualizar egresos de ejemplo para usar presentaciones:
```typescript
// Compra de alimento con presentación
{
  date: daysAgo(10),
  type: "egreso",
  category: "Compra de alimento",
  description: "Concentrado comercial",
  counterparty: "Agrosupply",
  amount: "190000",
  quantity: "50", // 2 bultos × 25 kg
  unitPrice: "3800", // $95,000 / 25 kg
  unit: "kg",
  presentation: "Bulto 25kg",
}

// Compra de insumos con presentación
{
  date: daysAgo(20),
  type: "egreso",
  category: "Control sanitario",
  description: "Vacuna Newcastle",
  counterparty: "Tienda veterinaria",
  amount: "80000",
  quantity: "1",
  unitPrice: "80000",
  unit: "unidades",
  presentation: "Unidad",
}

// Egreso sin presentación (servicio)
{
  date: daysAgo(25),
  type: "egreso",
  category: "Mantenimiento",
  description: "Reparación de cerca perimetral",
  amount: "120000",
}
```

#### Tests

Actualizar tests existentes para:
1. Verificar que el payload de presentaciones se procesa correctamente
2. Verificar que el stock se actualiza al comprar alimento
3. Verificar que el costo promedio se recalcula
4. Verificar que los egresos no-compra no tocan el stock
5. Verificar que los cálculos de cantidad base y monto total son correctos

## Archivos a Modificar

### Schema y Migraciones
- `src/db/schema.ts`: Cambiar `transactions.presentation` de `decimal` a `varchar`
- Crear migración SQL para el cambio de tipo

### Backend
- `src/app/api/finanzas/route.ts`: 
  - Aceptar nuevos campos: `feedId`, `presentation`, `presentations`, `pricePerPresentation`, `factor`
  - Implementar lógica de cálculo y actualización de stock
  - Implementar recálculo de costo promedio

### Frontend
- `src/app/(app)/egresos/page.tsx`:
  - Agregar selector de presentación (filtrado por unidad)
  - Agregar campos: cantidad de presentaciones, precio por presentación
  - Mostrar cálculos automáticos (cantidad base, monto total)
  - Condicionar visibilidad de campos según categoría

### Seed Data
- `src/db/seed.ts`:
  - Agregar catálogo `presentacion_compra`
  - Actualizar egresos de ejemplo para usar presentaciones

### Tests
- `tests/flows.test.ts`: Actualizar tests de egresos para incluir presentaciones

## Consideraciones Técnicas

### Filtrado de Presentaciones por Unidad

```typescript
const getPresentationsForUnit = (unit: string) => {
  const presentations = catalogData.presentacion_compra || [];
  return presentations.filter((p) => {
    // Kg, Bulto 25kg, Bulto 50kg, Arpilla 5kg → solo para insumos en kg
    if (["Kg", "Bulto 25kg", "Bulto 50kg", "Arpilla 5kg"].includes(p.value)) {
      return unit === "kg";
    }
    // Litro, Galón → solo para insumos en litros
    if (["Litro", "Galón"].includes(p.value)) {
      return unit === "litros";
    }
    // Unidad → para cualquier unidad
    if (p.value === "Unidad") return true;
    return false;
  });
};
```

### Manejo de Errores

- Validar que `feedId` exista si `category === "Compra de alimento"`
- Validar que `presentations > 0` y `pricePerPresentation >= 0`
- Validar que `factor > 0`
- Retornar error 400 si los datos son inválidos

### Transacciones de Base de Datos

Para compras de alimento, usar transacción de BD para asegurar atomicidad:
```typescript
await db.transaction(async (tx) => {
  // 1. Insertar transacción financiera
  // 2. Insertar movimiento de alimento
  // 3. Actualizar stock y costo promedio
});
```

## Flujo Completo de Ejemplo

**Escenario**: Comprar 2 bultos de 25kg de concentrado comercial a $95,000/bulto

1. Usuario selecciona categoría "Compra de alimento"
2. Formulario muestra: selector de alimento, presentación, cantidad, precio/presentación
3. Usuario selecciona: Alimento = "Concentrado comercial", Presentación = "Bulto 25kg", Cantidad = 2, Precio = $95,000
4. Frontend calcula: 2 × 25 = 50 kg, Total = $190,000
5. Usuario hace clic en "Registrar Egreso"
6. Frontend envía a POST /api/finanzas:
   ```json
   {
     "type": "egreso",
     "category": "Compra de alimento",
     "description": "Concentrado comercial",
     "counterparty": "Agrosupply",
     "feedId": "abc-123",
     "presentation": "Bulto 25kg",
     "presentations": 2,
     "pricePerPresentation": 95000,
     "factor": 25,
     "date": "2026-08-07"
   }
   ```
7. API calcula: quantity = 50 kg, amount = $190,000, unitPrice = $3,800/kg
8. API guarda transacción financiera
9. API crea movimiento de alimento (entrada de 50 kg)
10. API actualiza stock: currentStock += 50, costPerUnit = promedio ponderado
11. Frontend recarga lista de egresos y muestra confirmación

## Criterios de Aceptación

- [ ] Catálogo `presentacion_compra` existe con 7 presentaciones
- [ ] Campo `transactions.presentation` es `varchar(100)`
- [ ] Formulario de egresos muestra campos de presentación solo para categorías de compra
- [ ] Presentaciones se filtran según unidad del insumo
- [ ] Cálculos automáticos de cantidad base y monto total son correctos
- [ ] Para "Compra de alimento", se actualiza stock automáticamente
- [ ] Costo promedio se recalcula correctamente
- [ ] Egresos no-compra no actualizan stock
- [ ] Seed data incluye presentaciones
- [ ] Tests pasan y cubren los nuevos flujos

## Notas Adicionales

- Las presentaciones son genéricas y reutilizables para cualquier insumo
- El factor de conversión es fijo por presentación (no varía por producto)
- Para casos especiales como "paquete de X kg", el usuario puede ingresar la cantidad en kg directamente usando la presentación "Kg"
- El sistema no actualiza stock para insumos que no sean alimento (no hay inventario de medicinas, equipos, etc.)
