import assert from "node:assert/strict";
import test from "node:test";
import { databaseConnectionErrorCode } from "@/lib/db/errors";

test("finds a transient database code through wrapped causes", () => {
  const error = new Error("query failed", { cause: Object.assign(new Error("connect failed"), { code: "CONNECT_TIMEOUT" }) });
  assert.equal(databaseConnectionErrorCode(error), "CONNECT_TIMEOUT");
});

test("recognises the network failures a database connection can surface", () => {
  assert.equal(databaseConnectionErrorCode({ code: "ECONNRESET" }), "ECONNRESET");
  assert.equal(databaseConnectionErrorCode({ code: "EAI_AGAIN" }), "EAI_AGAIN");
});

test("does not hide query or schema errors", () => {
  assert.equal(databaseConnectionErrorCode({ code: "42703" }), null);
  assert.equal(databaseConnectionErrorCode(new Error("column does not exist")), null);
});
