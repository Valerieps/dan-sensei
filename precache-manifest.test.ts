import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildManifest, PRECACHE_MANIFEST, writeManifest } from './precache-manifest.ts';

const app = [
  { path: 'index.html', content: '<html>' },
  { path: 'assets/index-abc.js', content: 'js' },
  { path: 'manifest.webmanifest', content: '{}' },
];

describe('precache manifest', () => {
  it('lists the page as / and every other file by its path', () => {
    expect(buildManifest(app).urls).toEqual(['/assets/index-abc.js', '/', '/manifest.webmanifest']);
  });

  it('leaves out the worker, its own list and the headers file', () => {
    const extra = [...app, { path: 'sw.js', content: 'x' }, { path: PRECACHE_MANIFEST, content: 'x' }, { path: '_headers', content: 'x' }];
    expect(buildManifest(extra)).toEqual(buildManifest(app));
  });

  it('changes the version when a file changes, and only then', () => {
    const changed = app.map((file) => (file.path === 'assets/index-abc.js' ? { ...file, content: 'js2' } : file));
    expect(buildManifest(changed).version).not.toBe(buildManifest(app).version);
    expect(buildManifest([...app].reverse()).version).toBe(buildManifest(app).version);
  });

  it('writes the manifest into the built folder', () => {
    const dist = mkdtempSync(join(tmpdir(), 'dist-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<html>');
    writeFileSync(join(dist, 'assets', 'a.js'), 'js');
    writeFileSync(join(dist, 'sw.js'), 'worker');
    const written = writeManifest(dist);
    expect(JSON.parse(readFileSync(join(dist, PRECACHE_MANIFEST), 'utf8'))).toEqual(written);
    expect(written.urls).toEqual(['/assets/a.js', '/']);
  });
});
