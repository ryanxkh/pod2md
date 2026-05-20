const styles: Record<string, string> = {
  queued:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  transcribing:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  completed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  failed:
    "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
}

export function StatusBadge({ status }: { status: string }) {
  const cls = styles[status] ?? styles.queued
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  )
}
