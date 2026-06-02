import { eq, asc, desc } from "drizzle-orm"
import { notFound } from "next/navigation"
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {episode.title}
        </h1>
        <div className="flex items-center gap-3">
          {episode.durationSecs && (
            <span className="rounded-[4px] bg-elevated px-2.5 py-0.5 text-xs font-medium text-fg-secondary">
              {formatDuration(episode.durationSecs)}
            </span>
          )}
          {latestJob && <StatusBadge status={latestJob.status} />}
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm text-fg-secondary">
            Transcription in progress&hellip;
          </p>
          {latestJob && <StatusBadge status={latestJob.status} />}
        </div>
      )}

      {latestJob?.status === "failed" && (
        <div className="rounded-[8px] border border-status-fail/30 bg-elevated p-4">
          <p className="text-sm text-status-fail">
            Transcription failed
            {latestJob.errorMessage && `: ${latestJob.errorMessage}`}
          </p>
        </div>
      )}

      {hasTranscript && (
        <TranscriptView
          episodeId={id}
          episodeTitle={episode.title}
          sourceUrl={episode.sourceUrl}
          publishedAt={episode.publishedAt?.toISOString() ?? null}
          createdAt={episode.createdAt.toISOString()}
          durationSecs={episode.durationSecs}
          collection={episode.collection}
          show={episode.show}
          language={episode.language}
          enrichment={episode.enrichment}
          transcribedAt={episode.createdAt.toISOString()}
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
