import { describe, it, expect, vi, afterEach } from 'vitest';
import { MdzViewer } from '../src/viewer/index.js';
import { MdzParseError } from '../src/types.js';
import type { MarkdownRenderer } from '../src/types.js';
import { makeZip, encode, minimalManifest } from './helpers.js';

// ---------------------------------------------------------------------------
// MdzViewer.render — happy path
// ---------------------------------------------------------------------------

describe('MdzViewer.render', () => {
  it('renders index.md to HTML', async () => {
    const zip = await makeZip({ 'index.md': '# Hello' });
    const viewer = new MdzViewer();
    const result = await viewer.render(zip);

    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello');
    expect(result.entryPoint).toBe('index.md');
    expect(result.manifest).toBeNull();
  });

  it('returns the manifest when present', async () => {
    const zip = await makeZip({
      'manifest.json': minimalManifest({ title: 'Test Doc' }),
      'index.md': '# Test',
    });
    const result = await new MdzViewer().render(zip);

    expect(result.manifest).not.toBeNull();
    expect(result.manifest?.title).toBe('Test Doc');
  });

  it('renders paragraph Markdown correctly', async () => {
    const zip = await makeZip({ 'index.md': 'Hello **world**.' });
    const result = await new MdzViewer().render(zip);

    expect(result.html).toContain('<strong>world</strong>');
  });

  it('renders inline code', async () => {
    const zip = await makeZip({ 'index.md': 'Call `readMdz()` to parse.' });
    const result = await new MdzViewer().render(zip);

    expect(result.html).toContain('<code>readMdz()</code>');
  });
});

// ---------------------------------------------------------------------------
// MdzViewer.render — options.entryPoint override
// ---------------------------------------------------------------------------

describe('MdzViewer.render — entryPoint override', () => {
  it('renders the overridden entry-point file', async () => {
    const zip = await makeZip({
      'manifest.json': minimalManifest({ entryPoint: 'chapter-01.md' }),
      'chapter-01.md': '# Chapter 1',
      'chapter-02.md': '# Chapter 2',
    });
    const result = await new MdzViewer().render(zip, { entryPoint: 'chapter-02.md' });

    expect(result.html).toContain('Chapter 2');
    expect(result.entryPoint).toBe('chapter-02.md');
  });

  it('throws when the overridden entry-point file is missing', async () => {
    const zip = await makeZip({ 'index.md': '# Hello' });
    await expect(new MdzViewer().render(zip, { entryPoint: 'missing.md' })).rejects.toThrow(
      /not found/i,
    );
  });
});

// ---------------------------------------------------------------------------
// MdzViewer.render — custom renderer
// ---------------------------------------------------------------------------

describe('MdzViewer.render — custom renderer', () => {
  it('uses the provided custom renderer', async () => {
    const customRenderer: MarkdownRenderer = {
      render: vi.fn().mockReturnValue('<p>custom</p>'),
    };
    const zip = await makeZip({ 'index.md': '# Hello' });
    const result = await new MdzViewer().render(zip, { renderer: customRenderer });

    expect(customRenderer.render).toHaveBeenCalledOnce();
    expect(result.html).toBe('<p>custom</p>');
  });

  it('passes the raw Markdown string to the custom renderer', async () => {
    let capturedMarkdown = '';
    const customRenderer: MarkdownRenderer = {
      render: (md: string) => {
        capturedMarkdown = md;
        return '';
      },
    };
    const zip = await makeZip({ 'index.md': '# Captured' });
    await new MdzViewer().render(zip, { renderer: customRenderer });

    expect(capturedMarkdown).toBe('# Captured');
  });
});

// ---------------------------------------------------------------------------
// MdzViewer.render — error propagation
// ---------------------------------------------------------------------------

describe('MdzViewer.render — error propagation', () => {
  it('propagates MdzParseError for invalid ZIP input', async () => {
    const notZip = encode('not a zip');
    await expect(new MdzViewer().render(notZip)).rejects.toThrow(MdzParseError);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
