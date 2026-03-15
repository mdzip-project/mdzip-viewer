/**
 * Helpers shared across test files.
 *
 * Creates minimal in-memory ZIP archives using `fflate` so tests have
 * realistic MDZ fixtures without touching the file system.
 */

import { zipSync } from 'fflate';

/** Encode a string to UTF-8 bytes. */
export function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Build a ZIP archive from a plain-object map of path → string contents. */
export function makeZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[path] = encode(content);
  }
  return zipSync(entries);
}

/** A minimal valid manifest JSON string. */
export function minimalManifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ mdz: '1.0.0', ...overrides });
}
