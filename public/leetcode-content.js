(function () {
  const STORAGE_KEY = 'leet-room-site-theme';
  const LEGACY_STORAGE_KEY = 'leet-room-leetcode-theme';
  const site = globalThis.LEET_ROOM_SITES?.find((item) => (
    window.location.hostname === item.domain
      || window.location.hostname.endsWith(`.${item.domain}`)
  ));
  if (!site) return;
  let lastThemeSignature = '';
  let updateTimer = null;

  function notifyPageActive() {
    try {
      chrome.runtime.sendMessage({ type: 'CODING_SITE_PAGE_ACTIVE', siteId: site.id }).catch(() => {});
    } catch {
      // The extension may have been reloaded while this page stayed open.
    }
  }

  function notifyPageLeft() {
    try {
      chrome.runtime.sendMessage({ type: 'CODING_SITE_PAGE_LEFT', siteId: site.id }).catch(() => {});
    } catch {
      // The tab may already be closing.
    }
  }

  function parseRgb(value) {
    const match = String(value || '').match(/rgba?\((\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)[, ]+(\d+(?:\.\d+)?)(?:[, /]+(\d*\.?\d+))?\)/i);
    if (!match) return null;
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: match[4] === undefined ? 1 : Number(match[4]),
    };
  }

  function relativeLuminance(color) {
    const convert = (channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return (0.2126 * convert(color.r)) + (0.7152 * convert(color.g)) + (0.0722 * convert(color.b));
  }

  function firstOpaqueColor(elements, property, fallback) {
    for (const element of elements) {
      if (!element) continue;
      const value = getComputedStyle(element)[property];
      const parsed = parseRgb(value);
      if (parsed && parsed.a > 0.25) return value;
    }
    return fallback;
  }

  function detectTheme() {
    const root = document.documentElement;
    const body = document.body;
    const marker = [
      root.getAttribute('data-theme'),
      root.getAttribute('theme'),
      root.className,
      body?.getAttribute('data-theme'),
      body?.className,
    ].filter(Boolean).join(' ').toLowerCase();

    const pageBackground = firstOpaqueColor([body, root], 'backgroundColor', 'rgb(26, 26, 26)');
    const textColor = firstOpaqueColor([body, root], 'color', 'rgb(239, 239, 239)');
    const parsedBackground = parseRgb(pageBackground);
    const computedScheme = getComputedStyle(root).colorScheme || '';

    let mode;
    if (/(^|\s|[-_:])dark($|\s|[-_:])/.test(marker) || computedScheme.trim() === 'dark') mode = 'dark';
    else if (/(^|\s|[-_:])light($|\s|[-_:])/.test(marker) || computedScheme.trim() === 'light') mode = 'light';
    else if (parsedBackground) mode = relativeLuminance(parsedBackground) < 0.36 ? 'dark' : 'light';
    else mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    return {
      mode,
      pageBackground,
      textColor,
      source: site.id,
      siteName: site.name,
      detectedAt: Date.now(),
    };
  }

  function publishTheme(force) {
    const theme = detectTheme();
    const signature = `${theme.mode}|${theme.pageBackground}|${theme.textColor}`;
    if (!force && signature === lastThemeSignature) return theme;
    lastThemeSignature = signature;
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: theme, [LEGACY_STORAGE_KEY]: theme });
      chrome.runtime.sendMessage({ type: 'CODING_SITE_THEME_CHANGED', theme }).catch(() => {});
    } catch {
      // The extension may have been reloaded while this page stayed open.
    }
    return theme;
  }

  function scheduleThemeUpdate() {
    window.clearTimeout(updateTimer);
    updateTimer = window.setTimeout(() => publishTheme(false), 80);
  }

  function titleFromSlug(slug) {
    return slug.split(/[-_]+/).filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  function visibleTitle(fallback) {
    const suffixes = /\s*[-|]\s*(LeetCode|GeeksforGeeks|Codeforces).*$/i;
    const title = document.title.replace(suffixes, '').replace(/^[A-Z0-9]+\.\s*/, '').trim();
    return title && !['leetcode', 'geeksforgeeks', 'codeforces'].includes(title.toLowerCase())
      ? title
      : fallback;
  }

  function normalizeProblem() {
    if (site.id === 'leetcode') {
      const match = window.location.pathname.match(/^\/problems\/([^/]+)/i);
      if (!match) return null;
      const slug = decodeURIComponent(match[1]).toLowerCase();
      return {
        source: site.id,
        sourceKey: slug,
        title: visibleTitle(titleFromSlug(slug)),
        url: `https://leetcode.com/problems/${slug}/`,
      };
    }

    if (site.id === 'geeksforgeeks') {
      const match = window.location.pathname.match(/^\/problems\/([^/]+)(?:\/([^/]+))?/i);
      if (!match) return null;
      const slug = decodeURIComponent(match[1]).toLowerCase();
      const problemId = match[2] && /^\d+$/.test(match[2]) ? match[2] : null;
      return {
        source: site.id,
        sourceKey: problemId ? `${slug}-${problemId}` : slug,
        title: visibleTitle(titleFromSlug(slug)),
        url: `https://www.geeksforgeeks.org/problems/${slug}/${problemId || ''}`,
      };
    }

    if (site.id === 'codeforces') {
      const match = window.location.pathname.match(/^\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Za-z0-9]+)/i);
      if (!match) return null;
      const contest = match[1];
      const index = match[2].toUpperCase();
      return {
        source: site.id,
        sourceKey: `${contest}-${index}`,
        title: visibleTitle(`Problem ${contest}${index}`),
        url: `https://codeforces.com/problemset/problem/${contest}/${index}`,
      };
    }

    return null;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_CURRENT_PROBLEM') {
      sendResponse({ problem: normalizeProblem(), theme: publishTheme(true) });
    } else if (message?.type === 'GET_CODING_SITE_THEME' || message?.type === 'GET_LEETCODE_THEME') {
      sendResponse({ theme: publishTheme(true) });
    }
    return false;
  });

  const observer = new MutationObserver(scheduleThemeUpdate);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'theme'] });
  if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', scheduleThemeUpdate);
  window.addEventListener('pageshow', notifyPageActive);
  window.addEventListener('pagehide', notifyPageLeft);
  notifyPageActive();
  publishTheme(true);
})();
