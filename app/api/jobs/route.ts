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
  const body = await request.json();
  const parsed = createJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { audio_url, title } = parsed.data;

  // Upsert episode (source_url = audio_url for Phase 1)
  const existingEpisodes = await db
    .select()
    .from(episodes)
    .where(eq(episodes.sourceUrl, audio_url))
    .limit(1);

  let episodeId: string;

  if (existingEpisodes.length > 0) {
    episodeId = existingEpisodes[0].id;
    await db
      .update(episodes)
      .set({ title, audioUrl: audio_url, updatedAt: new Date() })
      .where(eq(episodes.id, episodeId));
  } else {
    const [newEpisode] = await db
      .insert(episodes)
      .values({
        sourceUrl: audio_url,
        audioUrl: audio_url,
        title,
      })
      .returning({ id: episodes.id });
    episodeId = newEpisode.id;
  }

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
