export interface YouTubeResolveResult {
  title: string
  url: string
  channelName: string | null
}

interface OEmbedResponse {
  title?: string
  author_name?: string
}

export async function resolveYouTube(url: string): Promise<YouTubeResolveResult> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`

  let res: Response
  try {
    res = await fetch(oembedUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to fetch YouTube metadata: ${msg}`)
  }

  if (!res.ok) {
    throw new Error(
      "Could not resolve YouTube video — it may be private, age-restricted, or deleted",
    )
  }

  let data: OEmbedResponse
  try {
    data = (await res.json()) as OEmbedResponse
  } catch {
    throw new Error("Could not parse YouTube metadata response")
  }

  if (!data.title) {
    throw new Error("YouTube video has no title")
  }

  return {
    title: data.title,
    url,
    channelName: data.author_name?.trim() || null,
  }
}
