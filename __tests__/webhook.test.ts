import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
  getTransactionalDb: vi.fn(),
}));

vi.mock("@/lib/db/schema", () => ({
  jobs: { runpodId: "runpod_id", startedAt: "started_at", id: "id", episodeId: "episode_id" },
  speakers: {},
  segments: {},
  episodes: { id: "id", title: "title" },
}));

vi.mock("nanoid", () => ({
  nanoid: () => "test-nanoid",
}));

vi.mock("@/lib/markdown", () => ({
  generateTranscriptMarkdown: vi.fn(() => "# Test\n\n[00:00] **Speaker:** Hello\n"),
}));

import { POST } from "@/app/api/webhooks/runpod/route";
import { db, getTransactionalDb } from "@/lib/db";

function makeRequest(body: unknown, token?: string): Request {
  const url = token
    ? `http://localhost/api/webhooks/runpod?token=${token}`
    : "http://localhost/api/webhooks/runpod";
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/runpod", () => {
  const mockSet = vi.fn();
  const mockWhere = vi.fn();
  const mockValues = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RUNPOD_WEBHOOK_SECRET = "test-secret";

    mockWhere.mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: mockWhere });
    mockValues.mockResolvedValue(undefined);

    vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);
  });

  it("returns 401 when token is missing", async () => {
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const res = await POST(makeRequest({}, "wrong-token") as any);
    expect(res.status).toBe(401);
  });

  it("returns 200 for progress updates", async () => {
    const body = {
      id: "job-123",
      status: "RUNNING",
      output: { stage: "transcribing", progress: 45 },
    };
    const res = await POST(makeRequest(body, "test-secret") as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    expect(db.update).toHaveBeenCalled();
  });

  it("returns 200 for failure updates", async () => {
    const body = {
      id: "job-123",
      status: "FAILED",
      error: "Something went wrong",
    };
    const res = await POST(makeRequest(body, "test-secret") as any);
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });

  it("returns 200 for cancelled updates", async () => {
    const body = { id: "job-123", status: "CANCELLED" };
    const res = await POST(makeRequest(body, "test-secret") as any);
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });

  it("returns 200 for timed out updates", async () => {
    const body = { id: "job-123", status: "TIMED_OUT" };
    const res = await POST(makeRequest(body, "test-secret") as any);
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
  });

  it("returns 200 for completion with transaction", async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn()
              .mockResolvedValueOnce([{ id: "job-1", episodeId: "ep-1", runpodId: "job-123" }])
              .mockResolvedValueOnce([{ title: "Test Episode" }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    vi.mocked(getTransactionalDb).mockReturnValue({
      transaction: vi.fn(async (fn: any) => fn(mockTx)),
    } as any);

    const body = {
      id: "job-123",
      status: "COMPLETED",
      output: {
        segments: [
          { start_ms: 0, end_ms: 5000, speaker_label: "SPEAKER_00", speaker_name: "Speaker 1", text: "Hello" },
        ],
        speakers: [
          { label: "SPEAKER_00", name: "Speaker 1", confidence: "fallback" },
        ],
        metadata: { duration_secs: 300, segment_count: 1, model: "large-v3-turbo", language: "en" },
      },
    };
    const res = await POST(makeRequest(body, "test-secret") as any);
    expect(res.status).toBe(200);
    expect(getTransactionalDb).toHaveBeenCalled();
  });

  it("returns 200 even on invalid payload (logs error, no retry)", async () => {
    const body = { invalid: "payload" };
    const res = await POST(makeRequest(body, "test-secret") as any);
    expect(res.status).toBe(200);
  });

  it("returns 200 even on processing error (logs error, no retry)", async () => {
    vi.mocked(db.update).mockImplementation(() => {
      throw new Error("DB error");
    });
    const body = { id: "job-123", status: "FAILED", error: "test" };
    const res = await POST(makeRequest(body, "test-secret") as any);
    expect(res.status).toBe(200);
  });
});
