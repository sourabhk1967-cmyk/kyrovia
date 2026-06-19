export const LIVE_VISUAL_HEIGHT_MESSAGE = 'kyrovia-live-visual-height';

const MAX_DOCUMENT_LENGTH = 300000;
const OHMS_LAW_RE = /\bohm(?:'|’)?s?\s+law\b|\bV\s*=\s*I\s*R\b/i;

function stripUnsafeDocumentControls(html = '') {
  return String(html)
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh\b[^>]*>/gi, '');
}

export function hasInteractiveHtml(image = {}) {
  return image?.interactiveType === 'sandboxed-html' && typeof image?.interactiveHtml === 'string' && image.interactiveHtml.trim().length > 0;
}

export function isOhmsLawVisual(text = '') {
  return OHMS_LAW_RE.test(String(text));
}

export function readOhmsLawDefaults(text = '') {
  const source = String(text);
  const voltage = Number(source.match(/(\d+(?:\.\d+)?)\s*V\b/i)?.[1] || 12);
  const resistance = Number(source.match(/(\d+(?:\.\d+)?)\s*(?:Ω|ohms?\b)/i)?.[1] || 6);

  return {
    voltage: Math.min(24, Math.max(1, voltage)),
    resistance: Math.min(20, Math.max(1, resistance))
  };
}

function nextNonEmptyLine(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index].trim()) {
      return index;
    }
  }

  return -1;
}

function stripOhmsLawVisualEcho(content = '') {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n');

  for (let start = 0; start < lines.length; start += 1) {
    if (!/^\$V\s*=\s*IR\$$/i.test(lines[start].trim())) {
      continue;
    }

    const sourceVoltage = nextNonEmptyLine(lines, start + 1);
    const voltageUnit = nextNonEmptyLine(lines, sourceVoltage + 1);
    const resistance = nextNonEmptyLine(lines, voltageUnit + 1);
    const resistanceUnit = nextNonEmptyLine(lines, resistance + 1);
    const calculation = nextNonEmptyLine(lines, resistanceUnit + 1);

    if (
      sourceVoltage < 0 ||
      voltageUnit < 0 ||
      resistance < 0 ||
      resistanceUnit < 0 ||
      calculation < 0 ||
      !/^\$V_s\$$/i.test(lines[sourceVoltage].trim()) ||
      !/^V$/i.test(lines[voltageUnit].trim()) ||
      !/^\$R\$$/i.test(lines[resistance].trim()) ||
      !/^(?:\u03a9|\u00ce\u00a9|\\Omega|\$\\Omega\$)$/.test(lines[resistanceUnit].trim()) ||
      !/^\$I\s*=/.test(lines[calculation].trim()) ||
      !/\\frac\{V_s\}\{R\}/.test(lines[calculation])
    ) {
      continue;
    }

    lines.splice(start, calculation + 1 - start);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  return content;
}

export function stripCapturedVisualEcho(content = '', images = []) {
  const hasBackendVisual = images.some((image) => image?.captureType === 'backend-visual');

  if (!hasBackendVisual || !isOhmsLawVisual(content)) {
    return content;
  }

  return stripOhmsLawVisualEcho(content);
}

export function buildInteractiveVisualDocument(html = '') {
  const source = stripUnsafeDocumentControls(html).slice(0, MAX_DOCUMENT_LENGTH);
  const securityHead = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;min-height:100%;overflow-x:hidden;background:#fff}*{box-sizing:border-box}</style>`;
  const resizeBridge = `<script>
(() => {
  const sendHeight = () => {
    const body = document.body;
    const root = document.documentElement;
    const height = Math.ceil(Math.max(body?.scrollHeight || 0, body?.offsetHeight || 0, root?.scrollHeight || 0, root?.offsetHeight || 0));
    parent.postMessage({ type: '${LIVE_VISUAL_HEIGHT_MESSAGE}', height }, '*');
  };
  addEventListener('load', sendHeight);
  addEventListener('resize', sendHeight);
  new ResizeObserver(sendHeight).observe(document.documentElement);
  setTimeout(sendHeight, 0);
})();
</script>`;

  if (/<head[\s>]/i.test(source)) {
    return source
      .replace(/<head([^>]*)>/i, `<head$1>${securityHead}`)
      .replace(/<\/body>/i, `${resizeBridge}</body>`);
  }

  const body = source
    .replace(/<!doctype\s+html[^>]*>/i, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '');

  return `<!doctype html><html><head>${securityHead}</head><body>${body}${resizeBridge}</body></html>`;
}
