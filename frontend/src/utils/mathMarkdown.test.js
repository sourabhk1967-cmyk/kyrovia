import assert from 'node:assert/strict';
import test from 'node:test';

import katex from 'katex';
import 'katex/contrib/mhchem';

import { LATEX_MACROS, isStandaloneMathExpression, normalizeMathMarkdown } from './mathMarkdown.js';

const renderOptions = {
  macros: LATEX_MACROS,
  throwOnError: true
};

test('keeps prose with inline fractions as inline math', () => {
  const source = String.raw`Take $\frac{1}{6}$ outside:`;

  assert.equal(normalizeMathMarkdown(source), source);
  assert.equal(isStandaloneMathExpression(source), false);
  assert.doesNotThrow(() => katex.renderToString(String.raw`\frac{1}{6}`, renderOptions));
});

test('normalizes parenthesis and bracket LaTeX delimiters', () => {
  assert.equal(
    normalizeMathMarkdown(String.raw`Use \(\frac{a}{b}\) here.`),
    String.raw`Use $\frac{a}{b}$ here.`
  );
  assert.equal(
    normalizeMathMarkdown(String.raw`\[\int_0^\infty e^{-x}\,dx = 1\]`),
    `$$\n${String.raw`\int_0^\infty e^{-x}\,dx = 1`}\n$$`
  );
});

test('wraps standalone formulas without touching prose or code', () => {
  assert.equal(
    normalizeMathMarkdown(String.raw`\frac{x+1}{x-1}`),
    `$$\n${String.raw`\frac{x+1}{x-1}`}\n$$`
  );
  assert.equal(
    normalizeMathMarkdown(String.raw`Take \frac{1}{6} outside:`),
    String.raw`Take \frac{1}{6} outside:`
  );
  assert.equal(
    normalizeMathMarkdown('`\\frac{1}{6}`'),
    '`\\frac{1}{6}`'
  );
});

test('supports advanced display environments', () => {
  const source = String.raw`\begin{align}
f(x) &= x^2 + 1 \\
f'(x) &= 2x
\end{align}`;
  const normalized = normalizeMathMarkdown(source);

  assert.equal(normalized, `$$\n${source}\n$$`);
  assert.doesNotThrow(() => katex.renderToString(source, { ...renderOptions, displayMode: true }));
});

test('supports matrices, cases, scientific macros, and chemistry', () => {
  const samples = [
    String.raw`A=\begin{pmatrix}1&2\\3&4\end{pmatrix}`,
    String.raw`f(x)=\begin{cases}x^2 & x\ge 0\\-x & x<0\end{cases}`,
    String.raw`\dv{x^3}{x}=3x^2,\quad \pdv{f}{y}`,
    String.raw`\set{x\in\RR \mid \abs{x}<1}`,
    String.raw`\braket{\psi}{\phi}`,
    String.raw`\prob{A\cap B}=\prob{A}\prob{B}`,
    String.raw`\expect{X}=\sum_x x\,p(x),\quad \variance{X}=\expect{(X-\expect{X})^2}`,
    String.raw`\ceil{x}+\floor{x}+\inner{u}{v}`,
    String.raw`\ce{2H2 + O2 -> 2H2O}`,
    String.raw`9.81\unit{m/s^2}`
  ];

  for (const sample of samples) {
    assert.doesNotThrow(() => katex.renderToString(sample, renderOptions), sample);
  }
});

test('repairs Markdown emphasis and backend line breaks inside probability formulas', () => {
  const source = String.raw`Example:\
Suppose:

$$
**P(A) = 1/2**\
$$
**P(B) = 1/3**

**P(A ∩ B) = P(A) × P(B)**`;
  const normalized = normalizeMathMarkdown(source);

  assert.doesNotMatch(normalized, /\$\$[\s\S]*?\*\*[\s\S]*?\$\$/);
  assert.doesNotMatch(normalized, /(?<!\\)\\$/m);
  assert.ok(normalized.includes(String.raw`P(A) = \frac{1}{2}`));
  assert.ok(normalized.includes(String.raw`P(B) = \frac{1}{3}`));
  assert.ok(normalized.includes(String.raw`P(A \cap B) = P(A) \times P(B)`));

  for (const block of normalized.matchAll(/\$\$\s*([\s\S]*?)\s*\$\$/g)) {
    assert.doesNotThrow(
      () => katex.renderToString(block[1], { ...renderOptions, displayMode: true }),
      block[1]
    );
  }
});

test('unwraps prose accidentally placed inside display math', () => {
  const source = String.raw`$$
Event B = getting 6 on dice\
$$
So:
$$
= **P(A) × P(B)**
$$`;
  const normalized = normalizeMathMarkdown(source);

  assert.match(normalized, /^Event B = getting 6 on dice/m);
  assert.doesNotMatch(normalized, /\$\$\s*Event B/);
  assert.ok(normalized.includes(String.raw`= P(A) \times P(B)`));
  assert.doesNotMatch(normalized, /\*\*/);
});

test('keeps ordinary bold prose while converting only bold equations to math', () => {
  const source = [
    '**AND means multiply**',
    '',
    '**P(A ∩ B) = P(A) × P(B)**'
  ].join('\n');
  const normalized = normalizeMathMarkdown(source);

  assert.match(normalized, /\*\*AND means multiply\*\*/);
  assert.doesNotMatch(normalized, /\*\*P\(A/);
  assert.match(normalized, /\$\$[\s\S]*P\(A \\cap B\)[\s\S]*\$\$/);
});

test('renders standalone operator expressions and cleans fenced math', () => {
  assert.equal(
    normalizeMathMarkdown('**P(A) × P(B)**'),
    `$$\n${String.raw`P(A) \times P(B)`}\n$$`
  );
  assert.equal(
    normalizeMathMarkdown('```math\n**P(A ∩ B) = 1/2**\n```'),
    `\`\`\`math\n${String.raw`P(A \cap B) = \frac{1}{2}`}\n\`\`\``
  );
});
