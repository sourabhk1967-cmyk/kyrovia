import {
  ArrowDown,
  ArrowUp,
  Beaker,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Grid3X3,
  Image as ImageIcon,
  ListFilter,
  MoreVertical,
  Search,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import kyroviaLogo from '../assets/kyrovia-logo.png';
import { searchGoogle } from '../services/api';
import { kyroviaSearchPath, safeKyroviaResultUrl } from '../utils/kyroviaSearch';
import styles from './SearchPage.module.css';

const SEARCH_TABS = [
  { key: 'ai', label: 'AI Mode' },
  { key: 'all', label: 'All' },
  { key: 'images', label: 'Images' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'shorts', label: 'Short videos' },
  { key: 'videos', label: 'Videos' },
  { key: 'forums', label: 'Forums' },
  { key: 'more', label: 'More', icon: ChevronDown },
  { key: 'tools', label: 'Tools', icon: ChevronDown }
];

function readSearchState() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') || (params.get('type') === 'image' ? 'images' : 'all');

  return {
    query: params.get('q') || params.get('query') || '',
    page: Math.max(Number(params.get('page')) || 1, 1),
    sort: params.get('sort') === 'verified' ? 'verified' : 'relevance',
    tab,
    type: params.get('type') === 'image' || tab === 'images' ? 'image' : 'web'
  };
}

function hostnameFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '');
  } catch (_error) {
    return '';
  }
}

function displayUrlFromUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, '');
    const path = url.pathname
      .split('/')
      .map((segment) => {
        try {
          return decodeURIComponent(segment).replace(/[-_+]+/g, ' ').trim();
        } catch (_error) {
          return segment.replace(/[-_+]+/g, ' ').trim();
        }
      })
      .filter(Boolean)
      .slice(0, 4);

    return [host, ...path].join(' \u203a ');
  } catch (_error) {
    return String(value || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }
}

function siteLabelFromHostname(hostname) {
  const host = String(hostname || '').replace(/^www\./i, '').toLowerCase();
  const label = host.split('.').slice(-2, -1)[0] || host.split('.')[0] || 'source';

  return label
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'Source';
}

