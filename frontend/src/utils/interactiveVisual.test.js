import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInteractiveVisualDocument,
  hasInteractiveHtml,
  isOhmsLawVisual,
  LIVE_VISUAL_HEIGHT_MESSAGE,
  readOhmsLawDefaults,
  stripCapturedVisualEcho
} from './interactiveVisual.js';

test('recognizes persisted live visuals and Ohm law responses', () => {
  assert.equal(hasInteractiveHtml({ interactiveType: 'sandboxed-html', interactiveHtml: '<html></html>' }), true);
  assert.equal(isOhmsLawVisual("Ohm's Law uses V = IR."), true);
});

test('reads voltage and resistance defaults from response text', () => {
  assert.deepEqual(readOhmsLawDefaults('A 12 V source and 6 Ω resistor.'), {
    voltage: 12,
    resistance: 6
  });
});

test('removes labels already captured inside an Ohm law backend visual', () => {
  const content = String.raw`Ohm's Law explains voltage, current, and resistance.

$V = IR$

$V_s$

V

$R$

Ω

$I = \frac{V_s}{R} = \frac{12.0\,\mathrm{V}}{6.0\,\Omega} = 2.00\,\mathrm{A}$

Where:

**V** = Voltage`;
  const cleaned = stripCapturedVisualEcho(content, [{ captureType: 'backend-visual' }]);

  assert.equal(
    cleaned,
    `Ohm's Law explains voltage, current, and resistance.\n\nWhere:\n\n**V** = Voltage`
  );
});

test('keeps visual-looking text when there is no captured backend visual', () => {
  const content = '$V = IR$\n\n$V_s$\n\nV\n\n$R$\n\nΩ';

  assert.equal(stripCapturedVisualEcho(content, []), content);
});

test('builds a network-blocked document with a resize bridge', () => {
  const document = buildInteractiveVisualDocument(
    '<!doctype html><html><head><base href="https://example.com"></head><body><input type="range"><script>void 0</script></body></html>'
  );

  assert.match(document, /Content-Security-Policy/);
  assert.match(document, /connect-src 'none'/);
  assert.match(document, new RegExp(LIVE_VISUAL_HEIGHT_MESSAGE));
  assert.doesNotMatch(document, /<base\b/i);
});
