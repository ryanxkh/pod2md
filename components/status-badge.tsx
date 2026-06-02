const styles: Record<string, string> = {
  queued: "bg-elevated text-status-queued",
  transcribing: "bg-elevated text-status-run animate-status-pulse",
  completed: "bg-elevated text-status-done",
  failed: "bg-elevated text-status-fail",
  cancelled: "bg-elevated text-status-fail",
}

const runningStatuses = new Set([
  "transcribing",
  "downloading",
  "running",
  "processing",
])

export function StatusBadge({ status }: { status: string }) {
  let cls = styles[status]
  if (!cls && runningStatuses.has(status)) {
    cls = `${styles.transcribing}`
  }
  cls ??= styles.queued

  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  )
}
