const MAX_INTERACTIVE_HTML_LENGTH = 300000;
const INTERACTIVE_WORD_RE = /\b(interactive|working|live|adjustable|dynamic|simulation|simulator|slider|control)\b/i;
const VISUAL_WORD_RE = /\b(diagram|chart|graph|plot|circuit|schematic|visuali[sz]ation)\b/i;

function isInteractiveVisualRequest(message = '') {
  const text = String(message);
  return INTERACTIVE_WORD_RE.test(text) && VISUAL_WORD_RE.test(text);
}

function createInteractiveVisualPrompt(prompt = '') {
  return [
    String(prompt).trim(),
    '',
    'Kyrovia live visual requirements:',
    '- Include exactly one complete, self-contained HTML document in a fenced ```html code block.',
    '- The HTML must reproduce the working visual and include functional controls using only inline CSS and JavaScript.',
    '- Do not use external scripts, stylesheets, fonts, images, network requests, forms, downloads, popups, or navigation.',
    '- Make the visual responsive and accessible. Keep all explanatory text outside the HTML block.',
    '- Return the HTML block even if the chat interface also renders its own interactive card.'
  ].join('\n');
}

function looksLikeInteractiveHtml(value = '') {
  const html = String(value).trim();

  if (!html || html.length > MAX_INTERACTIVE_HTML_LENGTH) {
    return false;
  }

  const hasDocument = /<!doctype\s+html|<html[\s>]/i.test(html);
  const hasVisual = /<(?:svg|canvas|input|button|select)[\s>]/i.test(html);
  const hasBehavior = /<script[\s>]|on(?:input|change|click)\s*=/i.test(html);

  return hasDocument && hasVisual && hasBehavior;
}

function extractInteractiveVisual(markdown = '') {
  const source = String(markdown);
  const blockPattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  const matches = [];
  let match;

  while ((match = blockPattern.exec(source))) {
    const language = match[1].trim().toLowerCase();
    const html = match[2].trim();

    if ((!language || language === 'html' || language === 'htm') && looksLikeInteractiveHtml(html)) {
      matches.push({
        html,
        index: match.index,
        length: match[0].length
      });
    }
  }

  if (!matches.length) {
    return {
      html: '',
      markdown: source
    };
  }

  const selected = matches.sort((left, right) => right.html.length - left.html.length)[0];
  const cleanedMarkdown = `${source.slice(0, selected.index)}${source.slice(selected.index + selected.length)}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    html: selected.html.slice(0, MAX_INTERACTIVE_HTML_LENGTH),
    markdown: cleanedMarkdown
  };
}

module.exports = {
  MAX_INTERACTIVE_HTML_LENGTH,
  createInteractiveVisualPrompt,
  extractInteractiveVisual,
  isInteractiveVisualRequest,
  looksLikeInteractiveHtml
};
