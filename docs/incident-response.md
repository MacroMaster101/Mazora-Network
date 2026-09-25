# Incident response runbook

What to do when something security-related goes wrong on mazora.us. Work top to
bottom; skip steps that do not apply. Speed matters more than polish — contain
first, investigate second.

Who can act: **Web Dev** (full access: Vercel, Supabase, secrets, scripts) and
**Owner** (site settings, users, audit logs). Write down what you do and when as
you go — it becomes the incident record.

---

## 1. Triage (first 10 minutes)

1. **What is happening?** Defacement, a staff account doing things its owner did
   not do, data exposed, the site down, a leaked secret, a report from a player.
2. **Check the audit log** — `/admin/audit-logs` (Owner / Web Dev). Staff
   changes, role changes, two-step changes and recovery-code use are all there,
   with who and when.
3. **Check logs** — Vercel → Project → Logs (errors, unusual request volume) and
   Supabase → Logs (auth: sign-ins, failed MFA, password resets).
4. **Decide the severity.**
   - *Critical*: a leaked server secret, an attacker in a staff or owner account,
     data exposed. Do everything in section 2 now.
   - *High*: one member account taken over, abuse at scale. Sections 2.2–2.4.
   - *Low*: a single suspicious report. Investigate; contain only if confirmed.

## 2. Contain

### 2.1 Stop the damage
- **Maintenance mode** — Admin → Settings → *Maintenance Mode*. Shows the
  maintenance banner; use it while you work.
- **Pause sign-ups** — Admin → Settings → turn off *User Registration*.
- **Take a staff account's powers away** — Admin → Users → change its rank, or
  from a terminal: `npm run role:set -- their@email.com member`.

### 2.2 Sign people out
- **One account**: Supabase → Authentication → Users → the user → *Sign out* /
  revoke sessions. Then have them reset their password.
- **Everyone** (a leaked signing key, or you cannot tell who is affected):
  Supabase → Project Settings → **JWT Keys** → *Create standby key* → *Rotate* →
  then *Revoke* the previous key. Every existing sign-in stops working; members
  sign in again. Access tokens last at most 15 minutes, so the rotation is
  complete within that window.

### 2.3 Rotate any secret that may have leaked
Rotate in the provider first, then update **Vercel → Settings → Environment
Variables** (Production and Preview) and your local `.env`, then **redeploy**.

| Secret | Where to rotate |
|---|---|
| `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) | Supabase → Settings → API Keys (create new secret key, delete old) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys |
| `DATABASE_URL` password | Supabase → Settings → Database → reset password |
| `DISCORD_BOT_TOKEN` | Discord Developer Portal → Bot → Reset token |
| `CRON_SECRET`, `BOT_CONFIG_SECRET` | Generate a new random value (32+ chars); also update the presence worker |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → the database → reset credentials |
| `RESEND_API_KEY` | Resend → API Keys |
| `GITHUB_BACKUP_TOKEN` | GitHub → Settings → Developer settings → fine-grained tokens |

Rotating the Supabase secret key also invalidates in-progress password resets
and recovery-code sign-in passes (they are signed with a key derived from it);
affected members simply sign in again.

### 2.4 Lost or compromised two-step verification
- Member lost their phone but has recovery codes: they sign in with a code and
  replace the authenticator in Settings — no action needed.
- Lost phone **and** codes: after confirming identity (e.g. from their verified
  Discord), a Web Dev runs `npm run mfa:reset -- their@email.com`. It is logged.

## 3. Investigate
- Audit log entries around the time of the incident; the actor id and the `by`
  field show who.
- Supabase auth logs for the affected accounts: sign-in method, IP, MFA events.
- `git log` / Vercel deployments: was anything deployed that should not have been?
- Note what was accessed or changed. If member data was exposed, list whose.

## 4. Recover
- **Restore data** — backups run automatically off-site (the private
  `mazora-backups` repository, to Cloudflare R2); the last run's status shows in
  the admin panel. For a local snapshot before risky repairs: `npm run backup`.
- Revert bad changes (admin boards, or `git revert` + redeploy for code).
- Turn maintenance mode and registrations back on.

## 5. Afterwards
- Tell affected members what happened, what was affected and what they should
  do (e.g. change passwords, turn on two-step verification). Be plain and prompt.
- Write a short incident note: timeline, cause, impact, what fixed it, what
  changes prevent a repeat. Keep it with this runbook.
- Review: rotate anything else that might be exposed, and add a test or check
  for the hole that was used.

See also: `SECURITY.md` (how vulnerabilities are reported to us).
