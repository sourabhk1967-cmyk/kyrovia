const MATH_COMMAND_PATTERN =
  /\\(?:alpha|approx|argmax|argmin|bar|begin|beta|binom|boxed|cancel|cap|cases|cfrac|cos|cup|delta|det|dfrac|div|dot|ddot|exists|forall|frac|gamma|gcd|ge|hat|infty|int|land|le|left|lim|ln|log|lor|mathbb|mathbf|mathcal|mathrm|nabla|ne|oint|operatorname|overbrace|overline|partial|pmod|prod|right|sin|sqrt|sum|tan|text|tfrac|theta|times|to|underbrace|underline|vec)\b/i;
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
const DISPLAY_ENVIRONMENT_PATTERN =
  /\\begin\{(equation\*?|align\*?|alignat\*?|gather\*?|multline\*?|flalign\*?|split|aligned|alignedat|gathered|array|cases|rcases|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|smallmatrix|CD)\}[\s\S]*?\\end\{\1\}/g;
const CODE_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
const DELIMITED_MATH_PATTERN =
  /(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$(?!\$)(?:\\.|[^$\n])*?(?<!\\)\$/g;
const PRIVATE_TOKEN_PATTERN = /\uE000(\d+)\uE001/g;
const UNICODE_MATH_REPLACEMENTS = [
  [/\u2229/g, '\\cap'],
  [/\u222a/g, '\\cup'],
  [/\u2208/g, '\\in'],
  [/\u2209/g, '\\notin'],
  [/\u2282/g, '\\subset'],
  [/\u2286/g, '\\subseteq'],
  [/\u2283/g, '\\supset'],
  [/\u2287/g, '\\supseteq'],
  [/\u00d7/g, '\\times'],
  [/\u00f7/g, '\\div'],
  [/\u2264/g, '\\le'],
  [/\u2265/g, '\\ge'],
  [/\u2260/g, '\\ne'],
  [/\u2248/g, '\\approx'],
  [/\u2192/g, '\\to'],
  [/\u2190/g, '\\leftarrow'],
  [/\u2212/g, '-']
];

export const LATEX_MACROS = {
  '\\RR': '\\mathbb{R}',
  '\\NN': '\\mathbb{N}',
  '\\ZZ': '\\mathbb{Z}',
  '\\QQ': '\\mathbb{Q}',
  '\\CC': '\\mathbb{C}',
  '\\PP': '\\mathbb{P}',
  '\\EE': '\\mathbb{E}',
  '\\dd': '\\mathop{}\\!\\mathrm{d}',
  '\\ee': '\\mathrm{e}',
  '\\ii': '\\mathrm{i}',
  '\\dv': '\\frac{\\mathrm{d} #1}{\\mathrm{d} #2}',
  '\\pdv': '\\frac{\\partial #1}{\\partial #2}',
  '\\abs': '\\left\\lvert #1 \\right\\rvert',
  '\\norm': '\\left\\lVert #1 \\right\\rVert',
  '\\set': '\\left\\{ #1 \\right\\}',
  '\\qty': '\\left( #1 \\right)',
  '\\paren': '\\left( #1 \\right)',
  '\\bracks': '\\left[ #1 \\right]',
  '\\ceil': '\\left\\lceil #1 \\right\\rceil',
  '\\floor': '\\left\\lfloor #1 \\right\\rfloor',
  '\\avg': '\\left\\langle #1 \\right\\rangle',
  '\\inner': '\\left\\langle #1, #2 \\right\\rangle',
  '\\bra': '\\left\\langle #1 \\right\\rvert',
  '\\ket': '\\left\\lvert #1 \\right\\rangle',
  '\\braket': '\\left\\langle #1 \\middle\\vert #2 \\right\\rangle',
  '\\prob': '\\mathbb{P}\\!\\left( #1 \\right)',
  '\\expect': '\\mathbb{E}\\!\\left[ #1 \\right]',
  '\\variance': '\\operatorname{Var}\\!\\left( #1 \\right)',
  '\\cov': '\\operatorname{Cov}\\!\\left( #1, #2 \\right)',
  '\\grad': '\\nabla',
  '\\laplacian': '\\nabla^{2}',
  '\\conj': '\\overline{#1}',
  '\\Tr': '\\operatorname{Tr}',
  '\\rank': '\\operatorname{rank}',
  '\\sgn': '\\operatorname{sgn}',
  '\\unit': '\\,\\mathrm{#1}'
};

function normalizeDelimitedMath(value) {
  if (value.startsWith('\\[') && value.endsWith('\\]')) {
    return `$$\n${value.slice(2, -2).trim()}\n$$`;
  }

  if (value.startsWith('\\(') && value.endsWith('\\)')) {
    return `$${normalizeMathExpression(value.slice(2, -2))}$`;
  }

  if (value.startsWith('$') && !value.startsWith('$$') && value.endsWith('$')) {
    return `$${normalizeMathExpression(value.slice(1, -1))}$`;
  }

  return value;
}

function normalizeMathOperators(value = '') {
  return UNICODE_MATH_REPLACEMENTS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    String(value)
  );
}

