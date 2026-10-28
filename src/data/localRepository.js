import { applyParticipantState, parseProblemUrl, randomCode } from '../domain.js';
import { createSeedState } from './seed.js';

const STORAGE_KEY = 'leet-room-demo-v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class LocalRepository {
  constructor() {
    this.listeners = new Set();
    this.channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('leet-room-demo') : null;
    this.channel?.addEventListener('message', () => this.emit());
  }

  get mode() {
    return 'demo';
  }

  async getSession() {
    return { user: createSeedState().currentUser };
  }

  async getSnapshot() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const seed = createSeedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return clone(seed);
    }
    try {
      return JSON.parse(saved);
    } catch {
      const seed = createSeedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return clone(seed);
    }
  }

  async write(mutator) {
    const state = await this.getSnapshot();
    const next = mutator(clone(state)) || state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.channel?.postMessage({ type: 'changed' });
    this.emit();
    return clone(next);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach((listener) => listener());
  }

  async setActiveRoom(roomId) {
    return this.write((state) => ({ ...state, activeRoomId: roomId }));
  }

  async createRoom({ name, visibility }) {
    return this.write((state) => {
      const id = `room-${Date.now()}`;
      state.rooms.push({
        id,
        name,
        visibility,
        inviteCode: randomCode(),
        role: 'owner',
        members: [state.currentUser],
        problems: [],
      });
      state.activeRoomId = id;
      return state;
    });
  }

  async joinRoom(roomId) {
    return this.write((state) => {
      const publicRoom = state.publicRooms.find((room) => room.id === roomId);
      const existingRoom = state.rooms.find((room) => room.id === roomId || room.inviteCode === roomId);
      if (existingRoom) {
        state.activeRoomId = existingRoom.id;
        return state;
      }
      const joinedRoom = publicRoom || {
        id: `joined-${Date.now()}`,
        name: `Invited room ${String(roomId).slice(-4)}`,
        members: 1,
      };
      if (!state.rooms.some((room) => room.id === joinedRoom.id)) {
        state.rooms.push({
          id: joinedRoom.id,
          name: joinedRoom.name,
          visibility: publicRoom ? 'public' : 'private',
          inviteCode: publicRoom ? randomCode() : String(roomId).toUpperCase(),
          role: 'member',
          members: [state.currentUser],
          problems: [],
        });
      }
      state.activeRoomId = joinedRoom.id;
      return state;
    });
  }

  async addProblem(roomId, input) {
    const parsed = input.url ? parseProblemUrl(input.url) : input;
    return this.write((state) => {
      const room = state.rooms.find((item) => item.id === roomId);
      if (!room) throw new Error('Select a room first.');
      if (room.problems.some((problem) => (
        (problem.source || 'leetcode') === parsed.source && problem.sourceKey === parsed.sourceKey
      ))) {
        throw new Error('This problem is already in the room.');
      }
      room.problems.push({
        id: `rp-${Date.now()}`,
        ...parsed,
        title: input.title || parsed.title,
        difficulty: input.difficulty || 'Medium',
        tags: input.tags?.length ? input.tags : ['DSA'],
        state: 'queued',
        addedAt: new Date().toISOString(),
        completedAt: null,
        participants: room.members.map((member) => ({
          userId: member.id,
          status: 'not_started',
          required: true,
          startedAt: null,
          solvedAt: null,
          elapsedSeconds: 0,
        })),
      });
      return state;
    });
  }

  async setParticipantState(roomId, problemId, nextState) {
    return this.write((state) => {
      const room = state.rooms.find((item) => item.id === roomId);
      const index = room?.problems.findIndex((problem) => problem.id === problemId) ?? -1;
      if (!room || index < 0) throw new Error('Problem was not found.');
      room.problems[index] = applyParticipantState(room.problems[index], state.currentUser.id, nextState);
      return state;
    });
  }

  async removeProblem(roomId, problemId) {
    return this.write((state) => {
      const room = state.rooms.find((item) => item.id === roomId);
      if (!room) throw new Error('Room was not found.');
      room.problems = room.problems.filter((problem) => problem.id !== problemId);
      return state;
    });
  }

  async resetDemo() {
    const seed = createSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    this.emit();
    return clone(seed);
  }

  async signOut() {}
}
