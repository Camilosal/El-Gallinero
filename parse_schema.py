import re
import sys

def extract_tables(content):
    # Find all table definitions
    pattern = re.compile(r'export const (\w+) = pgTable\("([^"]+)", \{')
    matches = list(pattern.finditer(content))
    tables = []
    for i, match in enumerate(matches):
        var_name = match.group(1)  # e.g., hens
        table_name = match.group(2)  # e.g., hens
        start = match.end()  # position after the opening {
        # Find the end of this table definition: look for the matching closing brace
        # We'll scan forward, counting braces.
        brace_count = 1
        pos = start
        while pos < len(content) and brace_count > 0:
            ch = content[pos]
            if ch == '{':
                brace_count += 1
            elif ch == '}':
                brace_count -= 1
            pos += 1
        # pos now points after the matching '}'
        # However there might be a comma and index definition: }, (t) => [ ... ]);
        # We'll extend to include possible index block until we see a closing '});' at same level?
        # Simpler: we'll take up to the next '});' that follows the closing brace we found.
        # Let's find the next '});' after pos-1
        # Actually we already counted braces; after the matching '}', there may be ', (t) => [ ... ]);'
        # We'll just capture until we see a '});' where the preceding char is ')' or ','? Let's just capture until we see '});' and stop.
        # Search from pos-1 for '});'
        end_pattern = re.compile(r'\);')
        # Find next occurrence of '});' after the matched closing brace
        search_start = pos-1  # position of the '}'
        match_end = content.find('});', search_start)
        if match_end != -1:
            end = match_end + 3  # include '});'
        else:
            # fallback: use pos
            end = pos
        table_block = content[match.start():end]
        tables.append((var_name, table_name, table_block))
        # Move cursor to end for next iteration (not needed as we use finditer)
    return tables

def parse_columns(block):
    # Extract lines inside the braces, ignoring the outer pgTable(...,
    # We'll get the content between the first '{' and the matching '}'
    # We already have block that includes the whole thing.
    # Let's get inner content between the braces after pgTable(
    inner_start = block.find('{')
    inner_end = block.rfind('}')  # last '}' before possible index
    inner = block[inner_start+1:inner_end]
    # Split by lines
    lines = inner.split('\n')
    cols = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith('//'):
            continue
        # Match column definition: usually something like   id: uuid("id").defaultRandom().primaryKey(),
        # We'll capture column name before colon
        if ':' in line and not line.startswith('export') and not line.startswith('//'):
            # Remove trailing comma
            line = line.rstrip(',')
            # Split at first colon
            parts = line.split(':', 1)
            col_name = parts[0].strip()
            col_def = parts[1].strip()
            cols.append((col_name, col_def))
    return cols

def main():
    with open('/home/ubuntu/negocio/data/app_gallinero/src/db/schema.ts', 'r') as f:
        content = f.read()
    tables = extract_tables(content)
    out_lines = []
    out_lines.append('# Diccionario de Datos - App Gallinero\n')
    out_lines.append('Este documento describe las tablas, columnas y tipos de datos utilizados en la base de datos de la aplicación **Gallinero**.\n')
    out_lines.append('## Tablas\n')
    for var_name, table_name, block in tables:
        out_lines.append(f'### {table_name}\n')
        # Try to get a comment preceding the table definition
        # We'll search for the line before the table definition that starts with '//'
        # For simplicity, we can skip.
        out_lines.append('| Column Name | Data Type / Constraints | Description |\n')
        out_lines.append('|-------------|-------------------------|-------------|\n')
        cols = parse_columns(block)
        for col_name, col_def in cols:
            # Clean up col_def: remove extra spaces
            col_def_clean = ' '.join(col_def.split())
            out_lines.append(f'| {col_name} | {col_def_clean} | |\n')
        out_lines.append('\n')
    with open('/home/ubuntu/negocio/data/app_gallinero/docs/data-dictionary.md', 'w') as f:
        f.write(''.join(out_lines))

if __name__ == '__main__':
    main()