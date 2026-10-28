import React, { useState } from 'react';
import { Icon } from './Icons.jsx';
import { formatDuration } from '../domain.js';

const statusLabels = {
  not_started: 'Not started',
  thinking: 'Thinking',
  solved: 'Solved',
};

const sourceLabels = {
  leetcode: 'LeetCode',
  geeksforgeeks: 'GeeksforGeeks',
  codeforces: 'Codeforces',
};

export function ProblemCard({ index, problem, room, currentUser, onSetState, onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mine = problem.participants.find((participant) => participant.userId === currentUser.id) || { status: 'not_started' };
  const solved = problem.participants.filter((participant) => participant.status === 'solved').length;
  const thinking = problem.participants.filter((participant) => participant.status === 'thinking').length;
  const total = problem.participants.filter((participant) => participant.required !== false).length;
  const nextState = mine.status === 'not_started' ? 'thinking' : mine.status === 'thinking' ? 'solved' : 'thinking';
  const buttonLabel = mine.status === 'not_started' ? 'Mark Thinking' : mine.status === 'thinking' ? 'Mark Solved' : 'Reopen';
  const inferredSource = problem.source || (problem.url?.includes('geeksforgeeks.org')
    ? 'geeksforgeeks'
    : problem.url?.includes('codeforces.com') ? 'codeforces' : 'leetcode');

  return (
    <article className={`problem-card ${problem.state === 'solved' ? 'is-solved' : ''}`}>
      <div className="problem-main">
        <div className="problem-copy">
          <div className="problem-title-row">
            <a href={problem.url} target="_blank" rel="noreferrer" className="problem-title" title={problem.title}>
              <span>{index + 1}. {problem.title}</span>
              <Icon name="external" size={14} />
            </a>
            <div className="card-menu-wrap">
              <button className="more-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Problem options"><Icon name="more" size={18} /></button>
              {menuOpen && (
                <div className="card-menu">
                  <a href={problem.url} target="_blank" rel="noreferrer">Open on {sourceLabels[inferredSource] || 'problem site'}</a>
                  {(room.role === 'owner' || room.role === 'admin') && <button onClick={() => onRemove(problem.id)}>Remove from room</button>}
                </div>
              )}
            </div>
          </div>
          <div className="problem-meta">
            <span className={`difficulty difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
            {problem.tags?.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        </div>

        <div className="problem-team">
          <div className="avatar-stack" aria-label="Participant statuses">
            {room.members.slice(0, 6).map((member) => {
              const status = problem.participants.find((participant) => participant.userId === member.id)?.status || 'not_started';
              return (
                <span
                  key={member.id}
                  className={`mini-avatar status-${status}`}
                  style={{ '--avatar-color': member.color || '#6c70d9' }}
                  title={`${member.name}: ${statusLabels[status]}`}
                >{member.initials || member.name?.charAt(0)}</span>
              );
            })}
            {room.members.length > 6 && <span className="mini-avatar overflow">+{room.members.length - 6}</span>}
          </div>
          <div className="progress-copy">
            {problem.state === 'solved' ? (
              <><Icon name="check" size={13} /> Completed by everyone</>
            ) : solved ? `${solved}/${total} solved · ${thinking} thinking` : `${thinking}/${total} thinking`}
          </div>
        </div>

        <div className="problem-actions">
          {problem.state === 'solved' && mine.elapsedSeconds > 0 && <span className="time-value"><Icon name="clock" size={13} />{formatDuration(mine.elapsedSeconds)}</span>}
          <button className={`state-button state-${mine.status}`} onClick={() => onSetState(problem.id, nextState)}>
            {mine.status === 'solved' ? <Icon name="refresh" size={16} /> : mine.status === 'thinking' ? <Icon name="check" size={16} /> : <Icon name="clock" size={16} />}
            {buttonLabel}
          </button>
        </div>
      </div>
      <div className="progress-track"><span style={{ width: `${total ? (solved / total) * 100 : 0}%` }} /></div>
    </article>
  );
}
