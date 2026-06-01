# Spec: YouTube transcription support (Phase 3)

**Status:** ready to delegate to a Cursor cloud agent
**Repo:** pod2md-repo, branch off current `main`
**Scope:** YouTube only. X/Twitter is a separate follow-on (flakier extraction).

## The idea in one line
A YouTube URL has no downloadable audio file like a podcast RSS enclosure does. So we do **audio extraction on the RunPod worker with `yt-dlp`** (where ffmpeg + the GPU already live), and the app just passes the YouTube URL through with a `source_type: "youtube"` flag.

## Why this shape
- The worker input **already has a `source_type` field** (`lib/runpod/client.ts` → `RunPodInput`), currently hardcoded to `"direct"` in `app/api/jobs/route.ts`. That is the hook.
- The worker Dockerfile **already installs `ffmpeg`**, which yt-dlp needs for audio extraction. No new system deps.
- yt-dlp resolves the real (signed, expiring) stream at download time, so we never store a stale audio URL.

---

## Part A — Worker (`runpod-worker/`)

1. **`requirements.txt`** — add `yt-dlp`. (Pure-Python; no apt changes. Note: yt-dlp needs frequent updates to keep working against YouTube — do not pin to an old version.)

2. **`pipeline/download.py`** — add a YouTube path:
   - New function `download_youtube_audio(url: str) -> str` using the `yt_dlp` Python API:
     - format `bestaudio/best`
     - `FFmpegExtractAudio` postprocessor → `mp3` (or m4a)
     - output to a temp file, return its path (same contract as the existing `download_audio`)
     - on failure raise `RuntimeError` with a clear message (mirror the existing error style)
   - Keep the existing HTTP `download_audio` untouched for `direct`.

3. **`handler.py`** — branch on `source_type`:
   - Read `source_type = input_data.get("source_type", "direct")`.
   - If `"youtube"` → call `download_youtube_audio(audio_url)`; else the existing `download_audio(audio_url)`.
   - Everything downstream (transcribe, diarize, format, temp-file cleanup in `finally`) is unchanged.

4. **No Dockerfile change needed** beyond rebuilding (ffmpeg already present).

5. **Deploy (Ryan / infra step, NOT the cloud agent):** rebuild and push the image, then point the RunPod endpoint at the new version.
   - `docker build --platform linux/amd64 --secret id=HF_TOKEN,env=HF_TOKEN -t rkhodge/pod2md-worker:latest runpod-worker/`
   - `docker push rkhodge/pod2md-worker:latest`
   - In RunPod, release/redeploy endpoint `499qn2rklaswxi` so it pulls the new image.

---

## Part B — App (Next.js)

1. **`lib/resolvers/index.ts`** — `detectUrlType` returns `"youtube"` for `youtube.com/watch`, `youtu.be/`, `m.youtube.com`, `music.youtube.com`. Add `"youtube"` to the `UrlType` union.

2. **`lib/resolvers/youtube.ts`** (new, thin — no yt-dlp in Vercel) — fetch title via YouTube **oEmbed** (no API key):
   - `GET https://www.youtube.com/oembed?url=<encoded>&format=json` → `title`, `author_name`.
   - Return `{ title, url }`. Duration/publishedAt are unavailable via oEmbed → leave null (worker still transcribes fine).
   - On oEmbed failure (private/age-gated/deleted), throw a clear 422-style error.

3. **`app/api/resolve/route.ts`** — handle `youtube`:
   - Return a new shape, e.g. `{ type: "youtube", url, title }`. (Not `"feed"` — a single video needs no episode picker.)

4. **`components/submit-form.tsx`** — on `type: "youtube"`, go to the existing **title-confirm step** (reuse the `direct` flow's title step) prefilled with the oEmbed title, user can edit, then submit.
   - The submit payload must include `source_type: "youtube"` and `audio_url` = the YouTube URL.

5. **`app/api/jobs/route.ts`** — plumb `source_type` through:
   - Add `source_type: z.enum(["direct", "youtube"]).default("direct")` to `CreateJobBody`.
   - Pass it into `submitJob({ audio_url, source_type }, webhook)` instead of the hardcoded `"direct"`.
   - Episode row: `audioUrl` and `sourceUrl` = the YouTube URL (the `onConflictDoUpdate` dedup on `sourceUrl` still works).

---

## Out of scope
- X/Twitter (separate spec).
- No playlist/channel batch — single video only.
- No schema migration.
- **Cookie/PO-token auth is NOT in scope unless the spike below forces it.**

## Known risk (accepted, build anyway)
YouTube actively blocks datacenter IPs (RunPod) with "confirm you're not a bot," which can make yt-dlp fail from the worker. ~70% chance this bites. **If it does:** the fix is passing browser cookies to yt-dlp (`cookiefile` / `--cookies-from-browser`) via a worker env/secret — treat that as a fast-follow, not part of this PR. First real YouTube job from the deployed worker is the true test.

## Acceptance / human test checklist
- [ ] Worker: `download_youtube_audio` pulls audio for a normal public YouTube video locally (or via a worker shell).
- [ ] App: paste a YouTube URL → resolves to the correct title → title-confirm step → submit.
- [ ] A job is created with `source_type: "youtube"`; episode appears in the dashboard.
- [ ] **End-to-end:** a real YouTube video transcribes through the deployed worker and produces a transcript. ← the one that proves bot-detection didn't block us.
- [ ] Regression: a normal podcast RSS/Apple/Spotify URL and a direct audio URL still work (source_type defaults to `direct`).
- [ ] `pnpm build` / typecheck passes; worker `test_local.py` still passes.

## PR
Open against `main`, link the Linear issue, fill the PR description with this checklist. Follow repo Cursor rules (`review.mdc`, `pipeline.mdc`, `infra.mdc`).
