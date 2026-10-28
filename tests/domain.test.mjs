import assert from 'node:assert';
import {
  applyParticipantState,
  calculateLeaderboard,
  parseLeetCodeUrl,
  parseProblemUrl,
  titleFromSlug,
} from '../src/domain.js';
import { normalizeTheme } from '../src/theme.js';

assert.deepStrictEqual(parseLeetCodeUrl('https://leetcode.com/problems/two-sum/?envType=study-plan'), {
  source: 'leetcode',
  sourceKey: 'two-sum',
  title: 'Two Sum',
  url: 'https://leetcode.com/problems/two-sum/',
});
assert.strictEqual(titleFromSlug('merge-k-sorted-lists'), 'Merge K Sorted Lists');
assert.throws(() => parseLeetCodeUrl('https://example.com/problems/two-sum/'), /Only leetcode/);
assert.deepStrictEqual(parseProblemUrl('https://www.geeksforgeeks.org/problems/two-sum/1'), {
  source: 'geeksforgeeks',
  sourceKey: 'two-sum-1',
  title: 'Two Sum',
  url: 'https://www.geeksforgeeks.org/problems/two-sum/1',
});
assert.deepStrictEqual(parseProblemUrl('https://codeforces.com/contest/4/problem/A'), {
  source: 'codeforces',
  sourceKey: '4-A',
  title: 'Problem 4A',
  url: 'https://codeforces.com/problemset/problem/4/A',
});

const problem = {
  id: 'p1',
  difficulty: 'Medium',
  state: 'queued',
  participants: [
    { userId: 'u1', status: 'thinking', required: true, startedAt: '2026-01-01T10:00:00.000Z' },
    { userId: 'u2', status: 'solved', required: true, startedAt: '2026-01-01T10:00:00.000Z' },
  ],
};
const completed = applyParticipantState(problem, 'u1', 'solved', new Date('2026-01-01T10:30:00.000Z'));
assert.strictEqual(completed.state, 'solved');
assert.strictEqual(completed.participants[0].elapsedSeconds, 1800);

const leaderboard = calculateLeaderboard({
  members: [
    { id: 'u1', name: 'A' },
    { id: 'u2', name: 'B' },
  ],
  problems: [{ ...completed, difficulty: 'Hard' }],
});
assert.strictEqual(leaderboard[0].points, 3);
assert.strictEqual(leaderboard[0].solved, 1);

assert.strictEqual(normalizeTheme({ mode: 'light', pageBackground: 'rgb(255, 255, 255)' }).mode, 'light');
assert.strictEqual(normalizeTheme({ mode: 'dark', pageBackground: 'rgb(26, 26, 26)' }).mode, 'dark');
assert.ok(['light', 'dark'].includes(normalizeTheme({ mode: 'unknown' }).mode));

console.log('domain tests passed');
