import re

def parse_schema(content):
    # Find all table definitions
    # Pattern: export const varName = pgTable("tableName", { ... });
    pattern = re.compile(
        r'export const (\w+) = pgTable\("([^"]+)",\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\s*(?:,\s*\([^)]*\)\s*=>\s*\[[^\]]*\])?\s*\);',
        re.DOTALL
    )
    
    matches = list(pattern.finditer(content))
    tables = []
    
    for match in matches:
        var_name = match.group(1)
        table_name = match.group(2)
        table_content = match.group(3)  # Content between braces
        
        # Get the full match to find preceding comments
        full_match = match.group(0)
        match_start = match.start()
        
        # Look backwards for section comments
        section_comment = ""
        # Look at lines before the match
        before_text = content[:match_start]
        lines = before_text.split('\n')
        
        # Find the most recent section comment
        for i in range(len(lines)-1, max(-1, len(lines)-20), -1):
            line = lines[i].strip()
            if line.startswith('// ───') and '───' in line:
                section_comment = line
                break
        
        # Parse columns from table_content
        columns = parse_columns(table_content)
        
        tables.append({
            'var_name': var_name,
            'table_name': table_name,
            'section': section_comment,
            'columns': columns
        })
    
    return tables

def parse_columns(table_content):
    lines = table_content.split('\n')
    columns = []
    
    for line in lines:
        stripped = line.strip()
        # Skip empty lines, index definitions, and continuations
        if not stripped or stripped.startswith('//') or stripped.startswith('/*') or \
           stripped.startswith('export') or stripped.startswith('(') or \
           stripped.startswith('uniqueIndex') or stripped.endswith('=> ['):
            continue
            
        # Look for column definitions: name: type(...),
        # Also handle cases where there might be comments after
        if ':' in stripped and not stripped.startswith('//'):
            # Remove trailing comma
            if stripped.endswith(','):
                stripped = stripped[:-1]
            
            # Handle inline comments
            comment = ""
            definition_part = stripped
            
            # Find comment that's not inside quotes
            # Simple approach: look for // that's not inside ""
            # We'll do a basic split and hope for the best
            if '//' in stripped:
                # Split but be careful about URLs or other doubleslash patterns
                parts = stripped.split('//')
                # Assume the first part is the definition if it ends with a comma or semicolon or has proper structure
                if len(parts) >= 2:
                    # Check if first part looks like a column definition
                    if ':' in parts[0] and not parts[0].strip().endswith(':'):
                        definition_part = parts[0].rstrip(',').strip()
                        comment = '//'.join(parts[1:]).strip()
                    else:
                        # Maybe the // is inside the definition somehow, treat whole thing as definition
                        definition_part = stripped
            elif '/*' in stripped and '*/' in stripped:
                # Handle block comments - extract and remove
                # This is simplified
                pass
            
            # Now split definition_part at first colon
            if ':' in definition_part:
                parts = definition_part.split(':', 1)
                col_name = parts[0].strip()
                col_def = parts[1].strip()
                
                columns.append({
                    'name': col_name,
                    'definition': col_def,
                    'comment': comment
                })
    
    return columns

def get_enum_description(enum_name):
    enum_descriptions = {
        'henStatusEnum': 'Estado de la gallina',
        'feedCategoryEnum': 'Categoría del alimento',
        'feedTypeEnum': 'Tipo de alimento',
        'transactionTypeEnum': 'Tipo de transacción (ingreso/egreso)',
        'feedMovementTypeEnum': 'Tipo de movimiento de alimento',
        'maintenanceStatusEnum': 'Estado del mantenimiento',
        'roosterStatusEnum': 'Estado del gallo',
        'broilerBatchStatusEnum': 'Estado del lote de pollos de engorde',
        'mortalityCauseEnum': 'Causa de mortalidad'
    }
    return enum_descriptions.get(enum_name, enum_name)

