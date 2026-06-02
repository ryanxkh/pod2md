# Spec: Batch submission + collections (Phase 3)

**Status:** ready to delegate to a Cursor cloud agent
**Repo:** pod2md-repo, branch off current `main`
**Goal:** Paste/import many podcast + YouTube URLs and transcribe them in one go, grouped into named **collections** that become corpora for specialized agents / light RAG.

## Decisions locked (from planning)
- Input: **both** a paste-list (many mixed URLs) **and** multi-select on a single feed.
- A pasted *whole-show* URL defaults to its **latest N episodes (default 10, adjustable)**.
- **Skip already-completed** episodes in a batch (no wasted GPU $).
- **Named collections** — tag a batch with a collection label; filter + bulk-export by it.
- **Fold in retry/delete-failed** (the old SOL-15 work) — batch is unusable without it.
- Transcript export gets **YAML frontmatter** for RAG.
- **Confirm + cap** before firing: show counts, hard-cap batch size.

## What already exists — reuse, don't rebuild
- `jobs.batchId` column + index already in `lib/db/schema.ts` — use it to group a batch.
- Dedup: `episodes.sourceUrl` is unique; `/api/jobs` already `onConflictDoUpdate`s.
- Bulk export exists (`lib/export.ts`, `generateExportMarkdown` already emits Date/Duration/Speakers) — extend it.
- Full-text search scaffolded (`episodes.search_vector` tsvector + GIN) — leave for Phase 4, but collections should play nice with it.

---

## Part A — Data model (`lib/db/schema.ts` + migration)
1. Add `collection: text("collection")` (nullable) to `episodes`. Single collection per episode for v1.
2. Generate migration via Drizzle (`drizzle-kit`). **Caveat:** Neon free tier has a 10-branch limit — preview-deploy migrations can pile up branches; if PR checks fail on a Neon branch error, that's the known blocker, delete stale branches.
3. `jobs.batchId` already exists — no schema change, just populate it.

## Part B — Batch flow (two API routes, resolve once)
**Phase 1 — Preview (`POST /api/batch/preview`)**
- Body: `{ urls: string[], collection?: string, latestN?: number }` (latestN default 10).
- Parse: split on newlines/whitespace, trim, drop blanks, dedupe within the paste.
- For each URL: `detectUrlType` → resolve.
  - feed/show (rss/apple/spotify show) → take **latest N** episodes
  - youtube / direct / single-episode URL → 1 item
- Mark each resolved item as **new** vs **already-completed** (skip; match on sourceUrl with a completed job).
- **Cap total resolved items at 25** — if exceeded, return them trimmed + a clear "capped at 25" message.
- Return: `{ items: ResolvedItem[], counts: { new, skipped, failed }, errors: {url, reason}[] }`. Resolve failures per-URL must NOT abort the batch.

**Phase 2 — Confirm (UI)**
- Show: "Queue **N** new (M already done, skipped · K failed to resolve)" + the collection name. User approves.

**Phase 3 — Submit (`POST /api/batch/submit`)**
- Body: the confirmed `items[]` + `collection` (so we don't re-resolve).
- Generate one `batchId` (nanoid) for the whole submission.
- For each item: upsert episode (set `collection`), create a `job` row with that `batchId`, dispatch to RunPod with the webhook (reuse the existing `/api/jobs` dispatch logic — extract it into a shared helper rather than duplicating).
- Submit all; RunPod queues per its worker cap. One failed dispatch must not abort the rest — record it as a failed job and continue.
- Return `{ batchId, queued, failed }`.

> NOTE: throughput is capped by RunPod's max workers (currently 3). Raising it is a **RunPod config + cost change handled separately** — NOT in this PR. Code just submits all and lets RunPod queue.

## Part C — Input UI (`components/submit-form.tsx` + picker)
1. **Bulk paste:** a "Batch" affordance opening a textarea (one URL per line) + optional **Collection** text input + **latest-N-per-feed** number (default 10) + **Preview** button → calls preview → shows the confirm summary → **Queue** button → submit.
2. **Feed multi-select:** extend `components/episode-picker.tsx` from single-select (click = submit) to **checkboxes + "Select all" + "Latest N"** + a "Transcribe N" button. Selecting many → submit as a batch (optionally with a collection).

## Part D — Dashboard (`app/page.tsx`, `components/dashboard.tsx`, `components/episode-list.tsx`)
1. **Collection filter** — pills or dropdown to filter the episode list by collection. Extend the `app/page.tsx` query to select `episodes.collection` and filter.
2. **Batch progress** — when a batch is active, a small summary: `N done · M running · K failed`. Group by `batchId` (already selectable).
3. **Retry / delete (fold in SOL-15):**
   - `POST /api/episodes/[id]/retry` — re-dispatch a failed episode (new job row, same episode).
   - `DELETE /api/episodes/[id]` — remove episode (cascade speakers/segments/jobs).
   - UI: per-row retry + delete on failed rows; plus **"Retry all failed"** and **"Clear failed"** for a batch/the list.
   - (Reference the unmerged `devin/...sol-15...` branch for the original approach, but rebuild against current `main`.)

## Part E — RAG output (`lib/export.ts`, single-episode download)
Prepend **YAML frontmatter** to exported transcripts (and the single "Download .md"):
```yaml
---
title: <episode title>
source_url: <sourceUrl>
published_at: <YYYY-MM-DD or null>
duration: <hh:mm:ss>
speakers: [<resolved speaker names>]
collection: <collection or null>
transcribed_at: <episode.createdAt date>
---
```
Use only fields already in the DB. (No `show`/`language` columns exist — omit for v1; add later if wanted.) Bulk export should support **export-by-collection** (zip of all transcripts in a collection).

---

## Out of scope (this PR)
- Raising RunPod worker concurrency (separate config/cost step — verify RunPod scaling/billing first).
- X/Twitter resolver.
- Full-text search UI (Phase 4) — but don't break the existing `search_vector`.
- Multi-collection-per-episode (v1 is single).

## Acceptance / human test checklist
- [ ] Paste 5 mixed URLs (a YouTube video, a direct audio URL, and a podcast show URL) + a collection name → Preview shows correct new/skip/fail counts → Queue → 5+ episodes appear, all tagged with the collection, sharing one batchId.
- [ ] A pasted show URL queues its latest 10 (or the adjusted N).
- [ ] Re-running a batch with already-done URLs skips them (count reflects it).
- [ ] Batch >25 items is capped with a clear message.
- [ ] Single-feed picker: select-all / pick several → all transcribe.
- [ ] Filter dashboard by collection works; batch progress counts update.
- [ ] Retry a failed episode re-runs it; delete removes it; "Retry all failed" works.
- [ ] Exported .md has valid YAML frontmatter; export-by-collection zips the right set.
- [ ] Regression: single-URL submit (podcast/YouTube/direct) still works unchanged.
- [ ] `pnpm build` / typecheck / lint pass; migration applies cleanly.

## PR
Open against `main`, link the Linear issue, put this checklist in the PR description. Follow repo Cursor rules (`review.mdc`, `pipeline.mdc`, `infra.mdc`).
