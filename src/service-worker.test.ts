import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/** Runs public/sw.js against a fake worker scope and fake Cache storage (ADR-009). */
function load(options: { online: boolean; manifest?: { version: string; urls: string[] } }) {
  const listeners: Record<string, (event: any) => void> = {};
  const stores = new Map<string, Map<string, string>>();
  const fakeCaches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, string>();
      stores.set(name, store);
      return {
        addAll: async (requests: { url: string }[]) => requests.forEach((r) => store.set(new URL(r.url, 'https://app.test').pathname, `cached ${r.url}`)),
      };
    },
    match: async (request: string | { url: string }) => {
      const path = new URL(typeof request === 'string' ? request : request.url, 'https://app.test').pathname;
      for (const store of stores.values()) if (store.has(path)) return store.get(path);
      return undefined;
    },
  };
  const scope = {
    addEventListener: (type: string, fn: (event: any) => void) => (listeners[type] = fn),
    location: { origin: 'https://app.test' },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  const context = {
    self: scope,
    caches: fakeCaches,
    URL,
    Request: class {
      constructor(public url: string) {}
    },
    Response: { error: () => 'error' },
    fetch: async (input: string | { url: string }) => {
      const url = typeof input === 'string' ? input : input.url;
      if (!options.online) throw new TypeError('offline');
      if (url === '/precache-manifest.json') return { ok: true, json: async () => options.manifest };
      return `network ${url}`;
    },
  };
  runInNewContext(readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8'), context);
  const wait = async (type: string) => {
    let pending: Promise<unknown> = Promise.resolve();
    listeners[type]!({ waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  };
  const request = (path: string, init: { method?: string; mode?: string } = {}) => {
    let answer: Promise<unknown> | undefined;
    listeners.fetch!({ request: { url: `https://app.test${path}`, method: init.method ?? 'GET', mode: init.mode ?? 'cors' }, respondWith: (p: Promise<unknown>) => (answer = p) });
    return answer;
  };
  return { wait, request, stores };
}

const manifest = { version: 'v1', urls: ['/', '/assets/a.js'] };

describe('service worker', () => {
  it('keeps the listed files at install, in a cache named by the version', async () => {
    const worker = load({ online: true, manifest });
    await worker.wait('install');
    expect([...worker.stores.keys()]).toEqual(['dan-sensei-v1']);
    expect([...worker.stores.get('dan-sensei-v1')!.keys()]).toEqual(['/', '/assets/a.js']);
  });

  it('drops the caches of older versions when it activates', async () => {
    const worker = load({ online: true, manifest });
    worker.stores.set('dan-sensei-old', new Map());
    worker.stores.set('other-app', new Map());
    await worker.wait('install');
    await worker.wait('activate');
    expect([...worker.stores.keys()]).toEqual(['other-app', 'dan-sensei-v1']);
  });

  it('opens a page offline from the kept app, deep links included', async () => {
    const worker = load({ online: true, manifest });
    await worker.wait('install');
    const offline = load({ online: false });
    offline.stores.set('dan-sensei-v1', worker.stores.get('dan-sensei-v1')!);
    expect(await offline.request('/teste-ipad', { mode: 'navigate' })).toBe('cached /');
    expect(await offline.request('/assets/a.js')).toBe('cached /assets/a.js');
  });

  it('leaves /api, other methods and other origins to the network', () => {
    const worker = load({ online: true, manifest });
    expect(worker.request('/api/me')).toBeUndefined();
    expect(worker.request('/api')).toBeUndefined();
    expect(worker.request('/assets/a.js', { method: 'POST' })).toBeUndefined();
  });
});
