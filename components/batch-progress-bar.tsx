interface BatchProgressBarProps {
  done: number
  running: number
  failed: number
  total: number
}

export function BatchProgressBar({
  done,
  running,
  failed,
  total,
}: BatchProgressBarProps) {
  const donePct = total > 0 ? (done / total) * 100 : 0
  const failedPct = total > 0 ? (failed / total) * 100 : 0

  const countParts: string[] = []
  countParts.push(`${done}/${total} done`)
  if (running > 0) countParts.push(`${running} running`)
  if (failed > 0) countParts.push(`${failed} failed`)

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-elevated"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Batch progress"
      >
        <div
          className="h-full bg-status-done transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${donePct}%` }}
        />
        {failed > 0 && (
          <div
            className="h-full bg-status-fail transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${failedPct}%` }}
          />
        )}
      </div>
      <p className="text-xs text-fg-secondary">{countParts.join(" · ")}</p>
    </div>
  )
}
