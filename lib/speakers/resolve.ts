import Anthropic from "@anthropic-ai/sdk"

interface SpeakerInput {
  id: string
  label: string
}

interface SegmentInput {
  speakerId: string
  text: string
  seq: number
}

interface SpeakerResult {
  speakerId: string
  name: string
  confidence: string
}

const WORDS_PER_SPEAKER = 500

function buildSpeakerSamples(
  speakerList: SpeakerInput[],
  segmentList: SegmentInput[],
): string {
  const grouped = new Map<string, string[]>()
  for (const s of speakerList) grouped.set(s.id, [])

  for (const seg of segmentList) {
    const bucket = grouped.get(seg.speakerId)
    if (bucket) bucket.push(seg.text)
  }

  const lines: string[] = []
  for (const spk of speakerList) {
    const texts = grouped.get(spk.id) ?? []
    const words: string[] = []
    let count = 0
    for (const t of texts) {
      const w = t.split(/\s+/)
      if (count + w.length > WORDS_PER_SPEAKER) {
        words.push(...w.slice(0, WORDS_PER_SPEAKER - count))
        break
      }
      words.push(...w)
      count += w.length
    }
    lines.push(`[${spk.label}]: ${words.join(" ")}`)
  }
  return lines.join("\n\n")
}

export async function resolveSpeakerNames(
  episodeTitle: string,
  speakerList: SpeakerInput[],
  segmentList: SegmentInput[],
): Promise<SpeakerResult[]> {
  if (speakerList.length === 0) return []

  if (speakerList.length === 1) {
    return [{ speakerId: speakerList[0].id, name: episodeTitle, confidence: "low" }]
  }

  const client = new Anthropic()
  const samples = buildSpeakerSamples(speakerList, segmentList)
  const labels = speakerList.map((s) => s.label)

  const prompt = [
    `Podcast episode: "${episodeTitle}"`,
    "",
    "Below are transcript samples grouped by speaker label.",
    "Identify each speaker by name based on what they say, how others address them, and context clues.",
    "",
    samples,
    "",
    `Return a JSON array with one object per speaker label (${labels.join(", ")}).`,
    'Each object: { "label": string, "name": string, "confidence": "high" | "medium" | "low" }',
    "Return ONLY the JSON array, no other text.",
  ].join("\n")

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const parsed: Array<{ label: string; name: string; confidence: string }> =
      JSON.parse(jsonMatch[0])

    const labelToId = new Map(speakerList.map((s) => [s.label, s.id]))
    return parsed
      .filter((r) => labelToId.has(r.label))
      .map((r) => ({
        speakerId: labelToId.get(r.label)!,
        name: r.name,
        confidence: r.confidence,
      }))
  } catch (err) {
    console.error("Speaker resolution failed:", err)
    return []
  }
}
