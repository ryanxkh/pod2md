import type { EpisodeEnrichment } from "@/lib/db/schema"
import { FileText, Tag, Users } from "lucide-react"

interface EpisodeOverviewProps {
  enrichment: EpisodeEnrichment | null
}

export function EpisodeOverview({ enrichment }: EpisodeOverviewProps) {
  if (!enrichment) return null

  const summary = enrichment.summary?.trim() ?? ""
  const topics = enrichment.topics
  const people = enrichment.people

  const hasContent =
    summary.length > 0 || topics.length > 0 || people.length > 0

  if (!hasContent) return null

  return (
    <div className="rounded-[8px] border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        {summary.length > 0 && (
          <div className="flex gap-2.5">
            <FileText
              className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="text-sm leading-relaxed text-fg-secondary">
              {summary}
            </p>
          </div>
        )}

        {topics.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag
              className="h-3.5 w-3.5 shrink-0 text-fg-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            {topics.map((topic) => (
              <span
                key={topic}
                className="rounded-[4px] bg-elevated px-1.5 py-0.5 text-xs text-fg-secondary"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {people.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Users
              className="h-3.5 w-3.5 shrink-0 text-fg-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            {people.map((person) => (
              <span
                key={person}
                className="rounded-[4px] bg-elevated px-1.5 py-0.5 text-xs text-fg-secondary"
              >
                {person}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
