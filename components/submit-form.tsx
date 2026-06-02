"use client"

import { useState, type FormEvent } from "react"
import { EpisodePicker } from "./episode-picker"
import type { ResolvedEpisode } from "@/lib/resolvers/types"
import type { BatchResolvedItem } from "@/lib/batch/types"
import { episodesToBatchItems } from "@/lib/batch/submit-items"

type Step =
  | { kind: "url" }
  | { kind: "title"; audioUrl: string; sourceType: "direct" | "youtube" }
  | { kind: "pick"; podcastTitle: string; episodes: ResolvedEpisode[]; inputUrl: string }
  | { kind: "batch-preview"; items: BatchResolvedItem[]; collection: string | null; capMessage: string | null }

interface SubmitFormProps {
  onSubmitted: (episodeId: string, title: string, collection?: string | null) => void
  onBatchSubmitted?: (payload: {
    batchId: string
    episodeIds: string[]
    titles: string[]
    collection?: string | null
  }) => void
}

export function SubmitForm({ onSubmitted, onBatchSubmitted }: SubmitFormProps) {
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [step, setStep] = useState<Step>({ kind: "url" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchText, setBatchText] = useState("")
  const [collection, setCollection] = useState("")
  const [latestN, setLatestN] = useState(10)

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
        setTitle("")
        setStep({ kind: "title", audioUrl: data.url, sourceType: "direct" })
      } else if (data.type === "youtube") {
        setTitle(data.title ?? "")
        setStep({ kind: "title", audioUrl: data.url, sourceType: "youtube" })
      } else if (data.type === "feed") {
        setStep({
          kind: "pick",
          podcastTitle: data.podcastTitle,
          episodes: data.episodes,
          inputUrl: url,
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
    source_type?: "direct" | "youtube"
    source_url?: string
    published_at?: string | null
    description?: string | null
    duration_secs?: number | null
    collection?: string | null
  }) {
    setError(null)
    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        audio_url: payload.audio_url,
        title: payload.title,
      }
      if (payload.source_type) body.source_type = payload.source_type
      if (payload.source_url) body.source_url = payload.source_url
      if (payload.published_at) body.published_at = payload.published_at
      if (payload.description) body.description = payload.description
      if (payload.duration_secs != null) body.duration_secs = payload.duration_secs
      if (payload.collection) body.collection = payload.collection

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
      resetForm()
      onSubmitted(data.episodeId, submittedTitle, payload.collection ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleBatchPreview(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/batch/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: batchText,
          collection: collection.trim() || undefined,
          latestN,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error ?? `Preview failed (${res.status})`)
      }

      setStep({
        kind: "batch-preview",
        items: data.items,
        collection: data.collection ?? (collection.trim() || null),
        capMessage: data.capMessage ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function submitBatch(items: BatchResolvedItem[], batchCollection: string | null) {
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/batch/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          collection: batchCollection ?? undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error ?? `Submit failed (${res.status})`)
      }

      const episodes = (data.episodes ?? []) as Array<{ id: string; title: string }>

      resetForm()
      onBatchSubmitted?.({
        batchId: data.batchId,
        episodeIds: data.episodeIds ?? episodes.map((e) => e.id),
        titles: episodes.map((e) => e.title),
        collection: data.collection ?? batchCollection,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setUrl("")
    setTitle("")
    setBatchText("")
    setStep({ kind: "url" })
    setBatchOpen(false)
  }

  async function handleDirectSubmit(e: FormEvent) {
    e.preventDefault()
    if (step.kind !== "title") return
    await submitJob({
      audio_url: step.audioUrl,
      title,
      source_type: step.sourceType,
      source_url: step.audioUrl,
      collection: collection.trim() || null,
    })
  }

  async function handleEpisodeSelect(episode: ResolvedEpisode) {
    if (step.kind !== "pick") return
    await submitJob({
      audio_url: episode.audioUrl,
      title: episode.title,
      source_url: episode.audioUrl,
      published_at: episode.publishedAt,
      description: episode.description,
      duration_secs: episode.durationSecs,
      collection: collection.trim() || null,
    })
  }

  async function handleFeedBatchSelect(selected: ResolvedEpisode[]) {
    if (step.kind !== "pick") return
    const items = episodesToBatchItems(selected, step.inputUrl)
    await submitBatch(items, collection.trim() || null)
  }

  function handleCancel() {
    setStep({ kind: "url" })
    setError(null)
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-base placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"

  const buttonClass =
    "self-start rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"

  if (step.kind === "batch-preview") {
    const newCount = step.items.filter((i) => i.disposition === "new").length
    const skippedCount = step.items.filter((i) => i.disposition === "skipped").length

    return (
      <div className="flex flex-col gap-3">
        {step.capMessage && (
          <p className="text-sm text-amber-700 dark:text-amber-400">{step.capMessage}</p>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Queue <strong>{newCount}</strong> new
          {skippedCount > 0 && (
            <> ({skippedCount} already done, skipped)</>
          )}
          {step.collection && (
            <> · collection <strong>{step.collection}</strong></>
          )}
        </p>
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 text-sm dark:border-zinc-700">
          {step.items.map((item) => (
            <li
              key={item.source_url}
              className="flex justify-between gap-2 border-b border-zinc-100 px-3 py-2 last:border-0 dark:border-zinc-800"
            >
              <span className="truncate">{item.title}</span>
              <span className="shrink-0 text-xs text-zinc-400">
                {item.disposition === "skipped" ? "skip" : "new"}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading || newCount === 0}
            onClick={() => submitBatch(step.items, step.collection)}
            className={buttonClass}
          >
            {loading ? "Queueing…" : `Queue ${newCount}`}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    )
  }

  if (step.kind === "pick") {
    return (
      <div className="flex flex-col gap-3">
        <EpisodePicker
          podcastTitle={step.podcastTitle}
          episodes={step.episodes}
          onSelect={handleEpisodeSelect}
          onBatchSelect={onBatchSubmitted ? handleFeedBatchSelect : undefined}
          onCancel={handleCancel}
          disabled={loading}
          collection={collection.trim() || undefined}
        />
        {loading && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Submitting…</p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    )
  }

  if (step.kind === "title") {
    const label =
      step.sourceType === "youtube"
        ? "YouTube video — confirm or edit the title"
        : "Direct audio URL — enter a title to continue"

    return (
      <form onSubmit={handleDirectSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
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
    <div className="flex flex-col gap-4">
      <form onSubmit={handleResolve} className="flex flex-col gap-3">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste podcast or audio URL…"
          className={inputClass}
        />
        <input
          type="text"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          placeholder="Collection (optional)"
          className={inputClass.replace("py-3", "py-2.5").replace("text-base", "text-sm")}
        />
        <button type="submit" disabled={loading} className={buttonClass}>
          {loading ? "Resolving feed…" : "Transcribe"}
        </button>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </form>

      <button
        type="button"
        onClick={() => setBatchOpen((o) => !o)}
        className="self-start text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        {batchOpen ? "Hide batch paste" : "Batch paste URLs"}
      </button>

      {batchOpen && (
        <form onSubmit={handleBatchPreview} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder="One URL per line (podcast shows, YouTube, direct audio)…"
            rows={6}
            required
            className={inputClass.replace("text-base", "text-sm")}
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              Latest per show
              <input
                type="number"
                min={1}
                max={25}
                value={latestN}
                onChange={(e) => setLatestN(Number(e.target.value) || 10)}
                className="w-14 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
          </div>
          <button type="submit" disabled={loading} className={buttonClass}>
            {loading ? "Previewing…" : "Preview batch"}
          </button>
        </form>
      )}
    </div>
  )
}
