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
  primaryKey,
  check,
  foreignKey,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
    usernameLowerIdx: uniqueIndex("profiles_username_lower_idx").on(sql`lower(${t.username})`),
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
    userIdx: uniqueIndex("minecraft_accounts_user_idx").on(t.userId),
  }),
);

/**
 * Every Minecraft player observed by the server sync plugin. This is separate
 * from `minecraft_accounts`: that table links a website account to Minecraft,
 * while this registry must also contain players who never created a web
 * account. UUID is the durable identity; usernames are only the latest seen
 * display value.
 */
export const minecraftPlayers = pgTable(
  "minecraft_players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    minecraftUuid: text("minecraft_uuid").notNull(),
    username: text("username").notNull(),
    playtimeSeconds: bigint("playtime_seconds", { mode: "number" }),
    balance: numeric("balance", { precision: 18, scale: 2 }),
    isOnline: boolean("is_online").default(false).notNull(),
    firstJoined: timestamp("first_joined", { withTimezone: true }),
    lastSeen: timestamp("last_seen", { withTimezone: true }),
    serverName: text("server_name"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uuidIdx: uniqueIndex("minecraft_players_uuid_idx").on(t.minecraftUuid),
    usernameIdx: index("minecraft_players_username_idx").on(sql`lower(${t.username})`),
    onlineIdx: index("minecraft_players_online_idx").on(t.isOnline, t.syncedAt.desc()),
    playtimeIdx: index("minecraft_players_playtime_idx").on(t.playtimeSeconds.desc().nullsLast()),
    balanceIdx: index("minecraft_players_balance_idx").on(t.balance.desc().nullsLast()),
    playtimeNonnegative: check("minecraft_players_playtime_nonnegative", sql`${t.playtimeSeconds} is null or ${t.playtimeSeconds} >= 0`),
  }),
);

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
  (t) => ({
    slugIdx: uniqueIndex("news_slug_idx").on(t.slug),
    discordMessageIdx: uniqueIndex("news_discord_message_idx").on(t.discordMessageId).where(sql`${t.discordMessageId} is not null`),
    statusIdx: index("news_status_idx").on(t.status),
    categoryIdx: index("news_articles_category_idx").on(t.category, t.publishedAt.desc()),
    publishedOrderIdx: index("news_articles_pub_order_idx").on(sql`coalesce(${t.publishedAt}, ${t.createdAt}) desc`).where(sql`${t.status} = 'published'`),
    statusCheck: check("news_articles_status_check", sql`${t.status} in ('draft', 'pending', 'published', 'hidden', 'rejected')`),
    publisherModeCheck: check("news_publisher_mode_check", sql`${t.publisherMode} in ('team', 'author')`),
    readTimeCheck: check("news_articles_read_time_minutes_check", sql`${t.readTimeMinutes} is null or ${t.readTimeMinutes} between 1 and 60`),
  }),
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
  (t) => ({
    slugIdx: uniqueIndex("game_modes_slug_idx").on(t.slug),
    storeOrderIdx: index("game_modes_store_order_idx").on(t.sortOrder),
  }),
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
}, (t) => ({ slugIdx: uniqueIndex("rule_categories_slug_idx").on(t.slug) }));

export const rules = pgTable("rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").notNull().references(() => ruleCategories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
}, (t) => ({ orderIdx: index("rules_order_idx").on(t.categoryId, t.sortOrder) }));

