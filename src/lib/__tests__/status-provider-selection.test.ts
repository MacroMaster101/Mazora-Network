import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { selectPreferredStatus } from "@/lib/data/status";

describe("selectPreferredStatus", () => {
  test("prefers a later online provider over an earlier offline response", () => {
    const first = { provider: "mcsrvstat", online: false };
    const second = { provider: "mcstatus", online: true };

    assert.equal(selectPreferredStatus([first, second]), second);
  });

  test("keeps an offline response when every reachable provider reports offline", () => {
    const first = { provider: "primary", online: false };
    const second = { provider: "secondary", online: false };

    assert.equal(selectPreferredStatus([first, second]), first);
  });

  test("ignores unreachable providers and returns null when none respond", () => {
    const online = { provider: "secondary", online: true };

    assert.equal(selectPreferredStatus([null, online]), online);
    assert.equal(selectPreferredStatus([null, null]), null);
  });
});
