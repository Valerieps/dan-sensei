import { describe, expect, it } from 'vitest';
import { conditionKey, isSignature, normalizeAlertNote, normalizeConditionName, normalizeGoals, normalizeParqAnswers, parqNeedsClearance } from './saude';

describe('signature', () => {
  const png = `data:image/png;base64,${'A'.repeat(200)}`;
  it('accepts a PNG data URL and nothing else', () => {
    expect(isSignature(png)).toBe(true);
    expect(isSignature('data:image/png;base64,AAAA')).toBe(false);
    expect(isSignature(`data:text/html;base64,${'A'.repeat(200)}`)).toBe(false);
    expect(isSignature(`data:image/png;base64,${'A'.repeat(200_001)}`)).toBe(false);
    expect(isSignature(42)).toBe(false);
  });
});

describe('PAR-Q', () => {
  it('needs exactly seven yes/no answers', () => {
    expect(normalizeParqAnswers(Array(7).fill(false))).toHaveLength(7);
    expect(normalizeParqAnswers(Array(6).fill(false))).toBeNull();
    expect(normalizeParqAnswers([...Array(6).fill(false), 'sim'])).toBeNull();
    expect(normalizeParqAnswers(undefined)).toBeNull();
  });
  it('asks for clearance on any yes', () => {
    expect(parqNeedsClearance([false, false])).toBe(false);
    expect(parqNeedsClearance([false, true])).toBe(true);
  });
});

describe('alerts', () => {
  it('cleans the condition name and the note', () => {
    expect(normalizeConditionName('  Dor   no joelho ')).toBe('Dor no joelho');
    expect(normalizeConditionName('   ')).toBeNull();
    expect(normalizeConditionName('x'.repeat(61))).toBeNull();
    expect(normalizeAlertNote(undefined)).toBe('');
    expect(normalizeAlertNote(' evitar  flexão ')).toBe('evitar flexão');
    expect(normalizeAlertNote('x'.repeat(201))).toBeNull();
    expect(conditionKey('Hérnia')).toBe(conditionKey('hernia'));
  });
});

describe('goals', () => {
  it('keeps one main goal and up to three secondary ones', () => {
    expect(normalizeGoals({ main: ' Emagrecer ', secondary: ['a', ' ', 'b'] })).toEqual({ main: 'Emagrecer', secondary: ['a', 'b'] });
    expect(normalizeGoals({ main: 'x', secondary: ['a', 'b', 'c', 'd'] })).toBeNull();
    expect(normalizeGoals({ main: 5 })).toBeNull();
    expect(normalizeGoals(null)).toBeNull();
  });
});
