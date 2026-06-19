import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toText } from 'hast-util-to-text';
import 'katex/contrib/mhchem';
import katex from 'katex';
import { SKIP, visitParents } from 'unist-util-visit-parents';

const EMPTY_CLASSES = [];

export default function rehypeKatexAdvanced(options = {}) {
  return function transformMath(tree, file) {
    visitParents(tree, 'element', (element, parents) => {
      const classes = Array.isArray(element.properties?.className)
        ? element.properties.className
        : EMPTY_CLASSES;
      const languageMath = classes.includes('language-math');
      const mathDisplay = classes.includes('math-display');
      const mathInline = classes.includes('math-inline');

      if (!languageMath && !mathDisplay && !mathInline) {
        return;
      }

      let parent = parents[parents.length - 1];
      let scope = element;
      let displayMode = mathDisplay;

      if (
        element.tagName === 'code' &&
        languageMath &&
        parent?.type === 'element' &&
        parent.tagName === 'pre'
      ) {
        scope = parent;
        parent = parents[parents.length - 2];
        displayMode = true;
      }

      if (!parent) {
        return;
      }

      const value = toText(scope, { whitespace: 'pre' });
      let result;

      try {
        result = katex.renderToString(value, {
          ...options,
          displayMode,
          throwOnError: true
        });
      } catch (error) {
        file?.message?.('Could not render math with KaTeX', {
          ancestors: [...parents, element],
          cause: error,
          place: element.position,
          ruleId: String(error?.name || 'parse-error').toLowerCase(),
          source: 'kyrovia-katex'
        });

        try {
          result = katex.renderToString(value, {
            ...options,
            displayMode,
            strict: 'ignore',
            throwOnError: false
          });
        } catch {
          result = `<span class="katex-error" title="${String(error)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}">${value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</span>`;
        }
      }

      const rendered = fromHtmlIsomorphic(result, { fragment: true }).children;
      const index = parent.children.indexOf(scope);
      parent.children.splice(index, 1, ...rendered);
      return SKIP;
    });
  };
}