export const suggestions = pgTable("suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Gameplay"),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  locked: boolean("locked").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suggestionVotes = pgTable(
  "suggestion_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    suggestionId: uuid("suggestion_id").notNull(),
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ voterIdx: uniqueIndex("suggestion_votes_unique_voter").on(t.suggestionId, t.userId) }),
);

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
  (t) => ({
    slugIdx: uniqueIndex("products_slug_idx").on(t.slug),
    gameModeIdx: index("products_game_mode_slug_idx").on(t.gameModeSlug),
    sortIdx: index("products_sort_idx").on(t.category, t.sortOrder),
    priceCheck: check("products_price_nonneg", sql`${t.price} >= 0 and (${t.salePrice} is null or ${t.salePrice} >= 0)`),
  }),
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
  // --- creator codes (021) ---
  /** Null after the code is deleted; the text snapshot below survives. */
  creatorCodeId: uuid("creator_code_id"),
  /** Snapshot of the code string, so history reads correctly after a rename. */
  creatorCode: text("creator_code"),
  /** Pre-discount total. `totalAmount` remains what staff actually collect. */
  subtotalAmount: numeric("subtotal_amount", { precision: 10, scale: 2 }),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  creatorCodeFk: foreignKey({
    name: "orders_creator_code_id_fkey",
    columns: [t.creatorCodeId],
    foreignColumns: [creatorCodes.id],
  }).onDelete("set null"),
  ownerIdx: index("orders_owner_idx").on(t.userId, t.createdAt.desc()),
  creatorCodeIdx: index("orders_creator_code_idx").on(t.creatorCodeId).where(sql`${t.creatorCodeId} is not null`),
  referenceIdx: uniqueIndex("orders_reference_idx").on(t.reference).where(sql`${t.reference} is not null`),
  statusIdx: index("orders_status_idx").on(t.status, t.createdAt.desc()),
  statusCheck: check("orders_status_check", sql`${t.status} in ('pending', 'confirmed', 'rejected', 'awaiting_discord_join', 'completed')`),
  amountsCheck: check("orders_amounts_nonneg", sql`${t.totalAmount} >= 0 and (${t.subtotalAmount} is null or ${t.subtotalAmount} >= 0) and ${t.discountAmount} >= 0`),
}));

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  // Nullable in SQL: a deleted product sets this null but keeps the line item.
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  /** Snapshot of the name at purchase time, so history survives a rename. */
  productName: text("product_name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  price: numeric("price").notNull(),
}, (t) => ({
  orderIdx: index("order_items_order_idx").on(t.orderId),
  quantityCheck: check("order_items_quantity_positive", sql`${t.quantity} > 0`),
  priceCheck: check("order_items_price_nonneg", sql`${t.price} >= 0`),
}));

export const creatorCodes = pgTable(
  "creator_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stored uppercase; lookups uppercase the buyer's input before querying. */
    code: text("code").notNull(),
    /** Creator attribution or a staff-run event/promotion. */
    codeType: text("code_type").default("creator").notNull(),
    creatorName: text("creator_name").notNull(),
    discordUsername: text("discord_username"),
    /** [{ platform, url }] — validated to http(s) before it is stored. */
    socials: jsonb("socials").default([]).notNull(),
    /** Bounded 1–90 by a check constraint and by validation. */
    percentOff: integer("percent_off").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    internalNote: text("internal_note"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: uniqueIndex("creator_codes_code_idx").on(t.code),
    typeIdx: index("creator_codes_type_idx").on(t.codeType, t.createdAt.desc()),
    percentCheck: check("creator_codes_percent_range", sql`${t.percentOff} between 1 and 90`),
    typeCheck: check("creator_codes_type_check", sql`${t.codeType} in ('creator', 'event')`),
  }),
);

/** Hand-picked eligibility: a code discounts only the products listed here. */
export const creatorCodeProducts = pgTable(
  "creator_code_products",
  {
    codeId: uuid("code_id").notNull().references(() => creatorCodes.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.codeId, t.productId] }),
    productIdx: index("creator_code_products_product_idx").on(t.productId),
  }),
);

export const voteSites = pgTable("vote_sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  imageUrl: text("image_url"),
  rewardDescription: text("reward_description"),
  cooldownHours: integer("cooldown_hours").default(24).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
}, (t) => ({ urlIdx: uniqueIndex("vote_sites_url_idx").on(t.url) }));

