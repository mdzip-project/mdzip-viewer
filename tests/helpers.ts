/**
 * Helpers shared across test files.
 *
 * Creates minimal in-memory ZIP archives using JSZip directly so tests can
 * construct any archive content, including intentionally invalid fixtures,
 * without going through mdzip-core-js validation.
 */

import JSZip from 'jszip';

/** Encode a string to UTF-8 bytes. */
export function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Build a ZIP archive from a plain-object map of path → string contents. */
export async function makeZip(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'uint8array' });
}

/** A minimal valid manifest JSON string. */
export function minimalManifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ mdz: '1.0.0', ...overrides });
}
