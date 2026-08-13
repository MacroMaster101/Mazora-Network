/**
 * Drizzle schema — the single source of truth for the Supabase Postgres database.
 * `npm run db:generate` emits SQL into supabase/migrations.
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    role: text("role").notNull().default("member"),
    accountStatus: text("account_status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    usernameIdx: uniqueIndex("profiles_username_idx").on(t.username),
    userIdIdx: uniqueIndex("profiles_user_id_idx").on(t.userId),
  }),
);

export const minecraftAccounts = pgTable(
  "minecraft_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    minecraftUuid: text("minecraft_uuid").notNull(),
    minecraftUsername: text("minecraft_username").notNull(),
    skinHeadUrl: text("skin_head_url"),
    rawSkinUrl: text("raw_skin_url"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uuidIdx: uniqueIndex("mc_accounts_uuid_idx").on(t.minecraftUuid),
    userIdx: index("mc_accounts_user_idx").on(t.userId),
  }),
);

export const playerStatistics = pgTable("player_statistics", {
  id: uuid("id").defaultRandom().primaryKey(),
  minecraftAccountId: uuid("minecraft_account_id").notNull(),
  playtimeSeconds: bigint("playtime_seconds", { mode: "number" }).default(0).notNull(),
  kills: integer("kills").default(0).notNull(),
  deaths: integer("deaths").default(0).notNull(),
  balance: numeric("balance").default("0").notNull(),
  level: integer("level").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  blocksMined: bigint("blocks_mined", { mode: "number" }).default(0).notNull(),
  blocksPlaced: bigint("blocks_placed", { mode: "number" }).default(0).notNull(),
  killStreak: integer("kill_streak").default(0).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  isOnline: boolean("is_online").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const newsArticles = pgTable(
  "news_articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    excerpt: text("excerpt"),
    content: text("content"),
    featuredImage: text("featured_image"),
    category: text("category").notNull().default("Announcements"),
    status: text("status").notNull().default("published"),
    authorId: uuid("author_id"),
    authorName: text("author_name"),
    authorRole: text("author_role"),
    authorAvatarUrl: text("author_avatar_url"),
    /** Optional per-story image for the fixed Mazora Team identity. */
    teamAvatarUrl: text("team_avatar_url"),
    /** Manual override; null keeps the automatic word-count estimate. */
    readTimeMinutes: integer("read_time_minutes"),
    /** Public byline: the named author or the shared Mazora Team identity. */
    publisherMode: text("publisher_mode").notNull().default("team"),
    /** 'manual' when written on the site, 'discord' when imported. */
    source: text("source").notNull().default("manual"),
    discordMessageId: text("discord_message_id"),
    discordAuthor: text("discord_author"),
    discordAuthorRole: text("discord_author_role"),
    discordAuthorAvatarUrl: text("discord_author_avatar_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ slugIdx: uniqueIndex("news_slug_idx").on(t.slug) }),
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    status: text("status").notNull().default("upcoming"),
    gameMode: text("game_mode"),
    rewards: jsonb("rewards"),
    maxParticipants: integer("max_participants"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ slugIdx: uniqueIndex("events_slug_idx").on(t.slug) }),
);

export const eventRegistrations = pgTable("event_registrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull(),
  userId: uuid("user_id").notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow().notNull(),
});

export const gameModes = pgTable(
  "game_modes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    serverAddress: text("server_address"),
    playerCount: integer("player_count").default(0).notNull(),
    icon: text("icon").default("gamepad-2").notNull(),
    accent: text("accent").default("violet").notNull(),
    tagline: text("tagline"),
    version: text("version").default("1.21.11").notNull(),
    features: jsonb("features").default([]).notNull(),
    commands: jsonb("commands").default([]).notNull(),
    rules: jsonb("rules").default([]).notNull(),
    storeStatus: text("store_status").default("coming_soon").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ slugIdx: uniqueIndex("game_modes_slug_idx").on(t.slug) }),
);

export const ruleCategories = pgTable("rule_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  /** Lucide icon key rendered by the public rulebook. */
  icon: text("icon"),
  sortOrder: integer("sort_order").default(0).notNull(),
  /** Bumped by a trigger whenever a rule in this category changes. */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rules = pgTable("rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
});

