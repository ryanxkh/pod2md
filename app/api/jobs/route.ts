import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { episodes, jobs } from "@/lib/db/schema";
import { submitJob } from "@/lib/runpod/client";

const createJobSchema = z.object({
  audio_url: z.url(),
  title: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = createJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { audio_url, title } = parsed.data;

  // Atomic upsert episode (source_url = audio_url for Phase 1)
  const [upsertedEpisode] = await db
    .insert(episodes)
    .values({
      sourceUrl: audio_url,
      audioUrl: audio_url,
      title,
    })
    .onConflictDoUpdate({
      target: episodes.sourceUrl,
      set: { title, audioUrl: audio_url, updatedAt: new Date() },
    })
    .returning({ id: episodes.id });

  const episodeId = upsertedEpisode.id;

  // Create job row with status "queued"
  const [newJob] = await db
    .insert(jobs)
    .values({
      episodeId,
      status: "queued",
    })
    .returning({ id: jobs.id });

  const jobId = newJob.id;

  // Build webhook URL
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const webhookSecret = process.env.RUNPOD_WEBHOOK_SECRET ?? "";
  const webhookUrl = `${baseUrl}/api/webhooks/runpod?token=${webhookSecret}`;

  try {
    const runpodResponse = await submitJob(
      { audio_url, source_type: "direct" },
      webhookUrl,
    );

    // Update job with runpod_id
    await db
      .update(jobs)
      .set({ runpodId: runpodResponse.id })
      .where(eq(jobs.id, jobId));

    return NextResponse.json({ jobId, episodeId }, { status: 201 });
  } catch (error) {
    console.error("RunPod submission failed:", error);

    // Set job status to failed
    await db
      .update(jobs)
      .set({
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown RunPod error",
      })
      .where(eq(jobs.id, jobId));

    return NextResponse.json(
      { error: "Failed to submit job to RunPod" },
      { status: 500 },
    );
  }
}
