import { useCallback, useEffect, useState } from 'react';

const fallbackSites = [
  { id: 'leetcode', name: 'LeetCode', domain: 'leetcode.com', description: 'Primary site · always enabled', locked: true, enabled: true },
  { id: 'geeksforgeeks', name: 'GeeksforGeeks', domain: 'geeksforgeeks.org', description: 'Practice problem pages', enabled: false },
  { id: 'codeforces', name: 'Codeforces', domain: 'codeforces.com', description: 'Problemset and contest pages', enabled: false },
];

function sendMessage(message) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return Promise.resolve({ ok: true, sites: fallbackSites });
  }
  return chrome.runtime.sendMessage(message);
}

export function useSiteAccess(showToast) {
  const [sites, setSites] = useState(fallbackSites);
  const [busySite, setBusySite] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const response = await sendMessage({ type: 'GET_SITE_SETTINGS' });
      if (response?.ok && response.sites) setSites(response.sites);
    } catch {
      // The web preview uses the fallback catalog.
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setSiteEnabled = useCallback(async (site, enabled) => {
    if (site.locked) return;
    setBusySite(site.id);
    try {
      const response = await sendMessage({
        type: 'SET_SITE_ENABLED',
        siteId: site.id,
        enabled,
      });
      if (!response?.ok) throw new Error(response?.error || 'Could not update site access.');
      setSites((current) => current.map((item) => (
        item.id === site.id ? { ...item, enabled } : item
      )));
      showToast?.(`${site.name} ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      showToast?.(error.message || 'Could not update site access.', 'error');
    } finally {
      setBusySite(null);
    }
  }, [showToast]);

  return { sites, busySite, setSiteEnabled };
}
