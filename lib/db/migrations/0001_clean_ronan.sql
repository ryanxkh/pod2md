ALTER TABLE "episodes" ADD COLUMN "collection" text;--> statement-breakpoint
CREATE INDEX "episodes_collection_idx" ON "episodes" USING btree ("collection");