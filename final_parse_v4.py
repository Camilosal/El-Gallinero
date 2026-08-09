import re

def parse_schema(content):
    # Find all table definitions
    pattern = re.compile(
        r'export const (\w+) = pgTable\("([^"]+)",\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\s*(?:,\s*\([^)]*\)\s*=>\s*\[[^\]]*\])?\s*\);',
        re.DOTALL
    )
    
    matches = list(pattern.finditer(content))
    tables = []
    
    for match in matches:
        var_name = match.group(1)
        table_name = match.group(2)
        table_content = match.group(3)
        
        # Look backwards for section comments
        section_comment = ""
        match_start = match.start()
        before_text = content[:match_start]
        lines = before_text.split('\n')
        for i in range(len(lines)-1, max(-1, len(lines)-20), -1):
            line = lines[i].strip()
            if line.startswith('// ───') and '───' in line:
                section_comment = line
                break
        
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
        if not stripped or stripped.startswith('//') or stripped.startswith('/*') or \
           stripped.startswith('export') or stripped.startswith('(') or \
           stripped.startswith('uniqueIndex') or stripped.endswith('=> ['):
            continue
            
        if ':' in stripped and not stripped.startswith('//'):
            if stripped.endswith(','):
                stripped = stripped[:-1]
            
            comment = ""
            definition_part = stripped
            
            # Handle inline comments
            if '//' in stripped:
                parts = stripped.split('//')
                if ':' in parts[0] and not parts[0].strip().endswith(':'):
                    definition_part = parts[0].rstrip(',').strip()
                    comment = '//'.join(parts[1:]).strip()
                else:
                    definition_part = stripped
            elif '/*' in stripped and '*/' in stripped:
                start_comment = stripped.find('/*')
                end_comment = stripped.find('*/', start_comment+2)
                if start_comment != -1 and end_comment != -1:
                    comment = stripped[start_comment+2:end_comment].strip()
                    definition_part = (stripped[:start_comment] + stripped[end_comment+2:]).rstrip(',').strip()
            
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
    if '_' in name:
        name = name.replace('_', ' ')
    s1 = re.sub('([A-Z][a-z]+)', r' \1', re.sub('([A-Z]+)', r' \1', name))
    s2 = s1.strip().lower()
    s3 = re.sub(r'\s+', ' ', s2)
    return s3

def generate_description(col_name, col_def, table_name=""):
    readable = to_readable(col_name)
    
    # Essential special cases
    special_cases = {
        'id': 'Identificador único (UUID)',
        'created at': 'Fecha y hora de creación',
        'updated at': 'Fecha y hora de última actualización',
        'date': 'Fecha',
        'name': 'Nombre o identificador',
        'code': 'Código identificador',
        'breed': 'Raza de la ave',
        'birth date': 'Fecha de nacimiento',
        'status': 'Estado actual',
        'weight': 'Peso',
        'notes': 'Notas adicionales',
        'is broody': 'Indica si la gallina está empollando',
        'clutch size': 'Número de huevos en la puesta',
        'acquisition id': 'ID de la adquisición',
        'acquisition cost': 'Costo de adquisición',
        'quantity': 'Cantidad',
        'is entry': 'Indica si es entrada (true) o salida (false)',
        'movement type': 'Tipo de movimiento',
        'auto generated': 'Generado automáticamente',
        'stage catalog id': 'ID de la etapa del catálogo',
        'hen count': 'Número de gallinas',
        'total collected': 'Total recolectado',
        'broken': 'Cantidad rota o dañada',
        'for incubation': 'Destinado a incubación',
        'production id': 'ID de producción asociado',
        'size': 'Tamaño o categoría',
        'hen id': 'ID de gallina asociada',
        'start date': 'Fecha de inicio',
        'expected hatch date': 'Fecha esperada de eclosión',
        'eggs set': 'Huevos puestos en incubadora',
        'eggs hatched': 'Huevos eclosionados',
        'males hatched': 'Pollitos machos eclosionados',
        'females hatched': 'Pollitas hembras eclosionadas',
        'is complete': 'Indica si está completo',
        'title': 'Título o nombre',
        'description': 'Descripción detallada',
        'scheduled date': 'Fecha programada',
        'completed date': 'Fecha de finalización',
        'cost': 'Costo asociado',
        'type': 'Tipo o categoría',
        'affected hens': 'Gallinas afectadas (JSON o "todas")',
        'product': 'Producto utilizado',
        'next scheduled': 'Próxima fecha programada',
        'category': 'Categoría de clasificación',
        'counterparty': 'Parte involucrada en la transacción',
        'amount': 'Monto de la transacción',
        'unit price': 'Precio por unidad',
        'unit': 'Unidad de medida',
        'presentation': 'Presentación del producto',
        'source type': 'Tipo de origen',
        'source id': 'ID de origen',
        'is credit': 'Indica si es a crédito',
        'username': 'Nombre de usuario',
        'password hash': 'Hash de contraseña',
        'role': 'Rol del usuario',
        'user id': 'ID de usuario asociado',
        'token hash': 'Hash de token de sesión',
        'expires at': 'Fecha de expiración del token',
    }
    
    if readable in special_cases:
        return special_cases[readable]
    
    # Handle common patterns
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
    
    # Generate from readable name
    desc = readable
    if desc:
        desc = desc[0].upper() + desc[1:] if len(desc) > 1 else desc.upper()
    
    # Add type hints
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
            clean_section = table['section']
            if clean_section.startswith('// ───') and clean_section.endswith('───'):
                clean_section = clean_section[4:-4]
            out_lines.append(f"*{clean_section}*\n")
        
        out_lines.append('| Column Name | Data Type / Constraints | Description |\n')
        out_lines.append('|-------------|-------------------------|-------------|\n')
        
        for col in table['columns']:
            if col['comment'] and col['comment'].strip() and not col['comment'].strip().startswith('@'):
                description = col['comment'].strip()
            else:
                description = generate_description(col['name'], col['definition'], table['table_name'])
            
            def_clean = ' '.join(col['definition'].split())
            out_lines.append(f'| {col["name"]} | {def_clean} | {description} |\n')
        
        out_lines.append('\n')
    
    with open('/home/ubuntu/negocio/data/app_gallinero/docs/data-dictionary.md', 'w') as f:
        f.write(''.join(out_lines))
    
    print(f"Generated data dictionary with {len(tables)} tables")

if __name__ == '__main__':
    main()