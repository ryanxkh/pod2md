import { eq, inArray, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { episodes, jobs } from "@/lib/db/schema"
import {
  detectUrlType,
  resolveRss,
  resolveApple,
  resolveSpotify,
  resolveYouTube,
  type UrlType,
} from "@/lib/resolvers"
import type { BatchResolvedItem, BatchPreviewCounts } from "@/lib/batch/types"

export const BATCH_CAP = 25

const FEED_TYPES: UrlType[] = ["rss", "apple", "spotify"]

export function parseUrlList(raw: string): string[] {
  const parts = raw.split(/[\s\n]+/).map((s) => s.trim()).filter(Boolean)
  return [...new Set(parts)]
}

function isFeedType(urlType: UrlType): boolean {
  return FEED_TYPES.includes(urlType)
}

function defaultTitleForDirect(url: string): string {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean)
    const last = path[path.length - 1]
    if (last) return decodeURIComponent(last.replace(/\.[^.]+$/, ""))
  } catch {
    /* ignore */
  }
  return "Untitled audio"
}

async function loadCompletedSourceUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set()

  const rows = await db
    .select({
      sourceUrl: episodes.sourceUrl,
      status: jobs.status,
    })
    .from(episodes)
    .innerJoin(jobs, eq(jobs.episodeId, episodes.id))
    .where(inArray(episodes.sourceUrl, urls))
    .orderBy(desc(jobs.createdAt))

  const completed = new Set<string>()
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.sourceUrl)) continue
    seen.add(row.sourceUrl)
    if (row.status === "completed") {
      completed.add(row.sourceUrl)
    }
  }
  return completed
}

function markDisposition(
  items: Omit<BatchResolvedItem, "disposition">[],
  completedUrls: Set<string>,
): BatchResolvedItem[] {
  return items.map((item) => ({
    ...item,
    disposition: completedUrls.has(item.source_url) ? "skipped" : "new",
  }))
}

async function resolveFeedUrl(
  url: string,
  latestN: number,
): Promise<BatchResolvedItem[]> {
  const urlType = detectUrlType(url)
  let result
  if (urlType === "spotify") {
    result = await resolveSpotify(url)
  } else if (urlType === "apple") {
    result = await resolveApple(url)
  } else {
    result = await resolveRss(url)
  }

  const slice = result.episodes.slice(0, latestN)
  const drafts = slice.map((ep) => {
    const sourceUrl = ep.audioUrl
    return {
      title: ep.title,
      audio_url: ep.audioUrl,
      source_url: sourceUrl,
      source_type: "direct" as const,
      published_at: ep.publishedAt,
      description: ep.description,
      duration_secs: ep.durationSecs,
      input_url: url,
    }
  })

  const sourceUrls = drafts.map((d) => d.source_url)
  const completed = await loadCompletedSourceUrls(sourceUrls)
  return markDisposition(drafts, completed)
}

async function resolveSingleUrl(url: string): Promise<BatchResolvedItem> {
  const urlType = detectUrlType(url)

  if (urlType === "youtube") {
    const result = await resolveYouTube(url)
    const sourceUrl = url
    const draft = {
      title: result.title,
      audio_url: result.url,
      source_url: sourceUrl,
      source_type: "youtube" as const,
      published_at: null,
      description: null,
      duration_secs: null,
      input_url: url,
    }
    const completed = await loadCompletedSourceUrls([sourceUrl])
    return markDisposition([draft], completed)[0]
  }

  const sourceUrl = url
  const draft = {
    title: defaultTitleForDirect(url),
    audio_url: url,
    source_url: sourceUrl,
    source_type: "direct" as const,
    published_at: null,
    description: null,
    duration_secs: null,
    input_url: url,
  }
  const completed = await loadCompletedSourceUrls([sourceUrl])
  return markDisposition([draft], completed)[0]
}

export interface BatchResolveResult {
  items: BatchResolvedItem[]
  counts: BatchPreviewCounts
  errors: Array<{ url: string; reason: string }>
  capped: boolean
  capMessage: string | null
}

export async function resolveBatchUrls(
  urls: string[],
  latestN: number,
): Promise<BatchResolveResult> {
  const errors: Array<{ url: string; reason: string }> = []
  const allItems: BatchResolvedItem[] = []

  for (const url of urls) {
    try {
      const urlType = detectUrlType(url)
      if (isFeedType(urlType)) {
        const feedItems = await resolveFeedUrl(url, latestN)
        allItems.push(...feedItems)
      } else {
        const item = await resolveSingleUrl(url)
        allItems.push(item)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      errors.push({ url, reason })
    }
  }

  const seenSource = new Set<string>()
  const deduped: BatchResolvedItem[] = []
  for (const item of allItems) {
    if (seenSource.has(item.source_url)) continue
    seenSource.add(item.source_url)
    deduped.push(item)
  }

  const capped = deduped.length > BATCH_CAP
  const items = capped ? deduped.slice(0, BATCH_CAP) : deduped

  const counts: BatchPreviewCounts = {
    new: items.filter((i) => i.disposition === "new").length,
    skipped: items.filter((i) => i.disposition === "skipped").length,
    failed: errors.length,
  }

  return {
    items,
    counts,
    errors,
    capped,
    capMessage: capped
      ? `Resolved list capped at ${BATCH_CAP} items. Narrow your paste or reduce latest-N per feed.`
      : null,
  }
}

export function countDispositions(items: BatchResolvedItem[]): BatchPreviewCounts {
  return {
    new: items.filter((i) => i.disposition === "new").length,
    skipped: items.filter((i) => i.disposition === "skipped").length,
    failed: 0,
  }
}
