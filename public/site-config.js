(function defineLeetRoomSites() {
  globalThis.LEET_ROOM_SITE_STORAGE_KEY = 'leet-room-enabled-sites';
  globalThis.LEET_ROOM_DEFAULT_SITE_IDS = ['leetcode'];
  globalThis.LEET_ROOM_SITES = [
    {
      id: 'leetcode',
      name: 'LeetCode',
      domain: 'leetcode.com',
      description: 'Primary site · always enabled',
      locked: true,
      matches: ['https://leetcode.com/*', 'https://*.leetcode.com/*'],
    },
    {
      id: 'geeksforgeeks',
      name: 'GeeksforGeeks',
      domain: 'geeksforgeeks.org',
      description: 'Practice problem pages',
      matches: ['https://geeksforgeeks.org/*', 'https://*.geeksforgeeks.org/*'],
    },
    {
      id: 'codeforces',
      name: 'Codeforces',
      domain: 'codeforces.com',
      description: 'Problemset and contest pages',
      matches: ['https://codeforces.com/*', 'https://*.codeforces.com/*'],
    },
  ];
})();
