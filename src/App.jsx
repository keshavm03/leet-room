import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { repository, isOnlineConfigured } from './data/repository.js';
import { calculateLeaderboard, formatDuration, parseProblemUrl } from './domain.js';
import { AuthScreen } from './components/AuthScreen.jsx';
import { Icon } from './components/Icons.jsx';
import { Modal } from './components/Modal.jsx';
import { ProblemCard } from './components/ProblemCard.jsx';
import { useCodingSiteTheme } from './theme.js';
import { useSiteAccess } from './siteAccess.js';

const navigation = [
  { id: 'rooms', label: 'Rooms', icon: 'users' },
  { id: 'activity', label: 'My Activity', icon: 'activity' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const inviteBaseUrl = (import.meta.env.VITE_INVITE_BASE_URL || 'https://keshavm03.github.io/leet-room/#/join').replace(/\/$/, '');

function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2800);
  }, []);
  return [toast, showToast];
}

function EmptyState({ icon = 'users', title, copy, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={23} /></div>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function CreateRoomModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await onCreate({ name: name.trim(), visibility });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Create a room" subtitle="Start a shared problem queue for your team." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>Room name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Backend Batch #3" required autoFocus /></label>
        <fieldset>
          <legend>Visibility</legend>
          <label className={`choice-card ${visibility === 'private' ? 'selected' : ''}`}>
            <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
            <span><strong>Private</strong><small>Only people with an invite can join.</small></span>
          </label>
          <label className={`choice-card ${visibility === 'public' ? 'selected' : ''}`}>
            <input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
            <span><strong>Public</strong><small>Discoverable by everyone in the Leet Room community.</small></span>
          </label>
        </fieldset>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create room'}</button></div>
      </form>
    </Modal>
  );
}

