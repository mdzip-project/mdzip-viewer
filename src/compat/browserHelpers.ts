export type ZipAsyncKind = 'text' | 'base64' | 'arraybuffer';

export interface ZipEntry {
  name: string;
  dir: boolean;
  async(kind: ZipAsyncKind): Promise<string | ArrayBuffer>;
}

export interface ZipLike {
  files: Record<string, ZipEntry>;
}

export interface ZipFactoryLike {
  loadAsync(data: Blob | ArrayBuffer | Uint8Array): Promise<ZipLike>;
}

export interface ManifestLike {
  mdz: string;
  title: string;
  entryPoint?: string;
}

export interface MdzRenderOptions {
  showNav?: boolean;
  showMenu?: boolean;
  showBreadcrumbs?: boolean;
}

export interface MdzRenderElements {
  nav?: HTMLElement | null;
  menu?: HTMLElement | null;
  breadcrumbs?: HTMLElement | null;
}

interface ResolvedImageEntry {
  entry: ZipEntry;
  resolvedForType: string;
}

type ArchiveBinary = Blob | ArrayBuffer | Uint8Array;

/** Map of lowercase image file extensions to MIME types. */
export const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
};

export class MdzArchiveService {
  public static readonly MIME_TYPES = MIME_TYPES;
  private static readonly SUPPORTED_MDZ_MAJOR = 1;
  private static readonly SEMVER_RE =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  private static readonly entriesCache = new WeakMap<ZipLike, Record<string, ZipEntry>>();
  private static readonly manifestCache = new WeakMap<ZipLike, ManifestLike | null>();

  public constructor(private readonly zip: ZipLike) {}

  public static async open(input: ArchiveBinary, zipFactory?: ZipFactoryLike): Promise<MdzArchiveService> {
    const factory = zipFactory ?? MdzArchiveService.getDefaultZipFactory();
    const zip = await factory.loadAsync(input);
    return new MdzArchiveService(zip);
  }

  private static getDefaultZipFactory(): ZipFactoryLike {
    const candidate = (globalThis as Record<string, unknown>).JSZip as ZipFactoryLike | undefined;
    if (!candidate || typeof candidate.loadAsync !== 'function') {
      throw new Error('ERR_ZIP_RUNTIME_MISSING: JSZip.loadAsync is not available on globalThis.');
    }
    return candidate;
  }

  private static dirOf(filePath: string): string {
    const i = filePath.lastIndexOf('/');
    return i >= 0 ? filePath.slice(0, i + 1) : '';
  }

