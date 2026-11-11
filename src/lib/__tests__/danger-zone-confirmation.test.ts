import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../components/dashboard/danger-zone.tsx", import.meta.url), "utf8");

test("the delete button is not silently disabled by an unmatched confirmation", () => {
  // .btn has no disabled look, so a disabled button read as one that did nothing.
  assert.match(source, /data-delete-submit\s+className="[^"]*"\s+disabled=\{deletePending \|\| sendPending\}/);
  assert.doesNotMatch(source, /disabled=\{[^}]*confirmation\.toLowerCase\(\)/);
});

test("a mismatched confirmation is said under the field, and only the delete button is checked", () => {
  assert.match(source, /<form action=\{deleteAction\} onSubmit=\{checkConfirmation\}/);
  assert.match(source, /if \(!submitter\?\.hasAttribute\("data-delete-submit"\) \|\| confirmationMatches\) return;/);
  assert.match(source, /confirmation\.trim\(\)\.toLowerCase\(\) === username\.toLowerCase\(\)/);
  assert.match(source, /error=\{confirmationError \?\? deleteState\.errors\?\.confirmation\}/);
});
