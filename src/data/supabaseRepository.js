import { createClient } from '@supabase/supabase-js';

function assertNoError(result) {
  if (result.error) throw result.error;
  return result.data;
}

export class SupabaseRepository {
  constructor(url, anonKey) {
    this.client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'leet-room-auth',
      },
    });
    this.listeners = new Set();
    this.channel = null;
    this.refreshTimer = null;
  }

  get mode() {
    return 'online';
  }

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  onAuthStateChange(listener) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => listener(session));
    return () => data.subscription.unsubscribe();
  }

  async requestOtp(email) {
    return assertNoError(await this.client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    }));
  }

  async verifyOtp(email, token) {
    const data = assertNoError(await this.client.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    }));
    return data.session;
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  async getSnapshot() {
    const activeRoomId = localStorage.getItem('leet-room-active-room') || null;
    const data = assertNoError(await this.client.rpc('get_app_snapshot', {
      p_active_room_id: activeRoomId,
    }));
    this.connectRealtime(data?.activeRoomId);
    return data;
  }

  async setActiveRoom(roomId) {
    localStorage.setItem('leet-room-active-room', roomId);
    this.connectRealtime(roomId);
    return this.getSnapshot();
  }

  async createRoom({ name, visibility }) {
    const roomId = assertNoError(await this.client.rpc('create_room', {
      p_name: name,
      p_visibility: visibility,
    }));
    if (roomId) localStorage.setItem('leet-room-active-room', roomId);
    return this.getSnapshot();
  }

  async joinRoom(roomIdOrCode) {
    const roomId = assertNoError(await this.client.rpc('join_room', { p_room_or_code: roomIdOrCode }));
    if (roomId) localStorage.setItem('leet-room-active-room', roomId);
    return this.getSnapshot();
  }

  async addProblem(roomId, input) {
    assertNoError(await this.client.rpc('enqueue_problem', {
      p_room_id: roomId,
      p_url: input.url,
      p_title: input.title,
      p_difficulty: input.difficulty,
      p_tags: input.tags || [],
    }));
    return this.getSnapshot();
  }

  async setParticipantState(_roomId, problemId, nextState) {
    assertNoError(await this.client.rpc('set_problem_state', {
      p_room_problem_id: problemId,
      p_state: nextState,
    }));
    return this.getSnapshot();
  }

  async removeProblem(_roomId, problemId) {
    assertNoError(await this.client.rpc('remove_problem', { p_room_problem_id: problemId }));
    return this.getSnapshot();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  scheduleRefresh() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.listeners.forEach((listener) => listener());
    }, 120);
  }

  connectRealtime(roomId) {
    if (!roomId || this.currentRoomId === roomId) return;
    if (this.channel) this.client.removeChannel(this.channel);
    this.currentRoomId = roomId;
    this.channel = this.client
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_problems', filter: `room_id=eq.${roomId}` }, () => this.scheduleRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'problem_participants' }, () => this.scheduleRefresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, () => this.scheduleRefresh())
      .subscribe();
  }
}
