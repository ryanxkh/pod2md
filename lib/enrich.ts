import Anthropic from "@anthropic-ai/sdk"
import { eq, asc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, speakers, segments } from "@/lib/db/schema"
import type { EpisodeEnrichment, EpisodeChapter } from "@/lib/db/schema"

export type { EpisodeEnrichment, EpisodeChapter }

interface EnrichSegment {
  startMs: number
  speakerName: string
  text: string
}

function anchorChapterStarts(
  chapters: EpisodeChapter[],
  segmentStarts: number[],
): EpisodeChapter[] {
  if (segmentStarts.length === 0) return chapters

  return chapters.map((ch) => {
    let best = segmentStarts[0]
    let bestDist = Math.abs(ch.start_ms - best)
    for (const start of segmentStarts) {
      const dist = Math.abs(ch.start_ms - start)
      if (dist < bestDist) {
        bestDist = dist
        best = start
      }
    }
    return { start_ms: best, title: ch.title }
  })
}

function buildTranscriptPrompt(
  episodeTitle: string,
  segmentList: EnrichSegment[],
): string {
  const lines = segmentList.map((seg) => {
    const totalSeconds = Math.floor(seg.startMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const ts =
      hours > 0
        ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    return `[${ts}] ${seg.speakerName}: ${seg.text}`
  })

  return [
    `Episode: "${episodeTitle}"`,
    "",
    "Diarized transcript:",
    "",
    lines.join("\n"),
  ].join("\n")
}

const ENRICHMENT_TOOL: Anthropic.Tool = {
  name: "episode_enrichment",
  description:
    "Structured orientation metadata for a podcast episode transcript",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "2-3 sentence abstract of the episode",
      },
      topics: {
        type: "array",
        items: { type: "string" },
        description: "5-10 key themes or topics discussed",
      },
      people: {
        type: "array",
        items: { type: "string" },
        description:
          "Named people or entities discussed, include role in parentheses when inferable (e.g. 'Jane Doe (CEO)')",
      },
      chapters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            start_ms: {
              type: "number",
              description: "Start time in milliseconds, aligned to topic shift",
            },
            title: { type: "string", description: "Short chapter title" },
          },
          required: ["start_ms", "title"],
        },
        description: "Ordered topic segments covering the full episode",
      },
    },
    required: ["summary", "topics", "people", "chapters"],
  },
}

export async function generateEnrichment(
  episodeTitle: string,
  segmentList: EnrichSegment[],
): Promise<EpisodeEnrichment | null> {
  if (segmentList.length === 0) return null

  const client = new Anthropic()
  const transcript = buildTranscriptPrompt(episodeTitle, segmentList)
  const segmentStarts = segmentList.map((s) => s.startMs)

  const prompt = [
    "Analyze this diarized podcast transcript and produce orientation metadata for someone who will paste the exported markdown into an LLM.",
    "",
    "Requirements:",
    "- summary: 2-3 sentences",
    "- topics: 5-10 concise theme labels",
    "- people: named people/entities mentioned, with role in parentheses when clear",
    "- chapters: 4-12 logical topic segments; start_ms should match a moment near a segment boundary (use milliseconds as in the transcript timestamps)",
    "",
    transcript,
  ].join("\n")

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: [ENRICHMENT_TOOL],
      tool_choice: { type: "tool", name: "episode_enrichment" },
      messages: [{ role: "user", content: prompt }],
    })

    const toolBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    )
    if (!toolBlock || toolBlock.name !== "episode_enrichment") return null

    const raw = toolBlock.input as {
      summary?: string
      topics?: string[]
      people?: string[]
      chapters?: Array<{ start_ms?: number; title?: string }>
    }

    if (!raw.summary || !Array.isArray(raw.topics)) return null

    const chapters: EpisodeChapter[] = (raw.chapters ?? [])
      .filter(
        (c): c is { start_ms: number; title: string } =>
          typeof c.start_ms === "number" && typeof c.title === "string",
      )
      .map((c) => ({ start_ms: Math.round(c.start_ms), title: c.title.trim() }))
      .filter((c) => c.title.length > 0)

    return {
      summary: raw.summary.trim(),
      topics: raw.topics.map((t) => String(t).trim()).filter(Boolean),
      people: (raw.people ?? []).map((p) => String(p).trim()).filter(Boolean),
      chapters: anchorChapterStarts(chapters, segmentStarts),
    }
  } catch (err) {
    console.error("Enrichment generation failed:", err)
    return null
  }
}

export async function enrichEpisode(
  episodeId: string,
  options?: { force?: boolean },
): Promise<boolean> {
  const [episode] = await db
    .select({
      id: episodes.id,
      title: episodes.title,
      enrichment: episodes.enrichment,
    })
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1)

  if (!episode) return false
  if (episode.enrichment && !options?.force) return false

  const speakerRows = await db
    .select({ id: speakers.id, name: speakers.name, label: speakers.label })
    .from(speakers)
    .where(eq(speakers.episodeId, episodeId))

  const segmentRows = await db
    .select({
      startMs: segments.startMs,
      speakerId: segments.speakerId,
      text: segments.text,
    })
    .from(segments)
    .where(eq(segments.episodeId, episodeId))
    .orderBy(asc(segments.seq))

  if (segmentRows.length === 0) return false

  const speakerMap = new Map(
    speakerRows.map((s) => [s.id, s.name ?? s.label]),
  )

  const enrichSegments: EnrichSegment[] = segmentRows.map((seg) => ({
    startMs: seg.startMs,
    speakerName: speakerMap.get(seg.speakerId) ?? "Unknown",
    text: seg.text,
  }))

  const enrichment = await generateEnrichment(episode.title, enrichSegments)
  if (!enrichment) return false

  await db
    .update(episodes)
    .set({ enrichment, updatedAt: new Date() })
    .where(eq(episodes.id, episodeId))

  return true
}
