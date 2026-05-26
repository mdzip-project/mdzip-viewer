# Repo Comparison

| repo | file extension | status/version | entry point / required file | manifest required? | multi-md? | MIME type | implementations / notes |
|---|---|---|---|---|---|---|---|
| [kylemwhite/markdownzip-spec](https://github.com/kylemwhite/markdownzip-spec) | .mdz | Spec (draft v1.0.1) | `manifest.json` with `entryPoint`, else `index.md`, else a single root `.md`/`.markdown` file | No (optional) | Yes | `application/vnd.markdownzip` | Spec only (no viewer/editor in repo) |
| [danielsimonjr/mdx](https://github.com/danielsimonjr/mdx/blob/master/spec/MDX_FORMAT_SPECIFICATION_v1.1.md) | .mdx (alt `.mdxc`) | Spec (draft v1.1.0) | `manifest.json` + `document.md` required; `content.entry_point` required | Yes | Yes (`content.additional_files`) | `application/vnd.mdx-container+zip` | Implementations/examples live in repo (`implementations/`, `examples/`) |
| [mdz-format/mdz](https://github.com/mdz-format/mdz) | .mdz | Spec v1.0 | `main.md` required | No (not in spec) | No (single `main.md`) | `application/mdz+zip` | `mdz-core` and `mdz-cli` in repo |

## Compatibility Narrative

### MDX (Markdown eXtended Container)
MarkdownZip (`.mdz`, per this repo’s spec) is not directly compatible with MDX containers, but **there are narrow cases where a reader could still open the primary content**:
1. **MarkdownZip reader opening MDX:** If the MDX archive has exactly one root Markdown file and it is discoverable by the MarkdownZip entry-point rules (for example, only `document.md` exists at the root and there is no ambiguity), a MarkdownZip reader may open it even though the MDX manifest schema is different. If there are multiple root Markdown files, MarkdownZip will require an MDZ-style `manifest.json` `entryPoint` or `index.md`, which MDX does not provide.
2. **MDX reader opening MarkdownZip:** This generally fails because MDX requires `manifest.json` and `document.md` at the root. It could only work if a MarkdownZip archive **also** includes a compliant MDX `manifest.json` plus `document.md` that matches the MDX schema.
Bottom line: MDX is only “compatible” with MarkdownZip when one format happens to satisfy the other’s entry-point and required-file rules.

They are compatible if the file has a single `main.md` file, images are stored in `/img` and css is stored in `/css`.

### MDZ (mdz-format/mdz)
Although both use the `.mdz` extension, the formats are not the same. That said, **compatibility can happen in common cases**:
1. **MarkdownZip reader opening mdz-format:** mdz-format requires a single `main.md` at the root. If `main.md` is the only root Markdown file, a MarkdownZip reader will resolve it via the “single root `.md` file” rule and open it. This is likely the common case.
2. **mdz-format reader opening MarkdownZip:** This only works if the MarkdownZip archive includes a root `main.md` and follows mdz-format’s assumptions (for example, `img/` and `css/` if used). If the MarkdownZip package uses a different entry point (`index.md` or a manifest `entryPoint`) and no `main.md`, mdz-format readers will not open it.
Bottom line: mdz-format and MarkdownZip can be compatible when the archive is authored to satisfy both entry-point conventions, but it is not automatic.

### Unverified Rows
The two placeholder rows (`sample-repo-3`, `sample-repo-4`) have no repo links, so compatibility cannot be assessed yet.