function normalizeSimpleNumericFractions(value = '') {
  return String(value).replace(
    /(?<![\w}\\])(\d+)\s*\/\s*(\d+)(?![\w{])/g,
    String.raw`\frac{$1}{$2}`
  );
}

function stripMarkdownFromMath(value = '') {
  return String(value)
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(?<!\\)\\\s*$/gm, '')
    .trim();
}

function normalizeMathExpression(value = '') {
  return normalizeSimpleNumericFractions(
    normalizeMathOperators(stripMarkdownFromMath(value))
  ).trim();
}

function unwrapMalformedDisplayMath(value = '') {
  if (!value.startsWith('$$') || !value.endsWith('$$')) {
    return value;
  }

  const rawMath = value.slice(2, -2).trim();
  const normalizedMath = normalizeMathExpression(rawMath);

  if (!normalizedMath) {
    return '';
  }

  if (
    looksLikeProse(normalizedMath) &&
    !MATH_COMMAND_PATTERN.test(normalizedMath) &&
    !/^\\begin\{[^}]+\}/.test(normalizedMath)
  ) {
    return normalizedMath.replace(/\s{2,}/g, ' ');
  }

  return `$$\n${normalizedMath}\n$$`;
}

function normalizeLatexSyntaxSegment(segment = '') {
  const protectedMath = [];
  const protectedSegment = String(segment).replace(DELIMITED_MATH_PATTERN, (value) => {
    const delimited = normalizeDelimitedMath(value);
    const index = protectedMath.push(
      delimited.startsWith('$$') ? unwrapMalformedDisplayMath(delimited) : delimited
    ) - 1;
    return `\uE000${index}\uE001`;
  });
  const withDisplayEnvironments = protectedSegment.replace(
    DISPLAY_ENVIRONMENT_PATTERN,
    (environment) => `$$\n${environment.trim()}\n$$`
  );

  return withDisplayEnvironments.replace(PRIVATE_TOKEN_PATTERN, (_match, index) => protectedMath[Number(index)] || '');
}

function normalizeLatexSyntax(content = '') {
  return String(content)
    .split(CODE_PATTERN)
    .map((segment) => {
      if (/^(```|~~~|`)/.test(segment)) {
        return segment;
      }

      return normalizeLatexSyntaxSegment(segment);
    })
    .join('');
}

function containsMathDelimiter(value = '') {
  return /(?<!\\)\$|\\\(|\\\)|\\\[|\\\]/.test(String(value));
}