function resultHost(result = {}) {
  const safeUrl = safeKyroviaResultUrl(result.url);
  return hostnameFromUrl(safeUrl) || result.hostname || safeUrl.replace(/^https?:\/\//i, '').split('/')[0] || 'source';
}

function resultSiteName(result = {}) {
  const host = resultHost(result);
  const resultHostname = String(result.hostname || '').replace(/^www\./i, '').toLowerCase();
  const siteName = String(result.siteName || '').trim();

  if (siteName && (!resultHostname || resultHostname === host.toLowerCase())) {
    return siteName;
  }

  return siteLabelFromHostname(host);
}

function resultInitials(result = {}) {
  const label = (resultSiteName(result) || resultHost(result) || 'source').replace(/[^a-z0-9 ]/gi, ' ').trim();
  const words = label.split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? `${words[0][0]}${words[1][0]}` : label.slice(0, 2);

  return initials.toUpperCase() || 'KR';
}

function resultDisplayUrl(result = {}) {
  const safeUrl = safeKyroviaResultUrl(result.url);
  const safeHost = hostnameFromUrl(safeUrl);
  const resultHostname = String(result.hostname || '').replace(/^www\./i, '').toLowerCase();
  const displayUrl = String(result.displayUrl || result.breadcrumbUrl || '').trim();
  const normalizedDisplay = displayUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  if (
    normalizedDisplay &&
    (!safeHost || resultHostname === safeHost.toLowerCase() || normalizedDisplay.toLowerCase().startsWith(safeHost.toLowerCase()))
  ) {
    return normalizedDisplay;
  }

  return displayUrlFromUrl(safeUrl);
}

function userDisplayName(user = {}) {
  return String(user.name || user.displayName || user.username || user.email || 'Account').trim() || 'Account';
}

function userAccountLabel(user = {}) {
  const displayName = userDisplayName(user);
  const email = String(user.email || '').trim();

  return email && email !== displayName ? `${displayName} (${email})` : displayName;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightedText(text, query) {
  const content = String(text || '');
  const tokens = String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)
    .slice(0, 6);

  if (!content || !tokens.length) {
    return content;
  }

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi');

  return content.split(pattern).map((part, index) => (
    tokens.includes(part.toLowerCase()) ? <strong key={`${part}-${index}`}>{part}</strong> : part
  ));
}

function fallbackSuggestions(query) {
  const clean = query.trim();

  if (!clean) {
    return [];
  }

  return [
    `${clean} pdf`,
    `${clean} structure`,
    `${clean} price`,
    `${clean} solubility`,
    `${clean} research proposal`,
    `${clean} products`,
    `${clean} review article`,
    `${clean} clinical study`
  ];
}

function SearchPage({ onLogout, session }) {
  const [searchState, setSearchState] = useState(() => readSearchState());
  const [draft, setDraft] = useState(searchState.query);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scrollState, setScrollState] = useState({
    atBottom: false,
    nearTop: true,
    thumbHeight: 80,
    thumbOffset: 0
  });
  const scrollRef = useRef(null);

  useEffect(() => {
    function handlePopState() {
      const nextState = readSearchState();
      setSearchState(nextState);
      setDraft(nextState.query);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadResults() {
      if (!searchState.query.trim()) {
        setData(null);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await searchGoogle(
          searchState.query,
          {
            page: searchState.page,
            sort: searchState.sort,
            type: searchState.type
          },
          session.token
        );

        if (mounted) {
          setData(response);
        }
      } catch (searchError) {
        if (searchError.status === 401) {
          onLogout();
          return;
        }

        if (mounted) {
          setError(searchError.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadResults();

    return () => {
      mounted = false;
    };
  }, [onLogout, searchState.page, searchState.query, searchState.sort, searchState.type, session.token]);

  useEffect(() => {
    const scrollNode = scrollRef.current;

    if (!scrollNode) {
      return undefined;
    }

    function updateScrollState() {
      const maxScroll = scrollNode.scrollHeight - scrollNode.clientHeight;
      const trackHeight = Math.max(scrollNode.clientHeight - 12, 1);
      const thumbHeight = maxScroll <= 0
        ? trackHeight
        : Math.max(48, Math.round((scrollNode.clientHeight / scrollNode.scrollHeight) * trackHeight));
      const thumbTravel = Math.max(trackHeight - thumbHeight, 0);
      const progress = maxScroll > 0 ? Math.min(Math.max(scrollNode.scrollTop / maxScroll, 0), 1) : 0;

      setScrollState({
        atBottom: maxScroll <= 0 || scrollNode.scrollTop >= maxScroll - 24,
        nearTop: scrollNode.scrollTop <= 24,
        thumbHeight,
        thumbOffset: Math.round(progress * thumbTravel)
      });
    }

    updateScrollState();
    scrollNode.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      scrollNode.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [data, loading]);

  const results = Array.isArray(data?.results) ? data.results : [];
  const suggestions = useMemo(() => {
    const apiSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
    const merged = [...apiSuggestions, ...fallbackSuggestions(searchState.query)]
      .map((suggestion) => suggestion.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    return merged.filter((suggestion, index, all) => all.findIndex((item) => item.toLowerCase() === suggestion.toLowerCase()) === index).slice(0, 8);
  }, [data?.suggestions, searchState.query]);
  const totalPages = Math.min(Math.max(Number(data?.totalPages) || 1, 1), 10);
  const activeTab = searchState.tab || (searchState.type === 'image' ? 'images' : 'all');
  const pageNumbers = Array.from({ length: totalPages }, (_value, index) => index + 1);
  const accountLabel = userAccountLabel(session.user);

  function navigateSearch(nextState) {
    const merged = {
      ...searchState,
      ...nextState
    };

    if (merged.tab === 'images') {
      merged.type = 'image';
    } else if (nextState.tab) {
      merged.type = 'web';
    }

    const path = kyroviaSearchPath(merged);
    window.history.pushState({}, '', path);
    setSearchState(readSearchState());
    setDraft(merged.query);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function scrollResults(direction) {
    const scrollNode = scrollRef.current;

    if (!scrollNode) {
      return;
    }

    scrollNode.scrollTo({
      top: direction === 'up' ? 0 : scrollNode.scrollHeight,
      behavior: 'smooth'
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const query = draft.trim();

    if (!query) {
      return;
    }

    navigateSearch({
      page: 1,
      query,
      tab: activeTab,
      type: activeTab === 'images' ? 'image' : 'web'
    });
  }

  function handleSuggestionClick(suggestion) {
    navigateSearch({
      page: 1,
      query: suggestion,
      tab: 'all',
      type: 'web'
    });
  }

  return (
    <main className={styles.searchPage} ref={scrollRef}>
      <header className={styles.searchHeader}>
        <a className={styles.brand} href="/" aria-label="Kyrovia home">
          <img alt="" src={kyroviaLogo} />
          <span>Kyrovia</span>
        </a>

        <form className={styles.searchForm} onSubmit={handleSubmit}>
          <input
            aria-label="Search Kyrovia"
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
          {draft ? (
            <button aria-label="Clear search" onClick={() => setDraft('')} type="button">
              <X size={24} />
            </button>
          ) : null}
          <span aria-hidden="true" />
          <button aria-label="Search" type="submit">
            <Search size={25} />
          </button>
        </form>

        <div className={styles.headerActions}>
          <button title="Labs" type="button">
            <Beaker size={23} />
          </button>
          <button title="Apps" type="button">
            <Grid3X3 size={22} />
          </button>
          <button
            aria-label={`Signed in as ${accountLabel}. Log out`}
            className={styles.userChip}
            onClick={onLogout}
            title={accountLabel}
            type="button"
          >
            {session.user?.photoURL ? (
              <img alt="" src={session.user.photoURL} />
            ) : (
              <CircleUserRound size={28} />
            )}
          </button>
        </div>
      </header>

      <nav className={styles.searchTabs} aria-label="Kyrovia result categories">
        <div>
          {SEARCH_TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = tab.key === activeTab;

            return (
              <button
                aria-current={selected ? 'page' : undefined}
                className={selected ? styles.tabActive : ''}
                key={tab.key}
                onClick={() => navigateSearch({ page: 1, tab: tab.key, type: tab.key === 'images' ? 'image' : 'web' })}
                type="button"
              >
                {tab.label}
                {Icon ? <Icon size={14} /> : null}
              </button>
            );
          })}
        </div>
      </nav>

      <section className={styles.resultsShell}>
        {error ? <div className={styles.errorBox}>{error}</div> : null}

        <div className={styles.resultStats}>
          <span>{data?.resultStats || (loading ? 'Searching Kyrovia...' : `${results.length} results`)}</span>
          <label>
            <ListFilter size={16} />
            Sort
            <select
              aria-label="Sort Kyrovia results"
              onChange={(event) => navigateSearch({ page: 1, sort: event.target.value })}
              value={searchState.sort}
            >
              <option value="relevance">Relevance</option>
              <option value="verified">Verified first</option>
            </select>
          </label>
        </div>

        {loading ? <div className={styles.loadingBar}>Loading Kyrovia results...</div> : null}

        {searchState.type === 'image' ? (
          <section className={styles.imageResults}>
            {results.map((result, index) => (
              <a href={safeKyroviaResultUrl(result.url)} key={`${result.thumbnail || result.url}-${index}`} rel="noreferrer" target="_blank">
                {result.thumbnail ? <img alt={result.title || searchState.query} src={result.thumbnail} /> : <span><ImageIcon size={30} /></span>}
                <strong>{result.title || searchState.query}</strong>
                <small>{resultHost(result)}</small>
              </a>
            ))}
          </section>
        ) : (
          <section className={styles.webResults}>
            {results.map((result, index) => (
              <article className={styles.webResult} key={`${result.url}-${index}`}>
                <div className={styles.resultFavicon}>
                  {result.faviconUrl ? (
                    <img
                      alt=""
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                        event.currentTarget.nextElementSibling.hidden = false;
                      }}
                      src={result.faviconUrl}
                    />
                  ) : null}
                  <span hidden={Boolean(result.faviconUrl)}>{resultInitials(result)}</span>
                </div>
                <div className={styles.resultText}>
                  <div className={styles.resultTopLine}>
                    <div className={styles.resultIdentity}>
                      <div className={styles.resultSiteName}>{resultSiteName(result)}</div>
                      <div className={styles.resultDisplayUrl}>{resultDisplayUrl(result)}</div>
                    </div>
                    <button aria-label={`More options for ${result.title || result.query}`} type="button">
                      <MoreVertical size={20} />
                    </button>
                  </div>
                  <a className={styles.resultTitle} href={safeKyroviaResultUrl(result.url)} rel="noreferrer" target="_blank">
                    {highlightedText(result.title || result.query, searchState.query)}
                  </a>
                  <p>
                    {result.snippet ? highlightedText(result.snippet, searchState.query) : `Kyrovia found this source for "${searchState.query}".`}
                    {' '}
                    <a href={safeKyroviaResultUrl(result.url)} rel="noreferrer" target="_blank">Read more</a>
                  </p>
                </div>
              </article>
            ))}
          </section>
        )}

        {suggestions.length ? (
          <section className={styles.peopleAlsoSearch}>
            <h2>People also search for</h2>
            <div>
              {suggestions.map((suggestion) => (
                <button key={suggestion} onClick={() => handleSuggestionClick(suggestion)} type="button">
                  <span>{suggestion}</span>
                  <Search size={21} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <nav className={styles.fullPagination} aria-label="Kyrovia pages">
          <div className={styles.paginationBrand}>
            <img alt="" src={kyroviaLogo} />
            <span>Kyrovia</span>
            <ChevronRight size={24} />
          </div>
          <div>
            {pageNumbers.map((pageNumber) => (
              <button
                aria-current={pageNumber === searchState.page ? 'page' : undefined}
                className={pageNumber === searchState.page ? styles.pageActive : ''}
                disabled={loading}
                key={pageNumber}
                onClick={() => navigateSearch({ page: pageNumber })}
                type="button"
              >
                {pageNumber}
              </button>
            ))}
            <button
              disabled={loading || searchState.page >= totalPages}
              onClick={() => navigateSearch({ page: searchState.page + 1 })}
              type="button"
            >
              Next
            </button>
          </div>
        </nav>
      </section>

      <footer className={styles.searchFooter}>
        <div>Results are personalised · Try without personalisation</div>
        <div>
          <span>Location settings</span>
          <span>Based on your activity</span>
          <a href="/">Update location</a>
        </div>
        <nav>
          <a href="/">Help</a>
          <a href="/">Send feedback</a>
          <a href="/">Privacy</a>
          <a href="/">Terms</a>
        </nav>
      </footer>
      <div className={styles.scrollControls} aria-label="Scroll controls">
        <button
          aria-label="Scroll to top"
          disabled={scrollState.nearTop}
          onClick={() => scrollResults('up')}
          type="button"
        >
          <ArrowUp size={18} />
        </button>
        <span aria-hidden="true" />
        <button
          aria-label="Scroll to bottom"
          disabled={scrollState.atBottom}
          onClick={() => scrollResults('down')}
          type="button"
        >
          <ArrowDown size={18} />
        </button>
      </div>
      <div
        aria-hidden="true"
        className={styles.scrollRail}
        style={{
          '--scroll-thumb-height': `${scrollState.thumbHeight}px`,
          '--scroll-thumb-offset': `${scrollState.thumbOffset}px`
        }}
      >
        <span />
      </div>
    </main>
  );
}

export default SearchPage;