function AddProblemModal({ onClose, onAdd, capturedProblem }) {
  const [url, setUrl] = useState(capturedProblem?.url || '');
  const [title, setTitle] = useState(capturedProblem?.title || '');
  const [difficulty, setDifficulty] = useState('Medium');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function inspectUrl(value) {
    setUrl(value);
    try {
      const parsed = parseProblemUrl(value);
      let previousTitle = '';
      try { previousTitle = parseProblemUrl(url || value).title; } catch { /* keep typed title */ }
      if (!title || title === previousTitle) setTitle(parsed.title);
      setError('');
    } catch (err) {
      if (value) setError(err.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const parsed = parseProblemUrl(url);
      await onAdd({
        ...parsed,
        title: title.trim() || parsed.title,
        difficulty,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not add the problem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a problem" subtitle="Everyone in the room will see it immediately." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>Problem link<input value={url} onChange={(event) => inspectUrl(event.target.value)} placeholder="LeetCode, GeeksforGeeks or Codeforces URL" required autoFocus /></label>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Two Sum" required /></label>
        <div className="form-grid">
          <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
          <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Array, Hash Map" /></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Adding…' : 'Add to queue'}</button></div>
      </form>
    </Modal>
  );
}

function DiscoverRoomsModal({ rooms, onJoin, onClose }) {
  const [query, setQuery] = useState('');
  const visible = rooms.filter((room) => room.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <Modal title="Public rooms" subtitle="Join rooms that are open to the community." onClose={onClose}>
      <label className="search-field"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rooms" autoFocus /></label>
      <div className="public-room-list">
        {visible.map((room) => (
          <div className="public-room" key={room.id}>
            <div className="public-room-icon"><Icon name="users" size={19} /></div>
            <div><strong>{room.name}</strong><span>{room.members} members · {room.problems} problems</span><div>{room.tags.map((tag) => <em key={tag}>{tag}</em>)}</div></div>
            <button className="secondary-button compact" onClick={() => onJoin(room.id)}>Join</button>
          </div>
        ))}
        {!visible.length && <EmptyState icon="search" title="No rooms found" copy="Try a different room name." />}
      </div>
    </Modal>
  );
}

function JoinRoomModal({ onJoin, onClose }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const trimmed = value.trim();
      const code = trimmed.includes('/') ? trimmed.split('/').filter(Boolean).pop() : trimmed;
      if (!code || code.length < 4) throw new Error('Enter a valid room link or invite code.');
      await onJoin(code.toUpperCase());
      onClose();
    } catch (err) {
      setError(err.message || 'Could not join the room.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Join a private room" subtitle="Paste the room link or the invite code sent by your teammate." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>Room link or code<input value={value} onChange={(event) => setValue(event.target.value)} placeholder="AB12-C3D4" autoFocus required /></label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Joining…' : 'Join room'}</button></div>
      </form>
    </Modal>
  );
}

function RoomView({ snapshot, room, onRefresh, showToast }) {
  const [queueTab, setQueueTab] = useState('queued');
  const [modal, setModal] = useState(null);
  const [capturedProblem, setCapturedProblem] = useState(null);
  const [helpOpen, setHelpOpen] = useState(true);
  const queue = room?.problems.filter((problem) => problem.state !== 'solved') || [];
  const solved = room?.problems.filter((problem) => problem.state === 'solved') || [];
  const shown = queueTab === 'queued' ? queue : solved;
  const inviteUrl = room ? `${inviteBaseUrl}/${room.inviteCode}` : '';

  async function selectRoom(roomId) {
    await repository.setActiveRoom(roomId);
    await onRefresh();
  }

  async function createRoom(input) {
    try {
      await repository.createRoom(input);
      await onRefresh();
      showToast('Room created. Share the invite when you are ready.');
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  }

  async function captureCurrentProblem() {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      setCapturedProblem(null);
      setModal('add');
      return;
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('Open a supported problem page first.');
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_PROBLEM' });
      if (!response?.problem) throw new Error('Open a supported problem page first.');
      setCapturedProblem(response.problem);
      setModal('add');
    } catch (err) {
      showToast(err.message || 'Open a supported problem page first.', 'error');
    }
  }

  async function addProblem(input) {
    try {
      await repository.addProblem(room.id, input);
      await onRefresh();
      setQueueTab('queued');
      showToast(`${input.title} added to the queue.`);
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  }

  async function setState(problemId, state) {
    try {
      await repository.setParticipantState(room.id, problemId, state);
      await onRefresh();
      showToast(state === 'solved' ? 'Marked solved.' : state === 'thinking' ? 'You are now thinking on this problem.' : 'Status updated.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function removeProblem(problemId) {
    try {
      await repository.removeProblem(room.id, problemId);
      await onRefresh();
      showToast('Problem removed.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    showToast('Room invite copied.');
  }

  return (
    <>
      <section className="room-toolbar">
        <div className="room-select-wrap">
          <span className="presence-dot" />
          <select value={room?.id || ''} onChange={(event) => selectRoom(event.target.value)} aria-label="Current room">
            {snapshot.rooms.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.members.length} members</option>)}
          </select>
        </div>
        <button className="primary-button create-room-button" onClick={() => setModal('create')}><Icon name="plus" /><span>Create Room</span></button>
      </section>

      {!room ? (
        <EmptyState title="Create your first room" copy="Rooms keep your team’s DSA queue and progress together." action={<button className="primary-button" onClick={() => setModal('create')}>Create room</button>} />
      ) : (
        <>
          <section className="invite-row">
            <div className="invite-label"><Icon name="link" size={17} /><span>Share room link</span></div>
            <div className="invite-value" title={inviteUrl}>{inviteUrl}</div>
            <button className="copy-button" onClick={copyInvite} aria-label="Copy room invite"><Icon name="copy" size={17} /></button>
          </section>
          <p className="invite-help">Anyone with this link can join this {room.visibility} room.</p>

          <section className="queue-header">
            <div className="segmented-control" role="tablist">
              <button className={queueTab === 'queued' ? 'active' : ''} onClick={() => setQueueTab('queued')}>Queue <span>{queue.length}</span></button>
              <button className={queueTab === 'solved' ? 'active' : ''} onClick={() => setQueueTab('solved')}>Solved <span>{solved.length}</span></button>
            </div>
            <button className="add-problem-button" onClick={captureCurrentProblem}><Icon name="plus" size={16} /><span>Add current</span></button>
          </section>

          <div className="problem-list">
            {shown.map((problem, index) => (
              <ProblemCard key={problem.id} index={index} problem={problem} room={room} currentUser={snapshot.currentUser} onSetState={setState} onRemove={removeProblem} />
            ))}
            {!shown.length && (
              <EmptyState
                icon={queueTab === 'solved' ? 'trophy' : 'plus'}
                title={queueTab === 'solved' ? 'No completed problems yet' : 'The queue is empty'}
                copy={queueTab === 'solved' ? 'A problem moves here when every assigned member marks it solved.' : 'Open a problem on an enabled coding site and add it for your team.'}
                action={queueTab === 'queued' ? <button className="secondary-button" onClick={captureCurrentProblem}>Add a problem</button> : null}
              />
            )}
          </div>

          <section className={`how-it-works ${helpOpen ? 'open' : ''}`}>
            <button onClick={() => setHelpOpen((value) => !value)}><span><Icon name="info" size={16} />How it works</span><Icon name="chevron" size={16} /></button>
            {helpOpen && <ol><li>Share the room invite with your teammates.</li><li>Add a problem from the active coding-site page.</li><li>Each person marks Thinking, then Solved.</li><li>When everyone is done, it moves to the Solved tab.</li></ol>}
          </section>
        </>
      )}

      {modal === 'create' && <CreateRoomModal onClose={() => setModal(null)} onCreate={createRoom} />}
      {modal === 'add' && <AddProblemModal capturedProblem={capturedProblem} onClose={() => { setModal(null); setCapturedProblem(null); }} onAdd={addProblem} />}
    </>
  );
}

function ActivityView({ snapshot, room }) {
  const entries = room?.problems.map((problem) => ({
    problem,
    participant: problem.participants.find((item) => item.userId === snapshot.currentUser.id),
  })).filter((item) => item.participant) || [];
  const solved = entries.filter((item) => item.participant.status === 'solved');
  const thinking = entries.filter((item) => item.participant.status === 'thinking');
  const totalSeconds = solved.reduce((sum, item) => sum + (item.participant.elapsedSeconds || 0), 0);
  return (
    <section className="page-view">
      <div className="section-heading"><div><h2>My activity</h2><p>Your progress in {room?.name || 'this room'}.</p></div></div>
      <div className="stats-grid">
        <div className="stat-card"><span>Solved</span><strong>{solved.length}</strong><small>problems</small></div>
        <div className="stat-card"><span>Thinking</span><strong>{thinking.length}</strong><small>right now</small></div>
        <div className="stat-card"><span>Focus time</span><strong>{formatDuration(totalSeconds)}</strong><small>recorded</small></div>
      </div>
      <div className="activity-list">
        {entries.map(({ problem, participant }) => (
          <a href={problem.url} target="_blank" rel="noreferrer" className="activity-row" key={problem.id}>
            <span className={`activity-status ${participant.status}`}><Icon name={participant.status === 'solved' ? 'check' : participant.status === 'thinking' ? 'clock' : 'more'} size={16} /></span>
            <span><strong>{problem.title}</strong><small>{problem.difficulty} · {problem.tags?.join(', ')}</small></span>
            <em>{participant.status.replace('_', ' ')}</em>
            <Icon name="chevron" size={16} />
          </a>
        ))}
      </div>
    </section>
  );
}

function LeaderboardView({ room, currentUser }) {
  const leaderboard = useMemo(() => room ? calculateLeaderboard(room) : [], [room]);
  return (
    <section className="page-view">
      <div className="section-heading"><div><h2>Leaderboard</h2><p>Points from unique solved problems in this room.</p></div><span className="period-pill">All time</span></div>
      <div className="leaderboard-list">
        {leaderboard.map((member, index) => (
          <div className={`leader-row ${member.id === currentUser.id ? 'is-me' : ''}`} key={member.id}>
            <span className={`rank rank-${index + 1}`}>{index + 1}</span>
            <span className="leader-avatar" style={{ '--avatar-color': member.color || '#6d72e8' }}>{member.initials || member.name?.charAt(0)}</span>
            <span className="leader-name"><strong>{member.name}{member.id === currentUser.id ? ' (you)' : ''}</strong><small>{member.solved} solved · avg {formatDuration(member.averageSeconds)}</small></span>
            <strong className="points">{member.points}<small> pts</small></strong>
          </div>
        ))}
      </div>
      <div className="scoring-note"><Icon name="info" size={16} /><span>Easy = 1 point · Medium = 2 points · Hard = 3 points</span></div>
    </section>
  );
}

function SettingsView({ snapshot, onRefresh, showToast, onSignOut, theme }) {
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const { sites, busySite, setSiteEnabled } = useSiteAccess(showToast);
  async function join(roomId) {
    try {
      await repository.joinRoom(roomId);
      await onRefresh();
      setDiscoverOpen(false);
      showToast('You joined the room.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
  async function reset() {
    if (repository.mode !== 'demo') return;
    await repository.resetDemo();
    await onRefresh();
    showToast('Demo data restored.');
  }
  return (
    <section className="page-view settings-view">
      <div className="section-heading"><div><h2>Settings</h2><p>Account, rooms and connection details.</p></div></div>
      <div className="settings-card profile-card">
        <span className="profile-avatar" style={{ '--avatar-color': snapshot.currentUser.color || '#835af2' }}>{snapshot.currentUser.initials || snapshot.currentUser.name?.charAt(0)}</span>
        <div><strong>{snapshot.currentUser.name}</strong><span>@{snapshot.currentUser.handle}</span></div>
        <span className="mode-badge">{repository.mode === 'demo' ? 'Demo' : 'Online'}</span>
      </div>
      <div className="settings-card connection-card">
        <div><span className={`connection-indicator ${repository.mode}`} /><div><strong>{repository.mode === 'demo' ? 'Local demo mode' : 'Supabase realtime'}</strong><small>{repository.mode === 'demo' ? 'Data stays in this browser until Supabase is configured.' : 'Changes sync across every connected computer.'}</small></div></div>
        <code>{repository.mode === 'demo' ? 'VITE_SUPABASE_URL not set' : 'Connected securely'}</code>
      </div>
      <div className="settings-card theme-card">
        <span className={`theme-preview ${theme.mode}`}><i /><i /><i /></span>
        <div><strong>Following active site theme</strong><small>{theme.mode === 'dark' ? 'Dark' : 'Light'} mode detected from {theme.siteName || 'your coding site'}.</small></div>
        <span className="mode-badge">Auto</span>
      </div>
      <div className="settings-card sites-card">
        <div className="sites-card-heading"><div><strong>Coding-site whitelist</strong><small>Show Leet Room in every tab for enabled sites.</small></div><span>{sites.filter((site) => site.enabled).length}/{sites.length}</span></div>
        <div className="site-access-list">
          {sites.map((site) => (
            <label className="site-access-row" key={site.id}>
              <span className={`site-monogram site-${site.id}`}>{site.name.charAt(0)}</span>
              <span><strong>{site.name}</strong><small>{site.description}</small></span>
              <input
                type="checkbox"
                role="switch"
                checked={Boolean(site.enabled)}
                disabled={site.locked || busySite === site.id}
                onChange={(event) => setSiteEnabled(site, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>
      <button className="settings-row" onClick={() => setJoinOpen(true)}><span className="settings-row-icon"><Icon name="link" /></span><span><strong>Join with invite</strong><small>Paste a private room link or invite code.</small></span><Icon name="chevron" /></button>
      <button className="settings-row" onClick={() => setDiscoverOpen(true)}><span className="settings-row-icon"><Icon name="search" /></span><span><strong>Discover public rooms</strong><small>Browse rooms open to the community.</small></span><Icon name="chevron" /></button>
      {repository.mode === 'demo' && <button className="settings-row" onClick={reset}><span className="settings-row-icon"><Icon name="refresh" /></span><span><strong>Reset demo data</strong><small>Restore the original rooms and sample progress.</small></span><Icon name="chevron" /></button>}
      {repository.mode === 'online' && <button className="settings-row danger" onClick={onSignOut}><span className="settings-row-icon"><Icon name="logout" /></span><span><strong>Sign out</strong><small>Remove the local session from this browser.</small></span><Icon name="chevron" /></button>}
      {joinOpen && <JoinRoomModal onJoin={join} onClose={() => setJoinOpen(false)} />}
      {discoverOpen && <DiscoverRoomsModal rooms={snapshot.publicRooms || []} onJoin={join} onClose={() => setDiscoverOpen(false)} />}
    </section>
  );
}

export default function App() {
  const theme = useCodingSiteTheme();
  const [sessionReady, setSessionReady] = useState(repository.mode === 'demo');
  const [session, setSession] = useState(repository.mode === 'demo' ? { user: true } : null);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('rooms');
  const [toast, showToast] = useToast();

  const refresh = useCallback(async () => {
    try {
      const next = await repository.getSnapshot();
      setSnapshot(next);
    } catch (err) {
      showToast(err.message || 'Could not load your rooms.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let mounted = true;
    repository.getSession().then((value) => {
      if (!mounted) return;
      setSession(value);
      setSessionReady(true);
    }).catch((err) => {
      showToast(err.message, 'error');
      setSessionReady(true);
    });
    const unsubscribeAuth = repository.onAuthStateChange?.((value) => setSession(value));
    return () => { mounted = false; unsubscribeAuth?.(); };
  }, [showToast]);

  useEffect(() => {
    if (!session) return undefined;
    refresh();
    return repository.subscribe(() => refresh());
  }, [session, refresh]);

  const activeRoom = snapshot?.rooms.find((room) => room.id === snapshot.activeRoomId) || snapshot?.rooms[0];

  async function signOut() {
    await repository.signOut();
    setSession(null);
    setSnapshot(null);
  }

  if (!sessionReady) return <div className="loading-screen"><div className="brand-mark"><Icon name="users" size={24} /></div><span>Connecting…</span></div>;
  if (!session && repository.mode === 'online') return <AuthScreen repository={repository} onAuthenticated={() => repository.getSession().then(setSession)} />;
  if (loading || !snapshot) return <div className="loading-screen"><div className="brand-mark"><Icon name="users" size={24} /></div><span>Loading your rooms…</span></div>;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark"><Icon name="users" size={22} /></div>
        <div className="brand-copy"><h1>Leet Room</h1><p>Solve together. Grow together.</p></div>
        <div className={`sync-pill ${repository.mode}`}><span />{repository.mode === 'demo' ? 'Demo' : 'Live'}</div>
      </header>

      <nav className="main-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <button key={item.id} className={activeNav === item.id ? 'active' : ''} onClick={() => setActiveNav(item.id)}>
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="content-shell">
        {activeNav === 'rooms' && <RoomView snapshot={snapshot} room={activeRoom} onRefresh={refresh} showToast={showToast} />}
        {activeNav === 'activity' && <ActivityView snapshot={snapshot} room={activeRoom} />}
        {activeNav === 'leaderboard' && <LeaderboardView room={activeRoom} currentUser={snapshot.currentUser} />}
        {activeNav === 'settings' && <SettingsView snapshot={snapshot} onRefresh={refresh} showToast={showToast} onSignOut={signOut} theme={theme} />}
      </div>

      {toast && <div className={`toast ${toast.type}`} role="status"><Icon name={toast.type === 'error' ? 'info' : 'check'} size={17} />{toast.message}</div>}
      {!isOnlineConfigured && <div className="demo-ribbon">Local demo · configure Supabase for team sync</div>}
    </main>
  );
}
