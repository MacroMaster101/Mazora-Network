import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildDirectory } from "@/lib/data/directory-merge";

const member = (username: string, rawSkinUrl: string | null = null) => ({
  username,
  headUrl: null,
  rawSkinUrl,
  linkedAt: "2026-01-01T00:00:00.000Z",
});

describe("buildDirectory", () => {
  test("marks a player in the ping sample as online", () => {
    const list = buildDirectory({
      online: [{ name: "Sanda_10", uuid: "u1" }],
      players: [],
      members: [],
    });
    assert.equal(list.length, 1);
    assert.equal(list[0].username, "Sanda_10");
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
    const list = buildDirectory({ online: [{ name: "Sanda_10", uuid: "u1" }], players: [], members: [] });
    assert.equal(list[0].stats, undefined);
  });

  test("carries statistics through when a database row does exist", () => {
    const list = buildDirectory({
      online: [],
      players: [
        {
          username: "Sanda_10",
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
});
