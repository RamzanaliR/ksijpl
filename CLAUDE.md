# CLAUDE.md — KSIJ DAR Premier League

> Project guide for Claude sessions. Read this before making any changes.

## What this is

A full-stack community football league management site for **KSIJ DAR PL** — two divisions (Seniors sponsored by gofiber, Juniors sponsored by Care & Cure), with league tables, fixtures, results, a knockout Cup, a full FPL-modelled Fantasy League, an auto-graphics media pipeline, and a comprehensive admin panel.

**Live site:** https://ksij-league.vercel.app
**Admin:** https://ksij-league.vercel.app/admin/login
**Repo:** https://github.com/RamzanaliR/ksijpl (private)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, `"use client"` pattern) |
| Language | TypeScript (strict) |
| Database | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth (email/password for admin + fantasy users) |
| Hosting | Vercel (auto-deploys from `main` branch) |
| Storage | Supabase Storage (`media`, `generated-graphics` buckets) |
| Graphics | Canva Connect API (OAuth 2.0 + Autofill + Export) |
| Styling | Tailwind CSS, no component library |

---

## Key identifiers

| What | Value |
|------|-------|
| GitHub username | `RamzanaliR` |
| GitHub repo | `ksijpl` |
| Vercel project | `ksij-league` under team `ramzi-r` |
| Vercel project ID | `prj_KUgz3BjYI23FoTgqSQXwTSvwLjzV` |
| Supabase project | `mktkmnryfoecsfzuidxd` (eu-west-1) |
| Supabase org | `RamzanaliR` |
| Seniors competition ID | `e0eee160-729a-4cbd-a29a-20d36115db31` |
| Juniors competition ID | `544019cb-0615-4b38-b9b8-03e71dfe1706` |
| Current season | Season 03, MW1 starts Sep 4 2026 |

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # Homepage (hero, fixtures, league panel, stats widget, news)
│   ├── seasons/page.tsx            # League table + player stats (paginated, sortable)
│   ├── stats/page.tsx              # Stats Centre (Golden Boot, Assists, CS, MOTM)
│   ├── teams/page.tsx              # Teams grid
│   ├── teams/[id]/page.tsx         # Team profile
│   ├── matches/[id]/page.tsx       # Match detail / result
│   ├── cup/page.tsx                # Cup bracket display
│   ├── privacy/page.tsx            # Privacy policy (for Canva integration review)
│   ├── fantasy/
│   │   ├── page.tsx                # Fantasy landing / pool selector
│   │   ├── login/page.tsx          # Fantasy auth
│   │   └── team/[poolId]/
│   │       ├── page.tsx            # Squad Builder (first-time flow)
│   │       ├── pick-team/page.tsx  # Pick starting XI (pitch/list toggle)
│   │       ├── transfers/page.tsx  # Weekly transfers
│   │       ├── leaderboard/page.tsx         # Leagues (overall + private)
│   │       ├── leaderboard/[teamId]/page.tsx # View other manager's team (read-only)
│   │       ├── fixtures/page.tsx   # Fantasy fixtures
│   │       └── points/page.tsx     # My Team / points breakdown
│   ├── admin/
│   │   ├── layout.tsx              # Admin shell (sidebar nav, auth guard)
│   │   ├── page.tsx                # Dashboard
│   │   ├── fixtures/page.tsx       # Fixtures admin (2-col card grid, match details editor)
│   │   ├── live/page.tsx           # Live Match Console list
│   │   ├── live/[id]/page.tsx      # Live Match Console (real-time scoring)
│   │   ├── teams/page.tsx          # Teams CRUD
│   │   ├── players/page.tsx        # Players CRUD
│   │   ├── cup/page.tsx            # Cup admin (bracket generation, results)
│   │   ├── totw/page.tsx           # Team of the Week selector
│   │   ├── fantasy/page.tsx        # Fantasy settings
│   │   ├── media/page.tsx          # Media panel (graphics generation + asset uploads)
│   │   ├── partners/page.tsx       # Partners/sponsors CRUD
│   │   ├── admins/page.tsx         # Admin user management
│   │   └── account/page.tsx        # Admin account settings
│   └── api/
│       ├── admin/generate-graphic/route.ts  # Graphics generation endpoint
│       ├── admin/delete-media/route.ts      # Delete generated media
│       ├── canva/auth/route.ts              # Canva OAuth initiation
│       └── canva/callback/route.ts          # Canva OAuth callback
├── components/
│   ├── SiteHeader.tsx              # Main nav (Home, Seasons, Stats, Teams, Cup, News, Fantasy)
│   ├── SiteFooter.tsx              # Footer (League/Fantasy/More columns + partners)
│   ├── LeagueDivisionPanel.tsx     # Homepage division toggle + fixtures/table/results
│   ├── StatsWidget.tsx             # Homepage stats sidebar (compact mode)
│   ├── PitchBackground.tsx         # Green pitch SVG background (reused across Fantasy + TOTW)
│   ├── PlayerJerseyCard.tsx        # Player card with jersey image, name, price, opponent
│   ├── TeamBadge.tsx               # Team name + logo/crest badge
│   ├── JerseyImage.tsx             # Jersey image with PNG→SVG→placeholder fallback
│   ├── CupBracket.tsx              # Knockout bracket visualisation
│   ├── FantasySubNav.tsx           # Fantasy tab navigation
│   ├── FantasyDivisionTabs.tsx     # Division toggle for fantasy
│   ├── TeamsGrid.tsx               # Teams card grid
│   └── ThemeToggle.tsx             # Dark/light mode toggle
└── lib/
    ├── supabase.ts                 # Client-side Supabase client
    ├── supabase-server.ts          # Server-side Supabase client
    ├── canva.ts                    # Canva Connect API helper (autofill, export, token refresh)
    ├── fantasy-scoring.ts          # FPL scoring rules (pure functions, no I/O)
    ├── fantasy-compute.ts          # Gameweek points computation pipeline
    ├── fantasy-autosub.ts          # Auto-substitution engine
    ├── fantasy-deadline.ts         # Transfer deadline logic
    ├── sponsor-logos.ts            # getSponsorLogoMap() helper
    ├── logos.ts                    # Logo URL utilities
    ├── bracket.ts                  # Cup bracket generation
    ├── cup-advance.ts              # Cup winner advancement
    └── round-robin.ts              # Round-robin fixture generation
