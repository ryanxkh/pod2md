import { listRecentEpisodes } from "@/lib/list-recent-episodes"

export async function GET() {
  try {
    const episodes = await listRecentEpisodes()
    return Response.json({ episodes })
  } catch (err) {
    console.error("Episode list failed:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