function looksLikeProse(value = '') {
  const withoutCommands = String(value)
    .replace(/\\[A-Za-z@]+/g, ' ')
    .replace(/[0-9{}_[\]^=+\-*/().,|:;<>\u2208\u2209\u2229\u222a\u2282\u2283\u2286\u2287\u2264\u2265\u2260\u2248\u2190\u2192\u221e\u03c0\u221a\u222b\u2212\u00d7\u00f7\u2223\u2061]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(withoutCommands);
}

export function isStandaloneMathExpression(value = '') {
  const trimmed = String(value).trim();
  const normalized = normalizeMathOperators(trimmed);

  if (
    !trimmed ||
    trimmed.length > 2000 ||
    containsMathDelimiter(trimmed) ||
    /`/.test(trimmed) ||
    /:\s*$/.test(trimmed) ||
    looksLikeProse(normalized)
  ) {
    return false;
  }

  if (MATH_COMMAND_PATTERN.test(normalized) || /^\\begin\{[^}]+\}/.test(normalized)) {
    return true;
  }

  if (!/[=^_]/.test(trimmed) || /^[=+\-*/|.]+$/.test(trimmed)) {
    return false;
  }

  const compact = normalized.replace(/\s+/g, '');

  return (
    /^[A-Za-z0-9\\{}_[\]^=+\-*/().,|:;<>\u2208\u2209\u2229\u222a\u2282\u2283\u2286\u2287\u2264\u2265\u2260\u2248\u2190\u2192\u221e\u03c0\u221a\u222b\u2212\u00d7\u00f7\u2223\u2061]+$/u.test(
      compact
    ) && compact.length <= 1000
  );
}

function parseMathCandidateLine(line = '') {
  const trimmed = String(line).trim();
  const boldMath = trimmed.match(/^\*\*([\s\S]+?)\*\*(?:\\)?$/);

  if (boldMath) {
    const math = normalizeMathExpression(boldMath[1]);

    if (isStandaloneMathExpression(math)) {
      return {
        kind: 'display',
        marker: '',
        math
      };
    }
  }

  if (
    !trimmed ||
    /^(```|~~~|#{1,6}\s|[-*+]\s|>\s|[*_]{1,3}[^*_]+[*_]{1,3}$)/.test(trimmed) ||
    containsMathDelimiter(trimmed)
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
  return normalizeMathExpression(
    String(line)
    .trim()
    .replace(/^\\\[([\s\S]*)\\\]$/g, '$1')
    .replace(/^\\\(([\s\S]*)\\\)$/g, '$1')
    .replace(/^\$\$?([\s\S]*?)\$\$?$/g, '$1')
    .replace(/\s+\]$/g, '')
    .replace(/(?<!\\)\s*,\s*dx\b/g, ' \\, dx')
  );
}

function normalizeBoldMathSpans(line = '') {
  return String(line).replace(/\*\*([^*\n]+)\*\*/g, (match, value) => {
    const math = normalizeMathExpression(value);
    return isStandaloneMathExpression(math) ? `$${math}$` : match;
  });
}

function normalizeBackendHardBreak(line = '') {
  return /(?<!\\)\\\s*$/.test(String(line))
    ? String(line).replace(/(?<!\\)\\\s*$/, '  ')
    : line;
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

    output.push(
      normalizeBackendHardBreak(
        normalizeBoldMathSpans(normalizeInlineMathProse(line))
      )
    );
  });

  return output.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

export function normalizeMathMarkdown(content = '') {
  return normalizeLatexSyntax(content)
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$)/g)
    .map((segment) =>
      /^(```|~~~)/.test(segment)
        ? segment.replace(
            /^(```|~~~)(?:math|latex|tex)\s*\n([\s\S]*?)\n\1$/i,
            (_match, fence, math) => `${fence}math\n${normalizeMathExpression(math)}\n${fence}`
          )
        : segment.startsWith('$$')
          ? unwrapMalformedDisplayMath(segment)
          : normalizeMathMarkdownSegment(segment)
    )
    .join('');
}
