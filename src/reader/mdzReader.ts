/**
 * Core MDZ archive reader.
 *
 * Parses a raw `.mdz` (ZIP) binary into an {@link MdzPackage}, performing:
 * - ZIP extraction via `mdz-core-js`
 * - Optional `manifest.json` parsing
 * - Entry-point discovery per the MDZ spec §5.5
 *
 * This module is environment-agnostic; it accepts `Uint8Array` bytes and
 * does not access the file system or DOM directly.
 *
 * @module reader
 */

import { MdzArchiveCore } from 'mdz-core-js';
import type { MdzManifest, MdzPackage } from '../types.js';
import { MdzEntryPointError, MdzParseError } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MANIFEST_PATH = 'manifest.json';
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
type ArchiveEntries = Record<string, Uint8Array>;

interface ArchiveZipEntry {
  dir: boolean;
  async(kind: 'arraybuffer'): Promise<ArrayBuffer | string>;
}

interface ArchiveZipLike {
  files: Record<string, ArchiveZipEntry>;
}

/** Returns true if `path` is a root-level Markdown file (no directory prefix). */
function isRootMarkdown(path: string): boolean {
  if (path.includes('/')) return false;
  const dot = path.lastIndexOf('.');
  if (dot === -1) return false;
  return MARKDOWN_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

/** Decode a `Uint8Array` to a UTF-8 string. */
function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Parse `manifest.json` bytes into an {@link MdzManifest}.
 *
 * Returns `null` if parsing fails (rather than throwing) so that readers can
 * degrade gracefully on malformed manifests.
 */
function parseManifest(bytes: Uint8Array): (MdzManifest & Record<string, unknown>) | null {
  try {
    const text = decodeUtf8(bytes);
    const obj = JSON.parse(text) as unknown;
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return null;
    }
    const manifest = obj as Record<string, unknown>;
    if (typeof manifest['mdz'] !== 'string') {
      return null;
    }
    return manifest as MdzManifest & Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Resolve the entry-point Markdown file from the extracted archive entries,
 * following the MDZ spec §5.5 ordered algorithm:
 *
 * 1. `manifest.json` present and `entryPoint` field references an existing file.
 * 2. `index.md` exists at the archive root.
 * 3. Exactly one `.md` / `.markdown` file at the archive root.
 * 4. Otherwise, throw {@link MdzEntryPointError} with the candidate list.
 */
function resolveEntryPoint(
  entries: ArchiveEntries,
  manifest: (MdzManifest & Record<string, unknown>) | null,
): string {
  const paths = Object.keys(entries);

  // Step 1 — manifest.entryPoint
  if (manifest?.entryPoint && typeof manifest.entryPoint === 'string') {
    const ep = manifest.entryPoint;
    if (paths.includes(ep)) {
      return ep;
    }
  }

  // Step 2 — index.md
  if (paths.includes('index.md')) {
    return 'index.md';
  }

  // Step 3 — exactly one root-level Markdown file
  const rootMarkdown = paths.filter(isRootMarkdown);
  if (rootMarkdown.length === 1) {
    // Safe: length === 1 guarantees the element exists.
    const [onlyFile] = rootMarkdown;
    return onlyFile as string;
  }

  // Step 4 — ambiguous or missing
  throw new MdzEntryPointError(
    rootMarkdown.length === 0
      ? 'No Markdown file found at the archive root. The archive does not contain a resolvable entry point.'
      : `Multiple root-level Markdown files found and no manifest.json with an entryPoint. ` +
        `Provide a manifest.json with an "entryPoint" field, or rename the primary file to "index.md". ` +
        `Candidates: ${rootMarkdown.join(', ')}`,
    rootMarkdown,
  );
}

/**
 * Extract non-directory entries from an MDZ archive via mdz-core-js.
 */
async function extractEntries(data: Uint8Array): Promise<ArchiveEntries> {
  let archive: MdzArchiveCore;
  try {
    archive = await MdzArchiveCore.open(data);
  } catch (err) {
    throw new MdzParseError(
      `Failed to open MDZ archive: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const zip = (archive as unknown as { zip?: ArchiveZipLike }).zip;
  if (!zip?.files || typeof zip.files !== 'object') {
    throw new MdzParseError('Failed to read MDZ archive entries.');
  }

  const entries: ArchiveEntries = {};

  for (const [rawPath, entry] of Object.entries(zip.files)) {
    if (!entry || entry.dir) continue;

    const path = MdzArchiveCore.normalizePath(rawPath);
    try {
      const bytes = await entry.async('arraybuffer');
      entries[path] = new Uint8Array(bytes as ArrayBuffer);
    } catch (err) {
      throw new MdzParseError(
        `Failed to extract MDZ entry "${path}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw `.mdz` binary into an {@link MdzPackage}.
 *
 * @param data - The raw bytes of an `.mdz` (ZIP) file. Accepts both
 *               `Uint8Array` and `Buffer` (Node.js).
 * @returns      A promise resolving to a fully-parsed {@link MdzPackage}.
 *
 * @throws {MdzParseError}      If `data` is not a valid ZIP archive.
 * @throws {MdzEntryPointError} If no unambiguous entry point can be resolved.
 *
 * @example
 * ```ts
 * import { readMdz } from 'mdz-viewer/reader';
 *
 * const bytes = await fetch('example.mdz').then(r => r.arrayBuffer());
 * const pkg = await readMdz(new Uint8Array(bytes));
 * console.log(pkg.entryPoint); // "index.md"
 * ```
 */
export async function readMdz(data: Uint8Array): Promise<MdzPackage> {
  const entries = await extractEntries(data);

  // Parse manifest (optional)
  const manifest = entries[MANIFEST_PATH] ? parseManifest(entries[MANIFEST_PATH]) : null;

  // Resolve entry point
  const entryPoint = resolveEntryPoint(entries, manifest);

  // Build file map
  const files = new Map<string, Uint8Array>(Object.entries(entries));

  return { files, manifest, entryPoint };
}

/**
 * Retrieve and decode a text file from a parsed {@link MdzPackage}.
 *
 * @param pkg  - A parsed MDZ package.
 * @param path - Archive-relative path of the file to read.
 * @returns     The file contents as a UTF-8 string.
 *
 * @throws {Error} If `path` does not exist in the archive.
 *
 * @example
 * ```ts
 * const markdown = readFileAsText(pkg, pkg.entryPoint);
 * ```
 */
export function readFileAsText(pkg: MdzPackage, path: string): string {
  const bytes = pkg.files.get(path);
  if (!bytes) {
    throw new Error(`File not found in MDZ archive: "${path}"`);
  }
  return decodeUtf8(bytes);
}
