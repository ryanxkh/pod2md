# Spec: UI redesign — Phase 2 (feedback states)

**Status:** ready to delegate to a Cursor cloud agent
**Repo:** pod2md-repo, branch off current `main` (Phase 1 merged in #29)
**Scope of THIS rep:** Phase 2 only — the four feedback-state deliverables below. **Do NOT build Phase 3 (Cmd+K, search, shortcuts) or Phase 4 (reader polish).** Keep the diff reviewable.

## Goal
Phase 1 gave pod2md a body (shell + design system). Phase 2 gives it a nervous system: it now *responds*. Four deliverables — toasts, skeletons, empty states, per-row progress. No new product features, no API/DB/worker changes. Everything builds on the Phase 1 tokens already in `app/globals.css` (`--accent`, `--status-*`, `--surface`, etc.) — reuse them, do not invent new colors.

## Decisions locked (do not re-litigate)
- **Adopt `sonner`** for toasts; delete the hand-rolled `components/toast.tsx` implementation. Adopt nothing else — no `cmdk`, no shadcn.
- Toast behavior: **success auto-dismisses (4s); errors persist until dismissed and, where a retry exists, carry a "Retry" action button.** Bottom-right, dark theme, mapped to our warm tokens (not sonner's default `richColors`).
- **Skeletons stream via Suspense**, shape-matched shimmer — never spinners — on the `/episodes` and `/collections` initial data load.
- **Empty states** are a single reusable component (lucide icon + active-voice title + one sentence + a CTA), used on episodes (empty + filtered-empty) and collections.
- **Per-row inline progress** replaces status-by-text: each row shows an animated indicator for in-flight work; the flat "Batch progress: X done · Y running · Z failed" text strip (`dashboard.tsx:427–430`) becomes a compact progress bar + counts.
- **No backend touched.** Nothing under `app/api/`, `lib/db/`, `lib/resolvers/`, `lib/batch/`, `lib/export.ts`, or the worker. Read-only server query restructuring (for streaming) is allowed.
- Keep all existing handler logic, polling, optimistic insert, and export behavior intact. This is presentation + feedback only.

## What already exists — reuse, don't rebuild
- `app/globals.css` — Phase 1 tokens + a `status-pulse` keyframe (`.animate-status-pulse`) already exist. Add a `shimmer` utility here (see Part B); don't duplicate the pulse.
- `components/toast.tsx` — exports `showToast(message)` + `<ToastProvider/>`. **20 call sites** across `components/dashboard.tsx`, `components/transcript-view.tsx`, `components/collections-view.tsx`. `<ToastProvider/>` is mounted in `app/layout.tsx`. You will migrate all of these (Part A).
- `components/status-badge.tsx` — pill with the Phase 1 status tokens. Keep it; Part D adds an animated icon alongside it, doesn't replace it.
- `components/episode-list.tsx` — rows already have hover + retry/delete (lucide `RotateCw`/`Trash2`) for failed. Add the per-row running indicator here.
- `components/dashboard.tsx` — `batchProgress` memo (lines ~77–84) already yields `{ done, running, failed, total }`; drive the new progress bar from it. `isRunning`/`isFailed` helpers exist.
- `app/episodes/page.tsx` — already has a `<Suspense>` but the `await loadDashboardData()` is *above* the boundary, so the fallback never streams. Restructure (Part B).
- `app/collections/page.tsx` + `components/collections-view.tsx` — collections-view has a text empty state at line ~67. Replace with the component.
- `lib/load-dashboard-data.ts`, `lib/collections-data.ts` (or wherever `/collections` fetches) — the async data loaders to move inside Suspense.

---

## Part A — Toasts via `sonner`

> Follow the **current sonner docs** for exact prop/API names — do not rely on memorized APIs. Confirm `<Toaster>` props and the `toast.success` / `toast.error` / action-button signatures against the installed version before wiring.

1. `npm install sonner`.
2. **Replace the provider:** in `app/layout.tsx`, swap `<ToastProvider/>` for sonner's `<Toaster/>`. Configure: position bottom-right, dark theme, close button on by default off (success self-dismisses; errors get a dismiss). Map colors to our tokens — toast surface `--surface`, border `--border`, text `--fg`, success accent `--status-done`, error accent `--status-fail` — via `toastOptions` class names / CSS vars per sonner's theming API. Do **not** use `richColors` (it overrides our palette).
3. **Create a thin wrapper** `lib/notify.ts` exporting:
   - `notifySuccess(message: string)` → `toast.success`, duration 4000.
   - `notifyError(message: string, action?: { label: string; onClick: () => void })` → `toast.error`, `duration: Infinity`, optional action button.
   - (optional) `notifyInfo(message: string)` for neutral messages.
4. **Migrate all 20 call sites.** Map by intent:
   - Success/neutral (`Copied …`, `Downloading …`, `Queued …`, `Downloaded knowledge pack …`, `Retrying transcription`, `Transcript copied …`) → `notifySuccess`.
   - Errors (`Failed to copy/download/export …`, `Retry failed`, `Delete failed`, the `data.error ?? "Retry failed"` case, `No completed episodes …`) → `notifyError`.
   - **Add a Retry action** to these specific failures, wiring the action to re-invoke the same operation:
     - `handleRetry` failure → `notifyError("Retry failed", { label: "Retry", onClick: () => handleRetry(id) })`
     - `handleDelete` failure → `notifyError("Delete failed", { label: "Retry", onClick: () => handleDelete(id) })`
     - `handleBulkCopy` / `handleBulkDownload` / `handleExportCollection` failures → `notifyError(msg, { label: "Try again", onClick: () => <that handler>() })`
   - `No completed episodes in this collection` is a guard, not a failure → `notifyInfo`.
5. Delete the old `showToast`/`ToastProvider` implementation from `components/toast.tsx` (or repurpose the file to re-export from `lib/notify.ts`). No `showToast` import should remain.

## Part B — Skeleton loaders (streamed)

1. **Add a shimmer utility** to `app/globals.css` (gradient sweep, reduced-motion-guarded):
   ```css
   @media (prefers-reduced-motion: no-preference) {
     @keyframes shimmer { 100% { transform: translateX(100%); } }
   }
   ```
   Build a `components/skeleton.tsx` base `<Skeleton className>` = `--elevated` block, 4–8px radius, with an absolutely-positioned sweeping highlight (`--surface`→transparent gradient) animated by the keyframe; static (no sweep) under reduced motion.
2. **`EpisodeListSkeleton`** — ~8 rows shape-matched to a real episode row (checkbox square + title bar + meta bar on the left, badge pill on the right).
3. **`CollectionsSkeleton`** — shape-matched to the collection cards grid.
4. **Make them actually stream.** Restructure so the DB query happens in an async component *inside* the Suspense boundary:
   - `app/episodes/page.tsx`: move the `await loadDashboardData()` into an inner `async function EpisodesData()` (or similar) rendered as `<Suspense fallback={<EpisodeListSkeleton/>}><EpisodesData/></Suspense>`. The page component itself must not `await` the data above the boundary, or the skeleton never shows.
   - Do the same for `app/collections/page.tsx` with `<CollectionsSkeleton/>`.
   - Keep `connection()` so the routes stay dynamic and the data is fresh.

## Part C — Empty states

1. **`components/empty-state.tsx`** — props `{ icon: LucideIcon; title: string; description: string; action?: { label: string; href?: string; onClick?: () => void } }`. Layout: centered, padded (`py-16`), 32–40px muted icon, `text-fg` title, `text-fg-secondary` one-liner, then a clay primary button or `<Link>` CTA. Tasteful, not loud.
2. Wire it:
   - **Episodes, no episodes at all** (`episode-list.tsx` empty branch): icon `AudioLines`, title "No transcripts yet", desc "Paste a podcast or video URL to get your first transcript.", action → Link to `/` labelled "Go to Transcribe".
   - **Episodes, filtered-empty** (a collection/batch filter yields zero rows — distinguish from truly empty in `dashboard.tsx`): icon `FilterX` (or `Search`), title "Nothing here", desc "No episodes match this filter.", action → "Clear filter" (clears collection/batch filter).
   - **Collections, none** (`collections-view.tsx:~67`): icon `Library`, title "No collections yet", desc "Add a collection name when transcribing to group episodes into a knowledge pack.", action → Link to `/` "Go to Transcribe".

## Part D — Per-row progress + batch progress bar

1. **Per-row indicator** in `episode-list.tsx` (right-side cluster, beside `StatusBadge`):
   - `queued` → small muted `Clock` (lucide), `--status-queued`.
   - running (`transcribing` / anything `isRunning`) → `Loader2` with `animate-spin`, `--accent` (or `--status-run`). Keep the `StatusBadge` text too.
   - `completed` → no extra indicator (badge is enough), or a subtle `Check` in `--status-done`.
   - `failed`/`cancelled` → keep the existing `RotateCw` retry + `Trash2` delete; the badge already reads red.
   Keep it compact — one 14–16px icon, 150ms transitions, reduced-motion safe.
2. **Batch progress bar** — replace the flat text at `dashboard.tsx:427–430` with a compact component driven by the existing `batchProgress` memo:
   - A thin (4–6px) rounded track (`--elevated`) with a filled portion = `done/total` in `--status-done`; if any failed, show that slice in `--status-fail`.
   - Below/beside it, the counts: "{done}/{total} done" + "· {running} running" + "· {failed} failed" (omit zero segments), small `text-fg-secondary`.
   - Animate the fill width (150–200ms ease-out).

---

## Acceptance criteria
- `sonner` installed; `components/toast.tsx` hand-rolled impl gone; no `showToast` import remains (`grep -rn "showToast" app components` → empty). Toasts are bottom-right, warm-themed (not sonner default), success auto-dismisses ~4s, errors persist and the retry/delete/export failures show a working action button.
- `/episodes` and `/collections` show a shimmer skeleton (shape-matched, not a spinner, not the "Loading…" text) while their data loads, via a Suspense boundary the data fetch is genuinely inside.
- Reusable `EmptyState` used on all three empty cases; the filtered-empty case is distinct from the truly-empty case and its CTA clears the filter.
- The flat "Batch progress:" text is replaced by a progress bar + counts driven by `batchProgress`; in-flight rows show an animated indicator.
- All Phase 1 behavior intact: submit→`/episodes`→poll→complete, retry, delete, bulk copy/zip, collection export, sidebar/nav.
- No new `zinc-*`, no elevation `box-shadow`, focus rings preserved, reduced-motion respected.
- Only new dependency is `sonner`. `npm run build` + `npm run lint` pass; no TS errors.

## Human test checklist (for Ryan — on the PR's Vercel preview)
1. Reload `/episodes` — you briefly see shimmer placeholder rows (not a spinner, not "Loading…"), then the real list.
2. Submit a URL → land on Episodes → the new row shows a spinning indicator while transcribing, then settles to completed.
3. Trigger a success (copy a transcript) — toast appears bottom-right and fades after ~4s. Trigger a failure (e.g. delete with network offline, or retry something that errors) — toast persists and shows a Retry/Try again button that actually re-runs the action.
4. Empty the list (or filter to a collection with nothing) — you get a proper empty state with an icon + CTA, and the filtered-empty CTA clears the filter.
5. Run a batch — the progress bar fills as episodes complete; counts update; a failure shows a red slice.
6. Toggle OS reduced-motion — shimmer/spinners calm down, nothing janks.

## NOT in this rep — later phases (context only, do not build)
- **Phase 3 — power user:** `cmdk` palette wired to the Phase 1 ⌘K placeholder; global search; keyboard shortcuts (N, /); bulk-action bar polish.
- **Phase 4 — reader polish:** sticky reader header with actions, chapter nav from `enrichment.chapters`, speaker sidebar, long-form typography.
