import {
  pgTable,
  text,
  timestamp,
  bigint,
  integer,
  boolean,
  decimal,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// Users table
export const users = pgTable("users", {
  fid: bigint("fid", { mode: "number" }).primaryKey(),
  username: text("username"),
  displayName: text("display_name"),
  pfpUrl: text("pfp_url"),

  // Ingestion tracking
  lastIngestAt: timestamp("last_ingest_at"),
  lastCastTimestamp: timestamp("last_cast_timestamp"),
  totalCasts: integer("total_casts").default(0),
  ingestStatus: text("ingest_status").default("pending"), // pending, in_progress, complete, failed

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User's authored casts
export const casts = pgTable(
  "casts",
  {
    hash: text("hash").primaryKey(),
    fid: bigint("fid", { mode: "number" }).notNull(),
    timestamp: timestamp("timestamp").notNull(),

    // Reply info (null if root cast)
    parentHash: text("parent_hash"),
    parentFid: bigint("parent_fid", { mode: "number" }),

    // Content
    text: text("text").notNull(),
    charCount: integer("char_count"),

    // Denormalized reply count
    replyCount: integer("reply_count").default(0),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    fidTimestampIdx: index("idx_casts_fid_ts").on(table.fid, table.timestamp),
    parentIdx: index("idx_casts_parent").on(table.parentHash),
  })
);

// Replies TO user's casts (from others)
export const replies = pgTable(
  "replies",
  {
    hash: text("hash").primaryKey(),
    parentHash: text("parent_hash").notNull(), // User's cast that was replied to
    targetFid: bigint("target_fid", { mode: "number" }).notNull(), // User who received the reply
    authorFid: bigint("author_fid", { mode: "number" }).notNull(), // Who wrote the reply
    timestamp: timestamp("timestamp").notNull(),
    text: text("text").notNull(),

    // For action-confirmation detection
    hasActionSignal: boolean("has_action_signal").default(false),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    targetTimestampIdx: index("idx_replies_target_ts").on(
      table.targetFid,
      table.timestamp
    ),
    authorIdx: index("idx_replies_author").on(table.authorFid),
    parentIdx: index("idx_replies_parent").on(table.parentHash),
  })
);

// Classifications (per user cast)
export const classifications = pgTable(
  "classifications",
  {
    castHash: text("cast_hash").primaryKey(),

    // Core labels
    sentiment: text("sentiment").notNull(), // 'positive', 'negative', 'neutral'
    hasAnger: boolean("has_anger").default(false),
    angerConfidence: decimal("anger_confidence", {
      precision: 3,
      scale: 2,
    }).default("0"),
    hasAgency: boolean("has_agency").default(false),

    // Meta
    classifierVersion: text("classifier_version").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    angerIdx: index("idx_class_anger").on(table.castHash),
    agencyIdx: index("idx_class_agency").on(table.castHash),
  })
);

// Engager first-seen tracking (for activation)
export const engagers = pgTable(
  "engagers",
  {
    targetFid: bigint("target_fid", { mode: "number" }).notNull(),
    engagerFid: bigint("engager_fid", { mode: "number" }).notNull(),
    firstReplyAt: timestamp("first_reply_at").notNull(),
    lastReplyAt: timestamp("last_reply_at").notNull(),
    replyCount: integer("reply_count").default(1),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.targetFid, table.engagerFid] }),
    firstIdx: index("idx_engagers_first").on(
      table.targetFid,
      table.firstReplyAt
    ),
  })
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Cast = typeof casts.$inferSelect;
export type NewCast = typeof casts.$inferInsert;
export type Reply = typeof replies.$inferSelect;
export type NewReply = typeof replies.$inferInsert;
export type Classification = typeof classifications.$inferSelect;
export type NewClassification = typeof classifications.$inferInsert;
export type Engager = typeof engagers.$inferSelect;
export type NewEngager = typeof engagers.$inferInsert;
