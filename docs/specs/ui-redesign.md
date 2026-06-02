# Spec: UI redesign — Phase 1 (design system + app shell)

**Status:** ready to delegate to a Cursor cloud agent
**Repo:** pod2md-repo, branch off current `main`
**Scope of THIS rep:** Phase 1 only. Phases 2–4 are outlined at the bottom for context — **do not build them in this rep.** Keep the diff reviewable.

## Goal
Move pod2md from "a form on a page" to a product that feels crafted. This rep installs the **visual foundation** every later phase reuses: a dark-only warm design system + a persistent app-shell with a real left sidebar, plus a visual pass over the existing components to adopt the new tokens. No new product features, no pipeline/API/data changes.

## Why this first
The single highest-leverage change is the persistent sidebar shell. But a sidebar implies real navigation, which implies routes, which implies the design tokens exist first. So Phase 1 = tokens → shell → routes → restyle. Everything in Phases 2–4 (states, toasts, Cmd+K, reader polish) sits on top of this and must not be blocked by it.

## Decisions locked (do not re-litigate)
- **Dark-only.** Remove light mode entirely. No `prefers-color-scheme`, no theme toggle. Set `color-scheme: dark`.
- **Warm-neutral + single clay accent** design language (studied from Anthropic / Sierra / Vercel — warmth + restraint, never a saturated digital hue). Exact tokens below.
- **Targeted libraries only, NOT full shadcn.** Add `lucide-react` for icons. Do **not** scaffold shadcn/ui, do **not** introduce CVA, do **not** rewrite the existing hand-rolled components into a `components/ui/` primitive layer. Restyle them in place. (`sonner` and `cmdk` come in later phases — do not add them now.)
- **Keep Geist Sans (UI) + Geist Mono (timestamps, wordmark).** Already wired in `app/layout.tsx`. Do not change fonts.
- **No backend touched.** Do not modify anything under `app/api/`, `lib/db/`, `lib/resolvers/`, `lib/batch/`, `lib/export.ts`, or the worker. This is presentation-only. If a server component's data query must change to support a new route, that is allowed (read-only queries only), but no schema/migration work.

## What already exists — reuse, don't rebuild
- `app/layout.tsx` — Geist Sans/Mono variables + `<ToastProvider />` already mounted. Keep the provider; restyle later.
- `components/dashboard.tsx` (597 lines, `"use client"`) — owns ALL state: episode list, selection, polling (`pollRef`/`startPolling`), collection + batch filters, bulk export (copy/zip), retry/delete. **This coupling is load-bearing — do not split the state.** See routing note below for how to reuse it across routes without tearing the state apart.
- `components/submit-form.tsx` — multi-step form (url → title → pick → batch-preview) + batch paste. Restyle inputs/buttons only.
- `components/episode-list.tsx`, `components/status-badge.tsx`, `components/episode-picker.tsx`, `components/transcript-view.tsx` — restyle to new tokens.
- `app/episodes/[id]/page.tsx` — reader page; gets the shell wrapper + token restyle (light touch; deep reader polish is Phase 4).

---

## Part A — Design tokens (`app/globals.css`)

Replace the current light-first `:root` + `@media (prefers-color-scheme: dark)` block entirely. Define the system once, dark-only, as CSS variables exposed to Tailwind v4 via `@theme inline`. Use these EXACT values:

