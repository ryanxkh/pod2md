import { revalidateTag } from "next/cache"
import { EPISODES_LIST_TAG, episodeTag } from "@/lib/cache-tags"

const CACHE_PROFILE = "max"

export function revalidateEpisodesList() {
  revalidateTag(EPISODES_LIST_TAG, CACHE_PROFILE)
}

export function revalidateEpisode(episodeId: string) {
  revalidateTag(episodeTag(episodeId), CACHE_PROFILE)
  revalidateEpisodesList()
}
