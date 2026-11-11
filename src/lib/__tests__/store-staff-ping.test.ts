import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
  The staff role is pinged for a member's order only while that member has no
  other order waiting for a staff decision. store.ts is a server action and
  orders.ts is "server-only", so both are checked from their source.
*/

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
/** Source with comments removed, so an assertion cannot be met by prose. */
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");

function exported(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `${name} not found`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("the role is pinged only when the member has no order waiting on staff", () => {
  const submit = exported(code("../actions/store.ts"), "submitStoreRequest");

  assert.match(
    submit,
    /const alreadyWaiting = staffRoleId\s*\? await hasOrderAwaitingStaff\(\{ userId: await getSessionUserId\(\), discordId: discord\.id \}\)\s*: false;/,
  );
  assert.match(submit, /const pingRoleId = staffRoleId && !alreadyWaiting \? staffRoleId : null;/);
  assert.match(submit, /const mention = pingRoleId \? `<@&\$\{pingRoleId\}>` : undefined;/);
  // Discord is told to ping exactly the role it mentions, and nothing otherwise.
  assert.match(submit, /allowed_mentions: pingRoleId \? \{ roles: \[pingRoleId\] \} : \{ parse: \[\] \},/);
  assert.doesNotMatch(submit, /roles: \[staffRoleId\]/);
  assert.doesNotMatch(submit, /`<@&\$\{staffRoleId\}>`/);

  // The Discord id is the verified session one, and the check runs before the message is sent.
  assert.ok(submit.indexOf("hasOrderAwaitingStaff(") > submit.indexOf("getDiscordIdentity()"));
  assert.ok(submit.indexOf("hasOrderAwaitingStaff(") < submit.indexOf("sendBotChannelMessage("));
});

test("an unpinged request is still posted with its buttons and its embed unchanged", () => {
  const submit = exported(code("../actions/store.ts"), "submitStoreRequest");
  // The ping only changes `content` and `allowed_mentions`: the same payload goes
  // to the bot and the webhook whether or not the role was pinged.
  assert.match(submit, /const basePayload = \{\s*content: mention,\s*allowed_mentions: [^\n]+\n\s*embeds: \[embed\],\s*\};/);
  assert.match(submit, /sendBotChannelMessage\(botConfig, \{ \.\.\.basePayload, components \}\)/);
  assert.match(submit, /body: JSON\.stringify\(\{ \.\.\.basePayload, username: "Mazora Store" \}\)/);
  assert.doesNotMatch(submit, /alreadyWaiting\s*\)?\s*return/);
  // The interactions route reads these fields back by name.
  assert.match(submit, /\{ name: "Order total", value: usd\(total\), inline: true \}/);
  assert.match(submit, /custom_id: `mzo:confirm:\$\{discord\.id\}:\$\{reference\}`/);
  assert.match(submit, /custom_id: `mzo:reject:\$\{discord\.id\}:\$\{reference\}`/);
});

test("only a pending order of the same account or Discord id counts, and a failure pings", () => {
  const orders = code("../data/orders.ts");
  const waiting = exported(orders, "hasOrderAwaitingStaff");

  assert.match(waiting, /if \(!db \|\| !owner\.discordId\) return false;/);
  assert.match(
    waiting,
    /const ownedBy = owner\.userId\s*\? or\(eq\(schema\.orders\.userId, owner\.userId\), eq\(schema\.orders\.discordId, owner\.discordId\)\)\s*: eq\(schema\.orders\.discordId, owner\.discordId\);/,
  );
  assert.match(waiting, /\.where\(and\(eq\(schema\.orders\.status, "pending"\), ownedBy\)\)\s*\.limit\(1\);/);
  // Confirmed-but-parked orders wait on the buyer, not on staff.
  assert.doesNotMatch(waiting, /awaiting_discord_join|confirmed/);
  // A lookup failure must not silence the ping for a real first order.
  assert.match(waiting, /catch \(error\) \{[^}]*return false;\s*\}/);
});