export const voteHistory = pgTable("vote_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  voteSiteId: uuid("vote_site_id").notNull(),
  votedAt: timestamp("voted_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ ownerIdx: index("votes_owner_idx").on(t.userId, t.votedAt.desc()) }));

/**
 * The editable default notification templates shown on /admin/notifications.
 * `fixed` templates fire automatically from an auth flow (welcome, session
 * verification) and cannot be dispatched by hand — only their text is editable.
 */
export const notificationTemplates = pgTable("notification_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  triggerNote: text("trigger_note").notNull().default(""),
  title: text("title").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull().default("system"),
  sender: text("sender").notNull().default("mazora"),
  delivery: text("delivery").notNull().default("website"),
  fixed: boolean("fixed").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** History of sent broadcasts, so admins can list, edit, and withdraw them. */
export const notificationBroadcasts = pgTable(
  "notification_broadcasts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    audience: text("audience").notNull().default("all"),
    category: text("category").notNull().default("announcement"),
    sender: text("sender").notNull().default("mazora"),
    priority: text("priority").notNull().default("normal"),
    href: text("href"),
    delivered: integer("delivered").notNull().default(0),
    actorId: uuid("actor_id"),
    actorName: text("actor_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ createdIdx: index("notification_broadcasts_created_idx").on(t.createdAt.desc()) }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    category: text("category").notNull().default("system"),
    sender: text("sender").notNull().default("mazora"),
    href: text("href"),
    /** Set when this row was delivered by a broadcast; cascades on withdrawal. */
    broadcastId: uuid("broadcast_id").references(() => notificationBroadcasts.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
    unreadIdx: index("notifications_unread_idx").on(t.userId, t.createdAt.desc()).where(sql`${t.readAt} is null`),
    broadcastIdx: index("notifications_broadcast_idx").on(t.broadcastId).where(sql`${t.broadcastId} is not null`),
  }),
);

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
}, (t) => ({
  feedIdx: index("gallery_images_feed_idx").on(t.status, t.featured.desc(), t.createdAt.desc()),
  authorIdx: index("gallery_images_author_idx").on(t.authorId),
  statusCheck: check("gallery_images_status_check", sql`${t.status} in ('pending', 'published', 'rejected')`),
}));

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
}, (t) => ({ createdIdx: index("audit_logs_created_idx").on(t.createdAt.desc()) }));

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

export const suggestionReplies = pgTable(
  "suggestion_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    suggestionId: uuid("suggestion_id").notNull().references(() => suggestions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /** Soft delete: the row stays so the thread keeps its shape. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** One-level nesting: a top-level parent reply, or null. Depth beyond one
     *  is prevented in the post action, not here. */
    parentId: uuid("parent_id").references((): AnyPgColumn => suggestionReplies.id, { onDelete: "cascade" }),
  },
  (t) => ({
    threadIdx: index("suggestion_replies_thread_idx").on(t.suggestionId, t.createdAt),
    parentIdx: index("suggestion_replies_parent_idx").on(t.parentId).where(sql`${t.parentId} is not null`),
  }),
);

export const suggestionImages = pgTable(
  "suggestion_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Exactly one of these is set — see the CHECK in migration 042. */
    suggestionId: uuid("suggestion_id").references(() => suggestions.id, { onDelete: "cascade" }),
    replyId: uuid("reply_id").references(() => suggestionReplies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    url: text("url").notNull(),
    /** Kept so a delete can remove the stored object, not just this row. */
    storageKey: text("storage_key").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    suggestionIdx: index("suggestion_images_suggestion_idx").on(t.suggestionId, t.sortOrder).where(sql`${t.suggestionId} is not null`),
    replyIdx: index("suggestion_images_reply_idx").on(t.replyId, t.sortOrder).where(sql`${t.replyId} is not null`),
  }),
);

/**
 * Community reports against a suggestion or a reply. Exactly one target column
 * is set; the SQL CHECK enforces it. Uniqueness is two partial indexes, which
 * the Drizzle builder cannot express, so it is declared in migration 039 only —
 * see the comment there before changing either side.
 */
export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: uuid("reporter_id").notNull(),
    suggestionId: uuid("suggestion_id").references(() => suggestions.id, { onDelete: "cascade" }),
    replyId: uuid("reply_id").references(() => suggestionReplies.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    note: text("note"),
    status: text("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ queueIdx: index("content_reports_queue_idx").on(t.status, t.createdAt.desc()) }),
);
