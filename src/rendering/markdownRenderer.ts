/**
 * Markdown rendering module.
 *
 * Provides a default `marked`-backed renderer and a pluggable
 * {@link MarkdownRenderer} interface so callers can swap in any Markdown
 * library they prefer.
 *
 * @module rendering
 *
 * @remarks
 * **Browser/environment notes:**
 * - The default renderer (`MarkedRenderer`) runs synchronously in both
 *   browser and Node.js environments.
 * - It does **not** sanitize HTML. If the Markdown source is untrusted, pass
 *   a custom renderer that wraps output with a sanitisation library.
 */

import { marked } from 'marked';
import type { MarkdownRenderer } from '../types.js';

// ---------------------------------------------------------------------------
// Default renderer
// ---------------------------------------------------------------------------

/**
 * The default Markdown renderer, backed by the `marked` library.
 *
 * @example
 * ```ts
 * import { MarkedRenderer } from 'mdz-viewer/rendering';
 *
 * const renderer = new MarkedRenderer();
 * const html = renderer.render('# Hello');
 * ```
 */
export class MarkedRenderer implements MarkdownRenderer {
  /**
   * Convert a Markdown string to an HTML string using `marked`.
   *
   * @param markdown - Raw Markdown source.
   * @returns          HTML string.
   */
  render(markdown: string): string {
    const result = marked.parse(markdown, { async: false });
    if (typeof result !== 'string') {
      // Synchronous mode always returns a string; this branch is unreachable
      // but satisfies TypeScript's type narrowing.
      throw new Error('Unexpected async result from marked.parse');
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Singleton default renderer
// ---------------------------------------------------------------------------

/** Shared default renderer instance. */
let _defaultRenderer: MarkdownRenderer | null = null;

/**
 * Get the shared default {@link MarkdownRenderer} instance.
 * Creates a {@link MarkedRenderer} on first call.
 */
export function getDefaultRenderer(): MarkdownRenderer {
  if (!_defaultRenderer) {
    _defaultRenderer = new MarkedRenderer();
  }
  return _defaultRenderer;
}

/**
 * Replace the default renderer used when no custom renderer is provided.
 * Useful for testing or for app-level renderer configuration.
 *
 * @param renderer - The new default renderer, or `null` to reset to
 *                   {@link MarkedRenderer}.
 */
export function setDefaultRenderer(renderer: MarkdownRenderer | null): void {
  _defaultRenderer = renderer;
}
