import { describe, it, expect, afterEach } from 'vitest';
import { MarkedRenderer, getDefaultRenderer, setDefaultRenderer } from '../src/rendering/index.js';

// ---------------------------------------------------------------------------
// MarkedRenderer
// ---------------------------------------------------------------------------

describe('MarkedRenderer', () => {
  it('renders an h1 heading', () => {
    const r = new MarkedRenderer();
    const html = r.render('# Hello World');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello World');
  });

  it('renders bold text', () => {
    const r = new MarkedRenderer();
    expect(r.render('**bold**')).toContain('<strong>bold</strong>');
  });

  it('renders italic text', () => {
    const r = new MarkedRenderer();
    expect(r.render('_italic_')).toContain('<em>italic</em>');
  });

  it('renders a paragraph', () => {
    const r = new MarkedRenderer();
    expect(r.render('Hello world.')).toContain('<p>');
  });

  it('renders inline code', () => {
    const r = new MarkedRenderer();
    expect(r.render('`code`')).toContain('<code>code</code>');
  });

  it('renders a fenced code block', () => {
    const r = new MarkedRenderer();
    const html = r.render('```js\nconsole.log("hi");\n```');
    expect(html).toContain('<code');
    expect(html).toContain('console.log');
  });

  it('renders a Markdown link', () => {
    const r = new MarkedRenderer();
    const html = r.render('[click here](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('click here');
  });

  it('renders an unordered list', () => {
    const r = new MarkedRenderer();
    const html = r.render('- item one\n- item two');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
  });

  it('renders an ordered list', () => {
    const r = new MarkedRenderer();
    const html = r.render('1. first\n2. second');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>');
  });

  it('returns a string (not a Promise)', () => {
    const r = new MarkedRenderer();
    const result = r.render('# Test');
    expect(typeof result).toBe('string');
  });

  it('handles empty string input', () => {
    const r = new MarkedRenderer();
    expect(typeof r.render('')).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// getDefaultRenderer / setDefaultRenderer
// ---------------------------------------------------------------------------

describe('getDefaultRenderer', () => {
  afterEach(() => {
    // Always reset back to the default after each test
    setDefaultRenderer(null);
  });

  it('returns a renderer instance', () => {
    const r = getDefaultRenderer();
    expect(r).toBeDefined();
    expect(typeof r.render).toBe('function');
  });

  it('returns the same instance on repeated calls', () => {
    const r1 = getDefaultRenderer();
    const r2 = getDefaultRenderer();
    expect(r1).toBe(r2);
  });

  it('uses the replaced renderer after setDefaultRenderer', () => {
    const custom = { render: (): string => '<p>custom</p>' };
    setDefaultRenderer(custom);
    expect(getDefaultRenderer()).toBe(custom);
  });

  it('reverts to a MarkedRenderer after setDefaultRenderer(null)', () => {
    const custom = { render: (): string => '' };
    setDefaultRenderer(custom);
    setDefaultRenderer(null);
    const r = getDefaultRenderer();
    expect(r).toBeInstanceOf(MarkedRenderer);
  });
});
