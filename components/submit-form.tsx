"use client"

import { useState, type FormEvent } from "react"

interface SubmitFormProps {
  onSubmitted: (episodeId: string, title: string) => void
}

export function SubmitForm({ onSubmitted }: SubmitFormProps) {
  const [audioUrl, setAudioUrl] = useState("")
  const [title, setTitle] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: audioUrl, title }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }

      const { episodeId } = await res.json()
      const submittedTitle = title
      setAudioUrl("")
      setTitle("")
      onSubmitted(episodeId, submittedTitle)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="url"
        required
        value={audioUrl}
        onChange={(e) => setAudioUrl(e.target.value)}
        placeholder="Paste audio URL…"
        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-base placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />
      <input
        type="text"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Episode title"
        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {submitting ? "Submitting…" : "Transcribe"}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  )
}
