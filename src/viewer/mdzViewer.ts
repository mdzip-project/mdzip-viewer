/**
 * High-level MDZ viewer.
 *
 * Combines reading ({@link readMdz}) and rendering ({@link getDefaultRenderer})
 * into a single convenient API.
 *
 * @module viewer
 *
 * @remarks
 * **Browser/environment notes:**
 * - The viewer is environment-agnostic; it accepts raw `Uint8Array` bytes.
 * - Use the {@link BrowserAdapter} or {@link NodeAdapter} from the `adapters`
 *   module to load bytes from a `File`, `Blob`, or file-system path.
 * - Rendered HTML is **not** sanitized. Sanitize output before inserting into
 *   the DOM when the MDZ source is untrusted.
 */

import { readMdz, readFileAsText } from '../reader/mdzReader.js';
import { getDefaultRenderer } from '../rendering/markdownRenderer.js';
import type { RenderOptions, RenderResult, ViewerPluginContext } from '../types.js';

// ---------------------------------------------------------------------------
// Viewer
// ---------------------------------------------------------------------------

/**
 * High-level viewer that parses an MDZ archive and renders the entry-point
 * Markdown file to HTML.
 *
 * @example
 * ```ts
 * import { MdzViewer } from 'mdz-viewer';
 *
 * const viewer = new MdzViewer();
 * const bytes  = await fetch('my-doc.mdz').then(r => r.arrayBuffer());
 * const result = await viewer.render(new Uint8Array(bytes));
 *
 * document.getElementById('content')!.innerHTML = result.html;
 * ```
 */
export class MdzViewer {
  /**
   * Parse an `.mdz` binary and render its entry-point Markdown to HTML.
   *
   * @param data    - Raw bytes of the `.mdz` (ZIP) file.
   * @param options - Optional render configuration.
    * @returns        A promise resolving to a {@link RenderResult} containing the HTML and metadata.
   *
   * @throws {MdzParseError}      If `data` is not a valid ZIP archive.
   * @throws {MdzEntryPointError} If no unambiguous entry point can be resolved
   *                              and no override is provided via `options.entryPoint`.
   * @throws {Error}              If the resolved entry-point file is missing from
   *                              the archive.
   */
  async render(data: Uint8Array, options: RenderOptions = {}): Promise<RenderResult> {
    const pkg = await readMdz(data);

    const entryPoint = options.entryPoint ?? pkg.entryPoint;
    const renderer = options.renderer ?? getDefaultRenderer();
    const plugins = options.plugins ?? [];
    const pluginContext: ViewerPluginContext = { pkg, entryPoint };

    let markdown = readFileAsText(pkg, entryPoint);
    for (const plugin of plugins) {
      if (plugin.transformMarkdown) {
        markdown = await plugin.transformMarkdown(markdown, pluginContext);
      }
    }

    let html = renderer.render(markdown);
    for (const plugin of plugins) {
      if (plugin.transformHtml) {
        html = await plugin.transformHtml(html, pluginContext);
      }
    }

    return { html, entryPoint, manifest: pkg.manifest };
  }
}
