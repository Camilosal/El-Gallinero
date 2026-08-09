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
            
            # Find comment that's not inside quotes - simple approach
            # We'll look for the last // that's not inside quotes by checking quote balance
            # But for simplicity, let's just split and take the first part if it looks like a def
            if '//' in stripped:
                parts = stripped.split('//')
                # Check if first part contains a colon and looks like a column def
                if ':' in parts[0] and not parts[0].strip().endswith(':'):
                    # This looks like it's the definition part
                    definition_part = parts[0].rstrip(',').strip()
                    # Rejoin any additional // parts as comment (in case there were multiple)
                    comment = '//'.join(parts[1:]).strip()
                else:
                    # The // might be inside the definition, treat whole as definition
                    definition_part = stripped
            elif '/*' in stripped and '*/' in stripped:
                # Handle block comments - extract and remove
                # Find the comment
                start_comment = stripped.find('/*')
                end_comment = stripped.find('*/', start_comment+2)
                if start_comment != -1 and end_comment != -1:
                    comment = stripped[start_comment+2:end_comment].strip()
                    # Remove the comment from definition
                    definition_part = (stripped[:start_comment] + stripped[end_comment+2:]).rstrip(',').strip()
                else:
                    definition_part = stripped
            else:
                definition_part = stripped
            
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

def to_readable(name):
    """Convert camelCase or snake_case to readable Spanish words"""
    # Handle snake_case first
    if '_' in name:
        name = name.replace('_', ' ')
    
    # Insert space before capital letters
    s1 = re.sub('([A-Z][a-z]+)', r' \1', re.sub('([A-Z]+)', r' \1', name))
    return s1.strip().lower()

