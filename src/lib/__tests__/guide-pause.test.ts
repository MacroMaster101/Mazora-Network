import assert from "node:assert/strict";
import test from "node:test";
import { clearGuidePause, guidePauseKey, readGuidePause, writeGuidePause } from "@/lib/guide-pause";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

const blockedStorage = {
  getItem: (): string | null => { throw new Error("Storage disabled"); },
  setItem: () => { throw new Error("Storage disabled"); },
  removeItem: () => { throw new Error("Storage disabled"); },
};

test("a paused guide remembers the slide it was left on", () => {
  const storage = memoryStorage();
  writeGuidePause(storage, "site", "Steve", 2);
  assert.equal(readGuidePause(storage, "site", "Steve"), 2);
});

test("clearing the pause forgets it", () => {
  const storage = memoryStorage();
  writeGuidePause(storage, "site", "Steve", 2);
  clearGuidePause(storage, "site", "Steve");
  assert.equal(readGuidePause(storage, "site", "Steve"), null);
});

test("pauses are per guide and per account", () => {
  const storage = memoryStorage();
  writeGuidePause(storage, "site", "Steve", 1);
  assert.equal(readGuidePause(storage, "staff", "Steve"), null);
  assert.equal(readGuidePause(storage, "site", "Alex"), null);
  assert.equal(readGuidePause(storage, "site", "steve"), 1);
  assert.notEqual(guidePauseKey("site", "Steve"), guidePauseKey("staff", "Steve"));
});

test("anything that is not a whole, non-negative slide number reads as no pause", () => {
  for (const raw of ["-1", "1.5", "abc", "", "NaN"]) {
    assert.equal(readGuidePause(memoryStorage({ [guidePauseKey("site", "Steve")]: raw }), "site", "Steve"), null, raw);
  }
});

test("blocked or missing storage never throws and reads as no pause", () => {
  assert.equal(readGuidePause(blockedStorage, "site", "Steve"), null);
  assert.equal(readGuidePause(null, "site", "Steve"), null);
  assert.doesNotThrow(() => writeGuidePause(blockedStorage, "site", "Steve", 1));
  assert.doesNotThrow(() => clearGuidePause(blockedStorage, "site", "Steve"));
  assert.doesNotThrow(() => writeGuidePause(null, "site", "Steve", 1));
});
