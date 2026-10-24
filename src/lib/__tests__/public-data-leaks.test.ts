import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { beforeEach, describe } from "node:test";

import { BUILTIN_ROLES, setRoleCatalog } from "@/lib/auth/role-catalog-core";
import * as merge from "@/lib/data/directory-merge";
import type { LinkedAccount } from "@/lib/data/minecraft-accounts";
import type { PublicRosterAccount } from "@/lib/data/directory-merge";
import type { DirectoryPlayer, Player } from "@/lib/types";
import { loadServerModule } from "./helpers/server-module";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const between = (source: string, start: string, end?: string) =>
  source.slice(source.indexOf(start), end ? source.indexOf(end, source.indexOf(start)) : undefined);

beforeEach(() => setRoleCatalog(BUILTIN_ROLES));

const USER_1 = "00000000-0000-3000-8000-000000000001";
const USER_2 = "00000000-0000-3000-8000-000000000002";
const USER_3 = "00000000-0000-3000-8000-000000000003";
const DISCORD_ID = "111111111111111111";
const DISCORD_PHOTO = `https://cdn.discordapp.com/avatars/${DISCORD_ID}/abcdef0123456789.png`;
const GOOGLE_PHOTO = "https://lh3.googleusercontent.com/a/example-photo";
const MC_HEAD = "https://mc-heads.net/avatar/Steve_42/64";
const UPLOADED_HEAD = `https://project.example.com/storage/v1/object/public/profile-avatars/${USER_1}/skin-head-1700000000000.png`;

const account = (overrides: Partial<merge.AccountInfo> = {}): merge.AccountInfo => ({
  username: "Steve_42",
  minecraftUsername: null,
  minecraftSkinUrl: null,
  role: "member",
  avatarUrl: null,
  ...overrides,
});

/* ------------------------------------------- provider photos stay private */

describe("directory site avatars", () => {
  const avatarOf = (avatarUrl: string | null) =>
    merge.buildDirectory({ online: [], players: [], members: [], accounts: [account({ avatarUrl })] })[0].siteAvatarUrl;

  test("a Discord or Google photo is not handed to the browser", () => {
    assert.equal(avatarOf(DISCORD_PHOTO), null);
    assert.equal(avatarOf(GOOGLE_PHOTO), null);
    const list = merge.buildDirectory({
      online: [],
      players: [],
      members: [],
      accounts: [account({ avatarUrl: DISCORD_PHOTO, minecraftUsername: "Alex_Builder" })],
    });
    assert.equal(JSON.stringify(list).includes(DISCORD_ID), false);
  });

  test("a Minecraft head, the one kind the card draws, is kept", () => {
    assert.equal(avatarOf(MC_HEAD), MC_HEAD);
    assert.equal(avatarOf(UPLOADED_HEAD), UPLOADED_HEAD);
    assert.equal(avatarOf(null), null);
  });

  test("the player card still only draws a Minecraft head", () => {
    const slot = read("../../components/shared/player-slot.tsx");
    assert.match(slot, /isMinecraftAvatarUrl\(player\.siteAvatarUrl\) \? player\.siteAvatarUrl : null/);
  });
});

/* ------------------------------------------------------- the vote board */

