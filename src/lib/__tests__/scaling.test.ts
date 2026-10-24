import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { uuidArrayLiteral } from "@/lib/validation/id";
import { checkEnvironment } from "@/lib/env";
import { withQueueDeadline, type QueueableQuery } from "@/lib/db/queue-deadline";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const UUID_A = "00000000-0000-3000-8000-000000000001";
const UUID_B = "00000000-0000-3000-8000-000000000002";

describe("uuidArrayLiteral", () => {
  test("builds one Postgres array literal from valid ids", () => {
    assert.equal(uuidArrayLiteral([UUID_A, UUID_B]), `{${UUID_A},${UUID_B}}`);
  });

  test("drops anything that is not a UUID, so nothing else reaches the cast", () => {
    assert.equal(uuidArrayLiteral([UUID_A, "Steve_42", "x},{y", "", null, 42, undefined]), `{${UUID_A}}`);
  });

  test("lowercases and dedupes", () => {
    assert.equal(uuidArrayLiteral([UUID_A, UUID_A.toUpperCase(), UUID_A]), `{${UUID_A}}`);
  });

  test("an empty list is an empty array, which matches nothing", () => {
    assert.equal(uuidArrayLiteral([]), "{}");
  });
});

describe("checkEnvironment", () => {
  const complete = {
    NEXT_PUBLIC_SITE_URL: "https://example.com",
    DATABASE_URL: "postgresql://user:pass@db.example.com:6543/postgres",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.example.com",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-example",
    SUPABASE_SECRET_KEY: "secret-example",
    CRON_SECRET: "cron-secret-example-0000",
    MFA_RECOVERY_PEPPER: "pepper-example-000000",
  };

  test("a complete production environment has no problems", () => {
    assert.deepEqual(checkEnvironment(complete, { production: true }), []);
  });

  test("names missing required variables in production only", () => {
    const problems = checkEnvironment({}, { production: true });
    for (const name of ["NEXT_PUBLIC_SITE_URL", "DATABASE_URL", "CRON_SECRET", "MFA_RECOVERY_PEPPER"]) {
      assert.ok(problems.some((line) => line.startsWith(name)), `${name} reported`);
    }
    assert.ok(problems.some((line) => line.includes("SUPABASE_SECRET_KEY")), "one-of group reported");
    assert.deepEqual(checkEnvironment({}, { production: false }), []);
  });

  test("either Supabase key name satisfies its group", () => {
    const legacy = { ...complete, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-example" };
    assert.deepEqual(checkEnvironment(legacy, { production: true }), []);
  });

  test("reports malformed values by name and never echoes the value", () => {
    const env = {
      NEXT_PUBLIC_SITE_URL: "http://example.com",
      DATABASE_URL: "mysql://example.com/db",
      DISCORD_GUILD_ID: "123",
      CRON_SECRET: "short-value-xyz",
      TRUSTED_PROXY_HOPS: "9",
      AUTH_DEMO_MODE: "maybe",
    };
    const problems = checkEnvironment(env, { production: false });
    assert.equal(problems.length, 6);
    for (const [name, value] of Object.entries(env)) {
      assert.ok(problems.some((line) => line.startsWith(name)), `${name} reported`);
      assert.ok(problems.every((line) => !line.includes(value) || value.length < 4), `${name} value not echoed`);
    }
  });

  test("accepts well-formed optional values, flags in any case", () => {
    const env = { DISCORD_GUILD_ID: "111111111111111111", AUTH_DEMO_MODE: "FALSE", MAZORA_LAUNCH_MODE: "off", TRUSTED_PROXY_HOPS: "1" };
    assert.deepEqual(checkEnvironment(env, { production: false }), []);
  });

  test("the Upstash pair must be set together", () => {
    const problems = checkEnvironment({ UPSTASH_REDIS_REST_URL: "https://redis.example.com" }, { production: false });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /UPSTASH_REDIS_REST_TOKEN/);
  });

  test("demo auth is refused in production", () => {
    const problems = checkEnvironment({ ...complete, AUTH_DEMO_MODE: "true" }, { production: true });
    assert.ok(problems.some((line) => line.includes("AUTH_DEMO_MODE")));
    assert.deepEqual(checkEnvironment({ AUTH_DEMO_MODE: "true" }, { production: false }), []);
  });
});

