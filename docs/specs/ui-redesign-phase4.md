# Spec: UI redesign — Phase 4 (reader enrichment overview) — FINAL

**Status:** ready to delegate to a Cursor cloud agent
**Repo:** pod2md-repo, branch off current `main` (Phases 1–3 merged)
**Scope of THIS rep:** One thing only — surface the already-computed enrichment in the episode reader. This is the **final** phase of the UI arc.

## Goal
The pipeline already computes `summary`, `topics`, and `people` for each episode and stores them in `episodes.enrichment` — but they're **only used to build the export markdown**, never shown in the browser. The reader today is just title/meta + raw timestamped segments. Add a small **overview card** at the top of the reader that renders summary + topics + people. That's it.

## Why this is the whole phase (deliberately trimmed)
Ryan reads transcripts in Claude Code, not the browser, so polishing reader *chrome* is low-payoff. The one piece worth doing is the one that adds **information** rather than decoration: surfacing the enrichment that's currently invisible. The originally-outlined chapter nav, sticky reader header, sticky speaker rail, and long-form typography overhaul are **intentionally dropped** (not deferred) — see "Explicitly out of scope."

## Decisions locked
- New presentational component `components/episode-overview.tsx`, rendered in `app/episodes/[id]/page.tsx` **between the title/meta block and `<TranscriptView>`**. It can be a **server component** (pure presentational, no hooks) — do not add `"use client"`.
- **Do not modify `components/transcript-view.tsx`'s logic.** The page already has `episode.enrichment`; pass it straight to the new component. Keep transcript-view untouched except, if truly necessary, nothing.
- Render **only sections that have content.** If `episode.enrichment` is `null`, render **nothing** (no empty card) — many older episodes predate enrichment / await backfill, and a blank card would be noise. Within the card: omit the summary line if empty, omit topics if `topics.length === 0`, omit people if `people.length === 0`.
- **No backend, no schema, no new deps, no new route.** Presentation only. `EpisodeEnrichment` type already exists in `lib/db/schema.ts` (`{ summary: string; topics: string[]; people: string[]; chapters: EpisodeChapter[] }`) — import it; don't redefine.
- Reuse Phase 1 tokens. No `zinc-*`, no elevation `box-shadow`, focus rings preserved, reduced-motion respected. `npm run build` + `lint` pass.

## What already exists — reuse, don't rebuild
- `lib/db/schema.ts` — `EpisodeEnrichment` interface (and the `enrichment` jsonb column). Import the type.
- `lib/export.ts` `buildOrientationHeader()` (~line 164) — the canonical treatment: `Summary: …`, `Topics: a, b, c`, `People: …`. Mirror that content, styled.
- `app/episodes/[id]/page.tsx` — already fetches the episode and renders the title (`<h1>`), a duration badge, and `<StatusBadge>` above `<TranscriptView>`. Insert the overview here. `episode.enrichment` is in scope.
- Existing chip/badge styling precedent: the collection badge in `components/episode-list.tsx` (`--elevated` bg, small radius) — match it for topic/people chips.
- `lucide-react` is installed — use existing icons (e.g. `Sparkles`/`FileText` for summary, `Tag` for topics, `Users` for people). No new icon dep.

## Build — `components/episode-overview.tsx`
Props: `{ enrichment: EpisodeEnrichment | null }`. Behavior:
1. If `!enrichment` → `return null`.
2. Compute `hasContent = !!enrichment.summary?.trim() || enrichment.topics.length > 0 || enrichment.people.length > 0`. If `!hasContent` → `return null`.
3. Otherwise render a card:
   - Container: `bg-surface`, `border border-border`, `--radius-control` (8px), comfortable padding (`p-4`/`p-5`), placed with sensible top/bottom margin so it sits cleanly between the title and the transcript.
   - **Summary** (if present): a small muted label or `Sparkles`/`FileText` icon + the summary text in `text-fg-secondary`, readable line-height. Full text, no truncation (summaries are a few sentences).
   - **Topics** (if any): a row of chips — each `bg-elevated text-fg-secondary` pill, ~4px radius, small text; optionally a leading `Tag` icon on the group. Wrap on overflow.
   - **People** (if any): either chips (same style) or an inline `People: a · b · c` line in `text-fg-secondary`; pick whichever reads cleaner — chips preferred for visual consistency with topics.
   - Keep it calm and compact — this is an orientation aid, not a hero banner. No accent-color fills (clay is for actions); this card is informational, so keep it neutral surface + muted text, maybe a single small accent icon at most.
4. Static only — no collapse, no client state, no animation needed.

## Wire-in — `app/episodes/[id]/page.tsx`
- Import `EpisodeOverview`, render `<EpisodeOverview enrichment={episode.enrichment} />` directly after the title/meta `<div>` and before `<TranscriptView>` (only meaningful when there's a transcript, but the component self-guards on null so placement is forgiving).
- No other changes to the page.

## Acceptance criteria
- Opening an episode that **has** enrichment shows an overview card (summary + topic chips + people) above the transcript; opening one with `enrichment === null` shows **no card** and the reader looks exactly as before.
- Empty sub-sections are omitted (e.g. an episode with topics but no people shows topics only).
- Only files changed: `components/episode-overview.tsx` (new) + `app/episodes/[id]/page.tsx` (one import + one line). No backend, no deps, no other component.
- No `zinc-*`, no elevation `box-shadow`, tokens used throughout. `npm run build` + `npm run lint` pass; no TS errors.

## Human test checklist (for Ryan — on the PR's Vercel preview)
1. Open a **recently transcribed** episode (new ones auto-enrich) → an overview card sits above the transcript with a readable summary, topic chips, and people. Warm-dark, neutral surface, no clay fills.
2. Open an **older** episode that was never enriched → no card at all, transcript renders as before (no blank box, no layout gap).
3. Confirm topics/people wrap nicely and nothing overflows on a narrow window.
> Note: to see the card on *old* episodes you'd need to run `npm run backfill:enrichment` (CLI, needs `DATABASE_URL` + `ANTHROPIC_API_KEY`) — out of scope for this PR; new transcriptions already carry enrichment.

## Explicitly out of scope (dropped, not deferred — arc ends here)
- Chapter navigation / jump-links from `enrichment.chapters`.
- Sticky reader header with pinned actions.
- Sticky/side-rail speaker legend.
- Long-form typography overhaul of the segment list.
Rationale: the reader is consumed in Claude Code; only the information-surfacing card earns its keep. With this merged, the UI redesign (Phases 1–4) is complete.