```

---

## Database schema (32 tables)

### Core
- `competitions` — league/cup competition definitions
- `divisions` — seniors/juniors
- `seasons` — season per competition (Season 01, 02, 03)
- `teams` — all teams (name, slug, crest_url, sponsor_logo_url)
- `players` — all players (full_name, fpl_name, nickname, position, team_id)
- `season_teams` — which teams play in which season
- `gameweeks` — match weeks per season
- `matches` — all fixtures/results (home/away team, scores, kickoff_at, venue, MOTMs)
- `match_events` — goals, assists, cards, penalties per match
- `match_attendance` — who played in each match
- `standings` — league table (computed)

### Fantasy
- `fantasy_settings` — budget, squad size, scoring rules per pool
- `fantasy_profiles` — user profiles for fantasy
- `fantasy_teams` — each manager's fantasy team
- `fantasy_team_players` — squad composition
- `fantasy_player_prices` — player prices per pool
- `fantasy_transfers` — transfer history
- `fantasy_chip_usage` — Triple Captain, Bench Boost, Free Hit
- `fantasy_free_hit_snapshots` — pre-Free-Hit squad state
- `fantasy_gameweek_squads` — frozen squad per gameweek (for scoring)
- `fantasy_player_gameweek_points` — individual player points per GW
- `fantasy_gameweek_points` — team total points per GW
- `fantasy_leagues` — private mini-leagues
- `fantasy_league_members` — league membership

### Media
- `generated_media` — generated graphics (status, captions, Instagram post ID)
- `caption_templates` — per-type caption templates with `{variable}` placeholders
- `media_assets` — uploaded logos, jerseys, crests
- `admin_settings` — API credentials store (Canva tokens, Instagram tokens)

### Admin
- `admin_users` — admin accounts with roles (super_admin, league_admin, matchday_admin, fantasy_admin, media_admin)
- `partners` — sponsor/partner logos for footer

### TOTW
- `team_of_week` — weekly TOTW selections (formation, player slots, published flag)
- `team_of_week_view` — read view with player names resolved

---

## RLS & auth patterns

**Critical lesson learned:** `admin_users` RLS policies must NOT self-reference. Use `SECURITY DEFINER` helper functions:
- `is_admin()` — returns true for any admin role
- `is_super_admin()` — returns true for super_admin only
- `is_league_admin()` — league_admin or super_admin
- `is_fantasy_admin()` — fantasy_admin or super_admin

**Manual super_admin setup** requires:
1. Empty strings (not NULL) for token columns
2. Matching row in `auth.identities` with `provider_id` = user UUID as text
3. Separate `UPDATE admin_users SET role = 'super_admin'` after trigger auto-inserts at `matchday_admin`

---

## Environment variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, bypasses RLS) |
| `CANVA_CLIENT_ID` | Canva integration client ID |
| `CANVA_CLIENT_SECRET` | Canva integration client secret |

---

## Fantasy League rules (FPL-modelled)

- **Budget:** 100m, squad of 12 (2 GK, 4 DEF, 4 MID, 2 FWD min)
- **Starting XI:** 8 players (1 GK, formation flexible)
- **Max per team:** 3 players from any real team
- **Transfers:** Unlimited pre-MW1, 1 free per week from MW2, -4 pts each additional, max 2 banked
- **Chips:** Triple Captain (3x), Bench Boost, Free Hit — each once per season
- **Default formation:** 3-3-1

### Scoring
| Event | GK | DEF | MID | FWD |
|-------|-----|-----|-----|-----|
| Appearance | 1 | 1 | 1 | 1 |
| Goal | 10 | 6 | 5 | 4 |
| Assist | 3 | 3 | 3 | 3 |
| Clean sheet | 4 | 4 | — | — |
| Penalty save | 5 | — | — | — |
| Penalty miss | -2 | -2 | -2 | -2 |
| Yellow card | -1 | -1 | -1 | -1 |
| Red card | -2 | -2 | -2 | -2 |
| Own goal | -2 | -2 | -2 | -2 |
| Goals conceded (per 3) | -3 | -3 | — | — |
| Man of the Match | 3 | 3 | 3 | 3 |

### Fantasy price scales
| Position | Floor | Average | Good | Star | Max |
|----------|-------|---------|------|------|-----|
| GK | 4.5m | 5.0m | 5.0m | 5.5m | 6.5m |
| DEF | 4.5m | 5.0m | 5.5-6.0m | 7.0m | 7.5m |
| MID | 5.0m | 5.5m | 6.5-7.0m | 7.5-8.5m | 9.0m |
| FWD | 5.5m | 6.0m | 7.0-7.5m | 8.5-9.5m | 10.0m |

---

## Media / graphics generation pipeline

### Flow
1. Admin selects match week + template types in Media panel
2. System queries Supabase for match data
3. Calls Canva Connect API: autofill template → poll → export PNG
4. Saves PNG to `generated-graphics` Supabase Storage bucket
5. Creates `generated_media` record with status `pending_approval`
6. Admin reviews, edits caption, approves
7. (Future) Posts to Instagram via Graph API

### Template types
- **Fixtures** — all matches for a match week
- **Individual Match** (Jersey Fixtures) — one match with jersey images
- **Results** — one per match (carousel for Instagram)
- **League Table** — standings snapshot
- **MOTM** — 8-player grid of Man of the Matches
- **TOTW** — Team of the Week (multiple Canva templates per formation)

### Canva integration status
- OAuth 2.0 flow working (auth + callback routes)
- Token refresh implemented
- Autofill + export working but **Canva review pending** (Draft integration, quota limited)
- Brand Template ID for Fixtures: `EAHQ2Xq4Gb0`
- Data field naming convention: `match_1_home_name`, `match_1_home_logo`, `match_1_time`, `match_1_pitch`, etc.

### TOTW formations (admin selectable)
- 2-3-2, 3-3-1, 2-4-1, 3-2-2 (GK always fixed)

---

## Division toggle pattern

Site-wide convention: goFiber PL (Seniors) / Care & Cure PL (Juniors) toggle appears on:
Homepage, Seasons, Cup, Fantasy, Stats, TOTW admin, Media admin.

Always use the same button style (rounded-xl toggle pills).

---

## Column name gotchas

| Intuitive name | Actual column | Table |
|----------------|--------------|-------|
| kickoff_time | `kickoff_at` | matches |
| pitch | `venue` | matches |
| home_motm | `home_motm_player_id` | matches |
| away_motm | `away_motm_player_id` | matches |
| sponsor_logo | `sponsor_logo_url` | teams |
| crest | `crest_url` | teams |
| price | `price` | fantasy_player_prices |

---

## Git workflow

- **Push to `main` only** — Vercel auto-deploys from main
- **Never use Vercel MCP for deploys** — full file set required, large binaries corrupt payloads
- **Git-based auto-deploys are the established workflow**
- **Parallel Claude sessions may exist** — always `git pull` before pushing
- Commit messages: descriptive, multi-line, list all changes

---

## Design system

### Colors
- **Navy:** `#0B3363` (primary text, buttons)
- **Sky blue:** `#3EA0D9` (accents, links, active states)
- **Gold:** `#F4B400` (highlights, captain badges, star indicators)
- **Dark mode bg:** `#0B1220`

