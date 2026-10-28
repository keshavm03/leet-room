export const PARTICIPANT_STATES = ['not_started', 'thinking', 'solved'];

export function titleFromSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function parseProblemUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid problem URL.');
  }

  if (/(^|\.)leetcode\.com$/i.test(url.hostname)) {
    const match = url.pathname.match(/^\/problems\/([^/]+)/i);
    if (!match) throw new Error('This does not look like a LeetCode problem link.');
    const sourceKey = decodeURIComponent(match[1]).toLowerCase();
    return {
      source: 'leetcode',
      sourceKey,
      title: titleFromSlug(sourceKey),
      url: `https://leetcode.com/problems/${sourceKey}/`,
    };
  }

  if (/(^|\.)geeksforgeeks\.org$/i.test(url.hostname)) {
    const match = url.pathname.match(/^\/problems\/([^/]+)(?:\/([^/]+))?/i);
    if (!match) throw new Error('This does not look like a GeeksforGeeks problem link.');
    const slug = decodeURIComponent(match[1]).toLowerCase();
    const problemId = match[2] && /^\d+$/.test(match[2]) ? match[2] : null;
    return {
      source: 'geeksforgeeks',
      sourceKey: problemId ? `${slug}-${problemId}` : slug,
      title: titleFromSlug(slug),
      url: `https://www.geeksforgeeks.org/problems/${slug}/${problemId || ''}`,
    };
  }

  if (/(^|\.)codeforces\.com$/i.test(url.hostname)) {
    const match = url.pathname.match(/^\/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Za-z0-9]+)/i);
    if (!match) throw new Error('This does not look like a Codeforces problem link.');
    const contest = match[1];
    const index = match[2].toUpperCase();
    return {
      source: 'codeforces',
      sourceKey: `${contest}-${index}`,
      title: `Problem ${contest}${index}`,
      url: `https://codeforces.com/problemset/problem/${contest}/${index}`,
    };
  }

  throw new Error('Use a LeetCode, GeeksforGeeks or Codeforces problem link.');
}

export function parseLeetCodeUrl(value) {
  let hostname = '';
  try { hostname = new URL(value.trim()).hostname; } catch { /* handled below */ }
  if (!/(^|\.)leetcode\.com$/i.test(hostname)) {
    throw new Error('Only leetcode.com problem links are supported.');
  }
  const parsed = parseProblemUrl(value);
  return parsed;
}

export function applyParticipantState(problem, userId, nextState, now = new Date()) {
  if (!PARTICIPANT_STATES.includes(nextState)) {
    throw new Error(`Unknown participant state: ${nextState}`);
  }

  const timestamp = now.toISOString();
  let found = false;
  const participants = problem.participants.map((participant) => {
    if (participant.userId !== userId) return participant;
    found = true;

    const next = { ...participant, status: nextState };
    if (nextState === 'thinking' && !next.startedAt) next.startedAt = timestamp;
    if (nextState === 'solved') {
      next.startedAt = next.startedAt || timestamp;
      next.solvedAt = timestamp;
      next.elapsedSeconds = Math.max(
        0,
        Math.round((now.getTime() - new Date(next.startedAt).getTime()) / 1000),
      );
    }
    if (nextState === 'not_started') {
      next.startedAt = null;
      next.solvedAt = null;
      next.elapsedSeconds = 0;
    }
    return next;
  });

  if (!found) throw new Error('You are not assigned to this problem.');

  const isComplete = participants.filter((item) => item.required !== false)
    .every((item) => item.status === 'solved');

  return {
    ...problem,
    participants,
    state: isComplete ? 'solved' : 'queued',
    completedAt: isComplete ? timestamp : null,
  };
}

export function formatDuration(totalSeconds = 0) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  const seconds = Math.floor(totalSeconds % 60);
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function calculateLeaderboard(room) {
  return room.members
    .map((member) => {
      const entries = room.problems.flatMap((problem) => (
        problem.participants
          .filter((participant) => participant.userId === member.id && participant.status === 'solved')
          .map((participant) => ({ problem, participant }))
      ));
      const points = entries.reduce((sum, { problem }) => {
        if (problem.difficulty === 'Hard') return sum + 3;
        if (problem.difficulty === 'Medium') return sum + 2;
        return sum + 1;
      }, 0);
      const timed = entries.filter(({ participant }) => participant.elapsedSeconds > 0);
      const averageSeconds = timed.length
        ? Math.round(timed.reduce((sum, { participant }) => sum + participant.elapsedSeconds, 0) / timed.length)
        : 0;
      return { ...member, solved: entries.length, points, averageSeconds };
    })
    .sort((a, b) => b.points - a.points || b.solved - a.solved || a.name.localeCompare(b.name));
}

export function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}
