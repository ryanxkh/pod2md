import Link from "next/link"
import type { LucideIcon } from "lucide-react"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <Icon
        className="mb-4 h-10 w-10 text-fg-muted"
        strokeWidth={1.5}
        aria-hidden
      />
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-fg-secondary">{description}</p>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className={`mt-6 inline-flex rounded-[8px] bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors duration-150 ease-out hover:bg-accent-hover ${focusRing}`}
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className={`mt-6 inline-flex rounded-[8px] bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors duration-150 ease-out hover:bg-accent-hover ${focusRing}`}
          >
            {action.label}
          </button>
        ))}
    </div>
  )
}
