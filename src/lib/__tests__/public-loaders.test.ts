import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { beforeEach, describe } from "node:test";

import * as tree from "@/lib/comments/tree";
import * as roles from "@/lib/auth/roles";
import * as schema from "@/lib/db/schema";
import { BUILTIN_ROLES, setRoleCatalog } from "@/lib/auth/role-catalog-core";
import { canDeletePost, canEditPost, canReportPost, type ForumActor } from "@/lib/forums-rules";
import { canVoteOnComment } from "@/lib/comments/vote-rules";
import { canReport } from "@/lib/report-rules";
import { viewerSubject } from "@/components/comments/types";
import { rosterDirectoryAccounts, toPublicRosterAccount, type PublicRosterSource } from "@/lib/data/directory-merge";
import { loadServerModule } from "./helpers/server-module";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

beforeEach(() => setRoleCatalog(BUILTIN_ROLES));

const USER_1 = "00000000-0000-3000-8000-000000000001";
const USER_2 = "00000000-0000-3000-8000-000000000002";

const row = (overrides: Partial<PublicRosterSource> = {}): PublicRosterSource => ({
  user_id: USER_1,
  username: "Steve_42",
  avatar_url: null,
  email: "steve@example.com",
  role: "member",
  staff_hidden: false,
  user_metadata: null,
  minecraft_username: null,
  skin_head_url: null,
  ...overrides,
});

/* ------------------------------------------------------ the public roster */

describe("public roster rows", () => {
  test("keep the chosen name, rank and Minecraft link, and drop the email", () => {
    const account = toPublicRosterAccount(
      row({ role: "moderator", minecraft_username: "Alex_Builder", skin_head_url: "https://example.com/skin-head-1.png" }),
    );
    assert.deepEqual(account, {
      userId: USER_1,
      username: "Steve_42",
      role: "moderator",
      minecraftUsername: "Alex_Builder",
      minecraftSkinUrl: "https://example.com/skin-head-1.png",
      avatarUrl: null,
      publicStaffVisible: true,
    });
    assert.equal(JSON.stringify(account).includes("steve@example.com"), false);
  });

  test("an email-handle username is replaced with the placeholder", () => {
    const account = toPublicRosterAccount(row({ username: "steve", email: "steve@example.com" }));
    assert.equal(account?.username, `player_${USER_1.slice(0, 8)}`);
  });

  test("a hidden staff flag, an unknown rank and a missing id are handled", () => {
    assert.equal(toPublicRosterAccount(row({ staff_hidden: true }))?.publicStaffVisible, false);
    assert.equal(toPublicRosterAccount(row({ role: "not-a-rank" }))?.role, "member");
    assert.equal(toPublicRosterAccount(row({ role: null }))?.role, "member");
    assert.equal(toPublicRosterAccount(row({ user_id: null })), null);
  });

  test("the chosen avatar wins, then the sign-in provider photo", () => {
    assert.equal(toPublicRosterAccount(row({ avatar_url: "https://example.com/a.png" }))?.avatarUrl, "https://example.com/a.png");
    const fromProvider = toPublicRosterAccount(row({ user_metadata: { avatar_url: "https://cdn.discordapp.com/avatars/1/a.png" } }));
    assert.equal(fromProvider?.avatarUrl, "https://cdn.discordapp.com/avatars/1/a.png");
  });

  test("the directory sees public ranks only and no account id", () => {
    const roster = [toPublicRosterAccount(row({ role: "web_dev" }))!, toPublicRosterAccount(row({ user_id: USER_2, username: "Alex_Builder", role: "owner" }))!];
    const accounts = rosterDirectoryAccounts(roster);
    assert.deepEqual(accounts.map((account) => account.role), ["member", "owner"]);
    assert.equal(JSON.stringify(accounts).includes(USER_1), false);
    assert.equal(JSON.stringify(accounts).includes(USER_2), false);
  });
});

