"use client"

import { useState, type FormEvent } from "react"
import { EpisodePicker } from "./episode-picker"
import type { ResolvedEpisode } from "@/lib/resolvers/types"

type Step =
  | { kind: "url" }
  | { kind: "title"; directUrl: string }
  | { kind: "pick"; podcastTitle: string; episodes: ResolvedEpisode[] }

interface SubmitFormProps {
  onSubmitted: (episodeId: string, title: string) => void
}

export function SubmitForm({ onSubmitted }: SubmitFormProps) {
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [step, setStep] = useState<Step>({ kind: "url" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResolve(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }

      if (data.type === "direct") {
        setStep({ kind: "title", directUrl: data.url })
      } else if (data.type === "feed") {
        setStep({
          kind: "pick",
          podcastTitle: data.podcastTitle,
          episodes: data.episodes,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function submitJob(payload: {
    audio_url: string
    title: string
    published_at?: string | null
    description?: string | null
    duration_secs?: number | null
  }) {
    setError(null)
    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        audio_url: payload.audio_url,
        title: payload.title,
      }
      if (payload.published_at) body.published_at = payload.published_at
      if (payload.description) body.description = payload.description
      if (payload.duration_secs != null) body.duration_secs = payload.duration_secs

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }

      const submittedTitle = payload.title
      setUrl("")
      setTitle("")
      setStep({ kind: "url" })
      onSubmitted(data.episodeId, submittedTitle)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleDirectSubmit(e: FormEvent) {
    e.preventDefault()
    if (step.kind !== "title") return
    await submitJob({ audio_url: step.directUrl, title })
  }

  async function handleEpisodeSelect(episode: ResolvedEpisode) {
    if (step.kind !== "pick") return
    await submitJob({
      audio_url: episode.audioUrl,
      title: episode.title,
      published_at: episode.publishedAt,
      description: episode.description,
      duration_secs: episode.durationSecs,
    })
  }

  function handleCancel() {
    setStep({ kind: "url" })
    setError(null)
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-base placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"

  const buttonClass =
    "self-start rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"

  if (step.kind === "pick") {
    return (
      <div className="flex flex-col gap-3">
        <EpisodePicker
          podcastTitle={step.podcastTitle}
          episodes={step.episodes}
          onSelect={handleEpisodeSelect}
          onCancel={handleCancel}
        />
        {loading && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Submitting…
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    )
  }

  if (step.kind === "title") {
    return (
      <form onSubmit={handleDirectSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Direct audio URL — enter a title to continue
        </p>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Episode title"
          className={inputClass.replace("py-3", "py-2.5").replace("text-base", "text-sm")}
        />
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Submitting…" : "Transcribe"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </form>
    )
  }

  return (
    <form onSubmit={handleResolve} className="flex flex-col gap-3">
      <input
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste podcast or audio URL…"
        className={inputClass}
      />
      <button type="submit" disabled={loading} className={buttonClass}>
        {loading ? "Resolving feed…" : "Transcribe"}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  )
}
