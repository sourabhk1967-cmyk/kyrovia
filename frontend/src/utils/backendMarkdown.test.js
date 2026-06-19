import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeBackendMarkdownLayout,
  preserveAuthoritativeBackendMarkdown
} from './backendMarkdown.js';

test('restores collapsed backend definition rows as Markdown hard breaks', () => {
  assert.equal(
    normalizeBackendMarkdownLayout(
      '**V** = Voltage in volts **I** = Current in amperes **R** = Resistance in ohms'
    ),
    '**V** = Voltage in volts\\\n**I** = Current in amperes\\\n**R** = Resistance in ohms'
  );
});

test('does not alter ordinary bold prose or definitions already on separate lines', () => {
  const content = '**Ohm’s Law** explains **voltage** and **current**.\n\n**V** = Voltage\n**I** = Current';

  assert.equal(normalizeBackendMarkdownLayout(content), content);
});

test('preserves authoritative backend Markdown byte-for-byte', () => {
  const content = [
    '# Backend title',
    '',
    '- First bullet',
    '  - Nested bullet',
    '',
    '> Styled quote',
    '',
    '```js',
    'const value = 1;',
    '```'
  ].join('\n');

  assert.equal(preserveAuthoritativeBackendMarkdown(content), content);
});