```css
@import "tailwindcss";

:root {
  color-scheme: dark;

  /* 3-layer warm-dark surfaces (never pure black) */
  --bg:        #0E0D0C;  /* page */
  --surface:   #1A1815;  /* sidebar, cards, inputs */
  --elevated:  #221F1B;  /* hover, popovers, modals */

  /* warm hairlines — felt, not seen */
  --border:        rgba(245, 240, 230, 0.08);
  --border-strong: rgba(245, 240, 230, 0.14);

  /* warm text ramp */
  --text:           #F5F2EC;
  --text-secondary: #A8A096;
  --text-muted:     #6E665C;

  /* clay accent — pod2md signature. CTAs, active nav, focus. */
  --accent:        #CC6B4D;
  --accent-hover:  #D87C5F;
  --accent-press:  #B85C3F;
  --accent-fg:     #16130F;  /* text/icon ON a clay fill */
  --accent-subtle: rgba(204, 107, 77, 0.12);  /* active nav pill, focus glow */

  /* status — warm-consistent, kept clear of the accent.
     NOTE: 'transcribing/running' is deliberately NOT amber, so the
     warm-orange space belongs to the accent alone. */
  --status-done:    #7FA06A;  /* sage  */
  --status-run:     #A8A096;  /* neutral; pair with a subtle pulse animation */
  --status-queued:  #6E665C;
  --status-fail:    #D2574E;  /* muted red, not neon */
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-elevated: var(--elevated);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-fg: var(--text);
  --color-fg-secondary: var(--text-secondary);
  --color-fg-muted: var(--text-muted);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-fg: var(--accent-fg);
  --color-accent-subtle: var(--accent-subtle);
  --color-status-done: var(--status-done);
  --color-status-run: var(--status-run);
  --color-status-queued: var(--status-queued);
  --color-status-fail: var(--status-fail);

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  --radius-badge: 4px;
  --radius-control: 8px;   /* inputs, buttons, cards */
  --radius-modal: 12px;
}

body {
  background: var(--bg);
  color: var(--text);
}
```

Scales/conventions the agent must apply consistently everywhere it restyles:
- **Spacing:** 4px base (Tailwind default scale is fine).
- **Radius:** badges 4px, inputs/buttons/cards 8px, modals 12px.
- **Elevation in dark = border + lighter surface, NEVER box-shadow.** Remove existing `shadow-lg` etc.
- **Focus:** every interactive element gets a visible focus ring — `focus-visible:ring-2 ring-[--color-accent] ring-offset-2 ring-offset-[--color-bg]` (or equivalent). No `outline:none` without a replacement.
- **Motion:** 150ms ease-out on hover/active transitions. Wrap non-essential motion in `@media (prefers-reduced-motion: no-preference)`.
- **Replace all hardcoded `zinc-*` / `white` / `red-*` colors** in the existing components with the new tokens. After this rep there should be no raw `zinc-` color utility left in `components/` or `app/` (search for `zinc-` to verify).

---

## Part B — App shell (new)

Create a persistent shell that wraps every page.

**New file `components/app-shell.tsx`** (`"use client"` — needs `usePathname` for active state):
- Left **sidebar**, `bg-surface`, `border-border` right border, fixed full height.
  - Width 248px expanded; collapsible to 56px (icon-only). Persist collapsed state in `localStorage` (`pod2md:sidebar-collapsed`). A small chevron toggle at the sidebar footer.
  - **Top:** wordmark `pod2md` in Geist Mono, `text-fg`, with a small clay square/dot mark to its left.
  - **Nav** (primary group): each item = `lucide-react` icon (20px) + label.
    - Transcribe → `/` — icon `AudioLines` (or `Mic`)
    - Episodes → `/episodes` — icon `List`
    - Collections → `/collections` — icon `Library`
    - Active item: `bg-accent-subtle text-fg` pill (8px radius) + clay icon; a 2px clay left-edge bar is optional. Inactive: `text-fg-secondary`, hover `bg-elevated text-fg`. Active = exact match for `/`, prefix match for the others.
  - **Footer** (pinned bottom): Settings → `/settings` — icon `Settings`; below it the collapse toggle.
  - Collapsed mode: icons only, centered, label as `title`/tooltip.
- **Top bar:** thin (h-12), `border-border` bottom border, holds the current page title (left). Right side: a **Cmd+K placeholder** button (`⌘K` in a small bordered chip + `Search` lucide icon) that is **visually present but inert** in Phase 1 (wired in Phase 3 — add a `// TODO(phase 3): open command palette` and no-op onClick). Do not build search now.
- **Main content area:** `bg-bg`, left margin = sidebar width, max content width ~`880px` centered with comfortable padding (`px-8 py-8`). Pages render their own `<h1>`-level content inside.
- **Responsive:** below `md`, sidebar collapses to an overlay drawer toggled by a hamburger in the top bar. Keep it simple — a slide-in drawer over a dimmed backdrop.

