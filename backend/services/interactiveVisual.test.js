const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createInteractiveVisualPrompt,
  extractInteractiveVisual,
  isInteractiveVisualRequest,
  looksLikeInteractiveHtml
} = require('./interactiveVisual');

const interactiveDocument = `<!doctype html>
<html>
  <body>
    <input id="voltage" type="range" min="1" max="24" value="12">
    <svg viewBox="0 0 100 50"><path d="M0 25h100"></path></svg>
    <script>document.querySelector('#voltage').addEventListener('input', () => {});</script>
  </body>
</html>`;

test('detects requests for working visual controls', () => {
  assert.equal(isInteractiveVisualRequest('Show a working circuit diagram with sliders'), true);
  assert.equal(isInteractiveVisualRequest('Draw a circuit diagram'), false);
});

test('adds self-contained live visual requirements', () => {
  const prompt = createInteractiveVisualPrompt('Explain Ohm law with a live diagram');

  assert.match(prompt, /self-contained HTML document/i);
  assert.match(prompt, /inline CSS and JavaScript/i);
  assert.match(prompt, /Explain Ohm law/);
});

test('extracts the live HTML and removes it from visible markdown', () => {
  const result = extractInteractiveVisual(`Explanation before.\n\n\`\`\`html\n${interactiveDocument}\n\`\`\`\n\nAfter.`);

  assert.equal(result.html, interactiveDocument);
  assert.equal(result.markdown, 'Explanation before.\n\nAfter.');
});

test('rejects static or incomplete HTML', () => {
  assert.equal(looksLikeInteractiveHtml('<svg><path d="M0 0"></path></svg>'), false);
  assert.equal(extractInteractiveVisual('```js\nconsole.log("hello")\n```').html, '');
});