describe("vote board names", () => {
  test("the linked Minecraft name wins", () => {
    assert.equal(
      merge.publicVoterName({ userId: USER_1, minecraftUsername: "Alex_Builder", profileUsername: "Steve_42", email: "steve@example.com" }),
      "Alex_Builder",
    );
  });

  test("a chosen site name is shown, an email handle never is", () => {
    assert.equal(merge.publicVoterName({ userId: USER_1, minecraftUsername: null, profileUsername: "Steve_42", email: "steve@example.com" }), "Steve_42");
    const handle = merge.publicVoterName({ userId: USER_1, minecraftUsername: null, profileUsername: "steve.example", email: "steve.example@example.com" });
    assert.equal(handle, `player_${USER_1.slice(0, 8)}`);
    assert.equal(merge.publicVoterName({ userId: USER_2, minecraftUsername: null, profileUsername: null, email: null }), `player_${USER_2.slice(0, 8)}`);
  });

  test("only active accounts are read, and the email is not returned", () => {
    const voters = between(read("../data/content.ts"), "export async function getTopVoters", "/* ----");
    assert.match(voters, /\.innerJoin\(schema\.profiles, and\(\s*eq\(schema\.voteHistory\.userId, schema\.profiles\.userId\),\s*eq\(schema\.profiles\.accountStatus, "active"\),/);
    assert.doesNotMatch(voters, /leftJoin\(schema\.profiles/);
    assert.match(voters, /return rows\.map\(\(\{ userId, minecraftUsername, profileUsername, email, \.\.\.votes \}\) => \(\{\s*username: publicVoterName\(/);
  });
});

/* ----------------------------------------------------------- news bylines */

describe("news listings", () => {
  const content = read("../data/content.ts");
  const list = between(content, "async function loadNews", "export const getArticle");

  test("the listing byline never names the Web Dev rank", () => {
    assert.match(list, /bylineRole\(normalizeRoleKey\(liveProfile\.role\)\)/);
    assert.doesNotMatch(list, /\broleLabel\(normalizeRoleKey/);
    assert.match(list, /publicRoleLabel\(row\.author_role \?\? null\) \?\? publicRoleLabel\(row\.discord_author_role \?\? null\) \?\? "News Publisher"/);
    assert.match(content, /publicRoleLabel\(row\.authorRole\) \?\? publicRoleLabel\(row\.discordAuthorRole\) \?\? "News Publisher"/);
  });

  test("the listing carries no article text and reads named columns", () => {
    assert.match(list, /\.select\(NEWS_LIST_COLUMNS\)/);
    assert.doesNotMatch(list, /\.select\("\*"\)/);
    assert.match(list, /body: \[\],/);
    assert.match(list, /\}, \{ withBody: false \}\);/);
    // The article page keeps its body: getArticle uses the default.
    assert.doesNotMatch(between(content, "async function loadArticle", "export const getRelatedArticles"), /withBody/);
  });

  test("the patch-note fallback keeps the embargo and drops the internal rank", () => {
    const patches = read("../data/patches.ts");
    const fallback = between(patches, "// Check database if Discord sync is stored");
    assert.match(fallback, /or\(isNull\(schema\.newsArticles\.publishedAt\), lte\(schema\.newsArticles\.publishedAt, new Date\(\)\)\)/);
    assert.match(fallback, /authorRole: publicRoleLabel\(r\.authorRole\) \?\? publicRoleLabel\(r\.discordAuthorRole\) \?\? "Owner",/);
  });
});

/* ------------------------------------------------- active accounts only */

describe("skins and links of inactive accounts", () => {
  test("skin lookups only read active accounts", () => {
    const source = read("../data/minecraft-accounts.ts");
    for (const fn of ["export async function getLinkedAccount", "export async function getLinkedSkin", "export async function getUploadedSkin"]) {
      const body = between(source, fn, "\n}\n");
      assert.match(body, /eq\(schema\.profiles\.accountStatus, "active"\)/, fn);
    }
  });

  test("the synced player list only takes custom heads from active accounts and keeps unlinked players", () => {
    const players = read("../data/players.ts");
    assert.match(players, /\.leftJoin\(\s*schema\.minecraftAccounts,/);
    assert.match(players, /exists \(select 1 from \$\{schema\.profiles\} where \$\{schema\.profiles\.userId\} = \$\{schema\.minecraftAccounts\.userId\} and \$\{schema\.profiles\.accountStatus\} = 'active'\)/);
  });
});

/* ------------------------------------------------------------- team page */

test("the team count is the members the page shows", () => {
  const page = read("../../app/(site)/staff/page.tsx");
  assert.match(page, /const teamCount = groups\.reduce\(\(total, group\) => total \+ group\.members\.length, 0\);/);
  assert.doesNotMatch(page, /members\?\.length/);
});

/* ---------------------------------------------------------- bounded reads */

test("event registrants are read with a bound that fits every real event", () => {
  const registrations = read("../data/event-registrations.ts");
  assert.match(registrations, /export const MAX_EVENT_REGISTRANTS = 5000;/);
  assert.match(between(registrations, "export async function getEventRegistrants", "\n}\n"), /\.limit\(MAX_EVENT_REGISTRANTS\);/);
  assert.match(read("../actions/events-admin.ts"), /maxParticipants: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(5000\)/);
});

describe("player detail", () => {
  test("looks up one player instead of rebuilding the directory", () => {
    const detail = read("../data/player-detail.ts");
    assert.match(detail, /const player = await getDirectoryPlayer\(username\);/);
    assert.doesNotMatch(detail, /getDirectory\(\)/);
  });

  const head = (name: string) => `https://project.example.com/storage/v1/object/public/profile-avatars/${USER_1}/skin-head-${name}.png`;
  const playerRow = (username: string): Player =>
    ({
      username,
      playtimeSeconds: 3600,
      playtimeTracked: true,
      balance: 12.5,
      balanceTracked: true,
      status: "offline",
      firstJoined: "2026-01-01T00:00:00.000Z",
      lastSeen: "2026-01-02T00:00:00.000Z",
    }) as Player;
  const online = [{ name: "steve_42", uuid: "u1" }, { name: "Example_Player", uuid: "u2" }];
  const players = [playerRow("Steve_42"), playerRow("Notch_Example")];
  const members: LinkedAccount[] = [
    { username: "Steve_42", headUrl: head("1"), rawSkinUrl: null, linkedAt: "2026-01-01T00:00:00.000Z" },
  ];
  const roster: PublicRosterAccount[] = [
    { userId: USER_1, username: "SteveSite", role: "member", minecraftUsername: "Steve_42", minecraftSkinUrl: head("1"), avatarUrl: DISCORD_PHOTO, publicStaffVisible: true },
    { userId: USER_2, username: "StaffAlex", role: "web_dev", minecraftUsername: null, minecraftSkinUrl: null, avatarUrl: MC_HEAD, publicStaffVisible: true },
    { userId: USER_3, username: "Example_Player", role: "moderator", minecraftUsername: null, minecraftSkinUrl: null, avatarUrl: GOOGLE_PHOTO, publicStaffVisible: true },
  ];
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  const directory = loadServerModule<typeof import("@/lib/data/directory")>(new URL("../data/directory.ts", import.meta.url), {
    mocks: {
      "@/lib/data/status": { getServerStatus: async () => ({ playerList: online }) },
      "@/lib/data/players": {
        getPlayers: async () => players,
        getPlayerRows: async (name: string) => players.filter((row) => same(row.username, name)),
      },
      "@/lib/data/minecraft-accounts": {
        listLinkedAccounts: async () => members,
        getLinkedAccount: async (name: string) => members.find((row) => same(row.username, name)) ?? null,
      },
      "@/lib/data/accounts": { listAccounts: async () => [], listPublicRoster: async () => roster },
      "@/lib/data/directory-merge": merge,
    },
  });
  const plain = (value: DirectoryPlayer | null | undefined) => JSON.parse(JSON.stringify(value ?? null));

  test("gives exactly the entry the full directory lists, for every name and any case", async () => {
    const full = await directory.getDirectory();
    assert.ok(full.length >= 4);
    for (const entry of full) {
      assert.deepEqual(plain(await directory.getDirectoryPlayer(entry.username)), plain(entry), entry.username);
      assert.deepEqual(plain(await directory.getDirectoryPlayer(entry.username.toUpperCase())), plain(entry), entry.username);
    }
    assert.equal(await directory.getDirectoryPlayer("Nobody_Here"), null);
  });

  test("the detail entry carries no provider photo and no internal rank", async () => {
    const steve = await directory.getDirectoryPlayer("Steve_42");
    assert.equal(steve?.siteAvatarUrl, null);
    assert.equal(JSON.stringify(steve).includes(DISCORD_ID), false);
    const alex = await directory.getDirectoryPlayer("StaffAlex");
    assert.equal(alex?.role, "member");
    assert.equal(alex?.siteAvatarUrl, MC_HEAD);
  });
});
