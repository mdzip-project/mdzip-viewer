# Release Checklist — v0.1.0

Use this checklist before cutting the first public release of `mdz-viewer`.

## Pre-release

- [ ] All tests pass locally: `npm run verify`
- [ ] CI is green on `main` branch
- [ ] `package.json` version is set correctly (e.g. `0.1.0`)
- [ ] `CHANGELOG.md` entry is complete for the release version
- [ ] `README.md` is up to date (install instructions, API table, examples)
- [ ] `LICENSE` file is present and correct
- [ ] `files` field in `package.json` contains only what should be published
  - `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`
- [ ] `exports` and `types` fields in `package.json` are correct
- [ ] Source maps are included in `dist/`
- [ ] TypeScript declarations (`.d.ts`) are included in `dist/`
- [ ] No `node_modules/`, `tests/`, or `src/` in the published tarball
  - Verify with `npm pack --dry-run`

## Dependency review

- [ ] All `dependencies` are intentional (end-user installs them)
- [ ] All `devDependencies` are correctly scoped to development
- [ ] No known vulnerabilities: `npm audit`

## npm publish

- [ ] Logged in to npm as the correct user/org: `npm whoami`
- [ ] Dry-run passes: `npm publish --dry-run`
- [ ] Publish: `npm publish --access public`
- [ ] Verify the published package on npmjs.com

## Post-release

- [ ] Create a GitHub release tagged `v0.1.0` with CHANGELOG notes
- [ ] Update `CHANGELOG.md` to add a new `[Unreleased]` section
- [ ] Bump version in `package.json` to the next development version

## Open decisions / risks

- **Browser build**: The current output is a single ESM bundle. If consumers
  need a standalone browser UMD/IIFE build, a separate tsup entry will be
  needed.
- **Sanitization**: Rendered HTML is not sanitized. Document the security
  responsibility in README if MDZ files from untrusted sources are a use case.
- **CJS support**: ESM-only for now. Add `format: ['esm', 'cjs']` to
  `tsup.config.ts` if CJS compatibility is required.
- **`mdz-core-js` dependency**: If a separate `mdz-core-js` package is
  published, consider whether the ZIP-reading logic in this package should
  delegate to it to avoid duplication.
