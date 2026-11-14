import { describe, expect, it } from 'vitest';
import {
  formatPhone,
  initials,
  normalizeAddresses,
  normalizeBirthDate,
  normalizeNotes,
  normalizePhone,
  normalizeStudentInput,
  normalizeStudentName,
} from './student';

describe('student name and phone', () => {
  it('trims the name and refuses empty or long ones', () => {
    expect(normalizeStudentName('  Ana   Paula ')).toBe('Ana Paula');
    expect(normalizeStudentName('   ')).toBeNull();
    expect(normalizeStudentName('a'.repeat(81))).toBeNull();
  });

  it('keeps only the digits of the phone and wants 10 to 13', () => {
    expect(normalizePhone('(11) 91234-5678')).toBe('11912345678');
    expect(normalizePhone('+55 11 91234-5678')).toBe('5511912345678');
    expect(normalizePhone('1234')).toBeNull();
  });

  it('formats the phone for reading', () => {
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678');
    expect(formatPhone('1134567890')).toBe('(11) 3456-7890');
    expect(formatPhone('5511912345678')).toBe('(11) 91234-5678');
  });
});

describe('initials', () => {
  it('uses the first and the last word', () => {
    expect(initials('Ana Paula Souza')).toBe('AS');
    expect(initials('ana')).toBe('A');
    expect(initials('')).toBe('');
  });
});

describe('birth date and notes', () => {
  it('accepts only real dates', () => {
    expect(normalizeBirthDate('1990-02-28')).toBe('1990-02-28');
    expect(normalizeBirthDate('1990-02-30')).toBeNull();
    expect(normalizeBirthDate('28/02/1990')).toBeNull();
    expect(normalizeBirthDate('1850-01-01')).toBeNull();
  });

  it('limits the notes', () => {
    expect(normalizeNotes('  oi  ')).toBe('oi');
    expect(normalizeNotes('a'.repeat(5001))).toBeNull();
  });
});

describe('addresses', () => {
  it('drops blank rows and marks exactly one default', () => {
    const rows = normalizeAddresses([
      { label: 'Casa', address: 'Rua A, 1', isDefault: false },
      { label: '', address: '' },
      { label: 'Trabalho', address: 'Rua B, 2', isDefault: true },
    ]);
    expect(rows).toEqual([
      { id: undefined, label: 'Casa', address: 'Rua A, 1', isDefault: false },
      { id: undefined, label: 'Trabalho', address: 'Rua B, 2', isDefault: true },
    ]);
  });

  it('makes the first the default when none is marked', () => {
    expect(normalizeAddresses([{ label: '', address: 'Rua A' }])?.[0].isDefault).toBe(true);
  });

  it('refuses a label without an address and too many rows', () => {
    expect(normalizeAddresses([{ label: 'Casa', address: '' }])).toBeNull();
    expect(normalizeAddresses(Array.from({ length: 6 }, () => ({ label: '', address: 'x' })))).toBeNull();
  });
});

describe('student input', () => {
  const valid = { name: 'Ana', phone: '11912345678' };

  it('needs only the name and the phone', () => {
    expect(normalizeStudentInput(valid)).toEqual({
      ok: true,
      value: { name: 'Ana', phone: '11912345678', birthDate: null, heightCm: null, emergencyContact: '', addresses: [] },
    });
  });

  it('lists every field that failed', () => {
    expect(normalizeStudentInput({ name: '', phone: '1', birthDate: 'x', heightCm: 10 })).toEqual({
      ok: false,
      fields: ['name', 'phone', 'birthDate', 'heightCm'],
    });
  });
});
