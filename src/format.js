export function print(value, options = {}) {
  const { json = false } = options;
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        console.log(item);
      } else {
        console.log(JSON.stringify(item));
      }
    }
    return;
  }

  if (typeof value === 'string') {
    console.log(value);
    return;
  }

  console.log(JSON.stringify(value, null, 2));
}

export function toTable(rows, columns) {
  const rendered = rows.map((row) => Object.fromEntries(columns.map((column) => [column, stringifyValue(row[column])] )));
  const widths = Object.fromEntries(columns.map((column) => [column, Math.max(column.length, ...rendered.map((row) => row[column].length))]));
  const header = columns.map((column) => column.padEnd(widths[column])).join('  ');
  const separator = columns.map((column) => '-'.repeat(widths[column])).join('  ');
  const body = rendered.map((row) => columns.map((column) => row[column].padEnd(widths[column])).join('  '));
  return [header, separator, ...body].join('\n');
}

function stringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
