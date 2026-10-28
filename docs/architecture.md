# Architecture

## Runtime flow

```text
Enabled coding-site page
  ↓ user presses “Add current”
Content script
  ↓ chrome.runtime message
React side panel
  ↓ authenticated RPC
Supabase Postgres
  ↓ RLS-filtered realtime change
Every open side panel in the room
```

Postgres is authoritative. Local UI state is a projection that is replaced whenever a committed realtime event arrives.

## Boundaries

### Extension UI

- Displays room and participant state.
- Optimistically shows loading states, but does not decide authorization.
- Never contains a service-role credential.
- Communicates with whitelisted coding sites only through the narrowly scoped content script.

### Database RPCs

- Validate membership and roles.
- Normalize and deduplicate problems.
- Snapshot participants at enqueue time.
- Serialize participant state changes.
- Calculate overall completion.
- Record audit events.

### Row Level Security

- Public room summaries are visible to the community; private room content is membership-gated.
- Private room content is visible only to members.
- Writes are exposed through security-definer RPCs with explicit checks.
- Realtime Postgres Changes use the same read policies as normal queries.

## Main data relationships

```text
organization
  └─ profiles
  └─ rooms
       └─ room_members ── profiles
       └─ room_problems ── problems
            └─ problem_participants ── profiles
```

## State transition

```text
participant: not_started → thinking → solved
                                     ↘ thinking (reopen)

room problem: queued → solved only when all required participants are solved
                         ↘ queued when any participant reopens
```

## Scaling path

The MVP snapshot RPC deliberately favors correctness and a small API surface. For very large rooms:

1. Fetch only the active room instead of all joined rooms.
2. Paginate the problem queue.
3. Replace full snapshot refreshes with typed event patches.
4. Maintain leaderboard aggregates asynchronously.
5. Add Presence only for ephemeral online/current-problem indicators.

None of those changes alter the core relational model or state-transition RPCs.