**Wire it in `app/layout.tsx`:** wrap `{children}` in `<AppShell>{children}</AppShell>` (keep `<ToastProvider/>`). Set `<html lang="en" className="dark ...">` and ensure body uses the tokens. Remove any light-mode classes.

---

## Part C — Routes (split the single page; preserve the shared state)

Today everything lives on `/` inside `<Dashboard>`. Split into real routes so the nav works. **Critical constraint:** the live-polling + selection + export state in `dashboard.tsx` must keep working. Approach:

- **`/` (Transcribe):** the submit surface. Renders `<SubmitForm>` (with its existing `onSubmitted`/`onBatchSubmitted`). On a successful submit/batch-submit, `router.push("/episodes")` so the user sees it appear and polling takes over there. Page `<h1>` = "Transcribe". Keep it focused: form + a one-line helper, nothing else.
- **`/episodes` (Episodes):** the dashboard list. Move the existing server query from `app/page.tsx` here, rendering `<Dashboard>` **minus** the embedded `<SubmitForm>** at the top — i.e. the list + filters + batch progress + bulk-action bar + retry/delete. The `<Dashboard>` component currently renders `<SubmitForm>` itself (line ~553); refactor so the form is NOT rendered on `/episodes` (the Transcribe route owns it). Cleanest: add a prop `showSubmit?: boolean` (default true to avoid breaking) and set `showSubmit={false}` on `/episodes`, OR lift `<SubmitForm>` out of `<Dashboard>` and render it only on `/`. Either is fine; keep all polling/selection/export logic intact. Page `<h1>` = "Episodes".
- **`/collections` (Collections):** a view of the existing collections. Reuse the collection-filter logic. v1 can be: a grid/list of collection cards (name + episode count + "Export knowledge pack .zip" action that reuses `downloadCollectionZip`), clicking a card → `/episodes?collection=<name>` (the episodes page reads the query param into its existing `collectionFilter`). Don't invent new data — collections come from `episodes.collection` (already queried in `app/page.tsx`). Page `<h1>` = "Collections".
- **`/settings` (Settings):** a minimal stub page. Sections: **About** (one line on what pod2md is), **Maintenance** (a note that `npm run backfill:enrichment` is run from the CLI — do NOT build a button that runs server commands), and a placeholder for future prefs. Page `<h1>` = "Settings". Keep it genuinely minimal; this exists so the nav item isn't dead.

If the cleanest refactor is to lift `<SubmitForm>` out of `<Dashboard>`, do that and pass the existing `onSubmitted`/`onBatchSubmitted` handlers down from a thin client wrapper. Whatever the structure: **do not duplicate the polling logic** and do not break optimistic insert-on-submit.

---

## Part D — Visual pass on existing components (restyle to tokens, no behavior change)

Apply the new tokens; do not change any logic, handlers, or props.

- **`submit-form.tsx`:** `inputClass` → `bg-surface border-border` inputs, `focus-visible` clay ring, `placeholder:text-fg-muted`. `buttonClass` → **clay primary**: `bg-accent text-accent-fg hover:bg-accent-hover` (this is the app's main CTA — it should read as the one confident colored element). Secondary/"Cancel"/"Batch paste" → ghost/text buttons in `text-fg-secondary hover:text-fg`. Make "Batch paste URLs" a proper secondary button with a `lucide` icon (e.g. `ClipboardList`), not a forgotten text link.
- **`episode-list.tsx`:** rows get `hover:bg-surface` + 8px radius + consistent row padding; titles `text-fg`, meta `text-fg-muted`; collection chip → `bg-elevated text-fg-secondary` 4px-radius badge; replace the inline retry/delete SVGs with `lucide-react` `RotateCw` and `Trash2` (keep the same handlers and `title`s). Checkbox → accent-colored when checked.
- **`status-badge.tsx`:** remap the style table to the new status tokens — `completed`→sage, `transcribing`/`queued`/running→neutral (`--status-run`/`--status-queued`) with a subtle pulse for in-progress, `failed`/`cancelled`→muted red. Keep the pill shape + `text-xs`.
- **`episode-picker.tsx`:** card borders `border-border`, hover `border-border-strong bg-surface`; selected checkbox accent; primary "Transcribe N" button → clay. Token swap only.
- **`transcript-view.tsx`:** export buttons → primary clay ("Copy transcript") + secondary ghost ("Download .md"); speaker legend dots and the `SPEAKER_COLORS`/`DOT_COLORS` arrays may stay as the multi-speaker distinction palette (they're functional, not chrome) but shift them to read well on the warm-dark bg if any look off. Editable-name input + "Resolve speaker names" → token styling. Light touch — deep reader work is Phase 4.
- **`app/episodes/[id]/page.tsx`:** now lives inside the shell, so drop the standalone `max-w-[720px] ... py-16` wrapper and the manual `← Back` link (the shell + top bar provide chrome; a back affordance can live in the top bar). Title/meta/loading-spinner/failed-banner → tokens. The spinner border colors → `border-border` / `border-t-accent`.
- **`toast.tsx`:** token swap only (warm-dark surface, `border-border`, `text-fg`). Full toast overhaul (variants, error-persist, retry, `sonner`) is **Phase 2** — leave the behavior alone here.

---

## Acceptance criteria
- App is dark-only; no light-mode flash; `color-scheme: dark` set. No `prefers-color-scheme` left in the codebase.
- A persistent left sidebar is present on every route with working nav (Transcribe `/`, Episodes `/episodes`, Collections `/collections`, Settings `/settings`); the active item is visibly highlighted with the clay-subtle pill; sidebar collapses to icons and the state persists across reloads.
- Submitting a URL on `/` queues it and lands the user on `/episodes` where it appears and polls to completion exactly as before (no regression in submit → poll → complete, retry, delete, bulk copy/zip, collection export).
- `grep -r "zinc-" app components` returns nothing (all colors are tokens).
- No `box-shadow`/`shadow-*` used for elevation in dark surfaces.
- Every interactive control has a visible focus ring.
- `lucide-react` is the only new dependency. `sonner`, `cmdk`, shadcn are **not** added.
- `npm run build` passes; `npm run lint` passes; no TypeScript errors.

## Human test checklist (for Ryan — verify in the browser after merge)
1. Open the app: it's dark, warm-toned (not cold blue-black), with a clay accent on the primary button. Sidebar on the left with pod2md wordmark + 4 nav items.
2. Click each nav item — the page changes and the active item highlights in clay. Collapse the sidebar with the chevron; reload — it stays collapsed.
3. On **Transcribe**, paste a podcast/YouTube URL → submit. You should land on **Episodes** and watch the new row go queued → transcribing → completed.
4. On **Episodes**: retry a failed one, delete one, select a couple completed and "Copy all" / "Download .zip" — all still work.
5. On **Collections**: see your collections; click one → Episodes filtered to it; export a knowledge pack.
6. Open a completed episode (reader page): it's inside the shell now, dark + warm, transcript readable, Copy/Download work.
7. Resize the window narrow → sidebar becomes a drawer via a hamburger.
8. Nothing flashes white at any point.

---

## NOT in this rep — later phases (context only, do not build)
- **Phase 2 — feedback states:** real empty states (icon + title + CTA) on every list; skeleton loaders on the episode list (shimmer, not spinners); toast overhaul via `sonner` (success auto-dismiss, error persistent + retry); per-row inline progress (spinner → check → red-X + retry) replacing the flat "Batch progress: X done" text strip.
- **Phase 3 — power user:** `cmdk` command palette wired to the ⌘K placeholder (recent episodes + actions + fuzzy search); a global search field; keyboard shortcuts (N = new, / = search); bulk-action bar polish.
- **Phase 4 — reader polish:** deep pass on the episode reader (sticky header with title + actions, chapter navigation from `enrichment.chapters`, speaker sidebar, denser typography for long-form reading).
