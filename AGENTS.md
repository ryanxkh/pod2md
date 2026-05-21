# AGENTS.md

## Project

pod2md converts podcast/video URLs into markdown transcripts with speaker labels and timestamps. Personal-use app, no authentication.

Two codebases in one repo:
- **Next.js web app** (root) — UI + API routes + database
- **RunPod worker** (`runpod-worker/`) — Python ML pipeline (WhisperX + pyannote)

## Stack

- Next.js 16 (App Router, no Pages Router)
- React 19
- TypeScript (strict mode)
- Drizzle ORM + Neon Postgres (`@neondatabase/serverless`)
- Zod 4 for validation
- Tailwind CSS v4
- nanoid for all record IDs

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                   # Next.js dev server at localhost:3000
npm run build                 # production build — run before pushing
npm run lint                  # ESLint
```

### Database

```bash
npm run db:generate   # generate migration from schema changes
npm run db:migrate    # apply migrations to database
npm run db:studio     # open Drizzle Studio (DB browser)
```

Schema lives at `lib/db/schema.ts`. Migrations output to `lib/db/migrations/`.

### RunPod worker (Python, separate project)

```bash
cd runpod-worker
pip install -r requirements.txt
python handler.py
```

## Project structure

```
app/
  layout.tsx, page.tsx        — root layout and dashboard
  api/
    jobs/route.ts             — POST: create episode + dispatch RunPod job
    episodes/[id]/route.ts    — GET: fetch episode + transcript
    webhooks/runpod/route.ts  — POST: RunPod callback (progress/completed/failed)
  episodes/[id]/page.tsx      — transcript view page

components/                   — React components (client and server)
lib/
  db/
    index.ts                  — Drizzle client + connection pool
    schema.ts                 — tables: episodes, speakers, segments, jobs
    migrations/               — Drizzle-generated SQL migrations
  resolvers/                  — URL resolvers (RSS, Apple, Spotify — Phase 2)
  runpod/client.ts            — RunPod API client
  format.ts                   — formatting utilities
  markdown.ts                 — transcript → markdown generator

runpod-worker/                — Python: WhisperX + pyannote diarization
  handler.py                  — RunPod serverless entry point
  pipeline/                   — download → transcribe → format stages
```

## Environment variables

See `.env.example`:
- `DATABASE_URL` — Neon Postgres connection string
- `RUNPOD_API_KEY` — RunPod API authentication
- `RUNPOD_ENDPOINT_ID` — RunPod serverless endpoint
- `RUNPOD_WEBHOOK_SECRET` — shared secret for webhook auth
- `ANTHROPIC_API_KEY` — Claude API (for speaker name resolution)
- `BASE_URL` — app URL for webhook callback construction

## Conventions

- Path alias: `@/*` maps to repo root (e.g., `@/lib/db`)
- Server Components by default. Only add `"use client"` when the component needs interactivity.
- Route handlers return `Response.json()` with `{ error: string }` on failure
- Validate request bodies with Zod `safeParse` — see `app/api/jobs/route.ts`
- All database IDs are nanoid strings, never integers or UUIDs
- Tailwind v4 utility classes inline. No CSS modules, no styled-components.
- Always use Drizzle ORM for queries. Never raw SQL.
- After changing `lib/db/schema.ts`: run `npm run db:generate` then `npm run db:migrate`
- The `searchVector` tsvector column on `episodes` already exists — don't recreate it
- RunPod worker stages are independent — each function takes input and returns output

## Boundaries

### Always

- Run `npm run build` before pushing
- Follow existing patterns — read similar routes/components before writing new ones
- Use Drizzle for all database access
- Use Zod for request body validation in API routes
- Keep commits focused — one logical change per commit

### Ask first

- Adding new npm or pip dependencies
- Creating new database tables or modifying existing columns
- Changing API route request/response shapes
- Any changes to `runpod-worker/` when the task is about the web app (and vice versa)
- Creating new top-level directories

### Never

- Don't add authentication — this is a personal-use app
- Don't refactor code you weren't asked to touch
- Don't change the package manager (stay on npm)
- Don't modify `.env` or `.env.local` files
- Don't introduce CSS-in-JS, CSS modules, or styling other than Tailwind
- Don't add testing frameworks or write tests unless specifically asked
- Don't create abstractions "for the future" — solve what's in front of you
