import { XMLParser, XMLValidator } from 'fast-xml-parser';

export type ScriptLanguage = 'JavaScript' | 'FormCalc' | 'Unknown';
export interface ScriptInfo {
  elementPath: string;
  event: string;
  language: ScriptLanguage;
  length: number;
  findings: string[];
  snippet?: string;
}
export interface XdpAnalysis {
  root: string;
  sizeBytes: number;
  elements: number;
  fieldNames: string[];
  scripts: ScriptInfo[];
  summary: { byLanguage: Record<ScriptLanguage, number>; byEvent: Record<string, number>; findings: string[] };
}

type XmlNode = Record<string, unknown>;
const parser = new XMLParser({
  ignoreAttributes: false, preserveOrder: true, trimValues: false,
  parseTagValue: false, parseAttributeValue: false,
  processEntities: false, ignoreDeclaration: true
});

export function decodeAndValidateXdp(base64: string, maxBytes: number): string {
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error('Invalid XDP base64 encoding');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > maxBytes) throw new Error(`XDP exceeds ${maxBytes} bytes`);
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('XML DTD or ENTITY is not allowed');
  const validity = XMLValidator.validate(xml);
  if (validity !== true) throw new Error('XDP XML is malformed');
  if (!/<(?:[\w-]+:)?xdp\b/i.test(xml)) throw new Error('Expected an XDP root element');
  if (!/<(?:[\w-]+:)?template\b/i.test(xml)) throw new Error('Expected XFA template in XDP');
  return xml;
}

function flattenText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return '';
  return nodes.map((n: XmlNode) => {
    if (typeof n['#text'] === 'string') return n['#text'];
    return Object.entries(n).filter(([key]) => key !== ':@').map(([, val]) => flattenText(val)).join('');
  }).join('');
}
function localName(name: string): string { return name.split(':').at(-1) ?? name; }
function findingsFor(script: string, event: string): string[] {
  const findings: string[] = [];
  if (/\beval\s*\(/.test(script)) findings.push('Dynamic evaluation detected: review untrusted inputs');
  if (/\bresolveNodes?\s*\(/.test(script)) findings.push('Dynamic SOM resolution: verify paths and null handling');
  if (/\bxfa\.datasets\b/.test(script)) findings.push('XFA dataset access: review data bindings');
  if (/\bxfa\.host\.(?:messageBox|print)\s*\(/.test(script)) findings.push('Host interaction: verify PDF/ADS runtime support');
  if (/\brawValue\b/.test(script) && /^(?:calculate|form:ready|layout:ready|validate)$/i.test(event)) {
    findings.push('rawValue assignment in lifecycle event: verify event order and overwrites');
  }
  if (/\bxfa\.layout\.relayout\s*\(/.test(script) && event.toLowerCase() === 'layout:ready') {
    findings.push('layout:ready requests relayout: check for repeated layout passes');
  }
  return findings;
}

export function analyzeXdp(xml: string, includeSnippets = false): XdpAnalysis {
  const nodes: unknown = parser.parse(xml);
  if (!Array.isArray(nodes)) throw new Error('Unexpected parsed XML structure');
  let root = '';
  let elements = 0;
  const fieldNames: string[] = [];
  const scripts: ScriptInfo[] = [];

  function walk(items: unknown[], ancestors: string[], currentEvent: string): void {
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as XmlNode;
      const attrs = (item[':@'] ?? {}) as Record<string, string>;
      for (const [tag, child] of Object.entries(item)) {
        if (tag === ':@' || tag === '#text' || tag.startsWith('?')) continue;
        if (tag.startsWith('#')) continue;
        elements++;
        if (!root) root = tag;
        const kind = localName(tag);
        const name = attrs['@_name'];
        const part = name ? `${kind}[${name}]` : kind;
        const currentPath = [...ancestors, part];
        const event = kind === 'event' ? (attrs['@_activity'] ?? 'unknown') : currentEvent;
        if (kind === 'field' && name && fieldNames.length < 250) fieldNames.push(name);
        if (kind === 'script') {
          const code = flattenText(child);
          const contentType = attrs['@_contentType'] ?? '';
          const language: ScriptLanguage = /formcalc/i.test(contentType) ? 'FormCalc' : /javascript/i.test(contentType) ? 'JavaScript' : 'Unknown';
          const scriptInfo: ScriptInfo = {
            elementPath: currentPath.join('/'), event, language, length: code.length,
            findings: findingsFor(code, event)
          };
          if (includeSnippets) scriptInfo.snippet = code.slice(0, 400);
          scripts.push(scriptInfo);
        }
        if (Array.isArray(child)) walk(child, currentPath, event);
      }
    }
  }
  walk(nodes, [], 'unknown');
  const byLanguage: Record<ScriptLanguage, number> = { JavaScript: 0, FormCalc: 0, Unknown: 0 };
  const byEvent: Record<string, number> = {};
  const findings = new Set<string>();
  for (const s of scripts) {
    byLanguage[s.language]++;
    byEvent[s.event] = (byEvent[s.event] ?? 0) + 1;
    for (const f of s.findings) findings.add(f);
  }
  return { root, sizeBytes: Buffer.byteLength(xml), elements, fieldNames, scripts, summary: { byLanguage, byEvent, findings: [...findings] } };
}
