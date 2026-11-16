// Full export of the data: one CSV per table inside one .zip (docs/spec/termo-e-lgpd.md, "Cópia e
// exclusão"). Opens in any spreadsheet. The CSVs carry everything the app stores, so only an admin
// may ask, and secrets (sessions, Google ids) are left out.
import { dataEmSaoPaulo } from '../../src/domain/pacotes';
import type { Context } from './context';
import type { SqlValue } from './ports';
import { zip, type ZipEntry } from './zip';

/** Tables left out: they hold credentials or are the database's own bookkeeping. */
export const NOT_EXPORTED = ['sessions', 'schema_migrations'] as const;

/** Columns left out of an exported table: the Google account id is a login credential. */
const OMITTED_COLUMNS: Record<string, readonly string[]> = { members: ['google_sub'] };

/** Text a spreadsheet would run as a formula starts with one of these: a quote makes it text. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: SqlValue): string {
  if (value === null) return '';
  const text = typeof value === 'string' && FORMULA_START.test(value) ? `'${value}` : String(value);
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvLine(values: readonly SqlValue[]): string {
  return values.map(csvCell).join(',');
}

export function exportedTables(ctx: Context): string[] {
  return ctx.sql
    .all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
    .map((row) => row.name)
    .filter((name) => !(NOT_EXPORTED as readonly string[]).includes(name));
}

function tableCsv(ctx: Context, table: string): string {
  const omitted = OMITTED_COLUMNS[table] ?? [];
  const columns = ctx.sql
    .all<{ name: string }>(`PRAGMA table_info("${table}")`)
    .map((column) => column.name)
    .filter((name) => !omitted.includes(name));
  const rows = ctx.sql.all<Record<string, SqlValue>>(`SELECT ${columns.map((c) => `"${c}"`).join(', ')} FROM "${table}" ORDER BY rowid`);
  // A BOM makes Excel read the accents as UTF-8; CRLF is what spreadsheets expect.
  return `﻿${[csvLine(columns), ...rows.map((row) => csvLine(columns.map((c) => row[c] ?? null)))].join('\r\n')}\r\n`;
}

export function exportAll(ctx: Context): Uint8Array {
  const entries: ZipEntry[] = exportedTables(ctx).map((table) => ({ name: `${table}.csv`, content: tableCsv(ctx, table) }));
  return zip(entries, new Date(`${dataEmSaoPaulo(ctx.clock.now())}T12:00:00Z`));
}
