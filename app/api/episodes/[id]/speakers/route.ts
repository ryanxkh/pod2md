import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { speakers } from "@/lib/db/schema"
import { regenerateTranscriptMarkdown } from "@/lib/speakers/regenerate-markdown"

const PatchBody = z.object({
  speaker_id: z.string(),
  name: z.string().min(1),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: episodeId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = PatchBody.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { speaker_id, name } = parsed.data

  try {
    const [speaker] = await db
      .select({ id: speakers.id, label: speakers.label })
      .from(speakers)
      .where(and(eq(speakers.id, speaker_id), eq(speakers.episodeId, episodeId)))
      .limit(1)

    if (!speaker) {
      return Response.json({ error: "Speaker not found" }, { status: 404 })
    }

    const [updated] = await db
      .update(speakers)
      .set({ name })
      .where(eq(speakers.id, speaker_id))
      .returning({
        id: speakers.id,
        label: speakers.label,
        name: speakers.name,
        confidence: speakers.confidence,
      })

    await regenerateTranscriptMarkdown(episodeId)

    return Response.json({ speaker: updated })
  } catch (err) {
    console.error("Speaker rename failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
