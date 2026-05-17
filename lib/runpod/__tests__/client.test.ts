import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { submitJob, cancelJob, getJobStatus } from "../client"

const MOCK_API_KEY = "test-api-key"
const MOCK_ENDPOINT_ID = "test-endpoint-id"

beforeEach(() => {
  vi.stubEnv("RUNPOD_API_KEY", MOCK_API_KEY)
  vi.stubEnv("RUNPOD_ENDPOINT_ID", MOCK_ENDPOINT_ID)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("submitJob", () => {
  it("sends correct request and returns job id", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "runpod-job-123" }),
    })
    vi.stubGlobal("fetch", mockFetch)

    const result = await submitJob(
      { audio_url: "https://example.com/audio.mp3", source_type: "direct" },
      "https://example.com/webhook",
    )

    expect(result).toEqual({ id: "runpod-job-123" })
    expect(mockFetch).toHaveBeenCalledOnce()

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe(
      `https://api.runpod.ai/v2/${MOCK_ENDPOINT_ID}/run`,
    )
    expect(options.method).toBe("POST")
    expect(options.headers.Authorization).toBe(`Bearer ${MOCK_API_KEY}`)

    const body = JSON.parse(options.body)
    expect(body.input.audio_url).toBe("https://example.com/audio.mp3")
    expect(body.input.source_type).toBe("direct")
    expect(body.webhook).toBe("https://example.com/webhook")
    expect(body.policy.executionTimeout).toBe(7200000)
    expect(body.policy.ttl).toBe(10800000)
  })

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      }),
    )

    await expect(
      submitJob(
        { audio_url: "https://example.com/audio.mp3", source_type: "direct" },
        "https://example.com/webhook",
      ),
    ).rejects.toThrow("RunPod API error (401): Unauthorized")
  })

  it("throws when env vars are missing", async () => {
    vi.stubEnv("RUNPOD_API_KEY", "")

    await expect(
      submitJob(
        { audio_url: "https://example.com/audio.mp3", source_type: "direct" },
        "https://example.com/webhook",
      ),
    ).rejects.toThrow("RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID must be set")
  })
})

describe("cancelJob", () => {
  it("sends cancel request to correct URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", mockFetch)

    await cancelJob("job-456")

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe(
      `https://api.runpod.ai/v2/${MOCK_ENDPOINT_ID}/cancel/job-456`,
    )
    expect(options.method).toBe("POST")
    expect(options.headers.Authorization).toBe(`Bearer ${MOCK_API_KEY}`)
  })

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      }),
    )

    await expect(cancelJob("bad-id")).rejects.toThrow(
      "RunPod cancel error (404): Not found",
    )
  })
})

describe("getJobStatus", () => {
  it("returns status for a valid job", async () => {
    const mockStatus = { id: "job-789", status: "COMPLETED", output: { text: "hello" } }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      }),
    )

    const result = await getJobStatus("job-789")

    expect(result).toEqual(mockStatus)
  })

  it("sends GET request to status endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "job-789", status: "IN_PROGRESS" }),
    })
    vi.stubGlobal("fetch", mockFetch)

    await getJobStatus("job-789")

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe(
      `https://api.runpod.ai/v2/${MOCK_ENDPOINT_ID}/status/job-789`,
    )
    expect(options.method).toBe("GET")
  })
})
