const BOLD_DEFINITION_MARKER = /\*\*([^*\n]{1,32})\*\*\s*=/g;

function restoreCollapsedDefinitionLine(line = '') {
  const matches = [...String(line).matchAll(BOLD_DEFINITION_MARKER)];

  if (matches.length < 2 || String(line).slice(0, matches[0].index).trim()) {
    return line;
  }

  const definitions = matches.map((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? line.length;
    return line.slice(start, end).trim();
  });

  if (definitions.some((definition) => !/^\*\*[^*\n]{1,32}\*\*\s*=\s*\S/.test(definition))) {
    return line;
  }

  return definitions.join('\\\n');
}

export function normalizeBackendMarkdownLayout(content = '') {
  return String(content)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(restoreCollapsedDefinitionLine)
    .join('\n');
}

export function preserveAuthoritativeBackendMarkdown(content = '') {
  return String(content);
}
