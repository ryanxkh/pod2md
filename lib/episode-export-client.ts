import JSZip from "jszip"
import {
  generateExportMarkdown,
  episodeFilename,
  generateCollectionIndex,
  collectionSlug,
  type ExportEpisode,
} from "@/lib/export"
import type { EpisodeEnrichment } from "@/lib/db/schema"

interface EpisodeApiResponse {
  episode: {
    id: string
    title: string
    source_url: string
    published_at: string | null
    duration_secs: number | null
    collection: string | null
    show: string | null
    language: string | null
    enrichment: EpisodeEnrichment | null
    created_at: string
  }
  speakers: Array<{ id: string; name: string }>
  segments: Array<{
    start_ms: number
    speaker_name: string
    text: string
  }>
}

function buildExportEpisode(data: EpisodeApiResponse): ExportEpisode {
  return {
    id: data.episode.id,
    title: data.episode.title,
    sourceUrl: data.episode.source_url,
    publishedAt: data.episode.published_at,
    createdAt: data.episode.created_at,
    durationSecs: data.episode.duration_secs,
    speakers: data.speakers.map((s) => s.name),
    collection: data.episode.collection,
    transcribedAt: data.episode.created_at,
    show: data.episode.show,
    language: data.episode.language,
    enrichment: data.episode.enrichment,
  }
}

export async function fetchEpisodeExport(id: string): Promise<{
  markdown: string
  episode: ExportEpisode
}> {
  const res = await fetch(`/api/episodes/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch episode ${id}`)
  const data: EpisodeApiResponse = await res.json()
  const episode = buildExportEpisode(data)
  const segments = data.segments.map((seg) => ({
    startMs: seg.start_ms,
    speakerName: seg.speaker_name,
    text: seg.text,
  }))
  const markdown = generateExportMarkdown(episode, segments)
  return { markdown, episode }
}

export async function downloadZip(ids: string[], zipName: string) {
  const results = await Promise.all(ids.map(fetchEpisodeExport))
  const zip = new JSZip()
  const usedNames = new Set<string>()
  for (const r of results) {
    const name = episodeFilename(r.episode, usedNames)
    zip.file(name, r.markdown)
  }
  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = zipName
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadCollectionZip(
  ids: string[],
  collectionName: string,
  zipName: string,
  useClaudeIndexName: boolean,
) {
  const results = await Promise.all(ids.map(fetchEpisodeExport))
  const zip = new JSZip()
  const folderName = collectionSlug(collectionName)
  const folder = zip.folder(folderName)
  if (!folder) throw new Error("Failed to create zip folder")

  const usedNames = new Set<string>()
  const indexEpisodes = results.map((r) => {
    const filename = episodeFilename(r.episode, usedNames)
    folder.file(filename, r.markdown)
    return {
      filename,
      title: r.episode.title,
      publishedAt: r.episode.publishedAt,
      sourceUrl: r.episode.sourceUrl,
      enrichment: r.episode.enrichment,
    }
  })

  const indexMd = generateCollectionIndex(collectionName, indexEpisodes)
  folder.file(useClaudeIndexName ? "CLAUDE.md" : "INDEX.md", indexMd)

  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = zipName
  a.click()
  URL.revokeObjectURL(url)
}
