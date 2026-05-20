import { formatTimestamp } from "@/lib/format"

const SPEAKER_COLORS = [
  "text-blue-600 dark:text-blue-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-violet-600 dark:text-violet-400",
  "text-amber-600 dark:text-amber-400",
  "text-rose-600 dark:text-rose-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-fuchsia-600 dark:text-fuchsia-400",
  "text-lime-600 dark:text-lime-400",
]

const DOT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-500",
]

interface Speaker {
  id: string
  label: string
  name: string
}

interface Segment {
  id: string
  startMs: number
  endMs: number
  speakerId: string
  text: string
}

interface TranscriptViewProps {
  speakers: Speaker[]
  segments: Segment[]
}

export function TranscriptView({ speakers, segments }: TranscriptViewProps) {
  const speakerIndex = new Map(speakers.map((s, i) => [s.id, i]))

  return (
    <div className="flex flex-col gap-8">
      {/* Speaker legend */}
      {speakers.length > 1 && (
        <div className="flex flex-wrap gap-4">
          {speakers.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`}
              />
              <span className="text-zinc-600 dark:text-zinc-400">
                {s.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Transcript segments */}
      <div className="flex flex-col gap-6">
        {segments.map((seg) => {
          const idx = speakerIndex.get(seg.speakerId) ?? 0
          const speaker = speakers.find((s) => s.id === seg.speakerId)
          const colorClass = SPEAKER_COLORS[idx % SPEAKER_COLORS.length]

          return (
            <div key={seg.id} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  [{formatTimestamp(seg.startMs)}]
                </span>
                <span className={`text-sm font-semibold ${colorClass}`}>
                  {speaker?.name ?? "Unknown"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {seg.text}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
