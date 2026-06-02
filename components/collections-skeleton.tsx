import { Skeleton } from "@/components/skeleton"

function CollectionCardSkeleton() {
  return (
    <li className="flex flex-col gap-4 rounded-[8px] border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-[8px]" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-[66%] max-w-[200px]" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-8 w-40 rounded-[8px]" />
    </li>
  )
}

export function CollectionsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading collections">
      <Skeleton className="h-5 w-48" />
      <ul className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <CollectionCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  )
}
