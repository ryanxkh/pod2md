# Spec: LLM-optimized transcript output (Phase 1)

**Status:** ready to delegate to a Cursor cloud agent
**Repo:** pod2md-repo, branch off current `main`
**Goal:** Make exported transcript `.md` files — and a collection of them — the best possible artifact to drop directly into an LLM's context (the user always pulls the markdown into Claude Code; they never use the web UI for reading). Pure output quality. NO retrieval/embeddings/MCP/auth/chat — Claude Code reads files directly, so none of that applies.

## What exists today (build on it, don't replace)
- `lib/export.ts`: `generateYamlFrontmatter` (title, source_url, published_at, duration, speakers, collection, transcribed_at), `generateExportMarkdown` (frontmatter + `# title` + grouped diarized lines `[ts] Name: text`), `episodeFilename` (slugified title only).
- Single-episode "Download .md" + "Copy transcript" (detail page); bulk export (zip).
- DB `episodes`: title, sourceUrl, audioUrl, description, publishedAt, durationSecs, transcriptMd, collection, createdAt. `segments` (speaker, start_ms, end_ms, text, seq). Worker `format.py` returns `metadata.language` (not currently stored).

---

## Part A — Episode enrichment (LLM-generated, stored once)

Generate orientation metadata with Claude (the app already has `ANTHROPIC_API_KEY`), store it, reuse in exports + the collection index.

1. **Migration** (Drizzle): add to `episodes`:
   - `enrichment jsonb` — holds `{ summary: string, topics: string[], people: string[], chapters: {start_ms, title}[] }`
   - `language text` (from worker `metadata.language`)
   - `show text` (podcast/channel name, distinct from episode title — see A4)
2. **Enrichment generator** (`lib/enrich.ts`): given the diarized transcript, one Claude call returns:
   - `summary` — 2–3 sentence abstract
   - `topics` — key themes/topics (5–10)
   - `people` — named people/entities discussed, with role if inferable
   - `chapters` — ordered list of `{ start_ms, title }` topic segments (anchor each to the nearest segment boundary)
   Use a single structured (JSON / tool-use) Claude call. Keep the prompt model-agnostic in output (plain data).
3. **When it runs:** after a transcript is saved (RunPod webhook completion path), trigger enrichment as a **follow-up step that does NOT block the webhook ack** (webhook must stay fast — run enrichment in a separate request/route or after responding). Store result in `episodes.enrichment`. Also persist `language` from the webhook payload's metadata.
4. **`show` population:** persist the resolver's `podcastTitle` (RSS/Apple/Spotify) / channel name (YouTube) at submit time into `episodes.show`. Null for direct audio. (Plumb from the resolve result through `dispatchTranscriptionJob`.)
5. **Backfill script** (one-off, manual run): enrich all existing completed episodes + set `language`/`show` where derivable. Note Claude cost (one call per episode; a long transcript is a sizable input prompt — acceptable, flag total in the run log).

## Part B — Better single-file markdown (`lib/export.ts`)

`generateExportMarkdown` output, in order:
1. **YAML frontmatter** — extend with: `show`, `language`, `speaker_count`, `episode_id`, and `token_estimate` (compute from transcript length, ~chars/4; lets the user know if it fits a context window). Keep existing fields.
2. **`# {title}`**
3. **Orientation header** (from `enrichment`):
   ```
   > **Summary:** <summary>
   > **Topics:** topic, topic, ...
   > **People:** name (role), ...
   ```
   (Blockquote so it's visually distinct and the model reads it first. Omit gracefully if enrichment missing.)
4. **Transcript body** with **chapter headers** inserted: at each chapter's anchored segment, emit `## [hh:mm:ss] {chapter title}` before the speaker line. Bold speaker names: `[hh:mm:ss] **Name:** text`. Keep the existing same-speaker grouping.
5. If no enrichment yet, fall back to current behavior (frontmatter + body) — never error.

## Part C — Filenames

Replace `episodeFilename`: `YYYY-MM-DD-{slug}.md` (date from `publishedAt` ?? `createdAt`; slug from title). Collision-resistant: if two files would collide, append a short suffix (e.g. last 4 of episode id). Fixes the duplicate-name issue seen with same-title episodes.

## Part D — Collection export as a knowledge pack

When exporting a collection (extend the existing bulk/zip export):
1. Output a **folder** `{collection-slug}/` containing each episode's enriched `.md` (Part B) named per Part C.
2. Generate **`INDEX.md`** at the folder root via new `generateCollectionIndex(collection, episodes[])`:
   - Header: collection name, episode count, date range, and a one-paragraph description of what the collection is and how to use it (e.g. "These are diarized transcripts from the *{collection}* collection. Each file has YAML frontmatter + a summary + the full transcript. Use them as source material to answer questions about {topics}.").
   - A table/list: each episode's filename, date, one-line summary (from enrichment), and source_url.
3. Zip the folder. (Keep the existing all-episodes bulk export working too; this adds per-collection structured export.)
4. Optional nicety: offer the index also named `CLAUDE.md` (auto-loads as instructions in Claude Code) — make it a small toggle or just document that the user can rename it. Default filename `INDEX.md` (model-agnostic).

## Out of scope
- MCP server, embeddings/vector search, in-app chat, auth, SaaS shell, marketing.
- Worker/RunPod changes (enrichment runs in the Next.js app, not the worker).
- Re-enrichment UI (generate once; a manual backfill/regen script is enough).

## Infra / manual steps (Ryan; agent must NOT do these)
- Apply the Drizzle migration via the **neon-http migrator script** (NOT `npm run db:migrate` — it silently no-ops; see `docs/specs/` notes / team memory). Verify the new columns exist.
- Run the **enrichment backfill** against prod (`ANTHROPIC_API_KEY` + prod `DATABASE_URL`). Watch the cost in the log.
- No new env vars (uses existing `ANTHROPIC_API_KEY`).

## Acceptance / human test checklist
- [ ] Migration applied & verified (`enrichment`, `language`, `show` columns exist).
- [ ] New transcription auto-generates enrichment (summary/topics/people/chapters) without blocking the webhook.
- [ ] Backfill enriches existing episodes.
- [ ] A single exported `.md` opens with: frontmatter (incl. token_estimate, show, language, speaker_count) → title → summary/topics/people blockquote → transcript with `## [ts] Chapter` headers and bold speakers.
- [ ] Filenames are `YYYY-MM-DD-slug.md`; two same-title episodes don't collide.
- [ ] Collection export produces a `{collection}/` folder with `INDEX.md` (describes the collection + lists episodes with summaries) + the enriched transcripts; zips correctly.
- [ ] Drop an exported collection folder into Claude Code → it can answer a cross-episode question and cite an episode/timestamp. (The real-world test.)
- [ ] Regression: existing transcription pipeline + single/bulk export still work; enrichment-missing files fall back gracefully; `npm run build`/lint pass.

## PR
Open against `main`, link the Linear issue, put this checklist in the PR description. Follow repo Cursor rules. Do the migration/backfill manually per above.
