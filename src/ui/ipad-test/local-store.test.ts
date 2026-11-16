import { describe, expect, it } from 'vitest';
import { localStorageTestStore } from './local-store';
import { freshTest } from './store';
import { answerQuestion } from './steps';

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } as unknown as Storage;
}

describe('localStorageTestStore', () => {
  it('saves, loads and clears', () => {
    const storage = memory();
    const store = localStorageTestStore(() => storage);
    expect(store.load()).toBeNull();
    const saved = { ...freshTest(), state: answerQuestion(freshTest().state, 'sound-beeps', true) };
    store.save(saved);
    expect(store.load()).toEqual(saved);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('survives storage that throws', () => {
    const store = localStorageTestStore(() => {
      throw new Error('blocked');
    });
    expect(store.load()).toBeNull();
    expect(() => store.save(freshTest())).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });

  it('starts over when the saved text is damaged', () => {
    const storage = memory();
    storage.setItem('dan-sensei.ipad-test.v1', '{oops');
    expect(localStorageTestStore(() => storage).load()).toBeNull();
  });
});
