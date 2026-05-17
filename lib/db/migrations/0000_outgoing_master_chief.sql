CREATE TABLE "episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"audio_url" text,
	"title" text NOT NULL,
	"description" text,
	"published_at" timestamp with time zone,
	"duration_secs" integer,
	"transcript_md" text,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "episodes_source_url_unique" UNIQUE("source_url")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"batch_id" text,
	"runpod_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"speaker_id" text NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL,
	"seq" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speakers" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"label" text NOT NULL,
	"name" text NOT NULL,
	"confidence" text
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episodes_search_vector_idx" ON "episodes" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "segments_episode_id_seq_idx" ON "segments" USING btree ("episode_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "speakers_episode_id_label_idx" ON "speakers" USING btree ("episode_id","label");--> statement-breakpoint
CREATE INDEX "speakers_episode_id_idx" ON "speakers" USING btree ("episode_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_episode_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.transcript_md, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_episode_search_vector
  BEFORE INSERT OR UPDATE OF title, transcript_md ON episodes
  FOR EACH ROW EXECUTE FUNCTION update_episode_search_vector();
