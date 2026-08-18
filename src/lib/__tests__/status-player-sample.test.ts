import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parsePlayerSample } from "@/lib/data/status";

describe("parsePlayerSample", () => {
  test("reads the mcsrvstat v3 shape", () => {
    const list = parsePlayerSample({
      online: 2,
      max: 100,
      list: [
        { name: "Sanda_10", uuid: "12ddaafc-dfa1-31ba-92a5-a57bf4368eb7" },
        { name: "ThArukaxp", uuid: "2d697456-42d9-35a7-acf9-1f9f846c70f4" },
      ],
    });
    assert.deepEqual(list, [
      { name: "Sanda_10", uuid: "12ddaafc-dfa1-31ba-92a5-a57bf4368eb7" },
      { name: "ThArukaxp", uuid: "2d697456-42d9-35a7-acf9-1f9f846c70f4" },
    ]);
  });

  test("prefers name_clean over the raw name in the mcstatus.io shape", () => {
    const list = parsePlayerSample({
      list: [
        {
          uuid: "8603c15a-a9d1-30b1-9342-510ea4270964",
          name_raw: "\u00a7bOshSparky",
          name_clean: "OshSparky",
          name_html: "<span>OshSparky</span>",
        },
      ],
    });
    assert.deepEqual(list, [{ name: "OshSparky", uuid: "8603c15a-a9d1-30b1-9342-510ea4270964" }]);
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
    const list = parsePlayerSample({ list: [{ name: "\u00a7a\u00a7lShadow_1021", uuid: "d" }] });
    assert.deepEqual(list, [{ name: "Shadow_1021", uuid: "d" }]);
  });

  test("falls back to the username when a sample entry has no uuid", () => {
    const list = parsePlayerSample({ list: [{ name: "CutiePlums" }] });
    assert.deepEqual(list, [{ name: "CutiePlums", uuid: "CutiePlums" }]);
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
