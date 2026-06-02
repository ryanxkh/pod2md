export type BatchItemDisposition = "new" | "skipped"

export interface BatchResolvedItem {
  title: string
  audio_url: string
  source_url: string
  source_type: "direct" | "youtube"
  published_at: string | null
  description: string | null
  duration_secs: number | null
  disposition: BatchItemDisposition
  input_url: string
  show?: string | null
}

export interface BatchPreviewCounts {
  new: number
  skipped: number
  failed: number
}
