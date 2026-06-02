# Spec: UI redesign — Phase 3 (power-user: command palette, search, shortcuts)

**Status:** ready to delegate to a Cursor cloud agent
**Repo:** pod2md-repo, branch off current `main` (Phases 1–2 merged in #29, #30)
**Scope of THIS rep:** Phase 3 only. **Do NOT build Phase 4 (reader polish).** Keep the diff reviewable.

## Goal
Make pod2md fast to drive at 50+ episodes: a `cmdk` command palette on the ⌘K affordance, in-page episode search, keyboard shortcuts, and a polished bulk-action bar. Builds on Phase 1 tokens + the existing ⌘K placeholder.

## Decisions locked (do not re-litigate)
- **Adopt `cmdk`** for the palette. Nothing else new except the one read-only API route below.
- **The palette IS the global search** — wire it to the existing top-bar ⌘K button (`components/app-shell.tsx:~214`, currently a `TODO(phase 3)` no-op). Do **not** add a second always-visible global search field in the top bar.
- **One new backend route is allowed, read-only only:** `GET /api/episodes` (list). This is the *only* backend change permitted. Do NOT touch the pipeline, schema, migrations, worker, or any existing route's behavior.
- **In-page search** on `/episodes` is a separate, always-visible client-side filter (filters the already-loaded list by title) — distinct from the palette.
- Keyboard: `⌘K`/`Ctrl+K` toggles palette; `/` opens palette; `N` → new transcription (`/`); `Esc` closes palette / clears row selection. **All shortcuts must no-op while focus is in an input, textarea, or contenteditable.**
- Reuse Phase 1 tokens (`--accent`, `--surface`, `--elevated`, `--border`, `--fg*`). No new colors, no `zinc-*`, no elevation `box-shadow`, focus rings preserved, reduced-motion respected.
- `npm run build` + `npm run lint` pass; no TS errors.

## What already exists — reuse, don't rebuild
- `components/app-shell.tsx` — top-bar ⌘K button at ~line 214 (Search icon + "⌘K" chip) with a no-op onClick. AppShell is the `"use client"` shell mounted in `app/layout.tsx` and wraps every route — **own the palette open-state here** and mount `<CommandPalette>` here so it's global.
- `lib/load-dashboard-data.ts` — the existing recent-episodes query (id, title, collection, latest job status, limit 100). Reuse its query shape for `GET /api/episodes`.
- `components/dashboard.tsx` — owns `episodes`, `selectedIds`, the bulk-action bar (renders when `selectedIds.size > 0`: "N selected" + Copy all + Download .zip), `setCollectionFilter`. Add in-page search + bulk-bar polish here.
- `components/episode-list.tsx` — the list rows + `EmptyState`. The in-page search filters what's passed here; reuse the existing filtered-empty state when a search yields nothing.
- `lib/notify.ts` — toasts. Reuse for any feedback.
- Routes already exist: `/` (Transcribe), `/episodes`, `/episodes/[id]`, `/collections`, `/settings`.

---

## Part A — `GET /api/episodes` (read-only list)

New `app/api/episodes/route.ts`, `export async function GET`. Return recent episodes as JSON for the palette:
- Query: mirror `loadDashboardData()` — join latest job status per episode, order by `createdAt desc`, `limit 100`. Fields: `id`, `title`, `collection`, `status`, `createdAt`.
- Shape: `{ episodes: Array<{ id; title; collection: string|null; status; createdAt }> }`.
- `await connection()` (or mark the route dynamic) so it's never staticly cached. No auth (personal app, consistent with the rest).
- Do not modify the existing `app/api/episodes/[id]/route.ts` — this is a sibling collection route. Confirm Next resolves `GET /api/episodes` (collection) and `GET /api/episodes/[id]` (item) independently (they do — different segments).

## Part B — Command palette (`cmdk`)

> Follow the **current `cmdk` docs** for exact primitives (`Command`, `Command.Input`, `Command.List`, `Command.Item`, `Command.Group`, `Command.Empty`, dialog usage) — don't rely on memorized APIs.

1. `npm install cmdk`.
2. `components/command-palette.tsx` (`"use client"`), props `{ open: boolean; onOpenChange: (open: boolean) => void }`:
   - Renders cmdk's dialog/overlay centered, max-width ~560px, `--surface` panel, `--border`, 12px radius (`--radius-modal`), backdrop dim. No box-shadow — use border + elevated bg for separation.
   - **Search input** at top (cmdk `Command.Input`), placeholder "Search episodes or jump to…", autofocus on open.
   - **Group "Actions":** "New transcription" (→ `/`, icon `Plus`/`AudioLines`), "Go to Episodes" (`/episodes`, `List`), "Go to Collections" (`/collections`, `Library`), "Settings" (`/settings`, `Settings`). Selecting closes the palette and `router.push`es.
   - **Group "Episodes":** fetch from `GET /api/episodes` when the palette opens (not on app mount); show title + a muted collection/status hint; cmdk's built-in fuzzy filtering over titles. Selecting a *completed* episode → `/episodes/[id]`; a non-completed one → `/episodes` (it's not viewable yet) — or just always go to `/episodes/[id]` and let that page show its in-progress/failed state (the reader page already handles non-completed). Pick the latter for simplicity.
   - `Command.Empty` → "No results."
   - Loading state while episodes fetch: a slim row using the Phase 2 skeleton or a muted "Loading…" — keep it quiet.
   - Style selected/active item with `--accent-subtle` bg + `--fg`; inactive `--fg-secondary`. 150ms, reduced-motion safe.
