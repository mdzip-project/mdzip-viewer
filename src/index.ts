/**
 * mdz-viewer — TypeScript viewer for MarkdownZip (.mdz) packages.
 *
 * ## Quick start
 *
 * ```ts
 * import { MdzViewer } from 'mdz-viewer';
 *
 * const bytes  = await fetch('example.mdz').then(r => r.arrayBuffer());
 * const result = new MdzViewer().render(new Uint8Array(bytes));
 *
 * console.log(result.html);       // rendered HTML
 * console.log(result.entryPoint); // "index.md"
 * console.log(result.manifest);   // parsed manifest.json, or null
 * ```
 *
 * ## Lower-level API
 *
 * ```ts
 * import { readMdz, readFileAsText } from 'mdz-viewer';
 *
 * const pkg      = readMdz(bytes);
 * const markdown = readFileAsText(pkg, pkg.entryPoint);
 * ```
 *
 * @module mdz-viewer
 */

// Core types
export type {
  MdzManifest,
  MdzAuthor,
  MdzPackage,
  MarkdownRenderer,
  RenderOptions,
  RenderResult,
} from './types.js';
export { MdzParseError, MdzEntryPointError } from './types.js';

// Reader
export { readMdz, readFileAsText } from './reader/index.js';

// Viewer
export { MdzViewer } from './viewer/index.js';

// Rendering
export { MarkedRenderer, getDefaultRenderer, setDefaultRenderer } from './rendering/index.js';

// Adapters
export { loadFromBlob, loadFromUrl } from './adapters/index.js';
