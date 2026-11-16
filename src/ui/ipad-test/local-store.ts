// The TestStore on the device's localStorage. Private windows and blocked storage throw, so every
// access is guarded: the test then just lasts until the page closes.

import { parseTest, serializeTest, STORAGE_KEY, type SavedTest, type TestStore } from './store';

export function localStorageTestStore(storage: () => Storage = () => window.localStorage): TestStore {
  return {
    load(): SavedTest | null {
      try {
        return parseTest(storage().getItem(STORAGE_KEY));
      } catch {
        return null;
      }
    },
    save(saved) {
      try {
        storage().setItem(STORAGE_KEY, serializeTest(saved));
      } catch {
        // Full or blocked storage: keep going with what is in memory.
      }
    },
    clear() {
      try {
        storage().removeItem(STORAGE_KEY);
      } catch {
        // Nothing to clear.
      }
    },
  };
}
