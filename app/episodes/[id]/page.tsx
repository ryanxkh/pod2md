import { eq, asc, desc } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { episodes, speakers, segments, jobs } from "@/lib/db/schema"
import { TranscriptView } from "@/components/transcript-view"
import { StatusBadge } from "@/components/status-badge"
import { formatDuration } from "@/lib/format"

export default async function EpisodePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, id))
    .limit(1)

  if (!episode) notFound()

  const [latestJob] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.episodeId, id))
    .orderBy(desc(jobs.createdAt))
    .limit(1)

  const speakerRows = await db
    .select()
    .from(speakers)
    .where(eq(speakers.episodeId, id))

  const segmentRows = await db
    .select()
    .from(segments)
    .where(eq(segments.episodeId, id))
    .orderBy(asc(segments.seq))

  const hasTranscript = segmentRows.length > 0
  const isLoading =
    latestJob &&
    latestJob.status !== "completed" &&
    latestJob.status !== "failed"

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-6 py-16">
      <Link
        href="/"
        className="self-start text-sm text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        &larr; Back
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {episode.title}
        </h1>
        <div className="flex items-center gap-3">
          {episode.durationSecs && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {formatDuration(episode.durationSecs)}
            </span>
          )}
          {latestJob && <StatusBadge status={latestJob.status} />}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Transcription in progress&hellip;
          </p>
          {latestJob && <StatusBadge status={latestJob.status} />}
        </div>
      )}

      {latestJob?.status === "failed" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-700 dark:text-red-400">
            Transcription failed
            {latestJob.errorMessage && `: ${latestJob.errorMessage}`}
          </p>
        </div>
      )}

      {hasTranscript && (
        <TranscriptView
          episodeId={id}
          episodeTitle={episode.title}
          publishedAt={episode.publishedAt?.toISOString() ?? null}
          durationSecs={episode.durationSecs}
          speakers={speakerRows.map((s) => ({
            id: s.id,
            label: s.label,
            name: s.name ?? s.label,
          }))}
          segments={segmentRows.map((seg) => ({
            id: seg.id,
            startMs: seg.startMs,
            endMs: seg.endMs,
            speakerId: seg.speakerId,
            text: seg.text,
          }))}
        />
      )}
    </div>
  )
}
