function refineResponse(text = '') {
  return normalizeMathMarkdown(String(text))
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !isChatGptUiArtifact(line))
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(
      /(^|\n)(Python|JavaScript|TypeScript|HTML|CSS|JSON|Bash|Shell|PowerShell|Java|C\+\+|C#|SQL|PHP|Ruby|Go|Rust)\n+```([a-z0-9_+#.-]*)/gi,
      (_match, prefix, _label, language) => `${prefix}\`\`\`${language}`
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const MATH_COMMAND_PATTERN =
  /\\(?:int|frac|boxed|sqrt|sum|prod|lim|sin|cos|tan|ln|log|left|right|quad|pi|theta|alpha|beta|gamma|cdot|times|partial|infty|begin|end)\b/i;
const MATH_ECHO_WORDS = new Set([
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  'dx',
  'dy',
  'dz',
  'dt',
  'du',
  'dv',
  'dr',
  'ds',
  'ln',
  'log',
  'sin',
  'cos',
  'tan',
  'sec',
  'csc',
  'cot',
  'lim',
  'min',
  'max',
  'pi',
  'theta',
  'alpha',
  'beta',
  'gamma',
  'delta'
]);

function isStandaloneMathExpression(value = '') {
  const trimmed = String(value).trim();

  if (!trimmed || trimmed.length > 220 || /^\$/.test(trimmed) || /\$$/.test(trimmed)) {
    return false;
  }

  if (MATH_COMMAND_PATTERN.test(trimmed)) {
    return true;
  }

  if (
    !/[=^_]/.test(trimmed) ||
    /^[=+\-*/|.]+$/.test(trimmed) ||
    /[A-Za-z]{3,}\s+[A-Za-z]{2,}/.test(trimmed) ||
    /:\s*$/.test(trimmed)
  ) {
    return false;
  }

  const compact = trimmed.replace(/\s+/g, '');

  return (
    /^[A-Za-z0-9\\{}_[\]^=+\-*/().,|:;<>\u2264\u2265\u221e\u03c0\u221a\u222b\u2212\u00d7\u00f7\u2223\u2061]+$/u.test(
      compact
    ) && compact.length <= 160
  );
}

function parseMathCandidateLine(line = '') {
  const trimmed = String(line).trim();

  if (
    !trimmed ||
    /^(```|#{1,6}\s|[-*+]\s|>\s|[*_]{1,3}[^*_]+[*_]{1,3}$)/.test(trimmed) ||
    /^\$\$?/.test(trimmed) ||
    /\$\$?$/.test(trimmed)
  ) {
    return null;
  }

  const numbered = trimmed.match(/^(\d+\.)\s+(.+)$/);

  if (numbered && isStandaloneMathExpression(numbered[2])) {
    return {
      kind: 'numbered',
      marker: numbered[1],
      math: numbered[2]
    };
  }

  if (!isStandaloneMathExpression(trimmed)) {
    return null;
  }

  return {
    kind: 'display',
    marker: '',
    math: trimmed
  };
}

function isBrokenMathEchoToken(line = '') {
  const trimmed = String(line).trim();

  if (!trimmed || trimmed.length > 16 || /[*#:`]/.test(trimmed) || /\s/.test(trimmed)) {
    return false;
  }

  if (/^[A-Za-z]+$/.test(trimmed)) {
    return MATH_ECHO_WORDS.has(trimmed.toLowerCase());
  }

  return /^[A-Za-z0-9_{}()[\]+\-*/=.,|^\u222b\u221e\u03c0\u221a\u2061\u2223\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079\u2070\u2212\u00d7\u00f7\u22c5\u00b7\u2219\u2217\u2215\u2044\u00b1\u2213\u2260\u2248\u2192\u2190]+$/u.test(
    trimmed
  );
}

function normalizeMathLine(line = '') {
  return String(line)
    .trim()
    .replace(/^\\\[([\s\S]*)\\\]$/g, '$1')
    .replace(/^\\\(([\s\S]*)\\\)$/g, '$1')
    .replace(/^\$\$?([\s\S]*?)\$\$?$/g, '$1')
    .replace(/\s+\]$/g, '')
    .replace(/(?<!\\)\s*,\s*dx\b/g, ' \\, dx');
}

function normalizeInlineMathProse(line = '') {
  return String(line)
    .replace(/\bPut back\s+u=x\d+\+\d+(u=x\^\d+\+\d+):/gi, (_match, math) => `Put back $${math}$:`)
    .replace(
      /\bSince\s+x\d+\+\d+>\d+(x\^\d+\+\d+>\d+),/gi,
      (_match, math) => `Since $${math}$,`
    );
}

function normalizeMathMarkdownSegment(segment = '') {
  const lines = String(segment).replace(/\r\n/g, '\n').split('\n');
  const keep = Array(lines.length).fill(true);
  const mathLines = new Map();

  lines.forEach((line, index) => {
    const candidate = parseMathCandidateLine(line);

    if (!candidate) {
      return;
    }

    const tokenIndexes = [];
    let cursor = index - 1;

    while (cursor >= 0) {
      const previousLine = lines[cursor];

      if (!previousLine.trim()) {
        cursor -= 1;
        continue;
      }

      if (!isBrokenMathEchoToken(previousLine)) {
        break;
      }

      tokenIndexes.push(cursor);
      cursor -= 1;
    }

    if (tokenIndexes.length >= 3 || (tokenIndexes.length >= 1 && /\\boxed\b/.test(candidate.math))) {
      tokenIndexes.forEach((tokenIndex) => {
        keep[tokenIndex] = false;

        if (tokenIndex > 0 && !lines[tokenIndex - 1].trim()) {
          keep[tokenIndex - 1] = false;
        }
      });
    }

    mathLines.set(index, candidate);
  });

  const output = [];

  lines.forEach((line, index) => {
    if (!keep[index]) {
      return;
    }

    if (mathLines.has(index)) {
      const candidate = mathLines.get(index);
      const math = normalizeMathLine(candidate.math);

      if (math) {
        if (candidate.kind === 'numbered') {
          output.push(`${candidate.marker} $${math}$`);
        } else {
          output.push('$$', math, '$$');
        }
      }
      return;
    }

    output.push(normalizeInlineMathProse(line));
  });

  return output.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

function normalizeMathMarkdown(content = '') {
  return String(content)
    .split(/(```[\s\S]*?```|\$\$[\s\S]*?\$\$)/g)
    .map((segment) =>
      segment.startsWith('```') || segment.startsWith('$$') ? segment : normalizeMathMarkdownSegment(segment)
    )
    .join('');
}

function isChatGptUiArtifact(line = '') {
  const normalized = String(line).trim();

  return (
    /^Thought for\b/i.test(normalized) ||
    /^Thinking\b/i.test(normalized) ||
    /^Reasoned for\b/i.test(normalized) ||
    /^(Edit|Copy|Share|Retry|Regenerate|Read aloud)$/i.test(normalized)
  );
}

module.exports = {
  refineResponse
};
