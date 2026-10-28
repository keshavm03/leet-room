import './site-config.js';

const PANEL_PATH = 'index.html';
const SITE_CATALOG = globalThis.LEET_ROOM_SITES;
const SITE_STORAGE_KEY = globalThis.LEET_ROOM_SITE_STORAGE_KEY;
const DEFAULT_SITE_IDS = globalThis.LEET_ROOM_DEFAULT_SITE_IDS;

function siteForUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return SITE_CATALOG.find((site) => (
      url.hostname === site.domain || url.hostname.endsWith(`.${site.domain}`)
    )) || null;
  } catch {
    return null;
  }
}

async function enabledSiteIds() {
  const result = await chrome.storage.local.get(SITE_STORAGE_KEY);
  const configured = Array.isArray(result[SITE_STORAGE_KEY])
    ? result[SITE_STORAGE_KEY]
    : DEFAULT_SITE_IDS;
  return new Set([...configured, ...SITE_CATALOG.filter((site) => site.locked).map((site) => site.id)]);
}

async function setTabAvailability(tabId, enabled) {
  if (!Number.isInteger(tabId)) return;
  await chrome.sidePanel.setOptions({
    tabId,
    ...(enabled ? { path: PANEL_PATH } : {}),
    enabled,
  });
}

async function configureTab(tabId, url, allowed = null) {
  const enabled = allowed || await enabledSiteIds();
  const site = siteForUrl(url);
  await setTabAvailability(tabId, Boolean(site && enabled.has(site.id)));
}

async function configureExistingCodingTabs() {
  // With no manifest default_path, this makes every unrelated tab/window opt out.
  await chrome.sidePanel.setOptions({ enabled: false });
  const allowed = await enabledSiteIds();
  const tabs = await chrome.tabs.query({
    url: SITE_CATALOG.flatMap((site) => site.matches),
  });
  await Promise.all(tabs.map((tab) => configureTab(tab.id, tab.url, allowed)));
}

async function initializeSidePanel() {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await configureExistingCodingTabs();
}

async function updateSiteSetting(siteId, enabled) {
  const site = SITE_CATALOG.find((item) => item.id === siteId);
  if (!site) throw new Error('Unknown coding site.');
  if (site.locked && !enabled) throw new Error(`${site.name} is the required home site.`);
  const current = await enabledSiteIds();
  if (enabled) current.add(siteId);
  else current.delete(siteId);
  const next = SITE_CATALOG.filter((item) => current.has(item.id)).map((item) => item.id);
  await chrome.storage.local.set({ [SITE_STORAGE_KEY]: next });
  await configureExistingCodingTabs();
  return next;
}

// Run at service-worker evaluation time as well as lifecycle events. This also
// handles developer-mode reloads and newly opened browser windows.
initializeSidePanel().catch(console.error);

chrome.runtime.onInstalled.addListener(() => initializeSidePanel().catch(console.error));
chrome.runtime.onStartup.addListener(() => initializeSidePanel().catch(console.error));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (!url) return;
  configureTab(tabId, url).catch(console.error);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CODING_SITE_PAGE_ACTIVE' || message?.type === 'LEETCODE_PAGE_ACTIVE') {
    enabledSiteIds()
      .then((allowed) => setTabAvailability(
        sender.tab?.id,
        Boolean(message.siteId ? allowed.has(message.siteId) : allowed.has('leetcode')),
      ))
      .catch(console.error);
    return false;
  }

  if (message?.type === 'CODING_SITE_PAGE_LEFT' || message?.type === 'LEETCODE_PAGE_LEFT') {
    setTabAvailability(sender.tab?.id, false).catch(console.error);
    return false;
  }

  if (message?.type === 'GET_SITE_SETTINGS') {
    enabledSiteIds()
      .then((allowed) => sendResponse({
        ok: true,
        sites: SITE_CATALOG.map((site) => ({ ...site, enabled: allowed.has(site.id) })),
      }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'SET_SITE_ENABLED') {
    updateSiteSetting(message.siteId, Boolean(message.enabled))
      .then((enabledIds) => sendResponse({ ok: true, enabledIds }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === 'OPEN_SIDE_PANEL') {
    Promise.all([
      chrome.tabs.query({ active: true, currentWindow: true }),
      enabledSiteIds(),
    ]).then(([[tab], allowed]) => {
      const site = siteForUrl(tab?.url);
      if (!tab?.id || !site || !allowed.has(site.id)) {
        throw new Error('Enable this coding site in Leet Room settings first.');
      }
      return setTabAvailability(tab.id, true)
        .then(() => chrome.sidePanel.open({ tabId: tab.id }));
    }).then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
