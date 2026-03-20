# mdz-viewer

> Render MarkdownZip (`.mdz`) files to HTML, powered by `mdz-core-js`.

[![CI](https://github.com/kylemwhite/mdz-reader/actions/workflows/ci.yml/badge.svg)](https://github.com/kylemwhite/mdz-reader/actions/workflows/ci.yml)

This package provides a high-level MDZ viewer API for applications.
It uses `mdz-core-js` for archive extraction and core MDZ logic, then adds
rendering, adapters, and a viewer-focused developer experience.

## Install

```sh
npm install mdz-viewer (not yet)
```

Requires **Node.js ≥ 18** (or a modern browser with Fetch + `arrayBuffer` support).

## Quick Usage

```ts
import { MdzViewer } from 'mdz-viewer';

// Load an .mdz file from a URL
const bytes  = await fetch('example.mdz').then(r => r.arrayBuffer());
const result = await new MdzViewer().render(new Uint8Array(bytes));

console.log(result.html);        // Rendered HTML string
console.log(result.entryPoint);  // "index.md"
console.log(result.manifest);    // Parsed manifest.json, or null
```

### Browser — file input

```ts
import { loadFromBlob } from 'mdz-viewer';
import { MdzViewer }    from 'mdz-viewer';

document.querySelector('input[type="file"]')!.addEventListener('change', async (e) => {
  const file   = (e.target as HTMLInputElement).files![0];
  const bytes  = await loadFromBlob(file);
  const result = await new MdzViewer().render(bytes);
  document.getElementById('content')!.innerHTML = result.html;
});
```

### Low-level API

```ts
import { readMdz, readFileAsText } from 'mdz-viewer';

const pkg      = await readMdz(bytes);
const markdown = readFileAsText(pkg, pkg.entryPoint);
console.log(pkg.files.size);    // Number of files in the archive
console.log(pkg.manifest?.mdz); // Spec version from manifest.json
```

### Custom Markdown renderer

```ts
import { MdzViewer }       from 'mdz-viewer';
import type { MarkdownRenderer } from 'mdz-viewer';

const customRenderer: MarkdownRenderer = {
  render(markdown: string): string {
    // Use any Markdown library you prefer
    return myMarkdownLib.render(markdown);
  },
};

const result = await new MdzViewer().render(bytes, { renderer: customRenderer });
```

## API

### `MdzViewer`

| Method | Description |
|--------|-------------|
| `render(data, options?)` | Parse a `.mdz` `Uint8Array` and render its entry-point to HTML. Returns a `Promise<RenderResult>`. |

### `readMdz(data)`

Parses a raw `.mdz` binary into an `MdzPackage` (files map, manifest, entryPoint).
Returns `Promise<MdzPackage>`.

### `readFileAsText(pkg, path)`

Decodes a file from a parsed `MdzPackage` to a UTF-8 string.

### `loadFromBlob(file)` / `loadFromUrl(url, init?)`

Environment adapters to load `.mdz` bytes from a `Blob`/`File` or a URL.

### `setDefaultRenderer(renderer)` / `getDefaultRenderer()`

Replace or retrieve the global default Markdown renderer (default: `MarkedRenderer` backed by `marked`).

## Module layout

```
src/
  index.ts          ← public API entry point
  types.ts          ← shared types and error classes
  reader/           ← ZIP parsing + entry-point discovery
  viewer/           ← high-level render API
  rendering/        ← Markdown → HTML (pluggable)
  adapters/         ← environment helpers (Blob, URL)
```

## Environment notes

- **reader / viewer / rendering** — environment-agnostic; accept `Uint8Array`.
- **adapters** — use browser/Node APIs (`Blob.arrayBuffer`, `fetch`). Available
  in browsers and Node.js ≥ 18.
- Rendered HTML is **not sanitized**. Sanitize output before inserting it into
  the DOM when the MDZ source is untrusted.

## Development

```sh
npm install        # install dependencies
npm run verify     # lint + typecheck + test + build
npm test           # run unit tests only
npm run build      # compile to dist/
```

## License

Apache-2.0 — see [LICENSE](LICENSE).

