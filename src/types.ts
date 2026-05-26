/**
 * Core types and interfaces for the mdz-viewer package.
 *
 * MDZ is the MarkdownZip format — a ZIP archive containing Markdown files and
 * optional assets, with an optional manifest.json at the archive root.
 *
 * @see https://github.com/kylemwhite/markdownzip-spec
 */

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/** An author entry in the MDZ manifest. */
export interface MdzAuthor {
  /** Display name of the author. */
  name?: string;
  /** Email address of the author. */
  email?: string;
}

/**
 * The parsed contents of an MDZ `manifest.json` file.
 * All fields except `mdz` are optional per the specification.
 *
 * @see https://github.com/kylemwhite/markdownzip-spec/blob/main/SPEC.md section 6
 */
export interface MdzManifest {
  /** Spec version that the archive was produced against (e.g. "1.0.0"). */
  mdz: string;
  /** Human-readable document title. */
  title?: string;
  /** Relative path inside the archive to the primary Markdown file. */
  entryPoint?: string;
  /** BCP 47 language tag (e.g. "en", "fr-CA"). */
  language?: string;
  /** List of document authors. */
  authors?: MdzAuthor[];
  /** Short description of the document. */
  description?: string;
  /** Document version string. */
  version?: string;
  /** ISO 8601 creation datetime. */
  created?: string;
  /** ISO 8601 last-modified datetime. */
  modified?: string;
  /** SPDX license identifier or URL. */
  license?: string;
  /** Search keywords. */
  keywords?: string[];
  /** Relative path to a cover image asset. */
  cover?: string;
}

// ---------------------------------------------------------------------------
// Package
// ---------------------------------------------------------------------------

/**
 * A fully-parsed MDZ archive ready for viewing.
 *
 * `files` contains every entry extracted from the ZIP, keyed by the
 * archive-root-relative forward-slash path (e.g. `"assets/images/cover.png"`).
 * Values are raw `Uint8Array` bytes.
 */
export interface MdzPackage {
  /** All files in the archive, keyed by their archive-relative path. */
  files: Map<string, Uint8Array>;
  /**
   * Parsed `manifest.json`, or `null` if the archive does not include one.
   * Unknown fields are preserved via the index signature for forward compatibility.
   */
  manifest: (MdzManifest & Record<string, unknown>) | null;
  /**
   * Archive-relative path of the resolved entry-point Markdown file
   * (e.g. `"index.md"`).
   */
  entryPoint: string;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * A pluggable Markdown-to-HTML renderer.
 * Implement this interface to swap in your preferred Markdown library.
 */
export interface MarkdownRenderer {
  /**
   * Convert a Markdown string to an HTML string.
   *
   * @param markdown - Raw Markdown source text.
   * @param options  - Optional renderer-specific options.
   * @returns         HTML string.
   */
  render(markdown: string, options?: Record<string, unknown>): string;
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

/** Shared context passed through viewer plugin hooks. */
export interface ViewerPluginContext {
  /** Parsed MDZ archive. */
  pkg: MdzPackage;
  /** Resolved entry-point path used for this render. */
  entryPoint: string;
}

/**
 * Optional viewer plugin hooks that can transform markdown before rendering
 * and HTML after rendering.
 */
export interface ViewerPlugin {
  /** Optional plugin identifier for diagnostics. */
  name?: string;
  /**
   * Transform markdown before the renderer runs.
   * Return the new markdown string; return the input unchanged to no-op.
   */
  transformMarkdown?: (
    markdown: string,
    context: ViewerPluginContext,
  ) => string | Promise<string>;
  /**
   * Transform rendered HTML after the renderer runs.
   * Return the new HTML string; return the input unchanged to no-op.
   */
  transformHtml?: (html: string, context: ViewerPluginContext) => string | Promise<string>;
}

// ---------------------------------------------------------------------------
// Viewer options
// ---------------------------------------------------------------------------

/** Options accepted by {@link MdzViewer.render}. */
export interface RenderOptions {
  /**
   * Override the entry-point file to render.
   * Must be a path present in {@link MdzPackage.files}.
   */
  entryPoint?: string;
  /**
   * Custom Markdown renderer.
   * Defaults to the built-in renderer backed by the `marked` library.
   */
  renderer?: MarkdownRenderer;
  /** Optional plugins applied in declaration order. */
  plugins?: ViewerPlugin[];
}

/** The result produced by {@link MdzViewer.render}. */
export interface RenderResult {
  /** The rendered HTML string. */
  html: string;
  /**
   * The archive-relative path of the Markdown file that was rendered
   * (matches the resolved entry point).
   */
  entryPoint: string;
  /** The parsed manifest, or `null` if not present. */
  manifest: (MdzManifest & Record<string, unknown>) | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Thrown when an MDZ archive cannot be parsed or is structurally invalid. */
export class MdzParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MdzParseError';
  }
}

/** Thrown when no unambiguous entry point can be resolved from the archive. */
export class MdzEntryPointError extends Error {
  /** Archive-relative paths of all available Markdown files, if any. */
  readonly candidates: string[];

  constructor(message: string, candidates: string[] = []) {
    super(message);
    this.name = 'MdzEntryPointError';
    this.candidates = candidates;
  }
}
