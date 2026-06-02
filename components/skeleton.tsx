export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[6px] bg-elevated${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <span className="skeleton-shimmer pointer-events-none absolute inset-0" />
    </div>
  )
}
