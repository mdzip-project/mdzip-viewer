import { describe, it, expect } from 'vitest';
import { readMdz, readFileAsText } from '../src/reader/index.js';
import { MdzParseError, MdzEntryPointError } from '../src/types.js';
import { makeZip, encode, minimalManifest } from './helpers.js';

// ---------------------------------------------------------------------------
// readMdz — basic parsing
// ---------------------------------------------------------------------------

describe('readMdz', () => {
  it('parses a minimal archive with index.md', () => {
    const zip = makeZip({ 'index.md': '# Hello' });
    const pkg = readMdz(zip);

    expect(pkg.entryPoint).toBe('index.md');
    expect(pkg.manifest).toBeNull();
    expect(pkg.files.has('index.md')).toBe(true);
  });

  it('includes all files in the files map', () => {
    const zip = makeZip({
      'index.md': '# Hello',
      'assets/image.png': 'fake-png-bytes',
    });
    const pkg = readMdz(zip);

    expect(pkg.files.size).toBe(2);
    expect(pkg.files.has('assets/image.png')).toBe(true);
  });

  it('throws MdzParseError for non-ZIP data', () => {
    const notAZip = encode('not a zip file');
    expect(() => readMdz(notAZip)).toThrow(MdzParseError);
  });

  it('throws MdzParseError with helpful message', () => {
    const notAZip = encode('garbage');
    expect(() => readMdz(notAZip)).toThrow(/Failed to unzip/);
  });
});

// ---------------------------------------------------------------------------
// readMdz — entry-point discovery (spec §5.5)
// ---------------------------------------------------------------------------

describe('readMdz — entry-point discovery', () => {
  it('step 1: honours manifest.json entryPoint', () => {
    const zip = makeZip({
      'manifest.json': minimalManifest({ entryPoint: 'chapter-01.md' }),
      'chapter-01.md': '# Chapter 1',
      'index.md': '# Index (should be ignored)',
    });
    const pkg = readMdz(zip);
    expect(pkg.entryPoint).toBe('chapter-01.md');
  });

  it('step 1: falls through to step 2 when manifest entryPoint references missing file', () => {
    const zip = makeZip({
      'manifest.json': minimalManifest({ entryPoint: 'missing.md' }),
      'index.md': '# Index',
    });
    const pkg = readMdz(zip);
    expect(pkg.entryPoint).toBe('index.md');
  });

  it('step 2: uses index.md at root when no manifest entryPoint', () => {
    const zip = makeZip({ 'index.md': '# Index' });
    const pkg = readMdz(zip);
    expect(pkg.entryPoint).toBe('index.md');
  });

  it('step 3: uses single root .md file when no index.md', () => {
    const zip = makeZip({ 'readme.md': '# Readme' });
    const pkg = readMdz(zip);
    expect(pkg.entryPoint).toBe('readme.md');
  });

  it('step 3: uses single root .markdown file', () => {
    const zip = makeZip({ 'doc.markdown': '# Doc' });
    const pkg = readMdz(zip);
    expect(pkg.entryPoint).toBe('doc.markdown');
  });

  it('step 3: ignores .md files inside subdirectories when counting root files', () => {
    const zip = makeZip({
      'main.md': '# Main',
      'chapters/one.md': '# One',
    });
    const pkg = readMdz(zip);
    expect(pkg.entryPoint).toBe('main.md');
  });

  it('step 4: throws MdzEntryPointError when multiple root .md files exist', () => {
    const zip = makeZip({
      'chapter-01.md': '# Ch 1',
      'chapter-02.md': '# Ch 2',
    });
    expect(() => readMdz(zip)).toThrow(MdzEntryPointError);
  });

  it('step 4: includes candidate list in MdzEntryPointError', () => {
    const zip = makeZip({
      'a.md': '# A',
      'b.md': '# B',
    });
    try {
      readMdz(zip);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MdzEntryPointError);
      const e = err as MdzEntryPointError;
      expect(e.candidates).toContain('a.md');
      expect(e.candidates).toContain('b.md');
    }
  });

  it('step 4: throws MdzEntryPointError when no Markdown at root', () => {
    const zip = makeZip({ 'assets/image.png': 'bytes' });
    expect(() => readMdz(zip)).toThrow(MdzEntryPointError);
  });
});

// ---------------------------------------------------------------------------
// readMdz — manifest parsing
// ---------------------------------------------------------------------------

describe('readMdz — manifest parsing', () => {
  it('parses a well-formed manifest.json', () => {
    const manifest = {
      mdz: '1.0.0',
      title: 'My Doc',
      description: 'A test',
      authors: [{ name: 'Alice', email: 'alice@example.com' }],
    };
    const zip = makeZip({
      'manifest.json': JSON.stringify(manifest),
      'index.md': '# Hello',
    });
    const pkg = readMdz(zip);

    expect(pkg.manifest).not.toBeNull();
    expect(pkg.manifest?.mdz).toBe('1.0.0');
    expect(pkg.manifest?.title).toBe('My Doc');
    expect(pkg.manifest?.authors).toHaveLength(1);
  });

  it('returns null manifest when manifest.json is malformed JSON', () => {
    const zip = makeZip({
      'manifest.json': 'not valid json {{{',
      'index.md': '# Hello',
    });
    const pkg = readMdz(zip);
    expect(pkg.manifest).toBeNull();
  });

  it('returns null manifest when manifest.json has no required "mdz" field', () => {
    const zip = makeZip({
      'manifest.json': JSON.stringify({ title: 'No mdz field' }),
      'index.md': '# Hello',
    });
    const pkg = readMdz(zip);
    expect(pkg.manifest).toBeNull();
  });

  it('preserves unknown fields on the manifest for forward compatibility', () => {
    const zip = makeZip({
      'manifest.json': JSON.stringify({ mdz: '1.0.0', futureField: 42 }),
      'index.md': '# Hello',
    });
    const pkg = readMdz(zip);
    expect((pkg.manifest as Record<string, unknown>)['futureField']).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// readFileAsText
// ---------------------------------------------------------------------------

describe('readFileAsText', () => {
  it('returns the decoded content of an existing file', () => {
    const zip = makeZip({ 'index.md': '# Hello World' });
    const pkg = readMdz(zip);
    const text = readFileAsText(pkg, 'index.md');
    expect(text).toBe('# Hello World');
  });

  it('throws when the requested path does not exist', () => {
    const zip = makeZip({ 'index.md': '# Hello' });
    const pkg = readMdz(zip);
    expect(() => readFileAsText(pkg, 'nonexistent.md')).toThrow(/not found/i);
  });
});
