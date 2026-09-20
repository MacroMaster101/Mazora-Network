import assert from "node:assert/strict";
import test from "node:test";

import {
  databaseUrlForRuntime,
  isTransactionPoolerUrl,
} from "@/lib/db/connection-url";

const transactionPoolerUrl =
  "postgres://postgres.project:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres";

test("uses the Supabase session pooler during local development", () => {
  assert.equal(
    databaseUrlForRuntime(transactionPoolerUrl, "development"),
    "postgres://postgres.project:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  );
});

test("keeps transaction pooling in production", () => {
  assert.equal(
    databaseUrlForRuntime(transactionPoolerUrl, "production"),
    transactionPoolerUrl,
  );
});

test("does not rewrite unrelated database hosts", () => {
  const url = "postgres://postgres:secret@localhost:6543/postgres";
  assert.equal(databaseUrlForRuntime(url, "development"), url);
});

test("recognizes Supabase transaction-pooler URLs", () => {
  assert.equal(isTransactionPoolerUrl(transactionPoolerUrl), true);
  assert.equal(
    isTransactionPoolerUrl(transactionPoolerUrl.replace(":6543", ":5432")),
    false,
  );
});
