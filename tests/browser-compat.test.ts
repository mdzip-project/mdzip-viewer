import { describe, it, expect } from 'vitest';
import {
  MdzReader,
  findEntry,
  resolveEntryPoint,
  resolveImages,
  resolvePath,
  type ZipEntry,
  type ZipLike,
} from '../src/index.js';

function makeEntry(name: string, text: string, base64 = ''): ZipEntry {
  return {
    name,
    dir: false,
    async: async (kind): Promise<string | ArrayBuffer> => {
      if (kind === 'text') return text;
      if (kind === 'base64') return base64;
      return new TextEncoder().encode(text).buffer;
    },
  };
}

function makeZip(entries: Record<string, ZipEntry>): ZipLike {
  return { files: entries };
}

class FakeImageElement {
  private attrs: Record<string, string> = {};

  public constructor(initial: Record<string, string>) {
    this.attrs = { ...initial };
  }

  public getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  public setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  public removeAttribute(name: string): void {
    delete this.attrs[name];
  }
}

class FakeContainerElement {
  public constructor(private readonly imgs: FakeImageElement[]) {}

  public querySelectorAll(_selector: string): FakeImageElement[] {
    return this.imgs;
  }
}

describe('browser compatibility helpers', () => {
  it('resolves path and entrypoint with strict manifest behavior', async () => {
    const zip = makeZip({
      'manifest.json': makeEntry('manifest.json', JSON.stringify({ mdz: '1.0.0', title: 'Doc', entryPoint: 'chapters/start.md' })),
      'chapters/start.md': makeEntry('chapters/start.md', '# Start'),
      'index.md': makeEntry('index.md', '# Index'),
    });

    expect(resolvePath('chapters/start.md', '../assets/img.png')).toBe('assets/img.png');
    await expect(resolveEntryPoint(zip)).resolves.toBe('chapters/start.md');
    expect(findEntry(zip, 'INDEX.md')?.name).toBe('index.md');
    expect(MdzReader.resolvePath('index.md', './child.md')).toBe('child.md');
  });

  it('resolves images in an element and sets data URI for known image extensions', async () => {
    const zip = makeZip({
      'index.md': makeEntry('index.md', '# Doc'),
      'assets/image.png': makeEntry('assets/image.png', '', 'ZmFrZQ=='),
    });
    const img = new FakeImageElement({ 'data-src': 'assets/image.png', alt: '' });
    const container = new FakeContainerElement([img]);

    await resolveImages(zip, container as unknown as Element, 'index.md');

    expect(img.getAttribute('src')).toBe('data:image/png;base64,ZmFrZQ==');
    expect(img.getAttribute('data-src')).toBeNull();
  });

  it('throws legacy-style validation errors for invalid manifest', async () => {
    const zip = makeZip({
      'manifest.json': makeEntry('manifest.json', JSON.stringify({ title: 'Missing mdz' })),
      'index.md': makeEntry('index.md', '# Index'),
    });

    await expect(resolveEntryPoint(zip)).rejects.toThrow(/ERR_MANIFEST_INVALID/);
  });
});