3. **Mount + wire in `app-shell.tsx`:** add `const [paletteOpen, setPaletteOpen] = useState(false)`; set the top-bar ⌘K button `onClick={() => setPaletteOpen(true)}` (remove the TODO); render `<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />`.

## Part C — Keyboard shortcuts

Global `keydown` listener in `app-shell.tsx` (add/remove in a `useEffect`). **Guard:** if `document.activeElement` is an `INPUT`/`TEXTAREA`/`[contenteditable]`, ignore single-key shortcuts (`/`, `N`) — but still allow `⌘K`/`Ctrl+K` and `Esc`.
- `⌘K` / `Ctrl+K` → `e.preventDefault()`, toggle palette.
- `/` → open palette (preventDefault so it doesn't type into a field — only when not already in a field per the guard).
- `N` (no modifier) → `router.push("/")` (new transcription).
- `Esc` → if palette open, close it (cmdk may handle this internally — fine); else let the selection-clear in Part E handle it.
Keep the handler small and dependency-correct (stable callbacks / refs to avoid re-binding every render).

## Part D — In-page episode search (`/episodes`)

In `dashboard.tsx`, add an always-visible search input above the list (only when `showSubmit === false`, i.e. the Episodes route, or just always — your call, but it belongs on Episodes):
- Controlled `search` state; client-side filter `filteredEpisodes` further by `title.toLowerCase().includes(search.toLowerCase())`. Compose with the existing collection/batch filters (don't replace them).
- Input styled to tokens (`--surface`, `--border`, clay focus ring), a `Search` lucide icon inside, ~`max-w-sm`.
- When the search yields zero rows, reuse the **filtered-empty** EmptyState (Part C of Phase 2) — "Nothing here / No episodes match." with a clear action that clears the search (and/or filter).

## Part E — Bulk-action bar polish

Polish the existing bar in `dashboard.tsx` (shown when `selectedIds.size > 0`):
- Make it a **sticky bar pinned to the bottom of the viewport** (or bottom of the list region) so it stays reachable with many rows selected — `--elevated` bg, `--border`, rounded, comfortable padding; not a shadow for lift, use border + bg.
- Left: "{n} selected". Right: existing **Copy all** + **Download .zip** (keep handlers) + a **Deselect all** / clear (`X`) control that empties `selectedIds`.
- `Esc` clears the selection when the palette is not open (ties into Part C).
- Keep the exporting/disabled states and toasts intact.

---

## Acceptance criteria
- `cmdk` installed; `GET /api/episodes` added (read-only); no other backend change (`git diff` touches no other `app/api/**`, no `lib/db/**`, no worker, no migration).
- ⌘K / Ctrl+K and the top-bar button both open the palette; the TODO no-op is gone. Palette has Actions + Episodes groups; typing fuzzy-filters episodes; Enter on an episode navigates to its reader; Enter on an action navigates + closes.
- `/` opens the palette and `N` goes to Transcribe — but **both are inert while typing in any input/textarea** (verify: typing "n" in the URL field types "n", doesn't navigate).
- `/episodes` has a working in-page title search that composes with collection/batch filters; empty search result shows the filtered-empty state.
- Bulk-action bar is sticky/reachable, has Deselect all, Esc clears selection; Copy/Download still work.
- No `zinc-*`, no elevation `box-shadow`, focus rings + reduced-motion preserved. `npm run build` + `lint` pass.

## Human test checklist (for Ryan — on the PR's Vercel preview)
1. Press **⌘K** anywhere → palette opens, focused on search. Type part of an episode title → it filters. Enter → opens that episode.
2. In the palette, run "New transcription" / "Go to Collections" → navigates and closes.
3. Press **N** on the Episodes page → lands on Transcribe. Click into the URL field and type a word starting with "n" → it types normally, does NOT navigate (the in-field guard).
4. Press **/** → palette opens (doesn't type a slash into anything).
5. On **Episodes**, use the in-page search box → list filters live; clear it → full list returns. Search something nonexistent → empty state with a clear action.
6. Select a few completed episodes → the bulk bar is pinned and reachable even after scrolling; Deselect all clears it; **Esc** also clears it; Copy all / Download .zip still work.
7. Everything is warm-dark, clay-accented, no white flash, calm under reduced-motion.

## NOT in this rep — later phase (context only)
- **Phase 4 — reader polish:** sticky reader header with actions, chapter nav from `enrichment.chapters`, speaker sidebar, long-form typography. This is the final phase.
