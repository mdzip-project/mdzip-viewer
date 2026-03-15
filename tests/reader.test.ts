import { describe, it, expect } from 'vitest';
import { readMdz, readFileAsText } from '../src/reader/index.js';
import { MdzParseError, MdzEntryPointError } from '../src/types.js';
import { makeZip, encode, minimalManifest } from './helpers.js';

// ---------------------------------------------------------------------------
// readMdz — basic parsing
// ---------------------------------------------------------------------------

describe('readMdz', () => {
  it('parses a minimal archive with index.md', async () => {
    const zip = await makeZip({ 'index.md': '# Hello' });
    const pkg = await readMdz(zip);

    expect(pkg.entryPoint).toBe('index.md');
    expect(pkg.manifest).toBeNull();
    expect(pkg.files.has('index.md')).toBe(true);
  });

  it('includes all files in the files map', async () => {
    const zip = await makeZip({
      'index.md': '# Hello',
      'assets/image.png': 'fake-png-bytes',
    });
    const pkg = await readMdz(zip);

    expect(pkg.files.size).toBe(2);
    expect(pkg.files.has('assets/image.png')).toBe(true);
  });

  it('throws MdzParseError for non-ZIP data', () => {
    const notAZip = encode('not a zip file');
    return expect(readMdz(notAZip)).rejects.toThrow(MdzParseError);
  });

  it('throws MdzParseError with helpful message', () => {
    const notAZip = encode('garbage');
    return expect(readMdz(notAZip)).rejects.toThrow(/Failed to open MDZ archive/);
  });
});

// ---------------------------------------------------------------------------
// readMdz — entry-point discovery (spec §5.5)
// ---------------------------------------------------------------------------

describe('readMdz — entry-point discovery', () => {
  it('step 1: honours manifest.json entryPoint', async () => {
    const zip = await makeZip({
      'manifest.json': minimalManifest({ entryPoint: 'chapter-01.md' }),
      'chapter-01.md': '# Chapter 1',
      'index.md': '# Index (should be ignored)',
    });
    const pkg = await readMdz(zip);
    expect(pkg.entryPoint).toBe('chapter-01.md');
  });

  it('step 1: falls through to step 2 when manifest entryPoint references missing file', async () => {
    const zip = await makeZip({
      'manifest.json': minimalManifest({ entryPoint: 'missing.md' }),
      'index.md': '# Index',
    });
    const pkg = await readMdz(zip);
    expect(pkg.entryPoint).toBe('index.md');
  });

  it('step 2: uses index.md at root when no manifest entryPoint', async () => {
    const zip = await makeZip({ 'index.md': '# Index' });
    const pkg = await readMdz(zip);
    expect(pkg.entryPoint).toBe('index.md');
  });

  it('step 3: uses single root .md file when no index.md', async () => {
    const zip = await makeZip({ 'readme.md': '# Readme' });
    const pkg = await readMdz(zip);
    expect(pkg.entryPoint).toBe('readme.md');
  });

  it('step 3: uses single root .markdown file', async () => {
    const zip = await makeZip({ 'doc.markdown': '# Doc' });
    const pkg = await readMdz(zip);
    expect(pkg.entryPoint).toBe('doc.markdown');
  });

  it('step 3: ignores .md files inside subdirectories when counting root files', async () => {
    const zip = await makeZip({
      'main.md': '# Main',
      'chapters/one.md': '# One',
    });
    const pkg = await readMdz(zip);
    expect(pkg.entryPoint).toBe('main.md');
  });

  it('step 4: throws MdzEntryPointError when multiple root .md files exist', async () => {
    const zip = await makeZip({
      'chapter-01.md': '# Ch 1',
      'chapter-02.md': '# Ch 2',
    });
    await expect(readMdz(zip)).rejects.toThrow(MdzEntryPointError);
  });

  it('step 4: includes candidate list in MdzEntryPointError', async () => {
    const zip = await makeZip({
      'a.md': '# A',
      'b.md': '# B',
    });
    try {
      await readMdz(zip);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MdzEntryPointError);
      const e = err as MdzEntryPointError;
      expect(e.candidates).toContain('a.md');
      expect(e.candidates).toContain('b.md');
    }
  });

  it('step 4: throws MdzEntryPointError when no Markdown at root', async () => {
    const zip = await makeZip({ 'assets/image.png': 'bytes' });
    await expect(readMdz(zip)).rejects.toThrow(MdzEntryPointError);
  });
});

// ---------------------------------------------------------------------------
// readMdz — manifest parsing
// ---------------------------------------------------------------------------

describe('readMdz — manifest parsing', () => {
  it('parses a well-formed manifest.json', async () => {
    const manifest = {
      mdz: '1.0.0',
      title: 'My Doc',
      description: 'A test',
      authors: [{ name: 'Alice', email: 'alice@example.com' }],
    };
    const zip = await makeZip({
      'manifest.json': JSON.stringify(manifest),
      'index.md': '# Hello',
    });
    const pkg = await readMdz(zip);

    expect(pkg.manifest).not.toBeNull();
    expect(pkg.manifest?.mdz).toBe('1.0.0');
    expect(pkg.manifest?.title).toBe('My Doc');
    expect(pkg.manifest?.authors).toHaveLength(1);
  });

  it('returns null manifest when manifest.json is malformed JSON', async () => {
    const zip = await makeZip({
      'manifest.json': 'not valid json {{{',
      'index.md': '# Hello',
    });
    const pkg = await readMdz(zip);
    expect(pkg.manifest).toBeNull();
  });

  it('returns null manifest when manifest.json has no required "mdz" field', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({ title: 'No mdz field' }),
      'index.md': '# Hello',
    });
    const pkg = await readMdz(zip);
    expect(pkg.manifest).toBeNull();
  });

  it('preserves unknown fields on the manifest for forward compatibility', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({ mdz: '1.0.0', futureField: 42 }),
      'index.md': '# Hello',
    });
    const pkg = await readMdz(zip);
    expect((pkg.manifest as Record<string, unknown>)['futureField']).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// readFileAsText
// ---------------------------------------------------------------------------

describe('readFileAsText', () => {
  it('returns the decoded content of an existing file', async () => {
    const zip = await makeZip({ 'index.md': '# Hello World' });
    const pkg = await readMdz(zip);
    const text = readFileAsText(pkg, 'index.md');
    expect(text).toBe('# Hello World');
  });

  it('throws when the requested path does not exist', async () => {
    const zip = await makeZip({ 'index.md': '# Hello' });
    const pkg = await readMdz(zip);
    expect(() => readFileAsText(pkg, 'nonexistent.md')).toThrow(/not found/i);
  });
});
