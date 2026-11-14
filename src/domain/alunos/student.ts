// The student's registration (docs/spec/alunos.md). Pure rules shared by the server and the app.
export const STUDENT_STATUSES = ['active', 'paused', 'inactive'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const BILLING_TYPES = ['package', 'monthly'] as const;
export type Billing = (typeof BILLING_TYPES)[number];

export const STUDENT_NAME_MAX_LENGTH = 80;
export const TEXT_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 5000;
export const MAX_ADDRESSES = 5;
export const HEIGHT_MIN_CM = 50;
export const HEIGHT_MAX_CM = 250;

export interface AddressInput {
  /** Present when the address already exists. */
  readonly id?: string;
  readonly label: string;
  readonly address: string;
  readonly isDefault: boolean;
}

export interface StudentInput {
  readonly name: string;
  readonly phone: string;
  readonly birthDate: string | null;
  readonly heightCm: number | null;
  readonly emergencyContact: string;
  readonly addresses: readonly AddressInput[];
}

export type StudentField = 'name' | 'phone' | 'birthDate' | 'heightCm' | 'emergencyContact' | 'addresses';

const clean = (text: string) => text.trim().replace(/\s+/g, ' ');

/** Trimmed, inner spaces collapsed; null when empty or too long. */
export function normalizeStudentName(name: string): string | null {
  const value = clean(name);
  return value.length >= 1 && value.length <= STUDENT_NAME_MAX_LENGTH ? value : null;
}

/** Digits only (Brazilian number, optional 55 prefix): 10 to 13 digits; null otherwise. */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 ? digits : null;
}

/** Shows "(11) 91234-5678" for a 10 or 11 digit number (after the 55 prefix, if any). */
export function formatPhone(digits: string): string {
  const national = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return digits;
}

/** A real calendar date as YYYY-MM-DD, from 1900 on; null otherwise. */
export function normalizeBirthDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getUTCFullYear() >= 1900 ? value : null;
}

export function isValidHeight(cm: number): boolean {
  return Number.isInteger(cm) && cm >= HEIGHT_MIN_CM && cm <= HEIGHT_MAX_CM;
}

/** Up to two letters: first letter of the first and the last word. */
export function initials(name: string): string {
  const words = clean(name).split(' ').filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toLocaleUpperCase('pt-BR');
}

/** Whatever the form sent, made safe; the fields that fail are listed. */
export function normalizeStudentInput(raw: Record<string, unknown>): { ok: true; value: StudentInput } | { ok: false; fields: StudentField[] } {
  const fields: StudentField[] = [];
  const text = (v: unknown) => (typeof v === 'string' ? v : '');

  const name = normalizeStudentName(text(raw.name));
  if (!name) fields.push('name');
  const phone = normalizePhone(text(raw.phone));
  if (!phone) fields.push('phone');

  let birthDate: string | null = null;
  if (raw.birthDate !== null && raw.birthDate !== undefined && raw.birthDate !== '') {
    birthDate = typeof raw.birthDate === 'string' ? normalizeBirthDate(raw.birthDate) : null;
    if (!birthDate) fields.push('birthDate');
  }

  let heightCm: number | null = null;
  if (raw.heightCm !== null && raw.heightCm !== undefined) {
    if (typeof raw.heightCm === 'number' && isValidHeight(raw.heightCm)) heightCm = raw.heightCm;
    else fields.push('heightCm');
  }

  const emergencyContact = clean(text(raw.emergencyContact));
  if (emergencyContact.length > TEXT_MAX_LENGTH) fields.push('emergencyContact');

  const addresses = normalizeAddresses(raw.addresses);
  if (!addresses) fields.push('addresses');

  if (fields.length > 0 || !name || !phone || !addresses) return { ok: false, fields };
  return { ok: true, value: { name, phone, birthDate, heightCm, emergencyContact, addresses } };
}

/** Drops blank rows; exactly one default when there is any address (the first, if none was marked). */
export function normalizeAddresses(raw: unknown): AddressInput[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const rows: AddressInput[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const row = item as Record<string, unknown>;
    const label = clean(typeof row.label === 'string' ? row.label : '');
    const address = clean(typeof row.address === 'string' ? row.address : '');
    if (!label && !address) continue;
    if (!address || label.length > TEXT_MAX_LENGTH || address.length > TEXT_MAX_LENGTH) return null;
    rows.push({ id: typeof row.id === 'string' ? row.id : undefined, label, address, isDefault: row.isDefault === true });
  }
  if (rows.length > MAX_ADDRESSES) return null;
  const defaultIndex = Math.max(0, rows.findIndex((r) => r.isDefault));
  return rows.map((r, i) => ({ ...r, isDefault: i === defaultIndex }));
}

/** The notes as stored; null when too long. */
export function normalizeNotes(notes: string): string | null {
  const value = notes.replace(/\r\n/g, '\n').trim();
  return value.length <= NOTES_MAX_LENGTH ? value : null;
}

export function isStudentStatus(value: unknown): value is StudentStatus {
  return typeof value === 'string' && (STUDENT_STATUSES as readonly string[]).includes(value);
}
