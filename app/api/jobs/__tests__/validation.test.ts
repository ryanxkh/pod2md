import { describe, it, expect } from "vitest"
import { z } from "zod/v4"

const createJobSchema = z.object({
  audio_url: z.url(),
  title: z.string().min(1),
})

describe("POST /api/jobs validation schema", () => {
  it("accepts valid input", () => {
    const result = createJobSchema.safeParse({
      audio_url: "https://example.com/audio.mp3",
      title: "Test Episode",
    })
    expect(result.success).toBe(true)
  })

  it("accepts http URLs", () => {
    const result = createJobSchema.safeParse({
      audio_url: "http://example.com/audio.mp3",
      title: "Test",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing audio_url", () => {
    const result = createJobSchema.safeParse({
      title: "Test Episode",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid URL", () => {
    const result = createJobSchema.safeParse({
      audio_url: "not-a-url",
      title: "Test Episode",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty title", () => {
    const result = createJobSchema.safeParse({
      audio_url: "https://example.com/audio.mp3",
      title: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing title", () => {
    const result = createJobSchema.safeParse({
      audio_url: "https://example.com/audio.mp3",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty object", () => {
    const result = createJobSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects non-object input", () => {
    const result = createJobSchema.safeParse("string")
    expect(result.success).toBe(false)
  })

  it("ignores extra fields", () => {
    const result = createJobSchema.safeParse({
      audio_url: "https://example.com/audio.mp3",
      title: "Test",
      extra: "field",
    })
    expect(result.success).toBe(true)
  })
})
