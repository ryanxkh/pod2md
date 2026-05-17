import { describe, it, expect } from "vitest";
import { generateTranscriptMarkdown } from "@/lib/markdown";

describe("generateTranscriptMarkdown", () => {
  it("returns title-only markdown for empty segments", () => {
    const result = generateTranscriptMarkdown(
      { title: "My Episode" },
      [],
    );
    expect(result).toBe("# My Episode\n");
  });

  it("formats a single segment with MM:SS timestamp", () => {
    const result = generateTranscriptMarkdown(
      { title: "Test Episode" },
      [{ start_ms: 12000, speaker_name: "Speaker 1", text: "Hello world" }],
    );
    expect(result).toBe(
      "# Test Episode\n\n[00:12] **Speaker 1:** Hello world\n",
    );
  });

  it("groups consecutive segments from same speaker", () => {
    const result = generateTranscriptMarkdown(
      { title: "Test" },
      [
        { start_ms: 0, speaker_name: "Speaker 1", text: "First part." },
        { start_ms: 5000, speaker_name: "Speaker 1", text: "Second part." },
        { start_ms: 10000, speaker_name: "Speaker 2", text: "Reply." },
      ],
    );
    expect(result).toBe(
      "# Test\n\n" +
        "[00:00] **Speaker 1:** First part. Second part.\n\n" +
        "[00:10] **Speaker 2:** Reply.\n",
    );
  });

  it("alternates speakers correctly", () => {
    const result = generateTranscriptMarkdown(
      { title: "Conversation" },
      [
        { start_ms: 0, speaker_name: "Alice", text: "Hi." },
        { start_ms: 2000, speaker_name: "Bob", text: "Hey." },
        { start_ms: 4000, speaker_name: "Alice", text: "How are you?" },
      ],
    );
    expect(result).toContain("[00:00] **Alice:** Hi.");
    expect(result).toContain("[00:02] **Bob:** Hey.");
    expect(result).toContain("[00:04] **Alice:** How are you?");
  });

  it("uses HH:MM:SS format for episodes >= 1 hour", () => {
    const result = generateTranscriptMarkdown(
      { title: "Long Episode" },
      [
        { start_ms: 0, speaker_name: "Host", text: "Welcome." },
        { start_ms: 3661000, speaker_name: "Guest", text: "Thanks." },
      ],
    );
    expect(result).toContain("[00:00:00] **Host:** Welcome.");
    expect(result).toContain("[01:01:01] **Guest:** Thanks.");
  });

  it("uses MM:SS format for episodes under 1 hour", () => {
    const result = generateTranscriptMarkdown(
      { title: "Short Episode" },
      [
        { start_ms: 0, speaker_name: "Host", text: "Welcome." },
        { start_ms: 1800000, speaker_name: "Guest", text: "Thanks." },
      ],
    );
    expect(result).toContain("[00:00] **Host:** Welcome.");
    expect(result).toContain("[30:00] **Guest:** Thanks.");
  });

  it("handles complex timestamp formatting", () => {
    const result = generateTranscriptMarkdown(
      { title: "Test" },
      [
        { start_ms: 62000, speaker_name: "A", text: "One." },
        { start_ms: 3723000, speaker_name: "B", text: "Two." },
      ],
    );
    expect(result).toContain("[01:02:03] **B:** Two.");
    expect(result).toContain("[00:01:02] **A:** One.");
  });
});
