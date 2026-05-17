import {
  pgTable,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const episodes = pgTable(
  "episodes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sourceUrl: text("source_url").notNull().unique(),
    audioUrl: text("audio_url"),
    title: text("title").notNull(),
    description: text("description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    durationSecs: integer("duration_secs"),
    transcriptMd: text("transcript_md"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const speakers = pgTable(
  "speakers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    episodeId: text("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    name: text("name").notNull(),
    confidence: text("confidence"),
  },
  (table) => [
    uniqueIndex("speakers_episode_label_idx").on(table.episodeId, table.label),
    index("speakers_episode_id_idx").on(table.episodeId),
  ],
);

export const segments = pgTable(
  "segments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    episodeId: text("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    speakerId: text("speaker_id")
      .notNull()
      .references(() => speakers.id),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    text: text("text").notNull(),
    seq: integer("seq").notNull(),
  },
  (table) => [
    index("segments_episode_seq_idx").on(table.episodeId, table.seq),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("jobs_status_idx").on(table.status)],
);
