/**
 * Helpers shared across test files.
 *
 * Creates minimal in-memory ZIP archives using `mdz-core-js` so tests have
 * realistic MDZ fixtures without touching the file system.
 */

import { MdzPackagerCore } from 'mdz-core-js';

/** Encode a string to UTF-8 bytes. */
export function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Build a ZIP archive from a plain-object map of path → string contents. */
export async function makeZip(files: Record<string, string>): Promise<Uint8Array> {
  const packResult = await MdzPackagerCore.buildArchive(
    Object.entries(files).map(([path, text]) => ({ path, text })),
    'test',
    {
      createIndex: false,
      mapFiles: false,
      filters: ['**/*'],
      title: null,
      entryPoint: null,
      language: null,
      author: null,
      description: null,
      docVersion: null,
    },
  );

  const bytes = await packResult.blob.arrayBuffer();
  return new Uint8Array(bytes);
}

/** A minimal valid manifest JSON string. */
export function minimalManifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ mdz: '1.0.0', ...overrides });
}
