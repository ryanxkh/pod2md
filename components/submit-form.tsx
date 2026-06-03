"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { ClipboardList } from "lucide-react"
import { EpisodePicker } from "./episode-picker"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
import type { ResolvedEpisode } from "@/lib/resolvers/types"
import type { BatchResolvedItem } from "@/lib/batch/types"
import { episodesToBatchItems } from "@/lib/batch/submit-items"

type Step =
  | { kind: "url" }
  | {
      kind: "title"
      audioUrl: string
      sourceType: "direct" | "youtube"
      show?: string | null
    }
  | { kind: "pick"; podcastTitle: string; episodes: ResolvedEpisode[]; inputUrl: string }
  | { kind: "batch-preview"; items: BatchResolvedItem[]; collection: string | null; capMessage: string | null }

interface SubmitFormProps {
  onSubmitted?: (episodeId: string, title: string, collection?: string | null) => void
  onBatchSubmitted?: (payload: {
    batchId: string
    episodeIds: string[]
    titles: string[]
    collection?: string | null
  }) => void
  redirectOnSubmit?: string
  redirectOnBatchSubmit?: string
}

export function SubmitForm({
  onSubmitted,
  onBatchSubmitted,
  redirectOnSubmit,
  redirectOnBatchSubmit,
}: SubmitFormProps) {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [step, setStep] = useState<Step>({ kind: "url" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchOpen, setBatchOpen] = useState(true)
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
        setStep({
          kind: "title",
          audioUrl: data.url,
          sourceType: "youtube",
          show: data.channelName ?? null,
        })
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
    show?: string | null
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
      if (payload.show) body.show = payload.show

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
      onSubmitted?.(data.episodeId, submittedTitle, payload.collection ?? null)
      if (redirectOnSubmit) router.push(redirectOnSubmit)
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
      if (redirectOnBatchSubmit) router.push(redirectOnBatchSubmit)
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
      show: step.sourceType === "youtube" ? step.show ?? null : null,
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
      show: step.podcastTitle,
    })
  }

  async function handleFeedBatchSelect(selected: ResolvedEpisode[]) {
    if (step.kind !== "pick") return
    const items = episodesToBatchItems(selected, step.inputUrl, step.podcastTitle)
    await submitBatch(items, collection.trim() || null)
  }

  function handleCancel() {
    setStep({ kind: "url" })
    setError(null)
  }

  const inputClass = `w-full rounded-[8px] border border-border bg-surface px-4 py-3 text-base text-fg placeholder:text-fg-muted transition-colors duration-150 ease-out ${focusRing}`

  const buttonClass = `self-start rounded-[8px] bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg transition-colors duration-150 ease-out hover:bg-accent-hover disabled:opacity-50 ${focusRing}`

  const ghostButtonClass = `text-sm text-fg-secondary transition-colors duration-150 ease-out hover:text-fg ${focusRing}`

  if (step.kind === "batch-preview") {
    const newCount = step.items.filter((i) => i.disposition === "new").length
    const skippedCount = step.items.filter((i) => i.disposition === "skipped").length

    return (
      <div className="flex flex-col gap-3">
        {step.capMessage && (
          <p className="text-sm text-accent">{step.capMessage}</p>
        )}
        <p className="text-sm text-fg-secondary">
          Queue <strong>{newCount}</strong> new
          {skippedCount > 0 && (
            <> ({skippedCount} already done, skipped)</>
          )}
          {step.collection && (
            <> · collection <strong>{step.collection}</strong></>
          )}
        </p>
        <ul className="max-h-48 overflow-y-auto rounded-[8px] border border-border text-sm">
          {step.items.map((item) => (
            <li
              key={item.source_url}
              className="flex justify-between gap-2 border-b border-border px-3 py-2 last:border-0"
            >
              <span className="truncate">{item.title}</span>
              <span className="shrink-0 text-xs text-fg-muted">
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
            className={ghostButtonClass}
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-sm text-status-fail">{error}</p>
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
          <p className="text-sm text-fg-secondary">Submitting…</p>
        )}
        {error && (
          <p className="text-sm text-status-fail">{error}</p>
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
        <p className="text-sm text-fg-secondary">{label}</p>
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
            className={ghostButtonClass}
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="text-sm text-status-fail">{error}</p>
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
          <p className="text-sm text-status-fail">{error}</p>
        )}
      </form>

      <button
        type="button"
        onClick={() => setBatchOpen((o) => !o)}
        className={`flex items-center gap-2 self-start rounded-[8px] border border-border px-3 py-2 text-sm text-fg-secondary transition-colors duration-150 ease-out hover:border-border-strong hover:bg-elevated hover:text-fg ${focusRing}`}
      >
        <ClipboardList size={16} aria-hidden />
        {batchOpen ? "Hide batch paste" : "Batch paste URLs"}
      </button>

      {batchOpen && (
        <form onSubmit={handleBatchPreview} className="flex flex-col gap-3 rounded-[8px] border border-border bg-surface p-4">
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder="One URL per line (podcast shows, YouTube, direct audio)…"
            rows={6}
            required
            className={inputClass.replace("text-base", "text-sm")}
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-fg-secondary">
              Latest per show
              <input
                type="number"
                min={1}
                max={25}
                value={latestN}
                onChange={(e) => setLatestN(Number(e.target.value) || 10)}
                className={`w-14 rounded-[8px] border border-border bg-surface px-2 py-1 text-fg ${focusRing}`}
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
