"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  AudioLines,
  Library,
  List,
  Plus,
  Settings,
} from "lucide-react"
import { Skeleton } from "@/components/skeleton"
import type { RecentEpisodeListItem } from "@/lib/list-recent-episodes"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ACTIONS = [
  {
    value: "action:new-transcription",
    label: "New transcription",
    href: "/",
    icon: Plus,
  },
  {
    value: "action:episodes",
    label: "Go to Episodes",
    href: "/episodes",
    icon: List,
  },
  {
    value: "action:collections",
    label: "Go to Collections",
    href: "/collections",
    icon: Library,
  },
  {
    value: "action:settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
] as const

function episodeHint(ep: RecentEpisodeListItem) {
  const parts: string[] = []
  if (ep.collection) parts.push(ep.collection)
  parts.push(ep.status)
  return parts.join(" · ")
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [episodes, setEpisodes] = useState<RecentEpisodeListItem[]>([])
  const [episodesReady, setEpisodesReady] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void fetch("/api/episodes")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { episodes: RecentEpisodeListItem[] }) => {
        if (!cancelled) setEpisodes(data.episodes ?? [])
      })
      .catch(() => {
        if (!cancelled) setEpisodes([])
      })
      .finally(() => {
        if (!cancelled) setEpisodesReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const loading = open && !episodesReady

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false)
      router.push(href)
    },
    [onOpenChange, router],
  )

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="command-palette"
      overlayClassName="command-palette-overlay"
      contentClassName="command-palette-dialog"
    >
      <Command.Input
        placeholder="Search episodes or jump to…"
        autoFocus
      />
      <Command.List>
        <Command.Empty>No results.</Command.Empty>

        <Command.Group heading="Actions">
          {ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <Command.Item
                key={action.value}
                value={action.value}
                keywords={[action.label]}
                onSelect={() => navigate(action.href)}
              >
                <Icon size={16} className="shrink-0 text-fg-secondary" aria-hidden />
                <span>{action.label}</span>
                {action.href === "/" && (
                  <AudioLines
                    size={14}
                    className="ml-auto shrink-0 text-fg-muted"
                    aria-hidden
                  />
                )}
              </Command.Item>
            )
          })}
        </Command.Group>

        <Command.Group heading="Episodes">
          {loading ? (
            <div className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-4 max-w-[12rem] flex-1" />
            </div>
          ) : null}
          {!loading &&
            episodes.map((ep) => (
              <Command.Item
                key={ep.id}
                value={ep.title}
                keywords={[ep.collection ?? "", ep.status, ep.id]}
                onSelect={() => navigate(`/episodes/${ep.id}`)}
              >
                <span className="min-w-0 truncate">{ep.title}</span>
                <span className="ml-auto shrink-0 text-xs text-fg-muted">
                  {episodeHint(ep)}
                </span>
              </Command.Item>
            ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
