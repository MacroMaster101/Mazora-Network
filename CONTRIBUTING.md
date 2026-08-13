# Contributing to Mazora Network

## Local setup

Use Node.js 24 and npm. Clone the repository, run `npm ci`, copy `.env.example` to `.env.local` when integrations are needed, and start the app with `npm run dev`. The public UI boots without secrets and shows safe empty states for unconfigured services.

Never commit `.env`, `.env.local`, service-role keys, Discord tokens, database credentials, generated Next.js output, or local logs.

## Changes

- Create a focused branch and keep each pull request limited to one coherent change.
- Preserve the canonical production origin (`https://mazora.us`) and verify the HTTP, `www`, and Vercel-domain redirects configured in the Vercel project.
- Enforce authentication, authorization, and input validation inside server actions and API routes; a hidden button or protected page alone is not a security boundary.
- Add or update targeted tests when changing authorization, redirects, URL validation, uploads, or other security-sensitive behavior.
- Do not mutate production data from tests or seed scripts.

## Quality gate

Run the same checks as CI before opening a pull request:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Describe the behavior changed, the routes affected, how it was verified, and any environment or migration work required after deployment.
