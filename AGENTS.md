# Instructions for AI coding agents

This repository is public. Anything committed, including tests, fixtures, code
comments and commit messages, is visible to everyone and stays in git history.

## Never use real data

Tests, fixtures, seed data, previews, placeholders, comments and examples must use
made-up values only. Never copy anything from the live site, the database, the
admin panel, Discord or logs into the repository. That includes:

- player, staff or member names, Minecraft usernames and display names;
- Discord user, server, channel, role or message IDs (use obvious fakes such as
  `111111111111111111` or `123456789012345678`);
- Minecraft or account UUIDs (use `00000000-0000-3000-8000-000000000001`-style);
- email addresses (use `@example.com`), IP addresses, phone numbers;
- order references, invoice data, chat or support-ticket content.

Use invented names such as `Steve_42`, `Alex_Builder`, `StaffAlex` or
`Example_Player`, and the reserved `example.com` domain in documentation. If a
bug report or log contains real data, reproduce it with invented values before
writing a test.

## Commits

Do not commit or push unless the maintainer asks. When asked, write plain commit
messages with no `Co-Authored-By` trailer and no mention of AI tools.
