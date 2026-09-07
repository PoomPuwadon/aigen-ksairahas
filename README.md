live/used cloudflare-deployed project for group K / made in july 2026 / **ai generated** (i had no knowledge at the time) / now used for learning backend development
unique_users ~ 150

# Kyai สายรหัส — BigBro/LilBro Code-Name Guessing Game

A web game for Thai university orientation ("รับน้อง" / "สายรหัส") events:
each freshman (lilbro) gets a set of time-locked hints about their secret
upperclassman (bigbro), then guesses who it is before a scheduled reveal.
Built as a static frontend (Vite + vanilla JS) backed by Supabase.

## Features

- **Name-based login** — a freshman finds themselves by nickname/first name
  (autocomplete search), no account creation needed.
- **Photo vote** — a quick one-off poll shown right after login.
- **Time-locked hints** — hint 1 is visible immediately; hints 2 and 3 unlock
  at admin-configured times, with a live countdown until then.
- **Guessing** — search/browse all bigbros, pick one, confirm. Everyone
  linked to the same bigbro (a "line") can see each other's guesses; if
  anyone in the line guesses correctly, the whole line is spared a forfeit.
- **Timed reveal** — guessing locks and the real answer becomes visible only
  after an admin-set reveal time.
- **Admin panel** — hidden behind a tap-count on a badge (only reachable
  after typing the real admin password once), lets an organizer adjust the
  open/reveal times and see a live summary of who's guessed what.
- **Bulk roster import** — a companion Google Apps Script pushes a roster
  from a Google Sheet straight into the database (see
  [`google-apps-script/`](./google-apps-script)).
- A couple of small hidden extras (a full-screen easter-egg keyword trigger)
  that are easy to disable if you don't want them — see `src/theme.js`.

## Architecture

Plain static site, no backend server of your own to run — all logic beyond
the UI lives in Supabase Postgres functions (`SECURITY DEFINER` RPCs), called
directly from the browser with the public anon key.

```
index.html                Markup for every screen/modal (one page, view-switched via JS)
src/
  main.js                 Wires everything together
  config.js               Supabase client (reads .env)
  state.js                Shared app state
  views.js                View-switching + a few shared helpers
  theme.js                Customizable content: branding, copy, links, feature toggles
  styles/main.css         All styling
  features/
    login.js              Name search + login + stealth admin/easter-egg triggers
    photoVote.js           Post-login photo poll
    dashboard.js            Hints display, countdown timers, "go guess" button logic
    guessing.js             BigBro grid, confirm modal, guess submission
    reveal.js               Reveal screen
    admin.js                Admin panel (dates, live summary)
    betsim.js                Easter-egg full-screen takeover
    bgGallery.js             Decorative background photo tiling
supabase/
  schema.sql               Full DB schema: tables, RLS, all RPC functions
google-apps-script/
  sync.gs                   Bulk roster importer (Google Sheets -> Supabase)
  template-bigbro.csv        \_ starter sheet layouts for the importer
  template-lilbro.csv        /
```

## Setup

### 1. Create a Supabase project

Free tier is plenty for a single event. Note your project URL and anon key
(Settings → API).

### 2. Run the schema

Open the SQL Editor in your Supabase project and run the entire contents of
[`supabase/schema.sql`](./supabase/schema.sql). It creates all tables (with
RLS enabled and intentionally no policies — see the comment at the top of
that file for why) and all RPC functions the frontend calls.

### 3. Seed the required config rows

The bottom of `schema.sql` has commented-out `insert` statements — uncomment
and run the ones you need:

- An admin password (`admin_auth`) — pick a real one.
- Four `event_config` rows: `hint2_date`, `hint3_date`, `guess_open_date`,
  `guess_reveal_date`. The app will error until all four exist.
- A `photo_votes` row matching `VOTE_PHOTO_ID` in `src/theme.js`.
- (Optional) a `betsim_keywords` row for the easter egg.

### 4. Populate your roster

Either insert rows into `users` by hand, or set up the Google Sheets bulk
importer — see [`google-apps-script/README.md`](./google-apps-script/README.md).

### 5. Configure and run the frontend

```bash
cp .env.example .env
# edit .env with your Supabase URL + anon key
npm install
npm run dev
```

Build for production with `npm run build` (outputs to `dist/`).

### 6. Deploy

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is included to
auto-build and publish to GitHub Pages on every push to `main`:

1. Repo Settings → Pages → Source → **GitHub Actions**.
2. Repo Settings → Secrets and variables → Actions → add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets.
3. Push to `main`.

Any other static host (Netlify, Vercel, Cloudflare Pages, etc.) works too —
just set the same two env vars in that platform's build settings and use
`npm run build` / `dist` as the build command / output directory.

## Customizing for your own event

Almost everything you'd want to change per-event lives in **`src/theme.js`**:
group badge letter, punishment/forfeit text, background gallery photos, the
vote-screen photo, admin-unlock tap count, and the easter-egg URL. Comments
in that file explain each one.

The overall look (colors, fonts, the corner "K" stamp) is in
`src/styles/main.css`, controlled mostly through the `:root` CSS variables at
the top of the file.

## Security notes

- **The anon key is meant to be public.** Every table has Row Level Security
  enabled with zero policies, so direct table access via the anon key is a
  hard deny. All reads/writes go through `SECURITY DEFINER` functions that
  perform their own checks — that's the actual security boundary, not the
  key itself.
- **Login has no password.** A lilbro "logs in" by first name lookup alone.
  This is a deliberate low-friction choice for a casual event, not a bug —
  but it means first names aren't a secret, and anyone who knows or guesses
  one can view that person's hints and act as them. Don't reuse this schema
  for anything where that matters.
- **The admin password check runs on every login attempt.** Typing anything
  into the login field silently tries it as the admin password first (see
  `features/login.js`). This is intentional (it's how the hidden admin entry
  point works) and is rate-limited only by bcrypt's cost factor — fine for a
  student event, not something to build on for anything higher-stakes.
- **`SUPABASE_SERVICE_KEY`** (used only by the Google Apps Script importer)
  is a completely different, far more powerful credential than the anon key.
  It must never end up in this repo, in `.env`, or anywhere client-side —
  see [`google-apps-script/README.md`](./google-apps-script/README.md).

## License

MIT — see [LICENSE](./LICENSE).
