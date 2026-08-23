/**
 * The staff-notice templates are pure so the admin page and the Discord slash
 * command cannot drift into wording the other does not send. The mention test
 * is the important one: a reason is operator-supplied free text delivered to a
 * Discord DM, so it must not be able to ping a role or escape the embed.
 *
 * Run with: npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_REASON_LENGTH,
  renderStaffNotice,
  SUGGESTED_REASONS,
  suggestionsFor,
  templateMentionsStaffTeam,
  validateStaffNotice,
  type StaffNoticeInput,
} from "@/lib/staff-notices";

function input(overrides: Partial<StaffNoticeInput> = {}): StaffNoticeInput {
  return { template: "terminated", username: "Kaviya", reason: "Inactive for 60 days", ...overrides };
}

describe("validateStaffNotice", () => {
  test("accepts a well-formed notice", () => {
    assert.deepEqual(validateStaffNotice(input()), { ok: true });
  });

  test("rejects an empty reason", () => {
    const result = validateStaffNotice(input({ reason: "   " }));
    assert.equal(result.ok, false);
  });

  test("rejects a reason over the length cap", () => {
    const result = validateStaffNotice(input({ reason: "x".repeat(MAX_REASON_LENGTH + 1) }));
    assert.equal(result.ok, false);
  });

  test("requires a title for the custom template", () => {
    const result = validateStaffNotice(input({ template: "custom", customTitle: "  " }));
    assert.equal(result.ok, false);
  });

  test("accepts the custom template when a title is given", () => {
    assert.deepEqual(validateStaffNotice(input({ template: "custom", customTitle: "Schedule change" })), {
      ok: true,
    });
  });
});

describe("renderStaffNotice", () => {
  test("names the recipient and carries the reason", () => {
    const payload = renderStaffNotice(input());
    const embed = (payload.embeds as Record<string, unknown>[])[0];
    assert.match(String(embed.description), /Kaviya/);
    assert.match(String(embed.description), /Inactive for 60 days/);
  });

  test("each template gets its own title and colour", () => {
    const terminated = (renderStaffNotice(input()).embeds as Record<string, unknown>[])[0];
    const promoted = (
      renderStaffNotice(input({ template: "promotion" })).embeds as Record<string, unknown>[]
    )[0];
    assert.notEqual(terminated.title, promoted.title);
    assert.notEqual(terminated.color, promoted.color);
  });

  test("the custom template uses the supplied title", () => {
    const payload = renderStaffNotice(input({ template: "custom", customTitle: "Schedule change" }));
    const embed = (payload.embeds as Record<string, unknown>[])[0];
    assert.equal(embed.title, "Schedule change");
  });

  test("suppresses every mention, so a reason cannot ping a role", () => {
    const payload = renderStaffNotice(input({ reason: "@everyone see this @here <@&123>" }));
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
  });

  test("truncates an over-long reason rather than letting Discord reject the embed", () => {
    const payload = renderStaffNotice(input({ reason: "y".repeat(5000) }));
    const embed = (payload.embeds as Record<string, unknown>[])[0];
    assert.ok(String(embed.description).length <= 4096);
  });
});

describe("templateMentionsStaffTeam", () => {
  // Drives a wording warning in the composer only. It must NOT be used to gate
  // delivery: every template may be sent to any guild member, including people
  // with no site account — promoting someone who has not linked one yet is the
  // case the old gate blocked.
  test("termination and promotion use staff-team wording", () => {
    assert.equal(templateMentionsStaffTeam("terminated"), true);
    assert.equal(templateMentionsStaffTeam("promotion"), true);
  });

  test("warning and custom do not", () => {
    assert.equal(templateMentionsStaffTeam("warning"), false);
    assert.equal(templateMentionsStaffTeam("custom"), false);
  });
});

describe("wording is scoped to the audience", () => {
  test("a staff-only template still speaks of the staff team", () => {
    const embed = (renderStaffNotice(input()).embeds as Record<string, unknown>[])[0];
    assert.match(String(embed.description), /staff team/i);
  });

  test("a warning does NOT assume the recipient is staff", () => {
    // Warnings now go to any guild member, so copy that calls the recipient a
    // staff member would be wrong for most recipients.
    const embed = (
      renderStaffNotice(input({ template: "warning" })).embeds as Record<string, unknown>[]
    )[0];
    assert.doesNotMatch(String(embed.description), /staff team/i);
  });

  test("a custom notice does not assume staff either", () => {
    const embed = (
      renderStaffNotice(input({ template: "custom", customTitle: "Heads up" }))
        .embeds as Record<string, unknown>[]
    )[0];
    assert.doesNotMatch(String(embed.description), /staff team/i);
  });
});

describe("one-way delivery is stated on every notice", () => {
  // These DMs are sent by a bot with no gateway connection: it physically
  // cannot read a reply. Without saying so, a recipient who hits reply is
  // talking to nobody — worst of all on a termination or warning, where they
  // most want to respond.
  const TEMPLATES: StaffNoticeInput["template"][] = ["terminated", "warning", "promotion", "custom"];

  for (const template of TEMPLATES) {
    test(`${template} tells the recipient replies are not read`, () => {
      const embed = (
        renderStaffNotice(input({ template, customTitle: "Heads up" })).embeds as Record<
          string,
          unknown
        >[]
      )[0];
      const text = `${embed.description}${JSON.stringify(embed.footer ?? "")}`;
      assert.match(text, /repl(y|ies)/i);
    });

    test(`${template} points at the support ticket channel`, () => {
      const embed = (
        renderStaffNotice({
          template,
          username: "Kaviya",
          reason: "x",
          customTitle: "Heads up",
          supportUrl: "https://discord.com/channels/1/2",
        }).embeds as Record<string, unknown>[]
      )[0];
      assert.match(String(embed.description), /https:\/\/discord\.com\/channels\/1\/2/);
    });
  }

  test("the reason stays visually separate from the footer note", () => {
    const embed = (
      renderStaffNotice(input({ reason: "Inactive for 60 days" })).embeds as Record<
        string,
        unknown
      >[]
    )[0];
    const description = String(embed.description);
    assert.ok(
      description.indexOf("Inactive for 60 days") < description.search(/repl(y|ies)/i),
      "the reply note should come after the reason, not interrupt it",
    );
  });
});

describe("the reply note survives an over-long reason", () => {
  // The body is truncated to leave room for the note, not the other way round:
  // the line telling a recipient how to reach a human must never be the part
  // that gets cut.
  test("a 5000-character reason still leaves the ticket link intact", () => {
    const embed = (
      renderStaffNotice(input({ reason: "y".repeat(5000) })).embeds as Record<string, unknown>[]
    )[0];
    const description = String(embed.description);
    assert.ok(description.length <= 4096, "still within Discord's embed limit");
    assert.match(description, /cannot read replies/i);
    assert.match(description, /https?:\/\//, "the ticket link is still present");
  });
});

describe("suggested reasons are shared by both surfaces", () => {
  // The admin page renders these as chips and the slash command serves them as
  // Discord autocomplete. One list so the two cannot drift.
  test("every template has at least one suggestion", () => {
    for (const template of ["terminated", "warning", "promotion", "custom"] as const) {
      assert.ok(SUGGESTED_REASONS[template].length > 0, `${template} has no suggestions`);
    }
  });

  test("no suggestion exceeds Discord's 100-character autocomplete limit", () => {
    for (const [template, list] of Object.entries(SUGGESTED_REASONS)) {
      for (const suggestion of list) {
        assert.ok(
          suggestion.length <= 100,
          `${template}: "${suggestion}" is ${suggestion.length} chars`,
        );
      }
    }
  });

  test("no template offers more than Discord's 25-choice limit", () => {
    for (const [template, list] of Object.entries(SUGGESTED_REASONS)) {
      assert.ok(list.length <= 25, `${template} has ${list.length} suggestions`);
    }
  });
});

describe("suggestionsFor filters as the user types", () => {
  test("an empty input returns the whole list", () => {
    assert.deepEqual(suggestionsFor("warning", ""), SUGGESTED_REASONS.warning);
  });

  test("matching is case-insensitive and substring-based", () => {
    const hits = suggestionsFor("warning", "SPAM");
    assert.ok(hits.length >= 1);
    assert.ok(hits.every((s) => s.toLowerCase().includes("spam")));
  });

  test("an unmatched input returns nothing rather than the full list", () => {
    assert.deepEqual(suggestionsFor("warning", "zzzzzz"), []);
  });

  test("an unknown template returns nothing rather than throwing", () => {
    assert.deepEqual(suggestionsFor("not-a-template", ""), []);
  });
});
