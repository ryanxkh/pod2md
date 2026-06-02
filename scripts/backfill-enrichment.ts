/**
 * Backfill LLM enrichment for completed episodes.
 *
 * Usage:
 *   npx tsx scripts/backfill-enrichment.ts [--force] [--dry-run]
 *
 * Requires DATABASE_URL and ANTHROPIC_API_KEY in the environment.
 * Does NOT run migrations — apply lib/db/migrations/0002_* first.
 */

import { isNotNull } from "drizzle-orm"
import { db } from "../lib/db"
import { episodes } from "../lib/db/schema"
import { enrichEpisode } from "../lib/enrich"
import { estimateTokenCount } from "../lib/export"

const force = process.argv.includes("--force")
const dryRun = process.argv.includes("--dry-run")

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required")
    process.exit(1)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required")
    process.exit(1)
  }

  const rows = await db
    .select({
      id: episodes.id,
      title: episodes.title,
      enrichment: episodes.enrichment,
      language: episodes.language,
      show: episodes.show,
      transcriptMd: episodes.transcriptMd,
    })
    .from(episodes)
    .where(isNotNull(episodes.transcriptMd))

  const targets = rows.filter((row) => force || !row.enrichment)
  const skipped = rows.length - targets.length
  const missingLanguage = rows.filter((r) => !r.language).length
  const missingShow = rows.filter((r) => !r.show).length

  const estimatedInputTokens = targets.reduce(
    (sum, row) => sum + estimateTokenCount(row.transcriptMd ?? ""),
    0,
  )

  console.log(`Completed episodes: ${rows.length}`)
  console.log(`To enrich: ${targets.length} (skipped ${skipped} already enriched)`)
  console.log(`Missing language (not backfilled here): ${missingLanguage}`)
  console.log(`Missing show (not backfilled here): ${missingShow}`)
  console.log(
    `Estimated input tokens (~transcript only): ${estimatedInputTokens.toLocaleString()}`,
  )
  console.log(
    "Note: one Claude call per episode; output tokens add to cost. Long transcripts are large prompts.",
  )

  if (dryRun) {
    console.log("Dry run — no API calls made.")
    return
  }

  let enriched = 0
  let failed = 0

  for (const row of targets) {
    process.stdout.write(`Enriching ${row.id} (${row.title.slice(0, 60)}…)… `)
    try {
      const ok = await enrichEpisode(row.id, { force })
      if (ok) {
        enriched++
        console.log("ok")
      } else {
        failed++
        console.log("failed (no result)")
      }
    } catch (err) {
      failed++
      console.log("error")
      console.error(err)
    }
  }

  console.log(`Done. Enriched: ${enriched}, failed: ${failed}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
