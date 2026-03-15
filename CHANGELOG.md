# Changelog

All notable changes to `mdz-viewer` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Initial scaffold for `mdz-viewer` npm package.
- `readMdz(data)` — parse a raw `.mdz` (ZIP) binary into an `MdzPackage` with
  file map, manifest, and resolved entry point.
- `readFileAsText(pkg, path)` — decode an archived file to a UTF-8 string.
- `MdzViewer.render(data, options?)` — high-level API that reads and renders an
  MDZ archive to HTML in one call.
- `MarkedRenderer` — default Markdown renderer backed by the `marked` library.
- Pluggable `MarkdownRenderer` interface for custom rendering backends.
- `loadFromBlob(file)` / `loadFromUrl(url)` — environment adapters for loading
  `.mdz` bytes from browser `File`/`Blob` or a URL.
- `MdzParseError` and `MdzEntryPointError` custom error classes.
- Entry-point discovery per MDZ spec §5.5 (manifest → index.md → single root
  `.md` → error).
- Full CI pipeline (lint, typecheck, test, build) via GitHub Actions.
- ESM-only output with TypeScript declarations and source maps.

### Migration note

Viewer functionality moved from `markdownzip.org` into this standalone package.
