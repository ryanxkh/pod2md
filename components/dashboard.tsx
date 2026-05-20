"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SubmitForm } from "./submit-form"
import { EpisodeListView, type EpisodeRow } from "./episode-list"

interface DashboardProps {
  initialEpisodes: EpisodeRow[]
}

export function Dashboard({ initialEpisodes }: DashboardProps) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>(initialEpisodes)
  const pollRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  )

  const stopPolling = useCallback((id: string) => {
    const timer = pollRef.current.get(id)
    if (timer) {
      clearInterval(timer)
      pollRef.current.delete(id)
    }
  }, [])

  const startPolling = useCallback(
    (id: string) => {
      if (pollRef.current.has(id)) return
      const timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/episodes/${id}`)
          if (!res.ok) return
          const data = await res.json()
          const status: string = data.job?.status ?? "completed"
          setEpisodes((prev) =>
            prev.map((ep) => (ep.id === id ? { ...ep, status } : ep)),
          )
          if (status === "completed" || status === "failed") {
            stopPolling(id)
          }
        } catch {
          /* ignore transient fetch errors */
        }
      }, 5000)
      pollRef.current.set(id, timer)
    },
    [stopPolling],
  )

  useEffect(() => {
    for (const ep of episodes) {
      if (ep.status !== "completed" && ep.status !== "failed") {
        startPolling(ep.id)
      }
    }
    const polls = pollRef.current
    return () => {
      for (const id of polls.keys()) stopPolling(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmitted = useCallback(
    (episodeId: string, title: string) => {
      const newEp: EpisodeRow = {
        id: episodeId,
        title,
        createdAt: new Date().toISOString(),
        status: "queued",
      }
      setEpisodes((prev) => [newEp, ...prev])
      startPolling(episodeId)
    },
    [startPolling],
  )

  return (
    <div className="flex flex-col gap-10">
      <SubmitForm onSubmitted={handleSubmitted} />
      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Recent episodes
        </h2>
        <EpisodeListView episodes={episodes} />
      </section>
    </div>
  )
}
