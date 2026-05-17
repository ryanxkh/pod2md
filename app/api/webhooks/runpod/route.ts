import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, getTransactionalDb } from "@/lib/db";
import { jobs, speakers, segments, episodes } from "@/lib/db/schema";
import { generateTranscriptMarkdown } from "@/lib/markdown";
import { nanoid } from "nanoid";

const ok = () => NextResponse.json({ ok: true }, { status: 200 });

const segmentSchema = z.object({
  start_ms: z.number(),
  end_ms: z.number(),
  speaker_label: z.string(),
  speaker_name: z.string(),
  text: z.string(),
});

const speakerSchema = z.object({
  label: z.string(),
  name: z.string(),
  confidence: z.string(),
});

const metadataSchema = z.object({
  duration_secs: z.number(),
  segment_count: z.number(),
  model: z.string(),
  language: z.string(),
});

const progressPayload = z.object({
  id: z.string(),
  status: z.literal("RUNNING"),
  output: z.object({
    stage: z.string(),
    progress: z.number(),
  }),
});

const completionPayload = z.object({
  id: z.string(),
  status: z.literal("COMPLETED"),
  output: z.object({
    segments: z.array(segmentSchema),
    speakers: z.array(speakerSchema),
    metadata: metadataSchema,
  }),
});

const failurePayload = z.object({
  id: z.string(),
  status: z.literal("FAILED"),
  error: z.string(),
});

const cancelledPayload = z.object({
  id: z.string(),
  status: z.literal("CANCELLED"),
});

const timedOutPayload = z.object({
  id: z.string(),
  status: z.literal("TIMED_OUT"),
});

const webhookPayload = z.discriminatedUnion("status", [
  progressPayload,
  completionPayload,
  failurePayload,
  cancelledPayload,
  timedOutPayload,
]);

async function handleProgress(payload: z.infer<typeof progressPayload>) {
  const now = new Date();
  await db
    .update(jobs)
    .set({
      status: payload.output.stage,
      progress: payload.output.progress,
      startedAt: sql`COALESCE(${jobs.startedAt}, ${now.toISOString()})`,
    })
    .where(eq(jobs.runpodId, payload.id));
}

async function handleCompletion(payload: z.infer<typeof completionPayload>) {
  const txDb = getTransactionalDb();

  await txDb.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(eq(jobs.runpodId, payload.id))
      .limit(1);

    if (!job) {
      throw new Error(`Job not found for runpod_id: ${payload.id}`);
    }

    const speakerMap = new Map<string, string>();
    for (const s of payload.output.speakers) {
      const id = nanoid();
      await tx.insert(speakers).values({
        id,
        episodeId: job.episodeId,
        label: s.label,
        name: s.name,
        confidence: s.confidence,
      });
      speakerMap.set(s.label, id);
    }

    const segmentValues = payload.output.segments.map((seg, idx) => {
      const speakerId = speakerMap.get(seg.speaker_label);
      if (!speakerId) {
        throw new Error(`Speaker not found for label: ${seg.speaker_label}`);
      }
      return {
        id: nanoid(),
        episodeId: job.episodeId,
        speakerId,
        startMs: seg.start_ms,
        endMs: seg.end_ms,
        text: seg.text,
        seq: idx,
      };
    });

    if (segmentValues.length > 0) {
      await tx.insert(segments).values(segmentValues);
    }

    const [episode] = await tx
      .select({ title: episodes.title })
      .from(episodes)
      .where(eq(episodes.id, job.episodeId))
      .limit(1);

    const markdownSegments = payload.output.segments.map((seg) => ({
      start_ms: seg.start_ms,
      speaker_name: seg.speaker_name,
      text: seg.text,
    }));
    const transcriptMd = generateTranscriptMarkdown(
      { title: episode.title },
      markdownSegments,
    );

    const now = new Date();
    await tx
      .update(episodes)
      .set({
        transcriptMd,
        durationSecs: payload.output.metadata.duration_secs,
        updatedAt: now,
      })
      .where(eq(episodes.id, job.episodeId));

    await tx
      .update(jobs)
      .set({
        status: "completed",
        completedAt: now,
        progress: 100,
      })
      .where(eq(jobs.id, job.id));
  });
}

async function handleFailure(payload: z.infer<typeof failurePayload>) {
  const now = new Date();
  await db
    .update(jobs)
    .set({
      status: "failed",
      errorMessage: payload.error,
      completedAt: now,
    })
    .where(eq(jobs.runpodId, payload.id));
}

async function handleCancelled(payload: z.infer<typeof cancelledPayload>) {
  const now = new Date();
  await db
    .update(jobs)
    .set({
      status: "cancelled",
      completedAt: now,
    })
    .where(eq(jobs.runpodId, payload.id));
}

async function handleTimedOut(payload: z.infer<typeof timedOutPayload>) {
  const now = new Date();
  await db
    .update(jobs)
    .set({
      status: "failed",
      errorMessage: "Job timed out",
      completedAt: now,
    })
    .where(eq(jobs.runpodId, payload.id));
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const secret = process.env.RUNPOD_WEBHOOK_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload = webhookPayload.parse(body);

    switch (payload.status) {
      case "RUNNING":
        await handleProgress(payload);
        break;
      case "COMPLETED":
        await handleCompletion(payload);
        break;
      case "FAILED":
        await handleFailure(payload);
        break;
      case "CANCELLED":
        await handleCancelled(payload);
        break;
      case "TIMED_OUT":
        await handleTimedOut(payload);
        break;
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
  }

  return ok();
}
