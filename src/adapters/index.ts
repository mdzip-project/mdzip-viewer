/**
 * Environment adapters.
 *
 * These utilities bridge environment-specific file-loading APIs to the
 * `Uint8Array` expected by the core reader and viewer.
 *
 * @module adapters
 *
 * @remarks
 * All adapters are **optional** helpers — you can always supply your own
 * `Uint8Array` directly to {@link MdzViewer.render} or {@link readMdz}.
 */

// ---------------------------------------------------------------------------
// Browser adapter
// ---------------------------------------------------------------------------

/**
 * Load an `.mdz` file from a browser `File` or `Blob` as a `Uint8Array`.
 *
 * **Browser only.** This function requires the `FileReader` / `Blob.arrayBuffer`
 * API and will throw in Node.js unless a polyfill is present.
 *
 * @param file - A `File` or `Blob` object obtained from, e.g., an
 *               `<input type="file">` element or a `fetch()` response.
 * @returns      A `Uint8Array` of the raw bytes.
 *
 * @example
 * ```ts
 * import { loadFromBlob } from 'mdzip-viewer/adapters';
 * import { MdzViewer }    from 'mdzip-viewer';
 *
 * inputEl.addEventListener('change', async (e) => {
 *   const file   = (e.target as HTMLInputElement).files![0];
 *   const bytes  = await loadFromBlob(file);
 *   const result = await new MdzViewer().render(bytes);
 *   document.getElementById('content')!.innerHTML = result.html;
 * });
 * ```
 */
export async function loadFromBlob(file: Blob): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Load an `.mdz` file from a URL as a `Uint8Array`.
 *
 * Uses the Fetch API; available in modern browsers and Node.js ≥ 18.
 *
 * @param url     - The URL of the `.mdz` resource.
 * @param init    - Optional `RequestInit` options forwarded to `fetch()`.
 * @returns        A `Uint8Array` of the raw bytes.
 *
 * @example
 * ```ts
 * import { loadFromUrl } from 'mdzip-viewer/adapters';
 * import { MdzViewer }   from 'mdzip-viewer';
 *
 * const bytes  = await loadFromUrl('/docs/guide.mdz');
 * const result = await new MdzViewer().render(bytes);
 * ```
 */
export async function loadFromUrl(url: string, init?: RequestInit): Promise<Uint8Array> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch MDZ from "${url}": ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
