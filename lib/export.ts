import { formatDuration } from "@/lib/format"

export interface ExportEpisode {
  title: string
  publishedAt: string | null
  durationSecs: number | null
  speakers: string[]
}

export interface ExportSegment {
  startMs: number
  speakerName: string
  text: string
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
  const lines: string[] = [`# ${episode.title}`, ""]

  if (episode.publishedAt) {
    const date = new Date(episode.publishedAt)
    lines.push(`Date: ${date.toISOString().split("T")[0]}`)
  }
  if (episode.durationSecs) {
    lines.push(`Duration: ${formatDuration(episode.durationSecs)}`)
  }
  if (episode.speakers.length > 0) {
    lines.push(`Speakers: ${episode.speakers.join(", ")}`)
  }
  lines.push("", "---", "")

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
