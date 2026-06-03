# Spec: Single-episode paste + remove Batch filter pills

Two independent fixes. Ship together or as two PRs — your call.

---

## Fix 1 — Pasting a single episode URL must transcribe only that episode

### Problem

Pasting a specific episode link (e.g. a Spotify episode:
`https://open.spotify.com/episode/33oMOus6SMZvaN6CFKpXRo`) opens the **full feed
picker** showing every recent episode of the show, instead of transcribing the
one episode that was pasted.

### Why it happens

`/api/resolve` (`app/api/resolve/route.ts`) always returns `type: "feed"` with
the whole show's episode list for `spotify` / `apple` / `rss` inputs. There is no
"single episode" return path.

`resolveSpotify` (`lib/resolvers/spotify.ts`) already does the hard part: it reads
the episode title via Spotify oEmbed, finds the show's RSS feed, locates the
matching episode in the feed, and boosts it to the top of the list. But the
single-episode intent is then thrown away — the route returns the whole list and
the UI (`components/submit-form.tsx`, `handleResolve`) renders the picker
(`kind: "pick"`).

### Desired behavior

When the input is a **single-episode URL**, skip the picker and go straight to
transcribing that one episode.

- Spotify: `open.spotify.com/episode/...` → already detected in `resolveSpotify`.
- Apple: `podcasts.apple.com/.../id<showId>?i=<episodeId>` — the `?i=` query param
  marks a single episode. `resolveApple` (`lib/resolvers/apple.ts`) currently
  ignores it and returns the whole feed. Handle it the same way.

### Implementation notes

1. **Resolvers** (`lib/resolvers/spotify.ts`, `lib/resolvers/apple.ts`):
   - When the input is a single-episode URL, after locating the matching episode
     in the resolved RSS feed, return a result that flags it as a single episode.
   - Suggested shape: extend `ResolverResult` (`lib/resolvers/types.ts`) with an
     optional `singleEpisode?: boolean`, OR return the matched episode in a
     dedicated field. Keep the existing `episodes` list populated so the fallback
     (below) still works.
   - **Matching:** reuse the existing normalised title match in `resolveSpotify`
     (lines ~108-119). For Apple, match the feed episode whose GUID/enclosure
     corresponds to the `?i=` episode id if derivable; otherwise fall back to
     title match via the iTunes `lookup?id=<episodeId>&entity=podcastEpisode`
     endpoint to get the episode title, then match by title in the feed.

2. **Route** (`app/api/resolve/route.ts`):
   - When the resolver reports a single episode AND the match was found, return
     `type: "episode"` with the single resolved episode object
     (`{ title, audioUrl, publishedAt, description, durationSecs }`) plus
     `podcastTitle`.

3. **UI** (`components/submit-form.tsx`, `handleResolve`):
   - Add a branch for `data.type === "episode"` that goes straight to submitting
     that single episode (same payload path the picker uses for one selected
     episode — see `episodesToBatchItems` / `submitJob`). Do **not** open the
     `kind: "pick"` step.

### Required fallback (do not skip)

RSS feeds are truncated — they typically expose only the most recent N episodes.
If the pasted episode is **older than the feed window**, it won't be found in the
feed and we can't get its audio URL.

- In that case, fall back to the **current behavior**: return `type: "feed"` and
  show the picker, with a short notice like
  *"Couldn't isolate that exact episode — pick it from the feed below."*
- Never return `type: "episode"` without a real `audioUrl`.

### Acceptance criteria

- [ ] Paste a single Spotify episode URL whose episode is in the feed → app
      transcribes only that episode, no picker shown.
- [ ] Paste a single Apple episode URL (`?i=...`) in the feed → same.
- [ ] Paste a show/feed URL (no specific episode) → picker still shows (unchanged).
- [ ] Paste a single-episode URL whose episode is NOT in the feed window → picker
      shown with the fallback notice (no crash, no empty/invalid submit).
- [ ] Existing YouTube and direct-audio paths unchanged.

---

## Fix 2 — Remove the Batch filter pills on the Episodes page

### Problem

The Episodes page shows a `Batch  [All] [3ARXaRnt] [dLJAorzT]` filter row. The
pills are truncated random batch IDs (`batchId.slice(0, 8)`) — meaningless to a
human. They add no usable way to find episodes.

### Decision

**Remove the Batch filter UI entirely.** Collections already provide meaningful
grouping; a date/source label would just duplicate Collections for marginal gain.

### Implementation notes

- File: `components/dashboard.tsx`.
- Remove the Batch filter block (the `{batchIds.length > 0 && ( ... )}` JSX,
  approx. lines 476-505 — the `<span>Batch</span>`, the `All` button, and the
  `batchIds.slice(0, 5).map(...)` pills).
- Remove now-dead state/derivation: `activeBatchId`, `setActiveBatchId`,
  `batchIds`, and any episode filtering keyed on `activeBatchId`. Verify the
  episode list filter still works for Collection + search after removal.

### Keep (do NOT remove)

- The `batchId` column / field on episodes in the DB and types.
- `BatchProgressBar` and the `batchProgress` logic — batches still drive the
  live progress indicator during an active batch submit. Only the **filter
  pills** are being removed.

### Acceptance criteria

- [ ] No "Batch" filter row on the Episodes page.
- [ ] Collection filter and episode search still work.
- [ ] Active batch submit still shows the progress bar.
- [ ] No unused-variable / dead-code lint errors from the removal.
