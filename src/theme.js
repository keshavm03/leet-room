import { useEffect, useState } from 'react';

const STORAGE_KEY = 'leet-room-site-theme';
const LEGACY_STORAGE_KEY = 'leet-room-leetcode-theme';

function systemTheme() {
  const dark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return {
    mode: dark ? 'dark' : 'light',
    source: 'system',
    pageBackground: dark ? 'rgb(26, 26, 26)' : 'rgb(247, 248, 250)',
    textColor: dark ? 'rgb(239, 239, 239)' : 'rgb(38, 38, 38)',
  };
}

export function normalizeTheme(theme) {
  if (!theme || !['dark', 'light'].includes(theme.mode)) return systemTheme();
  return {
    ...theme,
    mode: theme.mode,
    pageBackground: theme.pageBackground || (theme.mode === 'dark' ? 'rgb(26, 26, 26)' : 'rgb(247, 248, 250)'),
    textColor: theme.textColor || (theme.mode === 'dark' ? 'rgb(239, 239, 239)' : 'rgb(38, 38, 38)'),
  };
}

export function applyTheme(theme) {
  const next = normalizeTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = next.mode;
  root.style.colorScheme = next.mode;
  root.style.setProperty('--leetcode-page-bg', next.pageBackground);
  root.style.setProperty('--leetcode-page-text', next.textColor);
  return next;
}

function storedTheme() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return Promise.resolve(null);
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY], (result) => (
      resolve(result?.[STORAGE_KEY] || result?.[LEGACY_STORAGE_KEY] || null)
    ));
  });
}

async function activeCodingSiteTheme() {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CODING_SITE_THEME' });
    return response?.theme || null;
  } catch {
    return null;
  }
}

export function useCodingSiteTheme() {
  const [theme, setTheme] = useState(() => applyTheme(systemTheme()));

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      const detected = await activeCodingSiteTheme();
      const saved = detected || await storedTheme();
      if (mounted) setTheme(applyTheme(saved || systemTheme()));
    };
    update();

    const messageListener = (message) => {
      if (!['CODING_SITE_THEME_CHANGED', 'LEETCODE_THEME_CHANGED'].includes(message?.type) || !message.theme) return;
      update();
    };
    const tabListener = () => update();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const mediaListener = () => {
      if (theme.source === 'system') setTheme(applyTheme(systemTheme()));
    };

    if (typeof chrome !== 'undefined') {
      chrome.runtime?.onMessage?.addListener(messageListener);
      chrome.tabs?.onActivated?.addListener(tabListener);
      chrome.tabs?.onUpdated?.addListener(tabListener);
    }
    media.addEventListener('change', mediaListener);
    return () => {
      mounted = false;
      if (typeof chrome !== 'undefined') {
        chrome.runtime?.onMessage?.removeListener(messageListener);
        chrome.tabs?.onActivated?.removeListener(tabListener);
        chrome.tabs?.onUpdated?.removeListener(tabListener);
      }
      media.removeEventListener('change', mediaListener);
    };
  }, [theme.source]);

  return theme;
}

// Kept for compatibility with older imports.
export const useLeetCodeTheme = useCodingSiteTheme;