describe("withQueueDeadline", () => {
  type FakeQuery = QueueableQuery & { cancelled: number; settle: (value: unknown) => void; fail: (error: unknown) => void };

  function fakeQuery(): FakeQuery {
    let settle!: (value: unknown) => void;
    let fail!: (error: unknown) => void;
    const promise = new Promise((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
    const query = {
      cancelled: 0,
      state: undefined as unknown,
      settle,
      fail,
      cancel() {
        query.cancelled += 1;
      },
      then: promise.then.bind(promise) as PromiseLike<unknown>["then"],
    };
    return query;
  }

  function client(query: FakeQuery) {
    return { unsafe: (..._args: never[]) => query, other: "kept" };
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  test("returns the very same query object and passes other properties through", () => {
    const query = fakeQuery();
    const wrapped = withQueueDeadline(client(query), 50);
    assert.equal(wrapped.unsafe(), query);
    assert.equal(wrapped.other, "kept");
    query.settle(1);
  });

  test("cancels a query that is still queued at the deadline", async () => {
    const query = fakeQuery();
    withQueueDeadline(client(query), 10).unsafe();
    await wait(30);
    assert.equal(query.cancelled, 1);
  });

  test("never cancels a query a connection has taken", async () => {
    const query = fakeQuery();
    withQueueDeadline(client(query), 10).unsafe();
    query.state = { running: true };
    await wait(30);
    assert.equal(query.cancelled, 0);
  });

  test("clears the timer once the query settles, either way", async () => {
    const done = fakeQuery();
    const pending = withQueueDeadline(client(done), 20).unsafe().then((value) => value);
    done.settle("rows");
    assert.equal(await pending, "rows");

    const failed = fakeQuery();
    const rejected = withQueueDeadline(client(failed), 20).unsafe().then(undefined, (error) => `caught ${String(error)}`);
    failed.fail("boom");
    assert.equal(await rejected, "caught boom");

    await wait(40);
    assert.equal(done.cancelled, 0);
    assert.equal(failed.cancelled, 0);
  });

  test("the database client is built through it", () => {
    const source = read("../db/client.ts");
    assert.match(source, /drizzle\(withQueueDeadline\(sql, QUEUE_DEADLINE_MS\)/);
  });
});

describe("scaling: queries", () => {
  test("provider avatars send the ids as one uuid[] parameter, not a text cast of the column", () => {
    const source = read("../data/provider-avatars.ts");
    assert.match(source, /where id = any\(\$\{uuidArrayLiteral\(ids\)\}::uuid\[\]\)/);
    assert.doesNotMatch(source, /where id::text in/);
  });

  test("a broadcast inserts every recipient in one statement inside a transaction", () => {
    const source = read("../actions/notifications.ts");
    const tx = source.slice(source.indexOf("await db.transaction("));
    assert.ok(tx.length > 0, "broadcast runs in a transaction");
    assert.match(tx, /from unnest\(\$\{uuidArrayLiteral\(/);
    assert.match(source, /listAccountRoles\(\)/);
  });

  test("forum topics read their stats in one query, without a grouped join, and the board is cached", () => {
    const source = read("../data/forums.ts");
    const topics = source.slice(source.indexOf("export async function getTopics"));
    const body = topics.slice(0, topics.indexOf("\n}\n"));
    assert.doesNotMatch(body, /\.groupBy\(/);
    assert.match(body, /topicStats\(/);
    assert.match(source, /distinct on \(topic_id\)/);
    assert.match(source, /unstable_cache\(readForumBoard, \[FORUM_BOARD_TAG\]/);
  });

  test("leaderboards are limited in SQL, not after loading every player", () => {
    const source = read("../data/players.ts");
    assert.match(source, /\.orderBy\(desc\(rankColumn\), asc\(schema\.minecraftPlayers\.username\)\)\.limit\(ranking\.limit\)/);
    assert.match(source, /readPlayers\(undefined, \{ by: key, limit: LEADERBOARD_SIZE \}\)/);
    assert.match(read("../../app/(site)/leaderboards/page.tsx"), /getLeaderboard\(/);
  });

  test("suggestions sort on the stored vote count", () => {
    assert.match(read("../data/suggestions-board.ts"), /schema\.suggestions\.votesCount/);
    assert.doesNotMatch(read("../data/suggestions-board.ts"), /votesCountSql/);
  });
});

describe("scaling: migration 083", () => {
  const migration = read("../../../supabase/migrations/083_scaling_indexes_and_vote_counts.sql");

  test("keeps votes_count with a locked-down trigger and backfills it", () => {
    assert.match(migration, /add column if not exists votes_count integer not null default 0/);
    assert.match(migration, /security definer\s+set search_path = ''/);
    assert.match(migration, /revoke all on function public\.suggestion_votes_count\(\) from public, anon, authenticated/);
    assert.match(migration, /create trigger suggestion_votes_count/);
    assert.match(migration, /greatest\(votes_count - 1, 0\)/);
    assert.match(migration, /is distinct from counted\.votes/);
  });

  test("every index is idempotent and none is built concurrently (the CLI runs it in a transaction)", () => {
    const creates = migration.match(/create index[^;]*/gi) ?? [];
    assert.ok(creates.length >= 10);
    for (const statement of creates) assert.match(statement, /^create index if not exists /i, statement);
    assert.doesNotMatch(migration.replace(/--.*$/gm, ""), /concurrently/i);
  });

  test("the schema mirrors the new column", () => {
    assert.match(read("../db/schema.ts"), /votesCount: integer\("votes_count"\)/);
  });
});

describe("scaling: caching and revalidation", () => {
  const srcRoot = fileURLToPath(new URL("../../", import.meta.url));

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
      return /\.tsx?$/.test(name) ? [path] : [];
    });
  }

  test("only the role catalog purges the whole site with revalidatePath('/', 'layout')", () => {
    const callers = sourceFiles(srcRoot)
      .filter((file) => /^\s*revalidatePath\("\/", "layout"\)/m.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(srcRoot.length).replaceAll("\\", "/"));
    assert.deepEqual(callers, ["lib/actions/role-catalog.ts"]);
  });

  test("site settings and discount alerts are cached under tags their writers revalidate", () => {
    assert.match(read("../data/site-settings.ts"), /tags: \[SITE_SETTINGS_TAG\]/);
    assert.match(read("../data/site-settings.ts"), /revalidateTag\(SITE_SETTINGS_TAG\)/);
    assert.match(read("../data/creator-codes.ts"), /tags: \[DISCOUNT_ALERTS_TAG\]/);
    assert.match(read("../actions/creator-codes.ts"), /revalidateTag\(DISCOUNT_ALERTS_TAG\)/);
    assert.match(read("../actions/store-admin.ts"), /revalidateTag\(DISCOUNT_ALERTS_TAG\)/);
    assert.match(read("../actions/forums.ts"), /revalidateTag\(FORUM_BOARD_TAG\)/);
  });

  test("drizzle-kit generates outside supabase/migrations", () => {
    const config = read("../../../drizzle.config.ts");
    assert.match(config, /out: "\.\/drizzle\/generated"/);
    assert.doesNotMatch(config, /out: "\.\/supabase\/migrations"/);
  });

  test("the database client and the store loaders cannot reach a client bundle", () => {
    for (const file of ["../db/client.ts", "../data/store-categories.ts", "../data/store-settings.ts", "../data/voting.ts"]) {
      assert.match(read(file), /^import "server-only";/, file);
    }
  });
});

describe("scaling: health and error reporting", () => {
  test("the deep health check is opt-in, bounded and rate limited", () => {
    const source = read("../../app/api/health/route.ts");
    assert.match(source, /searchParams\.get\("deep"\) !== "1"/);
    assert.match(source, /probeDatabase\(DEEP_CHECK_MS\)/);
    assert.match(source, /rateLimit\(clientKey\(request, "health-deep"\)/);
    assert.match(source, /status: ok \? 200 : 503/);
    const probe = read("../db/probe.ts");
    assert.match(probe, /db\.execute\(sql`select 1`\)/);
    assert.match(probe, /Promise\.race\(/);
  });

  test("request errors are logged by route pattern with the digest, never with headers", () => {
    const source = read("../../instrumentation.ts");
    const handler = source.slice(source.indexOf("export async function onRequestError"));
    assert.match(handler, /digest:/);
    assert.match(handler, /route: context\.routePath/);
    assert.doesNotMatch(handler, /headers|cookie/i);
    assert.doesNotMatch(handler, /request\.path/);
  });

  test("the global error page shows the incident digest", () => {
    assert.match(read("../../app/global-error.tsx"), /<GlobalErrorCard digest=\{error\.digest\}/);
    assert.match(read("../../components/shared/global-error-card.tsx"), /Incident \{digest\}/);
  });
});
