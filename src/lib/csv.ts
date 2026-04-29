type Row = Record<string, string>;

export function parseCsv(raw: string): Row[] {
  const rows = parseRows(raw.trim());
  const [header, ...records] = rows;

  if (!header) {
    return [];
  }

  return records
    .filter((record) => record.some((cell) => cell.trim().length > 0))
    .map((record) =>
      header.reduce<Row>((row, key, index) => {
        row[key] = record[index] ?? "";
        return row;
      }, {})
    );
}

function parseRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  rows.push(row);
  return rows;
}
