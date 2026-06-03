"use client"

export default function EpisodeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-sm text-status-fail">
        {error.message || "Failed to load episode"}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-[8px] bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
      >
        Try again
      </button>
    </div>
  )
}
