import { formatDuration } from "@/lib/format"
import type { EpisodeEnrichment } from "@/lib/db/schema"

export type { EpisodeEnrichment }

export interface ExportEpisode {
  id?: string
  title: string
  sourceUrl?: string | null
  publishedAt: string | null
  createdAt?: string | null
  durationSecs: number | null
  speakers: string[]
  collection?: string | null
  transcribedAt?: string | null
  show?: string | null
  language?: string | null
  enrichment?: EpisodeEnrichment | null
}

export interface ExportSegment {
  startMs: number
  speakerName: string
  text: string
}

export interface CollectionIndexEpisode {
  filename: string
  title: string
  publishedAt: string | null
  sourceUrl?: string | null
  enrichment?: EpisodeEnrichment | null
}

function formatYamlDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().split("T")[0]
}

function yamlQuote(value: string): string {
  if (/[:#\[\]{}&*!|>'"%@`]/.test(value) || value.includes("\n")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  }
  return value
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "episode"
  )
}

export function collectionSlug(name: string): string {
  return slugifyTitle(name) || "collection"
}

export function episodeFilename(
  episode: Pick<
    ExportEpisode,
    "title" | "publishedAt" | "createdAt" | "id"
  >,
  usedNames?: Set<string>,
): string {
  const dateIso = episode.publishedAt ?? episode.createdAt
  const datePart = formatYamlDate(dateIso) ?? "undated"
  const slug = slugifyTitle(episode.title)
  let base = `${datePart}-${slug}.md`
  if (episode.id && usedNames?.has(base)) {
    base = `${datePart}-${slug}-${episode.id.slice(-4)}.md`
  }
  if (usedNames) {
    let candidate = base
    let counter = 1
    while (usedNames.has(candidate)) {
      const suffix = episode.id
        ? episode.id.slice(-4)
        : String(++counter)
      candidate = `${datePart}-${slug}-${suffix}.md`
    }
    usedNames.add(candidate)
    return candidate
  }
  return base
}

export function generateYamlFrontmatter(
  episode: ExportEpisode,
  tokenEstimate?: number,
): string {
  const lines = ["---"]
  lines.push(`title: ${yamlQuote(episode.title)}`)
  if (episode.id) {
    lines.push(`episode_id: ${yamlQuote(episode.id)}`)
  }
  if (episode.sourceUrl) {
    lines.push(`source_url: ${yamlQuote(episode.sourceUrl)}`)
  }
  const published = formatYamlDate(episode.publishedAt)
  lines.push(`published_at: ${published ?? "null"}`)
  if (episode.durationSecs != null) {
    lines.push(`duration: ${formatDuration(episode.durationSecs)}`)
  } else {
    lines.push("duration: null")
  }
  const speakerList = episode.speakers.map((s) => yamlQuote(s)).join(", ")
  lines.push(`speakers: [${speakerList}]`)
  lines.push(`speaker_count: ${episode.speakers.length}`)
  lines.push(
    `show: ${episode.show ? yamlQuote(episode.show) : "null"}`,
  )
  lines.push(
    `language: ${episode.language ? yamlQuote(episode.language) : "null"}`,
  )
  lines.push(
    `collection: ${episode.collection ? yamlQuote(episode.collection) : "null"}`,
  )
  const transcribed = formatYamlDate(episode.transcribedAt)
  lines.push(`transcribed_at: ${transcribed ?? "null"}`)
  if (tokenEstimate != null) {
    lines.push(`token_estimate: ${tokenEstimate}`)
  }
  lines.push("---")
  return lines.join("\n")
}

function formatTimestamp(ms: number, useHours: boolean): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")

  if (useHours) {
    const hh = String(hours).padStart(2, "0")
    return `[${hh}:${mm}:${ss}]`
  }
  return `[${mm}:${ss}]`
}

function formatChapterHeading(ms: number, useHours: boolean, title: string): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  const ts = useHours
    ? `${String(hours).padStart(2, "0")}:${mm}:${ss}`
    : `${mm}:${ss}`
  return `## [${ts}] ${title}`
}

function buildOrientationHeader(enrichment: EpisodeEnrichment | null | undefined): string[] {
  if (!enrichment) return []

  const lines: string[] = ["> **Summary:** " + enrichment.summary]
  if (enrichment.topics.length > 0) {
    lines.push("> **Topics:** " + enrichment.topics.join(", "))
  }
  if (enrichment.people.length > 0) {
    lines.push("> **People:** " + enrichment.people.join(", "))
  }
  return [...lines, ""]
}

