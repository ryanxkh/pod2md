import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  customType,
  jsonb,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { nanoid } from "nanoid"

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector"
  },
})

export interface EpisodeChapter {
  start_ms: number
  title: string
}

export interface EpisodeEnrichment {
  summary: string
  topics: string[]
  people: string[]
  chapters: EpisodeChapter[]
}

// ── Episodes ────────────────────────────────────────────────────────────────

export const episodes = pgTable(
  "episodes",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    sourceUrl: text("source_url").notNull().unique(),
    audioUrl: text("audio_url"),
    title: text("title").notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    durationSecs: integer("duration_secs"),
    transcriptMd: text("transcript_md"),
    collection: text("collection"),
    enrichment: jsonb("enrichment").$type<EpisodeEnrichment | null>(),
    language: text("language"),
    show: text("show"),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("episodes_search_vector_idx").using("gin", table.searchVector),
    index("episodes_collection_idx").on(table.collection),
  ],
)

// ── Speakers ────────────────────────────────────────────────────────────────

export const speakers = pgTable(
  "speakers",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    episodeId: text("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    name: text("name"),
    confidence: text("confidence"),
  },
  (table) => [
    uniqueIndex("speakers_episode_id_label_idx").on(table.episodeId, table.label),
    index("speakers_episode_id_idx").on(table.episodeId),
  ],
)

// ── Segments ────────────────────────────────────────────────────────────────

export const segments = pgTable(
  "segments",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    episodeId: text("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    speakerId: text("speaker_id")
      .notNull()
      .references(() => speakers.id, { onDelete: "cascade" }),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    text: text("text").notNull(),
    seq: integer("seq").notNull(),
  },
  (table) => [
    index("segments_episode_id_seq_idx").on(table.episodeId, table.seq),
  ],
)

// ── Jobs ────────────────────────────────────────────────────────────────────

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    episodeId: text("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    batchId: text("batch_id"),
    runpodId: text("runpod_id"),
    status: text("status").notNull().default("queued"),
    progress: integer("progress").default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("jobs_status_idx").on(table.status),
    index("jobs_batch_id_idx").on(table.batchId),
  ],
)

// ── Relations ───────────────────────────────────────────────────────────────

export const episodesRelations = relations(episodes, ({ many }) => ({
  speakers: many(speakers),
  segments: many(segments),
  jobs: many(jobs),
}))

export const speakersRelations = relations(speakers, ({ one, many }) => ({
  episode: one(episodes, { fields: [speakers.episodeId], references: [episodes.id] }),
  segments: many(segments),
}))

export const segmentsRelations = relations(segments, ({ one }) => ({
  episode: one(episodes, { fields: [segments.episodeId], references: [episodes.id] }),
  speaker: one(speakers, { fields: [segments.speakerId], references: [speakers.id] }),
}))

export const jobsRelations = relations(jobs, ({ one }) => ({
  episode: one(episodes, { fields: [jobs.episodeId], references: [episodes.id] }),
}))
