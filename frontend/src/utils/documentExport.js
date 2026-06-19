const A4_WIDTH_PX = 794;
const PDF_MARGIN_PT = 36;

function prepareDocumentClone(element) {
  const clone = element.cloneNode(true);

  clone.querySelectorAll('.katex').forEach((mathNode) => {
    const source = mathNode.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
    const replacement = document.createElement('span');
    replacement.textContent = source ? `$${source}$` : mathNode.textContent;
    mathNode.replaceWith(replacement);
  });

  clone.querySelectorAll('button, [aria-hidden="true"]').forEach((node) => node.remove());
  clone.removeAttribute('class');

  return clone;
}

function documentHtml(element, title) {
  const clone = prepareDocumentClone(element);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 0.7in; }
      body {
        margin: 0;
        color: #172033;
        font-family: Aptos, Calibri, Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.55;
      }
      h1 { margin: 0 0 18pt; font-size: 22pt; line-height: 1.18; }
      h2 { margin: 22pt 0 10pt; font-size: 16pt; line-height: 1.25; }
      h3 { margin: 18pt 0 8pt; font-size: 13pt; line-height: 1.3; }
      p { margin: 0 0 10pt; }
      ul, ol { margin: 0 0 12pt; padding-left: 24pt; }
      li { margin: 0 0 4pt; }
      blockquote {
        margin: 12pt 0;
        border-left: 3pt solid #8b5cf6;
        background: #f7f5ff;
        padding: 8pt 12pt;
      }
      table { width: 100%; border-collapse: collapse; margin: 14pt 0; }
      th, td { border: 1pt solid #cbd5e1; padding: 7pt; vertical-align: top; }
      th { background: #f1f5f9; font-weight: 700; }
      pre {
        white-space: pre-wrap;
        background: #f5f7fa;
        border: 1pt solid #dfe4ea;
        padding: 10pt;
        font-family: Consolas, monospace;
        font-size: 9pt;
      }
      code { font-family: Consolas, monospace; }
      a { color: #3157b7; text-decoration: underline; }
      img { max-width: 100%; height: auto; }
      hr { border: 0; border-top: 1pt solid #d8dee8; margin: 18pt 0; }
    </style>
  </head>
  <body>${clone.innerHTML}</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function createDocxBlob(element, title) {
  const { asBlob } = await import('html-docx-js-typescript');
  const blob = await asBlob(documentHtml(element, title), {
    orientation: 'portrait',
    margins: {
      top: 1008,
      right: 1008,
      bottom: 1008,
      left: 1008
    }
  });

  return blob instanceof Blob
    ? blob
    : new Blob([blob], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
}

export async function createPdfBlob(element) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ]);
  const staging = document.createElement('div');
  const clone = element.cloneNode(true);

  staging.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    `width:${A4_WIDTH_PX}px`,
    'background:#ffffff',
    'z-index:-1'
  ].join(';');
  clone.style.cssText = [
    `width:${A4_WIDTH_PX}px`,
    'max-height:none',
    'overflow:visible',
    'box-sizing:border-box',
    'background:#ffffff',
    'padding:56px 64px 64px'
  ].join(';');
  staging.appendChild(clone);
  document.body.appendChild(staging);

  try {
    await document.fonts?.ready;
    const captureScale = Math.max(1, Math.min(2, 28000 / Math.max(clone.scrollHeight, 1)));
    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      logging: false,
      scale: captureScale,
      useCORS: true,
      windowWidth: A4_WIDTH_PX
    });
    const pdf = new jsPDF({
      compress: true,
      format: 'a4',
      orientation: 'portrait',
      unit: 'pt'
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printableWidth = pageWidth - PDF_MARGIN_PT * 2;
    const printableHeight = pageHeight - PDF_MARGIN_PT * 2;
    const pixelsPerPage = Math.max(
      1,
      Math.floor((printableHeight * canvas.width) / printableWidth)
    );
    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      const sliceHeight = Math.min(pixelsPerPage, canvas.height - offsetY);
      const pageCanvas = document.createElement('canvas');
      const pageContext = pageCanvas.getContext('2d');

      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      pageContext.fillStyle = '#ffffff';
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      if (pageIndex > 0) {
        pdf.addPage();
      }

      const renderedHeight = (sliceHeight * printableWidth) / canvas.width;
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', 0.94),
        'JPEG',
        PDF_MARGIN_PT,
        PDF_MARGIN_PT,
        printableWidth,
        renderedHeight,
        undefined,
        'FAST'
      );

      offsetY += sliceHeight;
      pageIndex += 1;
    }

    return pdf.output('blob');
  } finally {
    staging.remove();
  }
}
