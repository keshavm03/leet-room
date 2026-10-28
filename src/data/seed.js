const members = [
  { id: 'u1', name: 'Keshav', handle: 'keshav', initials: 'K', color: '#9b5cff', online: true },
  { id: 'u2', name: 'Aditi', handle: 'aditi', initials: 'A', color: '#56c3a5', online: true },
  { id: 'u3', name: 'Rohan', handle: 'rohan', initials: 'R', color: '#7b8ba8', online: false },
  { id: 'u4', name: 'Sara', handle: 'sara', initials: 'S', color: '#6f74f6', online: true },
  { id: 'u5', name: 'Pranav', handle: 'pranav', initials: 'P', color: '#4e69c8', online: false },
  { id: 'u6', name: 'Nisha', handle: 'nisha', initials: 'N', color: '#d164d8', online: true },
];

const statusSets = [
  ['thinking', 'thinking', 'thinking', 'thinking', 'thinking', 'not_started'],
  ['thinking', 'solved', 'thinking', 'thinking', 'not_started', 'not_started'],
  ['thinking', 'thinking', 'not_started', 'not_started', 'not_started', 'not_started'],
  ['thinking', 'not_started', 'not_started', 'not_started', 'not_started', 'not_started'],
  ['not_started', 'not_started', 'not_started', 'not_started', 'not_started', 'not_started'],
];

function participants(index) {
  return members.map((member, memberIndex) => ({
    userId: member.id,
    status: statusSets[index][memberIndex],
    required: true,
    startedAt: statusSets[index][memberIndex] !== 'not_started' ? '2026-10-27T08:30:00.000Z' : null,
    solvedAt: statusSets[index][memberIndex] === 'solved' ? '2026-10-27T09:05:00.000Z' : null,
    elapsedSeconds: statusSets[index][memberIndex] === 'solved' ? 2100 : 0,
  }));
}

function allSolved(seconds) {
  return members.map((member, index) => ({
    userId: member.id,
    status: 'solved',
    required: true,
    startedAt: '2026-10-25T08:30:00.000Z',
    solvedAt: '2026-10-25T09:30:00.000Z',
    elapsedSeconds: seconds + (index * 240),
  }));
}

export function createSeedState() {
  return {
    currentUser: members[0],
    activeRoomId: 'room-backend',
    rooms: [
      {
        id: 'room-backend',
        name: 'Backend Batch #2',
        visibility: 'private',
        inviteCode: 'AB12-C3D4',
        role: 'owner',
        members,
        problems: [
          { id: 'rp1', source: 'leetcode', sourceKey: 'two-sum', title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/', difficulty: 'Easy', tags: ['Array'], state: 'queued', addedAt: '2026-10-27T07:30:00.000Z', participants: participants(0) },
          { id: 'rp2', source: 'leetcode', sourceKey: 'add-two-numbers', title: 'Add Two Numbers', url: 'https://leetcode.com/problems/add-two-numbers/', difficulty: 'Medium', tags: ['Linked List'], state: 'queued', addedAt: '2026-10-27T07:32:00.000Z', participants: participants(1) },
          { id: 'rp3', source: 'leetcode', sourceKey: 'longest-substring-without-repeating-characters', title: 'Longest Substring Without Repeating Characters', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', difficulty: 'Medium', tags: ['String'], state: 'queued', addedAt: '2026-10-27T07:34:00.000Z', participants: participants(2) },
          { id: 'rp4', source: 'leetcode', sourceKey: 'merge-k-sorted-lists', title: 'Merge K Sorted Lists', url: 'https://leetcode.com/problems/merge-k-sorted-lists/', difficulty: 'Hard', tags: ['Heap'], state: 'queued', addedAt: '2026-10-27T07:36:00.000Z', participants: participants(3) },
          { id: 'rp5', source: 'leetcode', sourceKey: 'container-with-most-water', title: 'Container With Most Water', url: 'https://leetcode.com/problems/container-with-most-water/', difficulty: 'Medium', tags: ['Two Pointers'], state: 'queued', addedAt: '2026-10-27T07:38:00.000Z', participants: participants(4) },
          { id: 'rp6', source: 'leetcode', sourceKey: 'valid-parentheses', title: 'Valid Parentheses', url: 'https://leetcode.com/problems/valid-parentheses/', difficulty: 'Easy', tags: ['Stack'], state: 'solved', addedAt: '2026-10-25T07:00:00.000Z', completedAt: '2026-10-25T10:00:00.000Z', participants: allSolved(1800) },
          { id: 'rp7', source: 'leetcode', sourceKey: 'binary-tree-level-order-traversal', title: 'Binary Tree Level Order Traversal', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/', difficulty: 'Medium', tags: ['Tree', 'BFS'], state: 'solved', addedAt: '2026-10-24T07:00:00.000Z', completedAt: '2026-10-24T11:00:00.000Z', participants: allSolved(2700) },
        ],
      },
      {
        id: 'room-dp',
        name: 'Dynamic Programming Club',
        visibility: 'public',
        inviteCode: 'DP42-ROOM',
        role: 'member',
        members: members.slice(0, 4),
        problems: [],
      },
    ],
    publicRooms: [
      { id: 'public-1', name: '30 Days of Graphs', members: 18, problems: 12, tags: ['Graphs', 'Daily'] },
      { id: 'public-2', name: 'Interview Sprint', members: 34, problems: 24, tags: ['FAANG', 'Mixed'] },
      { id: 'public-3', name: 'DP From Zero', members: 11, problems: 8, tags: ['Dynamic Programming'] },
    ],
  };
}
