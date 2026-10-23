import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildDirectory, publicDirectoryAccounts, type DirectoryAccountSource } from "@/lib/data/directory-merge";
import { isEmailDerivedUsername, publicUsername, siteUsername } from "@/lib/auth/placeholder";

const member = (username: string, rawSkinUrl: string | null = null) => ({
  username,
  headUrl: null,
  rawSkinUrl,
  linkedAt: "2026-01-01T00:00:00.000Z",
});

describe("buildDirectory", () => {
  test("marks a player in the ping sample as online", () => {
    const list = buildDirectory({
      online: [{ name: "Steve_42", uuid: "u1" }],
      players: [],
      members: [],
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].username, "Steve_42");
    assert.equal(list[0].online, true);
    assert.equal(list[0].membership, "server");
  });

  test("classifies a linked account as a member even when offline", () => {
    const list = buildDirectory({ online: [], players: [], members: [member("Kade")] });
    assert.equal(list[0].membership, "member");
    assert.equal(list[0].online, false);
  });

  test("merges one player across sources instead of listing them twice", () => {
    const list = buildDirectory({
      online: [{ name: "kade", uuid: "u1" }],
      players: [],
      members: [member("Kade")],
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].membership, "member");
    assert.equal(list[0].online, true);
    // The member's own spelling wins: it is the name they typed and own.
    assert.equal(list[0].username, "Kade");
  });

  test("uses an uploaded skin for a member who has one", () => {
    const list = buildDirectory({
      online: [],
      players: [],
      members: [member("Kade", "https://project.supabase.co/storage/v1/object/public/a/raw.png")],
    });
    assert.equal(list[0].skin.source, "uploaded");
  });

  test("does not invent statistics when no database row exists", () => {
    const list = buildDirectory({ online: [{ name: "Steve_42", uuid: "u1" }], players: [], members: [] });
    assert.equal(list[0].stats, undefined);
  });

  test("carries statistics through when a database row does exist", () => {
    const list = buildDirectory({
      online: [],
      players: [
        {
          username: "Steve_42",
          playtimeSeconds: 3600,
          playtimeTracked: true,
          balance: 25,
          balanceTracked: true,
          status: "offline",
          firstJoined: "2026-02-02T00:00:00.000Z",
          lastSeen: "2026-03-03T00:00:00.000Z",
        },
      ],
      members: [],
    });
    assert.deepEqual(list[0].stats, { playtimeSeconds: 3600, balance: 25 });
    assert.equal(list[0].firstJoined, "2026-02-02T00:00:00.000Z");
  });

  test("sorts online players first, then members, then alphabetically", () => {
    const list = buildDirectory({
      online: [{ name: "zoe", uuid: "u1" }],
      players: [],
      members: [member("Adam"), member("Bea")],
    });
    assert.deepEqual(
      list.map((p) => p.username),
      ["zoe", "Adam", "Bea"],
    );
  });

  test("a skin kept only as a profile picture draws its body from the raw file uploaded with it", () => {
    const head =
      "https://project.example.com/storage/v1/object/public/profile-avatars/00000000-0000-4000-8000-000000000001/skin-head-1700000000000.png";
    const list = buildDirectory({
      online: [],
      players: [],
      members: [],
      accounts: [{ username: "Alex_Builder", minecraftUsername: null, role: "member", avatarUrl: head }],
    });
    assert.equal(list[0].skin.source, "uploaded");
    assert.equal(list[0].skin.headUrl, head);
    assert.equal(list[0].skin.bodyUrl, "/api/minecraft/skin/Alex_Builder/body?v=1700000000000");
  });
});

