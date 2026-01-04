CREATE TABLE IF NOT EXISTS "casts" (
	"hash" text PRIMARY KEY NOT NULL,
	"fid" bigint NOT NULL,
	"timestamp" timestamp NOT NULL,
	"parent_hash" text,
	"parent_fid" bigint,
	"text" text NOT NULL,
	"char_count" integer,
	"reply_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "classifications" (
	"cast_hash" text PRIMARY KEY NOT NULL,
	"sentiment" text NOT NULL,
	"has_anger" boolean DEFAULT false,
	"anger_confidence" numeric(3, 2) DEFAULT '0',
	"has_agency" boolean DEFAULT false,
	"classifier_version" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagers" (
	"target_fid" bigint NOT NULL,
	"engager_fid" bigint NOT NULL,
	"first_reply_at" timestamp NOT NULL,
	"last_reply_at" timestamp NOT NULL,
	"reply_count" integer DEFAULT 1,
	CONSTRAINT "engagers_target_fid_engager_fid_pk" PRIMARY KEY("target_fid","engager_fid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "replies" (
	"hash" text PRIMARY KEY NOT NULL,
	"parent_hash" text NOT NULL,
	"target_fid" bigint NOT NULL,
	"author_fid" bigint NOT NULL,
	"timestamp" timestamp NOT NULL,
	"text" text NOT NULL,
	"has_action_signal" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"fid" bigint PRIMARY KEY NOT NULL,
	"username" text,
	"display_name" text,
	"pfp_url" text,
	"last_ingest_at" timestamp,
	"last_cast_timestamp" timestamp,
	"total_casts" integer DEFAULT 0,
	"ingest_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_casts_fid_ts" ON "casts" USING btree ("fid","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_casts_parent" ON "casts" USING btree ("parent_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_class_anger" ON "classifications" USING btree ("cast_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_class_agency" ON "classifications" USING btree ("cast_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_engagers_first" ON "engagers" USING btree ("target_fid","first_reply_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_replies_target_ts" ON "replies" USING btree ("target_fid","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_replies_author" ON "replies" USING btree ("author_fid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_replies_parent" ON "replies" USING btree ("parent_hash");