function chapterAtSegment(
  chapters: EpisodeEnrichment["chapters"],
  startMs: number,
): string | null {
  for (const ch of chapters) {
    if (ch.start_ms === startMs) return ch.title
  }
  return null
}

export function generateExportMarkdown(
  episode: ExportEpisode,
  segments: ExportSegment[],
): string {
  const orientation = buildOrientationHeader(episode.enrichment)

  if (segments.length === 0) {
    const frontmatter = generateYamlFrontmatter(episode, 0)
    return [frontmatter, "", `# ${episode.title}`, "", ...orientation].join("\n")
  }

  const maxMs = segments[segments.length - 1].startMs
  const useHours = maxMs >= 3_600_000
  const chapters = episode.enrichment?.chapters ?? []
  const emittedChapters = new Set<number>()
  const lines: string[] = []

  let currentSpeaker: string | null = null
  let currentTexts: string[] = []
  let currentTimestamp = 0

  function flushGroup() {
    if (currentSpeaker === null) return
    const ts = formatTimestamp(currentTimestamp, useHours)
    lines.push(
      `${ts} **${currentSpeaker}:** ${currentTexts.join(" ")}`,
    )
    lines.push("")
  }

  for (const seg of segments) {
    const chapterTitle = chapterAtSegment(chapters, seg.startMs)
    if (chapterTitle && !emittedChapters.has(seg.startMs)) {
      flushGroup()
      currentSpeaker = null
      currentTexts = []
      lines.push(formatChapterHeading(seg.startMs, useHours, chapterTitle))
      lines.push("")
      emittedChapters.add(seg.startMs)
    }

    if (seg.speakerName === currentSpeaker) {
      currentTexts.push(seg.text)
    } else {
      flushGroup()
      currentSpeaker = seg.speakerName
      currentTimestamp = seg.startMs
      currentTexts = [seg.text]
    }
  }
  flushGroup()

  const markdownBody = [
    `# ${episode.title}`,
    "",
    ...orientation,
    ...lines,
  ].join("\n")

  const tokenEstimate = estimateTokenCount(markdownBody)
  const frontmatter = generateYamlFrontmatter(episode, tokenEstimate)

  return [frontmatter, "", markdownBody].join("\n")
}

export function generateCollectionIndex(
  collectionName: string,
  episodes: CollectionIndexEpisode[],
): string {
  const sorted = [...episodes].sort((a, b) => {
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
    return da - db
  })

  const dates = sorted
    .map((e) => formatYamlDate(e.publishedAt))
    .filter((d): d is string => d != null)

  const dateRange =
    dates.length === 0
      ? "unknown dates"
      : dates.length === 1
        ? dates[0]
        : `${dates[0]} – ${dates[dates.length - 1]}`

  const topicSample = [
    ...new Set(
      sorted.flatMap((e) => e.enrichment?.topics ?? []).slice(0, 8),
    ),
  ]
  const topicHint =
    topicSample.length > 0
      ? topicSample.join(", ")
      : "the topics covered across these episodes"

  const lines = [
    `# ${collectionName}`,
    "",
    `This folder contains **${sorted.length}** diarized transcript${sorted.length === 1 ? "" : "s"} from the *${collectionName}* collection (${dateRange}).`,
    "",
    "Each `.md` file includes YAML frontmatter, an orientation summary (topics, people), chapter headers in the transcript body, and timestamped speaker lines. Use these files as source material to answer questions about " +
      topicHint +
      ". Cite specific episodes and `[hh:mm:ss]` timestamps when possible.",
    "",
    "## Episodes",
    "",
    "| File | Date | Summary | Source |",
    "| --- | --- | --- | --- |",
  ]

  for (const ep of sorted) {
    const date = formatYamlDate(ep.publishedAt) ?? "—"
    const summary =
      ep.enrichment?.summary?.replace(/\|/g, "\\|").replace(/\n/g, " ") ??
      "—"
    const source = ep.sourceUrl
      ? `[link](${ep.sourceUrl})`
      : "—"
    lines.push(
      `| ${ep.filename} | ${date} | ${summary} | ${source} |`,
    )
  }

  lines.push("")
  return lines.join("\n")
}
