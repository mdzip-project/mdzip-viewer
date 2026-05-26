import type { ViewerPlugin } from '../types.js';
import { MdzReader } from '../compat/browserHelpers.js';

export interface DrawioPluginOptions {
  /** CSS class assigned to replacement diagram nodes. */
  className?: string;
  /** JSON string assigned to `data-diagram-options` for external renderers. */
  diagramOptions?: string;
  /**
   * Optional deflater used when payload is raw `<mxGraphModel ...>` XML.
   * Pass `pako.deflateRaw` in browser environments when desired.
   */
  deflateRaw?: ((input: string) => Uint8Array) | null;
}

const DEFAULT_CLASS_NAME = 'drawio-diagram';
const DEFAULT_DIAGRAM_OPTIONS = '{"toolbar":"zoom layers pages","nav":true,"lightbox":false}';

function normalizeRefTarget(rawRef: string): string {
  let target = String(rawRef || '').trim();
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
    // Keep original value if decoding fails.
  }
  return target.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isDrawioPath(path: string): boolean {
  return /\.drawio(\.xml)?$/i.test(path);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function extractDrawioDiagramPayload(xmlText: string): string {
  const match = String(xmlText || '').match(/<diagram\b[^>]*>([\s\S]*?)<\/diagram>/i);
  return match ? match[1].trim() : '';
}

function escapeAttr(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += alphabet[(n >> 18) & 63];
    out += alphabet[(n >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? alphabet[n & 63] : '=';
  }
  return out;
}

function normalizeDrawioDiagramData(payload: string, deflateRaw?: ((input: string) => Uint8Array) | null): string {
  if (!payload) return '';
  if (!payload.startsWith('<mxGraphModel')) return payload;
  if (typeof deflateRaw !== 'function') return payload;
  const encoded = encodeURIComponent(payload);
  return toBase64(deflateRaw(encoded));
}

function parseAttr(tag: string, name: string): string {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const match = tag.match(re);
  return match?.[2] ?? match?.[3] ?? '';
}

export function createDrawioPlugin(options: DrawioPluginOptions = {}): ViewerPlugin {
  const className = options.className ?? DEFAULT_CLASS_NAME;
  const diagramOptions = options.diagramOptions ?? DEFAULT_DIAGRAM_OPTIONS;
  const deflateRaw = options.deflateRaw ?? null;

  return {
    name: 'drawio',
    transformHtml: async (html, context): Promise<string> => {
      const candidates = new Map<string, string>();
      for (const path of context.pkg.files.keys()) {
        candidates.set(path, path);
        candidates.set(path.toLowerCase(), path);
      }

      const resolveFilePath = (rawRef: string): string | null => {
        const target = normalizeRefTarget(rawRef);
        if (!target || !isDrawioPath(target)) return null;

        let resolved: string | null = null;
        try {
          resolved = MdzReader.resolvePath(context.entryPoint, target);
        } catch {
          resolved = null;
        }

        const direct = resolved ? candidates.get(resolved) ?? candidates.get(resolved.toLowerCase()) : null;
        if (direct) return direct;
        return candidates.get(target) ?? candidates.get(target.toLowerCase()) ?? null;
      };

      return html.replace(/<img\b[^>]*>/gi, (imgTag) => {
        const rawRef = parseAttr(imgTag, 'data-src') || parseAttr(imgTag, 'src') || parseAttr(imgTag, 'alt');
        const path = resolveFilePath(rawRef);
        if (!path) return imgTag;

        const bytes = context.pkg.files.get(path);
        if (!bytes) return imgTag;
        const payload = extractDrawioDiagramPayload(decodeUtf8(bytes));
        const diagramData = normalizeDrawioDiagramData(payload, deflateRaw);
        if (!diagramData) return imgTag;

        return `<div class="${escapeAttr(className)}" data-diagram-data="${escapeAttr(diagramData)}" data-diagram-options="${escapeAttr(
          diagramOptions,
        )}"></div>`;
      });
    },
  };
}
