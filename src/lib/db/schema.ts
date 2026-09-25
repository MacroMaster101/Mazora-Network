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
    /** Any presence heartbeat, throttled. Never written while the member is invisible. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** A heartbeat from a tab the member recently interacted with; drives Online → Idle. */
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    /** online | idle | dnd | invisible — checked in migration 051. */
    presenceStatus: text("presence_status").notNull().default("online"),
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

/**
 * The staff-issued invoice for an order.
 *
 * Deliberately a separate table rather than more columns on `orders`: an order
 * is the buyer's request and exists the moment they submit it, while an invoice
 * is a document staff choose to issue afterwards, and most orders never get
 * one. One row per order, so re-opening the dialog edits the same invoice
 * instead of minting a second number for the same purchase.
 *
 * Money is NOT copied here. Totals are always re-read from the order and its
 * line items, so an invoice can never drift from what was actually charged.
 * `adjustment` is the one figure staff add on top, and it is stored signed so a
 * credit is just a negative number.
 */
export const orderInvoices = pgTable("order_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  /**
   * Null for a standalone invoice staff built by hand — most sales are arranged
   * in Discord and never become an `orders` row. When set, the money is read
   * from the order so the document cannot drift from what was charged.
   */
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  /** Human invoice number. Defaults to the order reference, editable by staff. */
  invoiceNo: text("invoice_no").notNull(),
  /** Signed. Negative is a credit; added to the order subtotal minus discount. */
  adjustment: numeric("adjustment", { precision: 10, scale: 2 }).default("0").notNull(),
  /** Footer note, e.g. "This rank is valid from … to …". */
  notes: text("notes"),
  /** Billing name on the document; falls back to the order's Minecraft name. */
  billedTo: text("billed_to"),
  /** Shown as the document date. Staff can backdate a reissue. */
  /** Buyer on a standalone invoice; order-backed ones read the order. */
  buyerName: text("buyer_name"),
  buyerDiscord: text("buyer_discord"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  /** The staff member who raised the invoice on the website. */
  issuedBy: text("issued_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  orderIdx: uniqueIndex("order_invoices_order_idx").on(t.orderId),
  invoiceNoIdx: uniqueIndex("order_invoices_invoice_no_idx").on(t.invoiceNo),
}));

/**
 * Lines for a standalone invoice. Order-backed invoices read `order_items`
 * instead, so their figures always match what the buyer was charged.
 *
 * `discountPercent` is per line because a Discord sale often discounts one rank
 * and not the crate keys beside it.
 */
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => orderInvoices.id, { onDelete: "cascade" }),
  /** Null keeps the line readable after the product is deleted. */
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  /** Snapshot of the name at issue time, so a rename does not rewrite history. */
  name: text("name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: integer("discount_percent").default(0).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  invoiceIdx: index("invoice_items_invoice_idx").on(t.invoiceId, t.sortOrder),
  quantityCheck: check("invoice_items_quantity_positive", sql`${t.quantity} > 0`),
  priceCheck: check("invoice_items_price_nonneg", sql`${t.unitPrice} >= 0`),
  discountCheck: check("invoice_items_discount_range", sql`${t.discountPercent} between 0 and 100`),
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
    /**
     * Sitewide eligibility, stored rather than inferred.
     *
     * Eligibility is otherwise the hand-picked creatorCodeProducts list, and an
     * empty list means the code discounts nothing. "Applies to everything" has
     * to be its own flag: inferring it from an empty list would also catch
     * codes left empty by mistake, and codes whose picks were cascade-deleted
     * along with a product, turning both into sitewide discounts nobody chose.
     */
    appliesToAllProducts: boolean("applies_to_all_products").default(false).notNull(),
    /** Whether to feature this discount code as a floating alert across all public pages. */
    showPublicAlert: boolean("show_public_alert").default(false).notNull(),
    alertHeadline: text("alert_headline"),
    alertBadge: text("alert_badge"),
    alertPosition: text("alert_position").default("bottom-right").notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: uniqueIndex("creator_codes_code_idx").on(t.code),
    typeIdx: index("creator_codes_type_idx").on(t.codeType, t.createdAt.desc()),
    publicAlertIdx: index("creator_codes_public_alert_idx").on(t.showPublicAlert, t.enabled).where(sql`${t.showPublicAlert} = true`),
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

export const contentCreators = pgTable(
  "content_creators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    profileImageUrl: text("profile_image_url"),
    bio: text("bio"),
    socials: jsonb("socials").default([]).notNull(),
    publicVisible: boolean("public_visible").default(true).notNull(),
    featuredOnHome: boolean("featured_on_home").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    publicIdx: index("content_creators_public_idx")
      .on(t.featuredOnHome.desc(), t.sortOrder, t.createdAt.desc())
      .where(sql`${t.publicVisible} = true`),
    nameLengthCheck: check("content_creators_name_length", sql`char_length(${t.name}) between 1 and 80`),
    bioLengthCheck: check("content_creators_bio_length", sql`${t.bio} is null or char_length(${t.bio}) <= 180`),
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

/**
 * One row per vote, per player, per site.
 *
 * Nothing writes to this table yet — there is no vote callback route and no
 * insert anywhere in the codebase, only `voteSites` configuration and the
 * leaderboard read below. Once a recording path exists this becomes the
 * fastest-growing table in the schema by a wide margin: vote sites are on a
 * 24-hour cooldown, so a hundred active players across four sites is roughly
 * 146,000 rows a year. `audit_logs`, the only other unbounded table, manages a
 * few hundred.
 *
 * BEFORE ADDING RETENTION, READ THIS.
 *
 * `getTopVoters` in lib/data/content.ts derives all-time totals as
 * `count(*)` over these rows — not from a stored total. Its other windows (24
 * hours, 7 days, this month, last month) only need recent rows, so a naive
 * "delete older than N days" reaper looks correct in testing and quietly
 * resets every player's lifetime vote count the first time it fires, months
 * later, with no error and nothing to restore from.
 *
 * Pruning is therefore safe only once a running per-user counter exists that
 * is incremented on write. Build that into the vote-recording path when it is
 * added — retrofitting it afterwards means backfilling from rows that the
 * reaper has already deleted.
 */
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ createdIdx: index("audit_logs_created_idx").on(t.createdAt.desc()) }));

