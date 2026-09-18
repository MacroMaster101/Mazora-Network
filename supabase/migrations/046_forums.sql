begin;

CREATE TABLE "forum_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "forum_post_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid,
	"post_id" uuid,
	"reporter_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "forum_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"forum_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"last_post_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forums_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forum_post_images" ADD CONSTRAINT "forum_post_images_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_topic_id_forum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."forum_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_post_id_forum_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_forum_id_forums_id_fk" FOREIGN KEY ("forum_id") REFERENCES "public"."forums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forums" ADD CONSTRAINT "forums_category_id_forum_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."forum_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forum_post_images_post_idx" ON "forum_post_images" USING btree ("post_id","sort_order");--> statement-breakpoint
CREATE INDEX "forum_posts_topic_idx" ON "forum_posts" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "forum_topics_list_idx" ON "forum_topics" USING btree ("forum_id","pinned","last_post_at") WHERE "forum_topics"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "forum_topics_author_idx" ON "forum_topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "forums_category_idx" ON "forums" USING btree ("category_id","sort_order");

/*
 * Exactly one target per report. Same pattern as migration 042's constraint on
 * suggestion_images — the Drizzle builder cannot express either this or the
 * partial unique indexes below, so they are declared here only.
 */
alter table public.forum_reports
  add constraint forum_reports_one_target
  check (num_nonnulls(topic_id, post_id) = 1);

-- One open report per reporter per target.
create unique index forum_reports_topic_reporter_idx
  on public.forum_reports (topic_id, reporter_id)
  where topic_id is not null and status = 'open';

create unique index forum_reports_post_reporter_idx
  on public.forum_reports (post_id, reporter_id)
  where post_id is not null and status = 'open';

/*
 * Migration 032 established that every table carrying an Auth user id
 * declares `references auth.users(id)` with a deliberate ON DELETE action, so
 * deleting an account cannot orphan rows that still name it. Drizzle cannot
 * express a cross-schema (public -> auth) reference, so — same as the CHECK
 * and the partial indexes above — these are declared here only, never in the
 * schema module.
 */
alter table public.forum_topics
  add constraint forum_topics_user_id_auth_users_id_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.forum_posts
  add constraint forum_posts_user_id_auth_users_id_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.forum_post_images
  add constraint forum_post_images_user_id_auth_users_id_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.forum_reports
  add constraint forum_reports_reporter_id_auth_users_id_fk
  foreign key (reporter_id) references auth.users(id) on delete cascade;

alter table public.forum_reports
  add constraint forum_reports_resolved_by_auth_users_id_fk
  foreign key (resolved_by) references auth.users(id) on delete set null;

/*
 * Every forum write goes through a checked server action on DATABASE_URL.
 * Nothing reaches these tables over PostgREST, so the browser-facing roles get
 * no write privileges — the same reasoning as migration 045.
 */
revoke insert, update, delete on
  public.forum_categories, public.forums, public.forum_topics,
  public.forum_posts, public.forum_post_images, public.forum_reports
  from anon, authenticated;

/*
 * Supabase grants SELECT on new public tables to anon/authenticated by
 * default, and the revoke above only closes writes. Without RLS, PostgREST
 * would still serve reads straight off these tables — including the original
 * text of soft-deleted posts and the reporter_id/reason on forum_reports.
 * Every server read goes through DATABASE_URL as the postgres role, which
 * bypasses RLS entirely (see src/lib/db/client.ts), so enabling RLS with no
 * policies closes PostgREST completely while changing nothing the app does.
 */
alter table public.forum_categories enable row level security;
alter table public.forums enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_post_images enable row level security;
alter table public.forum_reports enable row level security;

commit;
