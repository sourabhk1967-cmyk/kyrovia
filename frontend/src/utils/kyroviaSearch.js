export function kyroviaSearchPath({ page = 1, query = '', sort = 'relevance', tab = 'all', type = 'web' } = {}) {
  const params = new URLSearchParams();
  const cleanQuery = typeof query === 'string' ? query.trim() : '';

  if (cleanQuery) {
    params.set('q', cleanQuery);
  }

  params.set('page', String(Math.max(Number(page) || 1, 1)));
  params.set('type', type === 'image' || tab === 'images' ? 'image' : 'web');
  params.set('sort', sort === 'verified' ? 'verified' : 'relevance');
  params.set('tab', tab || (type === 'image' ? 'images' : 'all'));

  return `/search?${params.toString()}`;
}

export function safeKyroviaResultUrl(value) {
  let candidate = value || '';

  for (let depth = 0; depth < 5; depth += 1) {
    try {
      const url = new URL(candidate);
      const searchRedirect =
        /(^|\.)google\.[a-z.]+$/i.test(url.hostname) ||
        /(^|\.)google$/i.test(url.hostname);

      if (searchRedirect) {
        const destination =
          url.searchParams.get('continue') ||
          url.searchParams.get('url') ||
          url.searchParams.get('link') ||
          url.searchParams.get('q');

        if (destination && /^https?:\/\//i.test(destination)) {
          candidate = destination;
          continue;
        }
      }

      if (url.hostname === 'm.youtube.com') {
        url.hostname = 'www.youtube.com';
      }

      return url.toString();
    } catch (_error) {
      return candidate;
    }
  }

  return candidate;
}

export function cleanLegacyKyroviaSearchMarkdown(content = '') {
  const query =
    content.match(/^##\s+(?:Google|Kyrovia) results for "([^"]+)"/m)?.[1] ||
    content.match(/^(?:Google|Kyrovia) results for "([^"]+)"/m)?.[1] ||
    '';
  const fullResultsPath = kyroviaSearchPath({ query });

  return content
    .replace(/^## Google results for /m, '## Kyrovia results for ')
    .replace(/^Google results for /m, 'Kyrovia results for ')
    .replace(/\*\*Related Google searches\*\*/g, '**Related Kyrovia searches**')
    .replace(
      /\[(?:Open all results in (?:Google|Kyrovia Google Search|Kyrovia Search)|Open the full Kyrovia results page)\]\([^)]+\)/g,
      `[Open the full Kyrovia results page](${fullResultsPath})`
    );
}
