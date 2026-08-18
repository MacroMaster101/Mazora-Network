import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parsePlayerSample } from "@/lib/data/status";

describe("parsePlayerSample", () => {
  test("reads the mcsrvstat v3 shape", () => {
    const list = parsePlayerSample({
      online: 2,
      max: 100,
      list: [
        { name: "Steve_42", uuid: "00000000-0000-3000-8000-000000000001" },
        { name: "Builder_Sam", uuid: "00000000-0000-3000-8000-000000000002" },
      ],
    });
    assert.deepEqual(list, [
      { name: "Steve_42", uuid: "00000000-0000-3000-8000-000000000001" },
      { name: "Builder_Sam", uuid: "00000000-0000-3000-8000-000000000002" },
    ]);
  });

  test("prefers name_clean over the raw name in the mcstatus.io shape", () => {
    const list = parsePlayerSample({
      list: [
        {
          uuid: "00000000-0000-3000-8000-000000000003",
          name_raw: "\u00a7bCrafty_Kim",
          name_clean: "Crafty_Kim",
          name_html: "<span>Crafty_Kim</span>",
        },
      ],
    });
    assert.deepEqual(list, [{ name: "Crafty_Kim", uuid: "00000000-0000-3000-8000-000000000003" }]);
  });

  test("returns an empty list when the sample is absent, empty or not an array", () => {
    assert.deepEqual(parsePlayerSample(undefined), []);
    assert.deepEqual(parsePlayerSample({ online: 8, max: 100 }), []);
    assert.deepEqual(parsePlayerSample({ list: [] }), []);
    assert.deepEqual(parsePlayerSample({ list: "nope" } as never), []);
    assert.deepEqual(parsePlayerSample(7), []);
  });

  test("drops entries with no usable username", () => {
    const list = parsePlayerSample({
      list: [{ name: "  ", uuid: "a" }, { uuid: "b" }, { name: "Real", uuid: "c" }],
    });
    assert.deepEqual(list, [{ name: "Real", uuid: "c" }]);
  });

  test("strips legacy section-sign colour codes left in a raw name", () => {
    const list = parsePlayerSample({ list: [{ name: "\u00a7a\u00a7lPlayer_Ten", uuid: "d" }] });
    assert.deepEqual(list, [{ name: "Player_Ten", uuid: "d" }]);
  });

  test("falls back to the username when a sample entry has no uuid", () => {
    const list = parsePlayerSample({ list: [{ name: "Alex_Builder" }] });
    assert.deepEqual(list, [{ name: "Alex_Builder", uuid: "Alex_Builder" }]);
  });

  test("de-duplicates repeated usernames and caps a hostile sample", () => {
    const list = parsePlayerSample({
      list: [{ name: "Dup", uuid: "1" }, { name: "dup", uuid: "2" }],
    });
    assert.deepEqual(list, [{ name: "Dup", uuid: "1" }]);

    const huge = parsePlayerSample({
      list: Array.from({ length: 500 }, (_, i) => ({ name: `P${i}`, uuid: `${i}` })),
    });
    assert.equal(huge.length, 200);
  });
});