/** Hashed single-use two-step verification recovery codes (migration 073). */
export const mfaRecoveryCodes = pgTable("mfa_recovery_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  codeHash: text("code_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({ userIdx: index("mfa_recovery_codes_user_idx").on(t.userId) }));

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

/** The role catalogue (migration 054). Accounts reference `key` via app_metadata.role. */
export const roles = pgTable("roles", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  color: text("color").notNull(),
  icon: text("icon"),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull(),
  position: integer("position").notNull().unique(),
  locked: boolean("locked").notNull().default(false),
  showOnTeam: boolean("show_on_team").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
    /** The reply this one answers, or null for a top-level reply. Any depth
     *  is allowed; the post action checks the target, not a depth limit here. */
    parentId: uuid("parent_id").references((): AnyPgColumn => suggestionReplies.id, { onDelete: "cascade" }),
  },
  (t) => ({
    threadIdx: index("suggestion_replies_thread_idx").on(t.suggestionId, t.createdAt),
    parentIdx: index("suggestion_replies_parent_idx").on(t.parentId).where(sql`${t.parentId} is not null`),
  }),
);

/** One vote per member per suggestion reply (migration 052). The auth.users FK is declared in SQL only. */
export const suggestionReplyVotes = pgTable(
  "suggestion_reply_votes",
  {
    replyId: uuid("reply_id").notNull().references(() => suggestionReplies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    /** +1 or -1; checked in SQL. */
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.replyId, t.userId] }),
    userIdx: index("suggestion_reply_votes_user_idx").on(t.userId),
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

export const forumCategories = pgTable("forum_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const forums = pgTable(
  "forums",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").notNull().references(() => forumCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Unique site-wide, so moving a forum between categories keeps its URL. */
    slug: text("slug").notNull().unique(),
    description: text("description"),
    /** Lucide icon name, as game_modes stores it. */
    icon: text("icon"),
    sortOrder: integer("sort_order").default(0).notNull(),
    locked: boolean("locked").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index("forums_category_idx").on(t.categoryId, t.sortOrder),
  }),
);

export const forumTopics = pgTable(
  "forum_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    forumId: uuid("forum_id").notNull().references(() => forums.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    locked: boolean("locked").default(false).notNull(),
    /** Soft delete: the row stays so counts and links keep their shape. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /*
      Denormalised on purpose, unlike the board counts: it is written in the
      same transaction as the post that sets it, every topic list orders by it,
      and a stale value shows as a mis-ordered row rather than a wrong fact.
    */
    lastPostAt: timestamp("last_post_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    listIdx: index("forum_topics_list_idx")
      .on(t.forumId, t.pinned, t.lastPostAt)
      .where(sql`${t.deletedAt} is null`),
    authorIdx: index("forum_topics_author_idx").on(t.userId),
  }),
);

export const forumPosts = pgTable(
  "forum_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id").notNull().references(() => forumTopics.id, { onDelete: "cascade" }),
    /** The post this one answers, or null for a top-level post. Any depth is
     *  allowed (migration 049); the post action checks the target, not a
     *  depth limit here. */
    parentId: uuid("parent_id").references((): AnyPgColumn => forumPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    topicIdx: index("forum_posts_topic_idx").on(t.topicId, t.createdAt),
    parentIdx: index("forum_posts_parent_idx").on(t.parentId, t.createdAt).where(sql`${t.parentId} is not null`),
  }),
);

export const forumPostImages = pgTable(
  "forum_post_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").notNull().references(() => forumPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    url: text("url").notNull(),
    /** Kept so a delete can remove the stored object, not just this row. */
    storageKey: text("storage_key").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ postIdx: index("forum_post_images_post_idx").on(t.postId, t.sortOrder) }),
);

/**
 * Community reports against a forum topic or post. Exactly one target column is
 * set; the SQL CHECK enforces it, following the pattern migration 042
 * established for suggestion_images. The per-reporter uniqueness is two partial
 * indexes, which the Drizzle builder cannot express — they live in migration
 * 046 only, the same caveat migration 039 records.
 */
export const forumReports = pgTable("forum_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  topicId: uuid("topic_id").references(() => forumTopics.id, { onDelete: "cascade" }),
  postId: uuid("post_id").references(() => forumPosts.id, { onDelete: "cascade" }),
  reporterId: uuid("reporter_id").notNull(),
  reason: text("reason").notNull(),
  /** Optional context from the reporter (migration 050). */
  note: text("note"),
  status: text("status").default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by"),
});

/** One vote per member per forum post (migration 052). The auth.users FK is declared in SQL only. */
export const forumPostVotes = pgTable(
  "forum_post_votes",
  {
    postId: uuid("post_id").notNull().references(() => forumPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    /** +1 or -1; checked in SQL. */
    value: integer("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.userId] }),
    userIdx: index("forum_post_votes_user_idx").on(t.userId),
  }),
);