describe("public roster loading", () => {
  const accounts = read("../data/accounts.ts");
  const directory = read("../data/directory.ts");

  test("is one cached query, not the GoTrue user list", () => {
    assert.match(accounts, /unstable_cache\(readPublicRoster, \[PUBLIC_ROSTER_TAG\], \{\s*tags: \[PUBLIC_ROSTER_TAG\],\s*revalidate: PUBLIC_ROSTER_TTL_SECONDS,/);
    assert.match(accounts, /const PUBLIC_ROSTER_TTL_SECONDS = 60;/);
    const reader = accounts.slice(accounts.indexOf("async function readPublicRoster"), accounts.indexOf("const readCachedPublicRoster"));
    assert.match(reader, /join auth\.users u on u\.id = p\.user_id/);
    assert.doesNotMatch(reader, /listAllAuthUsers|listUsers|auth\.identities/);
    // The cached function takes no arguments, so nothing viewer-specific can key or enter it.
    assert.match(reader, /async function readPublicRoster\(\): Promise<PublicRosterAccount\[\]>/);
  });

  test("the public directory uses the roster; only the staff view lists every account", () => {
    assert.match(directory, /staffView \? listAccounts\(\) : publicAccounts\(\)/);
    assert.match(directory, /const roster = await listPublicRoster\(\);/);
  });

  test("the team page gets no account id", () => {
    const type = accounts.slice(accounts.indexOf("export type PublicStaffMember"), accounts.indexOf("function toRole"));
    assert.doesNotMatch(type, /"userId"/);
    const list = accounts.slice(accounts.indexOf("export async function listPublicStaffAccounts"));
    assert.match(list, /return staff\.map\(\(\{ userId, username, role,/);
    assert.match(list, /status: presence\.get\(userId\),/);
    const page = read("../../app/(site)/staff/page.tsx");
    assert.doesNotMatch(page, /userId/);
  });

  test("the player-detail API uses the shared limiter", () => {
    const route = read("../../app/api/minecraft/players/[username]/route.ts");
    assert.match(route, /await rateLimitShared\(clientKey\(request, "player-detail"\)/);
    assert.doesNotMatch(route, /[^.]\brateLimit\(/);
  });
});

/* --------------------------------------------- no author ids on the page */

describe("ownership instead of author ids", () => {
  const member: ForumActor = { userId: USER_1, role: "member", accountStatus: "active", canModerate: false };
  const moderator: ForumActor = { userId: USER_2, role: "moderator", accountStatus: "active", canModerate: true };
  const guest: ForumActor = { userId: null, role: null, accountStatus: null, canModerate: false };
  const open = { locked: false };
  const topic = { locked: false, deletedAt: null };

  test("the viewer's own comment keeps edit and delete, and loses vote and report", () => {
    const mine = viewerSubject(true, member.userId, null);
    assert.equal(canEditPost(open, topic, mine, member), true);
    assert.equal(canDeletePost(mine, member), true);
    assert.equal(canVoteOnComment(mine, member), false);
    assert.equal(canReportPost(mine, member), false);
    assert.equal(canReport(mine, member), false);
  });

  test("someone else's comment can be voted on and reported, not edited", () => {
    const theirs = viewerSubject(false, member.userId, null);
    assert.equal(canEditPost(open, topic, theirs, member), false);
    assert.equal(canDeletePost(theirs, member), false);
    assert.equal(canVoteOnComment(theirs, member), true);
    assert.equal(canReport(theirs, member), true);
    assert.equal(canDeletePost(theirs, moderator), true, "moderators still remove");
  });

  test("a guest gets nothing, even for a comment marked as theirs", () => {
    const subject = viewerSubject(true, null, null);
    assert.equal(subject.authorId, "");
    assert.equal(canEditPost(open, topic, subject, guest), false);
    assert.equal(canDeletePost(subject, guest), false);
    assert.equal(canReport(subject, guest), false);
  });

  test("no comment, reply, thread or report target type carries an author id", () => {
    const strip = (source: string, start: string) => {
      const from = source.indexOf(start);
      return source.slice(from, source.indexOf("\n}\n", from));
    };
    const forums = read("../data/forums.ts").replace(/\r\n/g, "\n");
    const board = read("../data/suggestions-board.ts").replace(/\r\n/g, "\n");
    const view = read("../../components/comments/types.ts").replace(/\r\n/g, "\n");
    const report = read("../../components/suggestions/report-button.tsx").replace(/\r\n/g, "\n");
    for (const [source, start] of [
      [forums, "export interface ForumComment"],
      [forums, "export interface TopicHeader"],
      [board, "export interface ThreadReply"],
      [board, "export interface SuggestionThread"],
      [view, "export interface CommentView"],
      [report, "export interface ReportButtonTarget"],
    ] as const) {
      const block = strip(source, start);
      assert.ok(block.length > 0, start);
      assert.doesNotMatch(block, /authorId/, start);
      assert.match(block, /isOwn: boolean;|author: string; createdAt: string;/, start);
    }
  });

  test("the pages pass ownership flags, not ids", () => {
    const topicPage = read("../../app/(site)/forums/topic/[topicId]/page.tsx");
    assert.match(topicPage, /const subject = viewerSubject\(post\.isOwn, actor\.userId, post\.deletedAt\);/);
    assert.doesNotMatch(topicPage, /authorId/);
    for (const path of ["../../components/suggestions/thread-view.tsx", "../../components/suggestions/suggestion-comments.tsx"]) {
      assert.doesNotMatch(read(path), /authorId/, path);
    }
  });
});

/* ------------------------------------------------------- bounded reads */

describe("comment trees read only what a view shows", () => {
  const forums = loadServerModule<{
    shownCommentIds: (nodes: tree.CommentNode<tree.FlatComment>[]) => string[];
    mapCommentNodes: <T extends tree.FlatComment, U extends tree.FlatComment>(
      nodes: tree.CommentNode<T>[],
      map: (comment: T) => U,
    ) => tree.CommentNode<U>[];
  }>(new URL("../data/forums.ts", import.meta.url), {
    mocks: {
      "@/lib/db/client": { getDb: () => null, schema },
      "@/lib/forums-rules": { DELETED_AUTHOR: "[deleted]", POSTS_PER_PAGE: 20, TOPICS_PER_PAGE: 25 },
      "@/lib/auth": {},
      "@/lib/auth/permissions": {},
      "@/lib/auth/roles": roles,
      "@/lib/data/roles": { ensureRoleCatalog: async () => undefined },
      "@/lib/data/presence": {},
      "@/lib/data/provider-avatars": {},
      "@/lib/comments/tree": tree,
    },
  });

  const flat = (id: string, parentId: string | null, deletedAt: string | null = null): tree.FlatComment => ({
    id, parentId, createdAt: `2026-01-01T00:00:0${id.length % 10}.000Z`, deletedAt, up: 0, down: 0,
  });

  test("a removed comment with nothing under it is not read; deep replies stop at the visible depth", () => {
    const chain = Array.from({ length: tree.MAX_VISIBLE_DEPTH + 3 }, (_, depth) =>
      flat(`c${depth}`, depth === 0 ? null : `c${depth - 1}`),
    );
    const nodes = tree.buildCommentTree([...chain, flat("gone", null, "2026-01-02T00:00:00.000Z")], "old");
    const ids = forums.shownCommentIds(nodes);
    assert.equal(ids.includes("gone"), false);
    assert.deepEqual(ids, chain.slice(0, tree.MAX_VISIBLE_DEPTH + 1).map((comment) => comment.id));
  });

  test("mapping swaps comments without changing the tree's shape", () => {
    const nodes = tree.buildCommentTree([flat("a", null), flat("b", "a"), flat("c", "b")], "old");
    const mapped = forums.mapCommentNodes(nodes, (comment) => ({ ...comment, body: `text ${comment.id}` }));
    assert.equal(mapped[0].comment.body, "text a");
    assert.equal(mapped[0].children[0].children[0].comment.body, "text c");
    assert.equal(mapped[0].descendantCount, nodes[0].descendantCount);
  });

  test("the loaders cap the shape query and read full rows by id", () => {
    const source = read("../data/forums.ts");
    assert.match(source, /\.limit\(MAX_TOPIC_POSTS\)/);
    assert.match(source, /inArray\(schema\.forumPosts\.id, ids\)/);
    const board = read("../data/suggestions-board.ts");
    assert.match(board, /\.limit\(MAX_THREAD_REPLIES\)/);
    assert.match(board, /inArray\(schema\.suggestionReplies\.id, replyIds\)/);
  });
});

describe("other public lists are bounded", () => {
  test("the suggestions board reads one bounded view and a description preview", () => {
    const board = read("../data/suggestions-board.ts");
    assert.match(board, /export const BOARD_SUGGESTIONS_LIMIT = 100;/);
    assert.match(board, /\.limit\(limit\)\s*\.offset\(offset\)/);
    assert.match(board, /description: descriptionPreviewSql,/);
    assert.match(board, /inArray\(schema\.suggestionVotes\.suggestionId, rowIds\)/);
  });

  test("creator lists carry a LIMIT", () => {
    const creators = read("../data/content-creators.ts");
    assert.match(creators, /\.limit\(ADMIN_CREATORS_LIMIT\)/);
    assert.match(creators, /\.limit\(Math\.min\(limit \?\? PUBLIC_CREATORS_LIMIT, PUBLIC_CREATORS_LIMIT\)\)/);
  });

  test("discount alerts carry a bounded product preview", () => {
    const codes = read("../data/creator-codes.ts");
    assert.match(codes, /export const ALERT_PRODUCT_PREVIEW_LIMIT = 48;/);
    assert.match(codes, /\.slice\(0, ALERT_PRODUCT_PREVIEW_LIMIT\)\s*\.map\(toPreview\)/);
    assert.doesNotMatch(codes, /allProductsPreview/);
  });
});

/* ------------------------------------------------- links on public pages */

describe("stored links are re-checked on the way out", () => {
  test("creator socials go through isValidSocialUrl", () => {
    const creators = read("../data/content-creators.ts");
    assert.match(creators, /if \(!isValidSocialUrl\(entry\.url\)\) return \[\];/);
  });

  test("vote sites that are not https stay off /vote but not out of the editor", () => {
    const voting = read("../data/voting.ts");
    assert.match(voting, /return sites\.filter\(\(s\) => s\.enabled && isHttpsUrl\(s\.url\)\);/);
    assert.match(voting, /return toVoteSites\(rows\);/, "the editor still sees every stored site");
    assert.match(read("../data/content.ts"), /return publicVoteSites\(await getAdminVoteSites\(\)\);/);
  });
});
