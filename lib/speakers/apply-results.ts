import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { speakers } from "@/lib/db/schema"
import { regenerateTranscriptMarkdown } from "@/lib/speakers/regenerate-markdown"

interface ResolutionResult {
  speakerId: string
  name: string
  confidence: string
}

export async function applySpeakerResolution(
  episodeId: string,
  results: ResolutionResult[],
) {
  const applicable = results.filter(
    (r) => r.confidence === "high" || r.confidence === "medium",
  )

  await Promise.all(
    applicable.map((r) =>
      db
        .update(speakers)
        .set({ name: r.name, confidence: r.confidence })
        .where(eq(speakers.id, r.speakerId)),
    ),
  )

  if (applicable.length > 0) {
    await regenerateTranscriptMarkdown(episodeId)
  }
}
