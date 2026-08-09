import re

def extract_tables_v2(content):
    # Split by lines starting with 'export const'
    # We'll find each occurrence of 'export const' and then grab until next 'export const' or end.
    pattern = re.compile(r'export const (\w+) = pgTable\("([^"]+)",')
    matches = list(pattern.finditer(content))
    tables = []
    for idx, match in enumerate(matches):
        var_name = match.group(1)
        table_name = match.group(2)
        start = match.start()
        # Determine end: next match start or end of content
        end = matches[idx+1].start() if idx+1 < len(matches) else len(content)
        chunk = content[start:end]
        # Now we need to extract the column definitions inside the pgTable call.
        # Find the opening '{' after the pgTable(
        open_brace = chunk.find('{')
        if open_brace == -1:
            continue
        # Find matching closing brace
        brace_count = 0
        pos = open_brace
        while pos < len(chunk):
            ch = chunk[pos]
            if ch == '{':
                brace_count += 1
            elif ch == '}':
                brace_count -= 1
                if brace_count == 0:
                    break
            pos += 1
        # pos is at the matching '}'
        inner = chunk[open_brace+1:pos]  # content between braces
        # Now parse columns from inner lines
        lines = inner.split('\n')
        cols = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith('//'):
                continue
            # Remove trailing comma
            line = line.rstrip(',')
            if ':' not in line:
                continue
            col_name, col_def = line.split(':', 1)
            col_name = col_name.strip()
            col_def = col_def.strip()
            cols.append((col_name, col_def))
        tables.append((table_name, cols))
    return tables

def main():
    with open('/home/ubuntu/negocio/data/app_gallinero/src/db/schema.ts', 'r') as f:
        content = f.read()
    tables = extract_tables_v2(content)
    out_lines = []
    out_lines.append('# Diccionario de Datos - App Gallinero\n')
    out_lines.append('Este documento describe las tablas, columnas y tipos de datos utilizados en la base de datos de la aplicación **Gallinero**.\n')
    out_lines.append('## Tablas\n')
    for table_name, cols in tables:
        out_lines.append(f'### {table_name}\n')
        out_lines.append('| Column Name | Data Type / Constraints | Description |\n')
        out_lines.append('|-------------|-------------------------|-------------|\n')
        for col_name, col_def in cols:
            col_def_clean = ' '.join(col_def.split())
            out_lines.append(f'| {col_name} | {col_def_clean} | |\n')
        out_lines.append('\n')
    with open('/home/ubuntu/negocio/data/app_gallinero/docs/data-dictionary.md', 'w') as f:
        f.write(''.join(out_lines))

if __name__ == '__main__':
    main()