export const staffMembers = pgTable("staff_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  minecraftAccountId: uuid("minecraft_account_id"),
  username: text("username").notNull(),
  staffRole: text("staff_role").notNull(),
  bio: text("bio"),
  sortOrder: integer("sort_order").default(0).notNull(),
  visible: boolean("visible").default(true).notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  category: text("category").notNull().default("General"),
  subject: text("subject").notNull(),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  assignedTo: uuid("assigned_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ticketMessages = pgTable("ticket_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull(),
  senderId: uuid("sender_id").notNull(),
  message: text("message").notNull(),
  isPrivateStaffNote: boolean("is_private_staff_note").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const banAppeals = pgTable("ban_appeals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  minecraftUsername: text("minecraft_username").notNull(),
  punishmentType: text("punishment_type").notNull(),
  punishmentReason: text("punishment_reason"),
  appealText: text("appeal_text").notNull(),
  evidenceUrl: text("evidence_url"),
  status: text("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const playerReports = pgTable("player_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").notNull(),
  reportedUsername: text("reported_username").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  evidenceUrl: text("evidence_url"),
  status: text("status").notNull().default("submitted"),
  assignedTo: uuid("assigned_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bugReports = pgTable("bug_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  gameMode: text("game_mode"),
  description: text("description").notNull(),
  reproductionSteps: text("reproduction_steps"),
  expectedResult: text("expected_result"),
  actualResult: text("actual_result"),
  minecraftVersion: text("minecraft_version"),
  evidenceUrl: text("evidence_url"),
  status: text("status").notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suggestions = pgTable("suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Gameplay"),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suggestionVotes = pgTable("suggestion_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  suggestionId: uuid("suggestion_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    price: numeric("price").notNull(),
    salePrice: numeric("sale_price"),
    imageUrl: text("image_url"),
    /** Bullet points shown on the product card, as a JSON string array. */
    features: jsonb("features").default([]).notNull(),
    accent: text("accent"),
    badge: text("badge"),
    /** Rank family (Hero, VIP…) used to group the ladder on the storefront. */
    family: text("family"),
    billing: text("billing"),
    subcategory: text("subcategory"),
    gameModeSlug: text("game_mode_slug").default("survival-smp").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ slugIdx: uniqueIndex("products_slug_idx").on(t.slug) }),
);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Null after account deletion so operational order history can be retained
  // without retaining an auth identifier for the deleted account.
  userId: uuid("user_id"),
  totalAmount: numeric("total_amount").notNull(),
  // Reserved for a future card provider. The manual Discord flow uses `status`.
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentProvider: text("payment_provider"),
  externalPaymentId: text("external_payment_id"),
  // --- manual Discord order flow (013) ---
  /** Public MZ-YYYYMMDD-XXXXXX code the buyer quotes to staff. */
  reference: text("reference"),
  minecraftUsername: text("minecraft_username"),
  discordId: text("discord_id"),
  discordUsername: text("discord_username"),
  notes: text("notes"),
  /** pending | confirmed | rejected | awaiting_discord_join */
  status: text("status").notNull().default("pending"),
  /** Display name of the staff member who actioned it in Discord. */
  handledBy: text("handled_by"),
  handledAt: timestamp("handled_at", { withTimezone: true }),
  ticketChannelId: text("ticket_channel_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull(),
  // Nullable in SQL: a deleted product sets this null but keeps the line item.
  productId: uuid("product_id"),
  /** Snapshot of the name at purchase time, so history survives a rename. */
  productName: text("product_name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  price: numeric("price").notNull(),
});

export const voteSites = pgTable("vote_sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  imageUrl: text("image_url"),
  rewardDescription: text("reward_description"),
  cooldownHours: integer("cooldown_hours").default(24).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
});

export const voteHistory = pgTable("vote_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  voteSiteId: uuid("vote_site_id").notNull(),
  votedAt: timestamp("voted_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").notNull().default("info"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const galleryImages = pgTable("gallery_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category").notNull().default("community"),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  status: text("status").notNull().default("pending"),
  featured: boolean("featured").default(false).notNull(),
  likesCount: integer("likes_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const galleryLikes = pgTable(
  "gallery_likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    imageId: uuid("image_id").notNull().references(() => galleryImages.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ userImageIdx: uniqueIndex("gallery_likes_user_image_idx").on(t.userId, t.imageId) })
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const siteSettings = pgTable(
  "site_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    settingKey: text("setting_key").notNull(),
    settingValue: jsonb("setting_value"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ keyIdx: uniqueIndex("site_settings_key_idx").on(t.settingKey) }),
);