### Admin component classes
- `admin-card` — white card with rounded corners and border
- `admin-btn`, `admin-btn-primary`, `admin-btn-secondary`, `admin-btn-gold`
- `admin-label`, `admin-input`, `admin-select`
- `admin-page-title`, `admin-subtitle`

### Jersey image convention
- Path: `/jerseys/{team-slug}-home.png` (primary), `-gk-home.png` (goalkeeper)
- Fallback chain: PNG → SVG → `/jerseys/placeholder.png`
- Sponsor logos: stored in Supabase Storage, URL in `teams.sponsor_logo_url`

---

## Known issues & tech debt

1. **Fantasy scoring untested** — `computeGameweekPoints` has never run on real data. Must test before MW1 (Sep 4).
2. **Canva Draft quota** — autofill API calls rate-limited until integration review approved (submitted Jul 30 2026).
3. **Season rollover** — no admin flow to create new season, reset standings, carry forward players.
4. **Mobile UI** — Fantasy pitch views are 730px fixed width, needs responsive audit across all pages.
5. **Instagram posting** — button exists but disabled; Instagram Graph API credentials not configured.
6. **In-house graphics (Option 3)** — discussed as Canva fallback using Puppeteer/Sharp; not implemented.
7. **Player profiles** — `/players/[id]` route not yet built.
8. **Admin dashboard** — basic; needs weekly checklist, live numbers, quick actions.
9. **Old Supabase project** (`crcvehuefliutjtldkef`) is deprecated, should be deleted.

---

## Quick start for new session

```bash
git clone https://github.com/RamzanaliR/ksijpl.git
cd ksijpl
npm install
# Create .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

To push: need GitHub fine-grained PAT with Contents read/write on `ksijpl` repo only.

To query Supabase: use Supabase MCP with project ID `mktkmnryfoecsfzuidxd`.

To check Vercel deploys: use Vercel MCP with project ID `prj_KUgz3BjYI23FoTgqSQXwTSvwLjzV`, team `ramzi-r`.

---

## Approach & principles (from project owner)

- Prefers **discussing structurally significant changes before implementation**; moves quickly once direction is decided.
- Uses **screenshot references extensively** for UI direction.
- Runs a **parallel Claude session on the same repo** — occasional merge conflicts; always pull before pushing.
- Consistent **division-toggle pattern** across all pages — maintain this convention.
- **Database-driven > git-dependent** — explicit design principle for long-term maintainability and future handover.
- Pragmatic and efficiency-focused: prefers Claude to handle full technical implementation including database setup, code, and deployment.
