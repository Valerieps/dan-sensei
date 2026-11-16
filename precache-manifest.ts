import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * The list of built files the service worker keeps at install (ADR-009). `public/sw.js` fetches
 * `/precache-manifest.json`, so it never has to know a hashed file name. The `version` changes with
 * any file's content, which makes the worker switch to a new cache (and drop the old one).
 */
export const PRECACHE_MANIFEST = 'precache-manifest.json';

/** Files of `dist/` the worker must not keep: itself, its list and the static-assets headers. */
const LEFT_OUT = new Set(['sw.js', PRECACHE_MANIFEST, '_headers']);

export interface PrecacheManifest {
  version: string;
  /** Absolute paths. The page itself is listed as `/` and is also served for any deep link. */
  urls: string[];
}

export function buildManifest(files: { path: string; content: Uint8Array | string }[]): PrecacheManifest {
  const kept = files.filter((file) => !LEFT_OUT.has(file.path)).sort((a, b) => a.path.localeCompare(b.path));
  const hash = createHash('sha256');
  for (const file of kept) hash.update(file.path).update('\0').update(file.content).update('\0');
  return {
    version: hash.digest('hex').slice(0, 16),
    urls: kept.map((file) => (file.path === 'index.html' ? '/' : `/${file.path}`)),
  };
}

function listFiles(root: string, dir = root): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(root, path) : [path.slice(root.length + 1).split(sep).join('/')];
  });
}

/** Reads the finished `dist/` and writes the manifest next to it. */
export function writeManifest(distDir: string): PrecacheManifest {
  const files = listFiles(distDir).map((path) => ({ path, content: readFileSync(join(distDir, path)) }));
  const manifest = buildManifest(files);
  writeFileSync(join(distDir, PRECACHE_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