def generate_description(col_name, col_def, table_name=""):
    # Convert camelCase to readable
    s1 = re.sub('([A-Z][a-z]+)', r' \1', re.sub('([A-Z]+)', r' \1', col_name))
    readable = s1.strip().lower()
    
    # Special cases
    special_cases = {
        'id': 'Identificador único (UUID)',
        'createdat': 'Fecha y hora de creación',
        'updatedat': 'Fecha y hora de última actualización',
        'date': 'Fecha',
        'name': 'Nombre',
        'code': 'Código identificador',
        'breed': 'Raza de la ave',
        'birthdate': 'Fecha de nacimiento',
        'status': 'Estado actual',
        'weight': 'Peso',
        'notes': 'Notas adicionales',
        'isbroody': 'Indica si la gallina está empollando',
        'clutchsize': 'Número de huevos en la puesta',
        'acquisitionid': 'ID de la adquisición de la cual proviene este registro',
        'acquisitioncost': 'Costo de adquisición',
        'quantity': 'Cantidad',
        'isentry': 'Indica si es entrada (true) o consumo/salida (false)',
        'movementtype': 'Tipo de movimiento de alimento',
        'autogenerated': 'Indica si fue generado automáticamente por el programa de alimentación',
        'stagecatalogoid': 'ID de la etapa del catálogo (destino del consumo)',
        'hencount': 'Número de gallinas en el grupo al momento del consumo',
        'totalcollected': 'Total de huevos recolectados',
        'broken': 'Huevos rotos durante la recolección',
        'forincubation': 'Huevos destinados a incubación',
        'productionid': 'ID del registro de producción de huevos asociado',
        'size': 'Tamaño o categoría (ej: pequeño, mediano, grande)',
        'henid': 'ID de la gallina asociada',
        'startdate': 'Fecha de inicio',
        'expectedhatchdate': 'Fecha esperada de eclosión',
        'eggsset': 'Número de huevos puestos en incubadora',
        'egshatched': 'Número de huevos que eclosionaron',
        'maleshatched': 'Número de pollitos machos eclosionados',
        'femaleshatched': 'Número de pollitas hembras eclosionadas',
        'iscomplete': 'Indica si el proceso está completo',
        'title': 'Título o nombre corto',
        'description': 'Descripción detallada',
        'scheduleddate': 'Fecha programada para realización',
        'completeddate': 'Fecha en que se completó realmente',
        'cost': 'Costo asociado',
        'type': 'Tipo o categoría',
        'affectedhens': 'Identificadores de gallinas afectadas (JSON array o "todas")',
        'product': 'Producto utilizado',
        'nextscheduled': 'Próxima fecha programada',
        'category': 'Categoría o clasificación',
        'counterparty': 'Persona o entidad involucrada en la transacción',
        'amount': 'Monto económico de la transacción',
        'quantity': 'Cantidad involucrada en la transacción',
        'unitprice': 'Precio por unidad',
        'unit': 'Unidad de medida',
        'presentation': 'Forma de presentación o empaque',
        'sourcetype': 'Tipo de origen de la transacción',
        'sourceid': 'ID del registro de origen',
        'iscredit': 'Indica si la transacción es a crédito',
        'username': 'Nombre de usuario para inicio de sesión',
        'passwordhash': 'Hash seguro de la contraseña',
        'name': 'Nombre completo del usuario',
        'role': 'Rol o nivel de acceso del usuario',
        'userid': 'ID del usuario asociado',
        'tokenhash': 'Hash seguro del token de sesión',
        'expiresat': 'Fecha y hora de expiración del token',
        'category': 'Categoría de clasificación',
        'value': 'Valor o descripción del elemento del catálogo',
        'price': 'Precio asociado al elemento del catálogo',
        'units': 'Número de unidades por presentación (ej: 12 para docena)',
        'tipo': 'Subtipo o clasificación adicional',
        'minweeks': 'Semanas mínimas de duración (para etapas de crecimiento)',
        'maxweeks': 'Semanas máximas de duración (para etapas de crecimiento, null = ilimitado)',
        'expectedeggspershen': 'Número esperado de huevos por gallina por día',
        'sortorder': 'Orden de visualización o sorting',
        'isactive': 'Indica si el registro está activo y en uso',
        'birdtype': 'Tipo de ave (gallina, gallo, pollito, etc.)',
        'weightkg': 'Peso total en kilogramos',
        'priceperunit': 'Precio por unidad de venta',
        'pricemode': 'Modo de precios: por ave o por kilogramo',
        'totalamount': 'Monto total de la transacción',
        'buyer': 'Comprador o destinatario',
        'presentation': 'Forma de presentación del producto vendido',
        'henid': 'ID específico de gallina involucrada (opcional)',
        'roosterid': 'ID específico de gallo involucrado (opcional)',
        'batchid': 'ID específico de lote de engorde involucrado (opcional)',
        'destination': 'Destino final del producto (venta, consumo propio, donación)',
        'priceperkg': 'Precio por kilogramo (cuando se vende por peso)',
        'totalamount': 'Valor total cuando se vende',
        'stagecatalogoid': 'ID de la etapa del catálogo asociada',
        'feedid': 'ID del alimento utilizado en el programa',
        'percentage': 'Porcentaje que representa este alimento en la dieta total',
        'dailyamountperhen': 'Cantidad diaria de alimento por gallina (gramos)',
        'stagecatalogoid': 'ID de la etapa del catálogo asociada',
        'birdgroup': 'Grupo de aves al que se aplica el factor',
        'kgperbirdperday': 'Kilogramos de gallinaza producidos por ave por día',
        'date': 'Fecha de la transacción',
        'quantitykg': 'Cantidad en kilogramos',
        'priceperkg': 'Precio por kilogramo',
        'totalamount': 'Monto total de la transacción',
        'presentation': 'Forma de presentación',
        'buyer': 'Comprador o destinatario',
        'date': 'Fecha del ajuste',
        'deltaKg': 'Cambio en kilogramos (positivo para agregar, negativo para retirar)',
        'reason': 'Justificación o motivo del ajuste',
        'date': 'Fecha de producción',
        'kgproduced': 'Kilogramos de gallinaza producidos',
        'source': 'Método o fuente de la medición (por defecto: estimado)',
        'date': 'Fecha de adquisición',
        'acquisitiontype': 'Tipo de adquisición (compra, donación, compra de pollitos)',
        'birdtype': 'Tipo de ave adquirida',
        'quantity': 'Numero de aves adquiridas',
        'unitcost': 'Costo por ave',
        'totalcost': 'Costo total de la adquisición',
        'supplier': 'Proveedor o fuente de las aves',
        'breed': 'Raza de las aves adquiridas',
        'birthdate': 'Fecha de nacimiento estimada de las aves',
        'notes': 'Observaciones sobre la adquisición',
        'date': 'Fecha del evento de mortalidad',
        'birdtype': 'Tipo de ave afectada',
        'quantity': 'Numero de aves fallecidas',
        'cause': 'Causa de la mortalidad',
        'henid': 'ID específico de gallina fallecida (opcional)',
        'roosterid': 'ID específico de gallo fallecido (opcional)',
        'batchid': 'ID específico de lote involucrado (opcional)',
        'healthcontrolid': 'ID del control de salud asociado (opcional)',
        'description': 'Descripción detallada del evento',
        'date': 'Fecha de la pérdida',
        'quantity': 'Numero de huevos perdidos',
        'size': 'Tamaño de los huevos perdidos',
        'reason': 'Motivo o causa de la pérdida',
        'notes': 'Observaciones adicionales',
        'date': 'Fecha de registro',
        'name': 'Nombre del insumo',
        'category': 'Categoría del insumo',
        'unit': 'Unidad de medida',
        'currentstock': 'Nivel actual de existencia',
        'minstock': 'Nivel mínimo de existencia antes de reordenar',
        'costperunit': 'Costo por unidad del insumo',
        'supplier': 'Proveedor del insumo',
        'expirydate': 'Fecha de vencimiento o caducidad',
        'date': 'Fecha del movimiento',
        'supplyid': 'ID del insumo involucrado',
        'quantity': 'Cantidad movida',
        'isentry': 'Indica si es entrada al inventario (true) o salida (false)',
        'movementtype': 'Tipo de motivo del movimiento',
        'date': 'Fecha del movimiento',
        'healthcontrolid': 'ID del control de salud asociado (opcional)',
        'maintenanceid': 'ID del mantenimiento asociado (opcional)',
        'notes': 'Observaciones sobre el movimiento',
        'date': 'Fecha de la venta',
        'quantitykg': 'Cantidad en kilogramos vendida',
        'priceperkg': 'Precio por kilogramo',
        'totalamount': 'Monto total de la venta',
        'presentation': 'Forma de presentación del producto',
        'buyer': 'Comprador o destinatario',
        'notes': 'Observaciones adicionales',
        'date': 'Fecha de la pérdida',
        'quantitykg': 'Cantidad en kilogramos perdida',
        'reason': 'Motivo o causa de la pérdida',
        'notes': 'Observaciones adicionales',
        'date': 'Fecha de registro',
        'name': 'Nombre de la categoría financiera',
        'parentid': 'ID de la categoría padre (para jerarquía)',
        'type': 'Tipo de categoría (ingreso, gasto, etc.)',
        'sortorder': 'Orden de visualización',
        'date': 'Fecha de inicio del período presupuestario',
        'date': 'Fecha de fin del período presupuestario',
        'type': 'Tipo de presupuesto',
        'budgetid': 'ID del presupuesto asociado',
        'category': 'Categoría financiera a la que pertenece',
        'description': 'Descripción del ítem presupuestario',
        'monthlytarget': 'Meta monetaria mensual esperada',
        'unit': 'Unidad de medida aplicable',
        'notes': 'Observaciones sobre el ítem',
        'month': 'Mes al que corresponde la proyección',
        'projectedincome': 'Ingresos esperados o proyectados',
        'projectedexpense': 'Gastos esperados o proyectados',
        'actualincome': 'Ingresos reales obtenidos',
        'actualexpense': 'Gastos reales incurridos',
        'notes': 'Observaciones sobre la proyección',
        'date': 'Fecha de creación',
        'transactionid': 'ID de la transacción originadora',
        'buyer': 'Comprador o deudor en la cuenta por cobrar',
        'totalamount': 'Monto total de la cuenta por cobrar',
        'paidamount': 'Monto ya pagado',
        'pendingamount': 'Monto aún pendiente de pago',
        'duedate': 'Fecha de vencimiento o pago esperado',
        'status': 'Estado actual de la cuenta',
        'date': 'Fecha de creación',
        'transactionid': 'ID de la transacción originadora',
        'supplier': 'Proveedor o acreedor en la cuenta por pagar',
        'totalamount': 'Monto total de la cuenta por pagar',
        'paidamount': 'Monto ya pagado',
        'pendingamount': 'Monto aún pendiente de pago',
        'duedate': 'Fecha de vencimiento o pago esperado',
        'status': 'Estado actual de la cuenta',
        'date': 'Fecha del pago',
        'type': 'Tipo o categoría del pago',
        'receivableid': 'ID de la cuenta por cobrar asociada (si aplica)',
        'payableid': 'ID de la cuenta por pagar asociada (si aplica)',
        'amount': 'Monto del pago',
        'method': 'Método o medio de pago utilizado',
        'reference': 'Número de referencia o comprobante',
        'notes': 'Observaciones sobre el pago',
        'date': 'Fecha de creación',
        'type': 'Tipo de medida sanitaria',
        'name': 'Nombre o descripción de la medida',
        'description': 'Descripción detallada de la medida',
        'targetbirds': 'Grupo de aves al que se dirige la medida',
        'targetstageid': 'ID de la etapa de crecimiento objetivo (opcional)',
        'frequencydays': 'Frecuencia de aplicación en días',
        'nextduedate': 'Próxima fecha de aplicación programada',
        'withdrawaldays': 'Días de retiro antes del consumo tras aplicación',
        'lasthealthcontrolid': 'ID del último control de salud relacionado',
        'isactive': 'Indica si la medida está actualmente activa',
        'date': 'Fecha de inicio del plan',
        'name': 'Nombre o identificador del plan',
        'starthenccount': 'Meta numérica inicial de gallinas',
        'targetroostercount': 'Meta numérica de gallos en el plan',
        'replacementdate': 'Fecha programada para reemplazo de la parvada',
        'currentphase': 'Fase actual de ejecución del plan',
        'status': 'Estado actual del plan',
        'notes': 'Observaciones sobre el plan',
        'date': 'Fecha de creación',
        'planid': 'ID del plan de parvada asociado',
        'weeknumber': 'Numero de semana del plan',
        'expectedhens': 'Numero esperado de gallinas vivas',
        'expectedeggspersweek': 'Numero esperado de huevos producidos por semana',
        'expectedfeedkgpersweek': 'Cantidad esperada de alimento consumido por semana (kg)',
        'actualhens': 'Numero real de gallinas vivas contadas',
        'actualeggspersweek': 'Numero real de huevos producidos por semana',
        'date': 'Fecha de registro',
        'breed': 'Raza de la ave',
        'gender': 'Género de la ave (hembra/macho)',
        'weeknumber': 'Numero de semana de edad',
        'targetweightg': 'Peso objetivo en gramos',
        'mingweight': 'Peso mínimo aceptable en gramos',
        'maxweightg': 'Peso máximo aceptable en gramos',
        'date': 'Fecha del registro de peso',
        'batchid': 'ID del lote de engorde asociado (opcional)',
        'hengroup': 'Descripción del grupo de gallinas pesadas',
        'breed': 'Raza de las gallinas pesadas',
        'weeknumber': 'Numero de semana de edad de las gallinas',
        'avgweightkg': 'Peso promedio en kilogramos',
        'samplesize': 'Numero de individuos en la muestra tomada',
        'notes': 'Observaciones sobre el registro de peso'
    }
    
    if readable in special_cases:
        return special_cases[readable]
    
    # Try to handle common patterns
    if readable.endswith('id') and len(readable) > 2:
        base = readable[:-2]
        if base in ['user', 'hen', 'rooster', 'batch', 'feed', 'production', 'sale', 'supply', 'healthcontrol', 'maintenance', 'transaction', 'receivable', 'payable', 'payment', 'plan', 'financialcategory']:
            return f"ID de {base}"
        else:
            return f"Identificador de {readable[:-2]}"
    
    if readable.endswith('date'):
        return f"Fecha de {readable[:-4]}"
    
    if readable.endswith('time'):
        return f"Hora de {readable[:-4]}"
    
    if 'count' in readable:
        return f"Cantidad de {readable.replace('count', '').strip()}"
    
    if 'amount' in readable:
        return f"Monto de {readable.replace('amount', '').strip()}"
    
    if 'price' in readable:
        return f"Precio de {readable.replace('price', '').strip()}"
    
    if 'weight' in readable:
        return f"Peso de {readable.replace('weight', '').strip()}"
    
    # Default generation
    desc = readable.replace('_', ' ').strip()
    if desc:
        desc = desc[0].upper() + desc[1:] if len(desc) > 1 else desc.upper()
    
    # Add type information
    type_hints = []
    if 'varchar' in col_def or 'text' in col_def:
        type_hints.append("texto")
    if 'date' in col_def and 'timestamp' not in col_def:
        type_hints.append("fecha")
    if 'timestamp' in col_def:
        type_hints.append("fecha y hora")
    if 'decimal' in col_def:
        type_hints.append("decimal")
    if 'integer' in col_def:
        type_hints.append("entero")
    if 'boolean' in col_def:
        type_hints.append("booleano")
    if 'uuid' in col_def:
        type_hints.append("UUID")
    if 'enum' in col_def:
        enum_match = re.search(r'(\w+Enum)\(', col_def)
        if enum_match:
            enum_name = enum_match.group(1)
            type_hints.append(get_enum_description(enum_name))
    
    if type_hints:
        desc += f" ({', '.join(type_hints)})"
    
    return desc or "Campo sin descripción"