describe("publicDirectoryAccounts", () => {
  const account = (overrides: Partial<DirectoryAccountSource> = {}): DirectoryAccountSource => ({
    userId: "00000000-0000-3000-8000-000000000001",
    username: "Alex_Builder",
    email: "alex@example.com",
    minecraftUsername: null,
    minecraftSkinUrl: null,
    role: "member",
    avatarUrl: null,
    pendingInvite: false,
    accountStatus: "active",
    ...overrides,
  });

  test("lists only active accounts: no unconfirmed, suspended, deleted or unused invitations", () => {
    const listed = publicDirectoryAccounts([
      account({ username: "Active_One" }),
      account({ username: "Unconfirmed", accountStatus: "pending" }),
      account({ username: "Suspended", accountStatus: "suspended" }),
      account({ username: "Deleted", accountStatus: "deleted" }),
      account({ username: "NoProfile", accountStatus: null }),
      account({ username: "Invited", pendingInvite: true }),
    ]);
    assert.deepEqual(listed.map((entry) => entry.username), ["Active_One"]);
  });

  test("never shows the internal Web Dev rank", () => {
    const [listed] = publicDirectoryAccounts([account({ role: "web_dev" })]);
    assert.equal(listed.role, "member");
    const [staff] = publicDirectoryAccounts([account({ role: "admin" })]);
    assert.equal(staff.role, "admin", "real ranks still show");
  });

  test("an email handle is replaced with the account's placeholder", () => {
    const [handle] = publicDirectoryAccounts([account({ username: "alex.smith", email: "alex.smith@example.com" })]);
    assert.equal(handle.username, "player_00000000");
    const [chosen] = publicDirectoryAccounts([account({ username: "Alex_Builder", email: "alex.smith@example.com" })]);
    assert.equal(chosen.username, "Alex_Builder");
  });

  test("only the fields the list shows leave this function", () => {
    const [listed] = publicDirectoryAccounts([account()]);
    assert.deepEqual(Object.keys(listed).sort(), ["avatarUrl", "minecraftSkinUrl", "minecraftUsername", "role", "username"]);
  });

  test("the public list built from them carries no unlisted account", () => {
    const list = buildDirectory({
      online: [],
      players: [],
      members: [],
      accounts: publicDirectoryAccounts([account({ username: "Shown" }), account({ username: "Hidden", accountStatus: "suspended" })]),
    });
    assert.deepEqual(list.map((entry) => entry.username), ["Shown"]);
  });
});

describe("isEmailDerivedUsername", () => {
  const id = "abcdef01-0000-3000-8000-000000000001";

  test("matches the raw handle, the stored sanitised one and its uniqueness suffixes", () => {
    assert.equal(isEmailDerivedUsername("alex.smith", "alex.smith@example.com", id), true, "the raw local part");
    assert.equal(isEmailDerivedUsername("alexsmith", "alex.smith@example.com", id), true, "derive_username's sanitised form");
    assert.equal(isEmailDerivedUsername("ALEXSMITH", "alex.smith@example.com", id), true, "case does not matter");
    assert.equal(isEmailDerivedUsername("alexsmith_abcdef01", "alex.smith@example.com", id), true, "unique_username's first suffix");
    assert.equal(isEmailDerivedUsername("alexsmit_abcdef010000", "alex.smith@example.com", id), true, "unique_username's second suffix");
  });

  test("matches a long handle cut to 24 characters before 076 and to 16 after it", () => {
    const email = "alexander.builder.example@example.com";
    assert.equal(isEmailDerivedUsername("alexanderbuilderexample", email, id), true, "24-character cap");
    assert.equal(isEmailDerivedUsername("alexanderbuilder", email, id), true, "16-character cap");
    assert.equal(isEmailDerivedUsername("alexanderbuilde", email, id), false, "a shorter cut is a different name");
  });

  test("leaves a chosen name, and the placeholder, alone", () => {
    assert.equal(isEmailDerivedUsername("Steve_42", "alex.smith@example.com", id), false);
    assert.equal(isEmailDerivedUsername("player_abcdef01", "alex.smith@example.com", id), false);
    assert.equal(isEmailDerivedUsername("alexsmith", "", id), false, "no email, nothing to compare");
    assert.equal(publicUsername({ username: "Steve_42", email: "steve_42@example.com", userId: id }), "player_abcdef01", "a name equal to the handle reads as derived");
  });
});

describe("siteUsername", () => {
  const userId = "abcdef01-0000-3000-8000-000000000001";
  const email = "alex.smith@example.com";

  test("keeps the player_ placeholder instead of swapping in the email handle", () => {
    assert.equal(siteUsername({ profileUsername: "player_abcdef01", metadataUsername: undefined, email, userId }), "player_abcdef01");
    assert.equal(
      siteUsername({ profileUsername: "player_abcdef01", metadataUsername: "alex.smith", email, userId }),
      "player_abcdef01",
      "an old invite's copied handle does not win either",
    );
  });

  test("a chosen profile username wins over metadata", () => {
    assert.equal(siteUsername({ profileUsername: "Alex_Builder", metadataUsername: "Steve_42", email, userId }), "Alex_Builder");
  });

  test("without a profile row: a metadata name of its own, else the placeholder, never the email", () => {
    assert.equal(siteUsername({ profileUsername: null, metadataUsername: "Steve_42", email, userId }), "Steve_42");
    assert.equal(siteUsername({ profileUsername: null, metadataUsername: "alex.smith", email, userId }), "player_abcdef01");
    assert.equal(siteUsername({ profileUsername: null, metadataUsername: undefined, email, userId }), "player_abcdef01");
    assert.equal(siteUsername({ profileUsername: "  ", metadataUsername: 42, email: null, userId: null }), "player");
  });
});
