/** Characters a spreadsheet may read as the start of a formula. */
const formulaStart = /^[=+\-@\t\r]/u;

/** A CSV cell, quoted when needed, and never run as a formula by a spreadsheet. */
export function csvCell(value: string): string {
  const safe = formulaStart.test(value) ? `'${value}` : value;
  return /[",\r\n]/u.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const byteOrderMark = String.fromCharCode(0xfeff);

/** Rows as CSV text that spreadsheets open as UTF-8 (accents and other alphabets intact). */
export function csvText(rows: readonly (readonly string[])[]): string {
  return byteOrderMark + rows.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
