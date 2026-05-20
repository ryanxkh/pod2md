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

export function generateTranscriptMarkdown(
  episode: { title: string },
  segments: Array<{ start_ms: number; speaker_name: string; text: string }>,
): string {
  if (segments.length === 0) return `# ${episode.title}\n`

  const maxMs = segments[segments.length - 1].start_ms
  const useHours = maxMs >= 3_600_000

  const lines: string[] = [`# ${episode.title}`, ""]

  let currentSpeaker: string | null = null
  let currentTexts: string[] = []
  let currentTimestamp = 0

  function flushGroup() {
    if (currentSpeaker === null) return
    const ts = formatTimestamp(currentTimestamp, useHours)
    lines.push(`${ts} **${currentSpeaker}:** ${currentTexts.join(" ")}`)
    lines.push("")
  }

  for (const seg of segments) {
    if (seg.speaker_name === currentSpeaker) {
      currentTexts.push(seg.text)
    } else {
      flushGroup()
      currentSpeaker = seg.speaker_name
      currentTimestamp = seg.start_ms
      currentTexts = [seg.text]
    }
  }
  flushGroup()

  return lines.join("\n")
}
