import { formatDuration } from "@/lib/format"

export interface ExportEpisode {
  title: string
  sourceUrl?: string | null
  publishedAt: string | null
  durationSecs: number | null
  speakers: string[]
  collection?: string | null
  transcribedAt?: string | null
}

export interface ExportSegment {
  startMs: number
  speakerName: string
  text: string
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

export function generateYamlFrontmatter(episode: ExportEpisode): string {
  const lines = ["---"]
  lines.push(`title: ${yamlQuote(episode.title)}`)
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
  lines.push(
    `collection: ${episode.collection ? yamlQuote(episode.collection) : "null"}`,
  )
  const transcribed = formatYamlDate(episode.transcribedAt)
  lines.push(`transcribed_at: ${transcribed ?? "null"}`)
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

export function generateExportMarkdown(
  episode: ExportEpisode,
  segments: ExportSegment[],
): string {
  const frontmatter = generateYamlFrontmatter(episode)
  const lines: string[] = [frontmatter, "", `# ${episode.title}`, ""]

  if (segments.length === 0) return lines.join("\n")

  const maxMs = segments[segments.length - 1].startMs
  const useHours = maxMs >= 3_600_000

  let currentSpeaker: string | null = null
  let currentTexts: string[] = []
  let currentTimestamp = 0

  function flushGroup() {
    if (currentSpeaker === null) return
    const ts = formatTimestamp(currentTimestamp, useHours)
    lines.push(`${ts} ${currentSpeaker}: ${currentTexts.join(" ")}`)
    lines.push("")
  }

  for (const seg of segments) {
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

  return lines.join("\n")
}

export function episodeFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "episode"
  ) + ".md"
}
