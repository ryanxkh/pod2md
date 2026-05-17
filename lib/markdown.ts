function formatTimestamp(ms: number, useHours: boolean): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (useHours) {
    const hh = String(hours).padStart(2, "0");
    return `[${hh}:${mm}:${ss}]`;
  }
  return `[${mm}:${ss}]`;
}

interface Segment {
  start_ms: number;
  speaker_name: string;
  text: string;
}

interface GroupedBlock {
  startMs: number;
  speakerName: string;
  texts: string[];
}

export function generateTranscriptMarkdown(
  episode: { title: string },
  segments: Segment[],
): string {
  if (segments.length === 0) {
    return `# ${episode.title}\n`;
  }

  const maxMs = segments[segments.length - 1].start_ms;
  const useHours = maxMs >= 3600000;

  const blocks: GroupedBlock[] = [];
  for (const seg of segments) {
    const last = blocks[blocks.length - 1];
    if (last && last.speakerName === seg.speaker_name) {
      last.texts.push(seg.text);
    } else {
      blocks.push({
        startMs: seg.start_ms,
        speakerName: seg.speaker_name,
        texts: [seg.text],
      });
    }
  }

  const lines: string[] = [`# ${episode.title}`, ""];
  for (const block of blocks) {
    const ts = formatTimestamp(block.startMs, useHours);
    const text = block.texts.join(" ");
    lines.push(`${ts} **${block.speakerName}:** ${text}`);
    lines.push("");
  }

  return lines.join("\n");
}