  public static resolvePath(base: string, relative: string): string {
    let target = String(relative || '').trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1).trim();
    }

    const q = target.indexOf('?');
    if (q >= 0) target = target.slice(0, q);
    const h = target.indexOf('#');
    if (h >= 0) target = target.slice(0, h);

    try {
      target = decodeURI(target);
    } catch {
      // Keep original if malformed.
    }

    target = target.replace(/\\/g, '/');
    if (target.startsWith('/')) throw new Error('Path must be relative');
    const parts = (MdzArchiveService.dirOf(base) + target).split('/');
    const out: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        if (out.length === 0) throw new Error('Path escapes archive root');
        out.pop();
        continue;
      }
      if (part === '.') continue;
      out.push(part);
    }

    return out.join('/');
  }

  public resolvePath(base: string, relative: string): string {
    return MdzArchiveService.resolvePath(base, relative);
  }

  public findEntry(path: string): ZipEntry | null {
    const normalized = path.replace(/\\/g, '/').replace(/^\//, '');
    if (this.zip.files[normalized]) return this.zip.files[normalized];

    if (!MdzArchiveService.entriesCache.has(this.zip)) {
      MdzArchiveService.entriesCache.set(
        this.zip,
        Object.fromEntries(
          Object.entries(this.zip.files).map(([key, value]) => [key.replace(/\\/g, '/').toLowerCase(), value]),
        ),
      );
    }

    return MdzArchiveService.entriesCache.get(this.zip)?.[normalized.toLowerCase()] ?? null;
  }

  private static validateManifest(manifest: unknown): asserts manifest is ManifestLike {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json must be a JSON object.');
    }

    const candidate = manifest as Partial<ManifestLike>;
    if (typeof candidate.mdz !== 'string' || !MdzArchiveService.SEMVER_RE.test(candidate.mdz)) {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json must include a valid semver "mdz" field.');
    }
    if (typeof candidate.title !== 'string' || candidate.title.trim() === '') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json must include a non-empty "title" field.');
    }

    const major = Number.parseInt(candidate.mdz.split('.')[0] ?? '0', 10);
    if (major > MdzArchiveService.SUPPORTED_MDZ_MAJOR) {
      throw new Error(
        `ERR_VERSION_UNSUPPORTED: manifest.json targets mdz ${candidate.mdz}, but this viewer supports major ${MdzArchiveService.SUPPORTED_MDZ_MAJOR}.x only.`,
      );
    }

    if (candidate.entryPoint != null && typeof candidate.entryPoint !== 'string') {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json "entryPoint" must be a string when provided.');
    }
  }

  private validateArchivePaths(): void {
    const controlChars = /[\x00-\x1F\x7F]/;
    const reservedChars = /[\\:*?"<>|]/;

    for (const path of Object.keys(this.zip.files)) {
      if (!path.length) {
        throw new Error('ERR_PATH_INVALID: Archive contains an empty path entry.');
      }
      if (path.startsWith('/')) {
        throw new Error(`ERR_PATH_INVALID: Path "${path}" starts with "/".`);
      }
      if (controlChars.test(path)) {
        throw new Error(`ERR_PATH_INVALID: Path "${path}" contains ASCII control characters.`);
      }
      if (reservedChars.test(path)) {
        throw new Error(`ERR_PATH_INVALID: Path "${path}" contains OS-reserved characters.`);
      }
      if (path.split('/').includes('..')) {
        throw new Error(`ERR_PATH_INVALID: Path "${path}" contains path traversal ("..").`);
      }
    }
  }

  public async readManifest(): Promise<ManifestLike | null> {
    if (MdzArchiveService.manifestCache.has(this.zip)) {
      return MdzArchiveService.manifestCache.get(this.zip) ?? null;
    }

    const entry = this.zip.files['manifest.json'];
    if (!entry) {
      MdzArchiveService.manifestCache.set(this.zip, null);
      return null;
    }

    const manifestText = await entry.async('text');
    let manifest: unknown;
    try {
      manifest = JSON.parse(String(manifestText));
    } catch {
      throw new Error('ERR_MANIFEST_INVALID: manifest.json is not valid JSON');
    }

    MdzArchiveService.validateManifest(manifest);
    MdzArchiveService.manifestCache.set(this.zip, manifest);
    return manifest;
  }

  public async resolveEntryPoint(): Promise<string> {
    this.validateArchivePaths();

    const manifest = await this.readManifest();
    if (manifest?.entryPoint) {
      if (manifest.entryPoint.startsWith('/')) {
        throw new Error(
          'ERR_MANIFEST_INVALID: manifest.json "entryPoint" must be archive-relative and must not start with "/".',
        );
      }
      if (manifest.entryPoint.split('/').includes('..')) {
        throw new Error('ERR_MANIFEST_INVALID: manifest.json "entryPoint" must not contain path traversal ("..").');
      }
      if (this.zip.files[manifest.entryPoint]) return manifest.entryPoint;
      throw new Error(`ERR_ENTRYPOINT_MISSING: manifest.json references "${manifest.entryPoint}" which is not in the archive`);
    }

    const rootMd = Object.keys(this.zip.files)
      .filter((p) => {
        const entry = this.zip.files[p];
        if (!entry) return false;
        return !entry.dir && !p.includes('/') && !p.includes('\\') && (p.endsWith('.md') || p.endsWith('.markdown'));
      })
      .sort();

    if (this.zip.files['index.md']) return 'index.md';
    if (rootMd.length === 1) return rootMd[0] as string;

    if (rootMd.length > 1) {
      throw new Error(
        'ERR_ENTRYPOINT_UNRESOLVED: Multiple Markdown files at the archive root and no manifest.json entryPoint. Add an index.md or a manifest.json to specify which file to open first.',
      );
    }

    throw new Error('ERR_ENTRYPOINT_UNRESOLVED: No Markdown file found at the archive root.');
  }

  private findEntryByBasename(fileName: string): ZipEntry | null {
    const target = fileName.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
    if (!target) return null;

    const candidates = Object.entries(this.zip.files)
      .filter(([path, entry]) => !entry.dir && path.replace(/\\/g, '/').split('/').pop()?.toLowerCase() === target)
      .sort((a, b) => a[0].length - b[0].length);

    const first = candidates[0];
    return first ? first[1] : null;
  }

  private static normaliseLinkTarget(raw: string): string {
    let target = String(raw || '').trim();
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1).trim();
    }
    const q = target.indexOf('?');
    if (q >= 0) target = target.slice(0, q);
    const h = target.indexOf('#');
    if (h >= 0) target = target.slice(0, h);
    try {
      target = decodeURI(target);
    } catch {
      // Keep original if malformed.
    }
    target = target.replace(/\\/g, '/').replace(/^\.\//, '');
    return target;
  }

  private findEntryBySuffix(pathSuffix: string): ZipEntry | null {
    const target = pathSuffix.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
    if (!target) return null;
    const candidates = Object.entries(this.zip.files)
      .filter(([path, entry]) => {
        if (entry.dir) return false;
        const norm = path.replace(/\\/g, '/').toLowerCase();
        return norm === target || norm.endsWith('/' + target);
      })
      .sort((a, b) => a[0].length - b[0].length);
    const first = candidates[0];
    return first ? first[1] : null;
  }

  private static normaliseNameForLookup(name: string): string {
    return name
      .toLowerCase()
      .replace(/%20/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static fileStem(name: string): string {
    return name.replace(/\.[^/.]+$/, '');
  }

  private findEntryByStem(fileRef: string): ZipEntry | null {
    const rawBase = fileRef.replace(/\\/g, '/').split('/').pop() || fileRef;
    const targetStem = MdzArchiveService.normaliseNameForLookup(MdzArchiveService.fileStem(rawBase));
    if (!targetStem) return null;

    const candidates = Object.entries(this.zip.files)
      .filter(([path, entry]) => {
        if (entry.dir) return false;
        const base = path.replace(/\\/g, '/').split('/').pop() || path;
        return MdzArchiveService.normaliseNameForLookup(MdzArchiveService.fileStem(base)) === targetStem;
      })
      .sort((a, b) => a[0].length - b[0].length);

    const first = candidates[0];
    return first ? first[1] : null;
  }

  private resolveImageEntry(rawRef: string, filePath: string): ResolvedImageEntry | null {
    const normalizedSrc = MdzArchiveService.normaliseLinkTarget(rawRef);
    let entry: ZipEntry | null = null;
    let resolvedForType = normalizedSrc;

    try {
      const resolved = MdzArchiveService.resolvePath(filePath, normalizedSrc);
      entry = this.findEntry(resolved);
      resolvedForType = resolved;
    } catch {
      // Keep trying broader fallbacks below.
    }

    if (!entry) {
      entry = this.findEntry(normalizedSrc);
    }
    if (!entry && !normalizedSrc.includes('/')) {
      entry = this.findEntryByBasename(normalizedSrc);
    }
    if (!entry) {
      entry = this.findEntryBySuffix(normalizedSrc);
    }
    if (!entry) {
      entry = this.findEntryByStem(normalizedSrc);
    }
    if (!entry) return null;

    return { entry, resolvedForType };
  }

  public async resolveImagesInElement(el: Element, filePath: string): Promise<void> {
    const images = el.querySelectorAll('img');

    await Promise.all(
      Array.from(images).map(async (imageNode) => {
        const img = imageNode as HTMLImageElement;
        const src = img.getAttribute('data-src');
        const existingSrc = img.getAttribute('src');
        const altText = img.getAttribute('alt') || '';

        if (existingSrc && (existingSrc.startsWith('http') || existingSrc.startsWith('data:'))) {
          return;
        }

        const rawRef = src || (!existingSrc && altText ? altText : '');
        if (!rawRef) return;
        if (rawRef.startsWith('http') || rawRef.startsWith('data:')) {
          if (!existingSrc) img.setAttribute('src', rawRef);
          return;
        }

        const resolved = this.resolveImageEntry(rawRef, filePath);
        if (!resolved) return;

        try {
          const ext =
            resolved.entry.name.replace(/\\/g, '/').split('.').pop()?.toLowerCase() ??
            resolved.resolvedForType.split('.').pop()?.toLowerCase() ??
            '';
          const type = MIME_TYPES[ext];
          if (!type) return;
          const base64 = await resolved.entry.async('base64');
          img.setAttribute('src', `data:${type};base64,${String(base64)}`);
          if (src) img.removeAttribute('data-src');
        } catch {
          // Leave unresolved image as-is.
        }
      }),
    );
  }
}

export class MdzDocumentRenderer {
  private options: MdzRenderOptions = {};

  public constructor(private readonly archive: MdzArchiveService) {}

  public setOptions(options: MdzRenderOptions): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public applyViewOptions(options: MdzRenderOptions, elements: MdzRenderElements): void {
    this.setOptions(options);
    this.applyCurrentViewOptions(elements);
  }

  public applyCurrentViewOptions(elements: MdzRenderElements): void {
    const options = this.options;

    if (options.showNav != null && elements.nav) {
      elements.nav.hidden = !options.showNav;
    }
    if (options.showMenu != null && elements.menu) {
      elements.menu.hidden = !options.showMenu;
    }
    if (options.showBreadcrumbs != null && elements.breadcrumbs) {
      elements.breadcrumbs.hidden = !options.showBreadcrumbs;
    }
  }

  public async resolveImagesInElement(el: Element, filePath: string): Promise<void> {
    return this.archive.resolveImagesInElement(el, filePath);
  }
}

export class MdzReader {
  public readonly archive: MdzArchiveService;
  public readonly renderer: MdzDocumentRenderer;

  public constructor(zipOrArchive: ZipLike | MdzArchiveService) {
    this.archive = zipOrArchive instanceof MdzArchiveService ? zipOrArchive : new MdzArchiveService(zipOrArchive);
    this.renderer = new MdzDocumentRenderer(this.archive);
  }

  public findEntry(path: string): ZipEntry | null {
    return this.archive.findEntry(path);
  }

  public async resolveEntryPoint(): Promise<string> {
    return this.archive.resolveEntryPoint();
  }

  public async resolveImages(el: Element, filePath: string): Promise<void> {
    return this.renderer.resolveImagesInElement(el, filePath);
  }

  public static resolvePath(base: string, relative: string): string {
    return MdzArchiveService.resolvePath(base, relative);
  }

  public static async open(input: ArchiveBinary, zipFactory?: ZipFactoryLike): Promise<MdzReader> {
    const archive = await MdzArchiveService.open(input, zipFactory);
    return new MdzReader(archive);
  }
}

export function findEntry(zip: ZipLike, path: string): ZipEntry | null {
  return new MdzReader(zip).findEntry(path);
}

export async function resolveEntryPoint(zip: ZipLike): Promise<string> {
  return new MdzReader(zip).resolveEntryPoint();
}

export async function resolveImages(zip: ZipLike, el: Element, filePath: string): Promise<void> {
  return new MdzReader(zip).resolveImages(el, filePath);
}

export function resolvePath(base: string, relative: string): string {
  return MdzReader.resolvePath(base, relative);
}

export const mdzReaderApi = {
  MdzArchiveService,
  MdzDocumentRenderer,
  MdzReader,
  MIME_TYPES,
  findEntry,
  resolveEntryPoint,
  resolveImages,
  resolvePath,
};

export function installBrowserGlobals(): void {
  Object.assign(globalThis as Record<string, unknown>, mdzReaderApi);
}
