# Leet Room

A Chrome side-panel extension for collaborative DSA rooms. Friends and coding communities can share problems from LeetCode, GeeksforGeeks and Codeforces, mark individual progress, track focus time and move a problem to **Solved** automatically when every assigned participant finishes it.

The repository runs in two modes:

- **Demo mode** works immediately and stores sample data in the browser.
- **Online mode** uses Supabase Auth, Postgres and Realtime to synchronize different computers.

## Features

- Chrome Manifest V3 side panel
- Multiple public/private rooms
- Shareable room codes
- Add the active problem from an enabled coding site or paste a link
- Per-member `Not started → Thinking → Solved` state
- Atomic all-members-solved transition
- Queue and completed views
- Personal activity and focus duration
- Room leaderboard
- Email OTP authentication
- Supabase Row Level Security and realtime updates
- Responsive sidebar matching the active coding site's light/dark interface
- Automatic theme detection and live switching
- Coding-site whitelist with LeetCode, GeeksforGeeks and Codeforces adapters

## Run the extension in demo mode

Requirements: Node.js 14.21+ and npm.

```bash
npm install
npm test
npm run build
```

Then open `chrome://extensions`:

1. Enable **Developer mode**.
2. Click **Load unpacked**.
3. Select the `dist` folder in this repository.
4. Open a problem on LeetCode, or enable GeeksforGeeks/Codeforces in Settings first.
5. Click the Leet Room toolbar icon to open the side panel.

Demo changes persist in `localStorage`. Use **Settings → Reset demo data** to restore the sample room.

## Enable real multi-computer synchronization

### 1. Create a Supabase project

Create a project at Supabase and keep its Project URL and public anon key. Never put the service-role key in this extension.

### 2. Apply the database migration

With the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, paste [`supabase/migrations/202610280001_initial_schema.sql`](supabase/migrations/202610280001_initial_schema.sql) into the Supabase SQL editor.

The migration creates:

- Organizations, profiles and rooms
- Room membership and roles
- Problems and per-member progress
- Atomic database RPCs
- Row Level Security policies
- Realtime publication configuration
- Activity audit events

### 3. Configure email OTP

In Supabase **Authentication → Email Templates**, make the sign-in email show the token:

```text
Your Leet Room sign-in code is: {{ .Token }}
```

For a public launch, replace email OTP with Google/GitHub OAuth or configure a transactional SMTP provider. Supabase's built-in test mail service is intentionally rate-limited and is not suitable for a public community.

### 4. Add environment variables

```bash
cp .env.example .env.local
```

Then fill in:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_INVITE_BASE_URL=https://keshavm03.github.io/leet-room/#/join
```

Rebuild and reload the extension:

```bash
npm run build
```

## Free GitHub hosting

GitHub Pages can host the web companion/demo, project documentation and invite landing URL. It cannot run PostgreSQL, authentication or realtime WebSockets, so synchronized data remains on Supabase.

The included [`.github/workflows/pages.yml`](.github/workflows/pages.yml) tests and builds the project, then deploys `dist/` to GitHub Pages on every push to `main`.

After pushing the repository:

1. Open **GitHub repository → Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. For online sync, add repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Secrets and variables → Actions**.
4. Run the workflow or push to `main`.
5. Open `https://keshavm03.github.io/leet-room/`.

Without the two Supabase secrets, the Pages site intentionally runs in local demo mode. The Chrome extension is still built with `npm run build` and loaded from `dist/`; GitHub Pages does not install browser extensions. For distribution, attach a zipped `dist/` folder to a GitHub Release or publish through the Chrome Web Store.

## Important behavior

### Membership snapshot

When a problem is added, the backend copies the room's current members into `problem_participants`. A person who joins later does not block an older problem from completing.

### Completion transaction

`set_problem_state` locks the room-problem row, updates the current participant and checks every required participant in one transaction. The client cannot independently move a problem to Solved.

### Coding-site access

The content script is limited to LeetCode, GeeksforGeeks and Codeforces domains. LeetCode is always enabled; the other adapters can be toggled from **Settings → Coding-site whitelist**. It reads the active problem URL and visible page title only when the user selects **Add current**. It does not access solution code, credentials, cookies or browsing history.

It also samples the active page's computed background/text colors and theme marker. The side panel applies the corresponding light or dark token set and updates live when the site's theme changes. The last detected mode is cached so the panel does not flash into the wrong mode when reopened.

The manifest deliberately has no global `side_panel.default_path`. The service worker disables the panel globally and enables it for every tab whose coding site is on the whitelist. Switching to an unrelated website, browser window or new tab hides it; returning to any enabled coding-site tab restores it.

### Realtime

The side panel subscribes to RLS-protected Postgres changes for the active room. When a relevant record changes, it reloads the authoritative room snapshot. Closing the side panel disconnects the live UI; reopening it fetches the latest state.

## Project layout

```text
public/
  manifest.json            Chrome extension manifest
  background.js            Side-panel service worker
  site-config.js           Supported-site catalog
  leetcode-content.js      Active coding-site problem capture
src/
  components/              UI components
  data/localRepository.js  Immediate demo backend
  data/supabaseRepository.js
  domain.js                URL/state/leaderboard rules
  App.jsx
supabase/migrations/       Postgres schema, RLS and RPCs
tests/                     Domain tests
```

## Production checklist

- Set the public invite URL or custom domain.
- Add approved PNG extension icons to `public/icons` and the manifest.
- Replace test OTP email delivery with social login or production SMTP.
- Enable Supabase backups and spend limits.
- Add RLS integration tests using the Supabase CLI.
- Add an invite landing page that copies the room code into the extension.
- Publish through the Chrome Web Store when the community beta is ready.
- Review LeetCode's terms before adding automatic submission detection.

## Scripts

```bash
npm run dev      # Browser UI development server
npm run build    # Build the unpacked Chrome extension into dist/
npm test         # Run domain rule tests
npm run preview  # Preview the built sidebar as a web page
```