def main():
    with open('/home/ubuntu/negocio/data/app_gallinero/src/db/schema.ts', 'r') as f:
        content = f.read()
    
    tables = parse_schema(content)
    
    out_lines = []
    out_lines.append('# Diccionario de Datos - App Gallinero\n')
    out_lines.append('Este documento describe las tablas, columnas y tipos de datos utilizados en la base de datos de la aplicación **Gallinero**.\n')
    out_lines.append('## Tablas\n')
    
    for table in tables:
        out_lines.append(f'### {table["table_name"]}\n')
        if table['section']:
            # Clean up the section comment
            clean_section = table['section']
            if clean_section.startswith('// ───') and clean_section.endswith('───'):
                clean_section = clean_section[4:-4]  # Remove // ─── and ───
            out_lines.append(f"*{clean_section}*\n")
        
        out_lines.append('| Column Name | Data Type / Constraints | Description |\n')
        out_lines.append('|-------------|-------------------------|-------------|\n')
        
        for col in table['columns']:
            # Use comment if available and meaningful, otherwise generate
            if col['comment'] and col['comment'].strip() and not col['comment'].strip().startswith('@'):
                description = col['comment'].strip()
            else:
                description = generate_description(col['name'], col['definition'], table['table_name'])
            
            # Clean up definition
            def_clean = ' '.join(col['definition'].split())
            out_lines.append(f'| {col["name"]} | {def_clean} | {description} |\n')
        
        out_lines.append('\n')
    
    with open('/home/ubuntu/negocio/data/app_gallinero/docs/data-dictionary.md', 'w') as f:
        f.write(''.join(out_lines))
    
    print(f"Generated data dictionary with {len(tables)} tables")

if __name__ == '__main__':
    main()