def generate_description(col_name, col_def, table_name=""):
    readable = to_readable(col_name)
    
    # Special cases dictionary
    special_cases = {
        'id': 'Identificador único (UUID)',
        'created at': 'Fecha y hora de creación',
        'updated at': 'Fecha y hora de última actualización',
        'date': 'Fecha',
        'name': 'Nombre o identificador',
        'code': 'Código identificador alfanumérico',
        'breed': 'Raza o variedad de la ave',
        'birth date': 'Fecha de nacimiento o nacimiento estimado',
        'status': 'Estado actual o condición',
        'weight': 'Peso medido',
        'notes': 'Notas adicionales o observaciones',
        'is broody': 'Indica si la gallina está en estado de empollar (incubar huevos)',
        'clutch size': 'Número de huevos en la puesta actual',
        'acquisition id': 'ID de la adquisición de la cual proviene este registro',
        'acquisition cost': 'Costo asociado a la adquisición de la ave',
        'quantity': 'Cantidad numérica',
        'is entry': 'Indica si el movimiento es entrada al inventario (true) o salida/consumo (false)',
        'movement type': 'Tipo o motivo del movimiento de alimento',
        'auto generated': 'Indica si el registro fue generado automáticamente por el sistema',
        'stage catalog id': 'ID de la etapa de crecimiento del catálogo asociada',
        'hen count': 'Número de gallinas en el grupo o lote considerado',
        'total collected': 'Total de huevos recolectados en el periodo',
        'broken': 'Número de huevos rotos o dañados durante la recolección',
        'for incubation': 'Número de huevos destinados a incubación',
        'production id': 'ID del registro de producción de huevos asociado',
        'size': 'Tamaño o categoría del producto (ej: pequeño, mediano, grande)',
        'hen id': 'ID específico de la gallina asociada al registro',
        'start date': 'Fecha de inicio del periodo o actividad',
        'expected hatch date': 'Fecha estimada de eclosión de los huevos',
        'eggs set': 'Número de huevos colocados en la incubadora',
        'eggs hatched': 'Número de huevos que eclosionaron exitosamente',
        'males hatched': 'Número de pollitos machos resultantes de la eclosión',
        'females hatched': 'Número de pollitas hembras resultantes de la eclosión',
        'is complete': 'Indica si el proceso o ciclo está completo terminado',
        'title': 'Título breve o nombre descriptivo corto',
        'description': 'Descripción detallada o explicación ampliada',
        'scheduled date': 'Fecha programada para la realización de la actividad',
        'completed date': 'Fecha real en que se completó la actividad',
        'cost': 'Costo económico asociado al registro',
        'type': 'Tipo, categoría o clasificación del registro',
        'affected hens': 'Lista de identificadores de gallinas afectadas (JSON array o "todas")',
        'product': 'Producto médico, vacuna, alimento o sustancia utilizada',
        'next scheduled': 'Próxima fecha programada para repetir la actividad',
        'category': 'Categoría o grupo de clasificación',
        'counterparty': 'Persona, empresa o entidad involucrada en la transacción',
        'amount': 'Monto económico o valor financiero de la transacción',
        'unit price': 'Precio por unidad individual de medida',
        'unit': 'Unidad de medida estándar utilizada',
        'presentation': 'Forma de presentación, empaque o configuración del producto',
        'source type': 'Tipo de origen o fuente de la transacción o datos',
        'source id': 'Identificador del registro de origen en otra tabla',
        'is credit': 'Indica si la transacción financiera es a crédito o deuda',
        'username': 'Nombre de usuario para autenticación en el sistema',
        'password hash': 'Hash criptográfico seguro de la contraseña de usuario',
        'role': 'Rol, nivel de acceso o permisos del usuario en el sistema',
        'user id': 'ID del usuario asociado al registro o acción',
        'token hash': 'Hash seguro del token de sesión de autenticación',
        'expires at': 'Fecha y hora en que expira el token o permiso',
        'value': 'Valor descriptivo o nominal del elemento del catálogo',
        'price': 'Precio asociado al producto o servicio del catálogo',
        'units': 'Cantidad de unidades que conforman una presentación estándar',
        'tipo': 'Subtipo, variante o clasificación adicional dentro de una categoría',
        'min weeks': 'Número mínimo de semanas de duración o validez',
        'max weeks': 'Número máximo de semanas de duración (null indica sin límite superior)',
        'expected eggs per hen': 'Número promedio de huevos esperados por gallina por día',
        'sort order': 'Orden de posicionamiento o secuencia en listados y reportes',
        'is active': 'Indicador booleano que muestra si el registro está actualmente activo y en uso',
        'bird type': 'Especie o tipo de ave involucrada (gallina, gallo, pollito, etc.)',
        'weight kg': 'Peso total expresado en kilogramos',
        'price per unit': 'Valor monetario por cada unidad individual de venta',
        'price mode': 'Criterio de establecimiento de precios: por unidad individual o por peso',
        'total amount': 'Valor económico total de la transacción o venta',
        'buyer': 'Persona, empresa o entidad que adquiere o compra el producto',
        'presentation': 'Modo de presentación o formato comercial del producto vendido',
        'destination': 'Destino final o uso asignado al producto después del proceso',
        'price per kg': 'Precio por kilogramo cuando la venta se realiza por peso',
        'total amount': 'Valor total cuando la transacción se efectúa por peso o cantidad',
        'delta kg': 'Cambio en kilogramos (valor positivo para incrementar, negativo para reducir)',
        'reason': 'Justificación, explicación o motivo que explica la acción tomada',
        'kg produced': 'Cantidad de gallinaza producida expresada en kilogramos',
        'source': 'Origen, procedencia o método utilizado para obtener la medición',
        'acquisition type': 'Modo o método mediante el cual se obtuvo la ave',
        'unit cost': 'Costo individual asociado a cada ave adquirida',
        'total cost': 'Valor total erogado en la operación de adquisición',
        'supplier': 'Persona, empresa o entidad que provee o suministra el producto o servicio',
        'birth date': 'Fecha de nacimiento estimada o conocida de las aves adquiridas',
        'cause': 'Razón específica o motivo determinado que provocó el evento',
        'quantity': 'Cantidad numérica de unidades, individuos o items afectados',
        'health control id': 'ID de la intervención de control de sanidad asociada',
        'description': 'Narración detallada de las circunstancias y detalles del evento',
        'size': 'Clasificación dimensional o de magnitud de los elementos afectados',
        'reason': 'Explicación detallada de los factores que condujeron a la pérdida',
        'name': 'Denominación comercial o técnica del insumo o producto',
        'category': 'Agrupación funcional o química a la que pertenece el insumo',
        'unit': 'Unidad estándar de medida utilizada para cuantificar el insumo',
        'current stock': 'Nivel actual de inventario o existencia disponible en almacén',
        'min stock': 'Umbral mínimo de existencia que activa una alerta de reposición',
        'cost per unit': 'Valor promedio gastado por cada unidad individual del insumo',
        'supplier': 'Proveedor habitual o fuente de suministro del insumo',
        'expiry date': 'Fecha límite después de la cual el insumo pierde su eficacia o utilidad',
        'supply id': 'Identificador específico del tipo de insumo involucrado en el movimiento',
        'quantity': 'Magnitud o volumen de la sustancia trasladada entre ubicaciones',
        'is entry': 'Indicador que muestra si el movimiento aumenta (true) o disminuye (false) el inventario',
        'movement type': 'Clasificación del motivo o propósito que justifica el traslado',
        'date': 'Momento temporal en que se ejecutó la operación de movimiento',
        'health control id': 'Referencia a una intervención sanitaria relacionada con el movimiento',
        'maintenance id': 'Identificación de una actividad de mantenimiento vinculada al movimiento',
        'date': 'Instante temporal en que se realizó la transacción comercial',
        'quantity kg': 'Masa total del producto expresada en kilogramos',
        'price per kg': 'Valor económico asignado a cada kilogramo de producto',
        'total amount': 'Valor económico total resultante de la transacción comercial',
        'presentation': 'Formato, disposición o modo en que se presenta el producto al cliente',
        'buyer': 'Persona natural o jurídica que adquiere el bien o servicio ofrecido',
        'date': 'Momento en que ocurrió el evento de pérdida o merma',
        'quantity': 'Numero de unidades afectadas por el fenómeno de pérdida',
        'size': 'Especificación dimensional o de grado de las unidades perdidas',
        'reason': 'Exposición detallada de los factores causales que originaron la pérdida',
        'notes': 'Información adicional complementaria que enriquece el registro',
        'date': 'Momento temporal de creación o generación del registro',
        'name': 'Etiqueta descriptiva que identifica la naturaleza de la categoría',
        'parent id': 'Referencia jerárquica a la categoría de nivel superior en la estructura',
        'type': 'Naturaleza financiera o clasificación contable de la categoría',
        'sort order': 'Posición relativa o secuencia establecida para la organización',
        'date': 'Límite temporal inicial del periodo presupuestario considerado',
        'date': 'Límite temporal final del periodo presupuestario considerado',
        'type': 'Clasificación funcional o proposital del tipo de presupuesto',
        'budget id': 'Vinculación específica con el presupuesto al que pertenece el ítem',
        'category': 'Agrupación contable o funcional a la que se asigna el recurso',
        'description': 'Explicación pormenorizada del propósito y aplicación del recurso',
        'monthly target': 'Objetivo cuantitativo esperado para cumplirse durante cada mes',
        'unit': 'Especificación de la unidad de medida aplicable al recurso presupuestado',
        'notes': 'Aclaraciones adicionales o consideraciones particulares sobre la partida',
        'month': 'Periodo mensual específico al que corresponde la proyección financiera',
        'projected income': 'Ingresos económicos anticipados o estimados según análisis',
        'projected expense': 'Gastos económicos previstos o calculados según planificación',
        'actual income': 'Ingresos económicos realmente percibidos y verificados',
        'actual expense': 'Gastos económicos realmente erogados y documentados',
        'notes': 'Factores explicativos o contextuales que justifican las variaciones observadas',
        'transaction id': 'Identificador único de la operación financiera que genera el derecho',
        'buyer': 'Parte acreedora o beneficiaria en la relación de crédito establecida',
        'total amount': 'Valor nominal o capital inicial que origina la obligación de pago',
        'paid amount': 'Parte ya satisfecha o cancelada del total de la obligación pendiente',
        'pending amount': 'Saldo remanente que aún requiere cumplimiento de la obligación',
        'due date': 'Fecha límite establecida para la realización del pago correspondiente',
        'status': 'Estado actual o fase en que se encuentra la obligación financiera',
        'transaction id': 'Identificador único de la operación financiera que genera la obligación',
        'supplier': 'Parte deudora o responsable en la relación de crédito establecida',
        'total amount': 'Valor nominal o capital inicial que origina la responsabilidad de pago',
        'paid amount': 'Porción ya ejecutada o entregada del total de la responsabilidad pendiente',
        'pending amount': 'Saldo insoluto que aún requiere ejecución de la responsabilidad asumida',
        'due date': 'Fecha contractual o legalmente establecida para efectuar el pago',
        'status': 'Condición actual o situación en que se encuentra la responsabilidad financiera',
        'date': 'Momento temporal en que se verificó o ejecutó la transacción de pago',
        'type': 'Clasificación o categoría que agrupa pagos con características similares',
        'receivable id': 'Referencia opcional a un documento o título de crédito cobrable',
        'payable id': 'Referencia opcional a un documento o título de crédito pagadero',
        'amount': 'Valor económico específico transferido o desplazado en la transacción',
        'method': 'Medio, vía o instrumento utilizado para la materialización del pago',
        'reference': 'Número, código o identificación documental de respaldo del pago',
        'notes': 'Observaciones adicionales que enriquecen la comprensión del movimiento financiero',
        'date': 'Momento de institucionalización o fecha de entrada en vigencia de la norma',
        'type': 'Clasificación taxonómica o funcional de la intervención preventiva aplicada',
        'name': 'Denominación popular o técnica que identifica específicamente la medida',
        'description': 'Especificación detallada de los procedimientos, alcances y limitaciones',
        'target birds': 'Especie, raza o grupo aviar al que se dirige la medida preventiva',
        'target stage id': 'Vinculación opcional con un estadio particular del desarrollo aviar',
        'frequency days': 'Intervalo regular expresado en días entre aplicaciones sucesivas',
        'next due date': 'Fecha calculada en que se debería realizar la siguiente aplicación',
        'withdrawal days': 'Tiempo de espera obligatoria antes de autorizar el consumo después de la aplicación',
        'last health control id': 'Vínculo con la última evaluación sanitaria registrada relacionada',
        'is active': 'Bandera de estado que indica si la medida preventiva está actualmente vigente',
        'date': 'Momento de constitución o fecha de inicio de validez del plan de manejo',
        'name': 'Designación única o identificador asignado al programa de manejo aviar',
        'start hen count': 'Población inicial de gallinas establecida al iniciar el ciclo productivo',
        'target rooster count': 'Numero objetivo de gallos mantenidos para fines de reproducción',
        'replacement date': 'Fecha calendarizada planificada para el recambio completo de la parvada',
        'current phase': 'Etapa específica del ciclo productivo en que actualmente se encuentra el lote',
        'status': 'Indicador de progreso o condición que refleja el estado actual del plan',
        'notes': 'Observaciones cualitativas que enriquecen la comprensión de la evolución del plan',
        'plan id': 'Vinculación específica que asocia el registro con su plan de manejo progenitor',
        'week number': 'Numero ordinal de la semana dentro del cronograma establecido del plan',
        'expected hens': 'Población de gallinas estimada que debería permanecer viva al término del periodo',
        'expected eggs per week': 'Producción ovípara anticipada que se debería obtener cada siete días',
        'expected feed kg per week': 'Consumo de alimento previsto que se debería manifeste durante la semana',
        'actual hens': 'Población real de gallinas verificada mediante conteo o registro directo',
        'actual eggs per week': 'Producción ovípara real obtenida mediante registro durante la semana',
        'date': 'Momento de medición o instante en que se realizó la captura del dato biométrico',
        'batch id': 'Identificador del lote productivo del que se obtuvo la muestra biometrica',
        'hen group': 'Descripción cualitativa o cuantitativa del conjunto específico de aves evaluadas',
        'breed': 'Raza específica o línea genética a la que pertenecen las aves sometidas a prueba',
        'week number': 'Edad expresada en semanas que poseen las aves en el momento de la medición',
        'avg weight kg': 'Valor medio aritmético del peso corporal expresado en kilogramos',
        'sample size': 'Numero de individuos seleccionados aleatoriamente para constituer la muestra analizada',
        'notes': 'Observaciones complementarias que califican o contextualizan la medida obtenida'
    }
    
    if readable in special_cases:
        return special_cases[readable]
    
    # Handle common suffixes/prefixes
    if readable.endswith(' id'):
        base = readable[:-3].strip()
        return f"ID de {base}"
    if readable.endswith(' date'):
        base = readable[:-5].strip()
        return f"Fecha de {base}"
    if readable.endswith(' time'):
        base = readable[:-5].strip()
        return f"Hora de {base}"
    if 'count' in readable:
        base = readable.replace('count', '').strip()
        return f"Cantidad de {base}"
    if 'amount' in readable:
        base = readable.replace('amount', '').strip()
        return f"Monto de {base}"
    if 'price' in readable:
        base = readable.replace('price', '').strip()
        return f"Precio de {base}"
    if 'weight' in readable:
        base = readable.replace('weight', '').strip()
        return f"Peso de {base}"
    
    # Default: capitalize and add type info
    desc = readable
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
    
    return desc

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