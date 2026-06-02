import { Skeleton } from "@/components/skeleton"

function EpisodeRowSkeleton() {
  return (
    <li className="flex items-center justify-between gap-4 rounded-[8px] px-2 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Skeleton className="h-4 w-4 shrink-0 rounded" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-[60%] max-w-[280px]" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 shrink-0 rounded-[4px]" />
    </li>
  )
}

export function EpisodeListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-1" aria-busy aria-label="Loading episodes">
      {Array.from({ length: rows }, (_, i) => (
        <EpisodeRowSkeleton key={i} />
      ))}
    </ul>
  )
}
