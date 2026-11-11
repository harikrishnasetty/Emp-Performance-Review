# Local development setup

This is the canonical, step-by-step guide for getting Meridian running on your
machine. For the one-paragraph version see the README; for production, see
`docs/deployment.md`.

## Prerequisites

- Node.js ≥ 22 (`node -v`)
- Docker Desktop (or any Docker engine) — used only to run Postgres/Redis
  locally; the app itself runs on the host via `npm run dev`
- npm (bundled with Node)

## 1. Install dependencies

```bash
npm install
```

## 2. Start local infrastructure (Postgres + Redis)

A dedicated, dev-only compose file spins up just the two stateful services,
with ports published to `localhost` so the app (running outside Docker) can
reach them:

```bash
docker compose -f docker-compose.dev.yml up -d
```

This is separate from `docker-compose.yml`, which is the production stack
(app + nginx + PgBouncer, no host-published DB ports). Don't use the
production compose file for day-to-day development.

Check both containers are healthy:

```bash
docker compose -f docker-compose.dev.yml ps
```

To stop them later: `docker compose -f docker-compose.dev.yml down` (add `-v`
to also wipe the data volume and start clean next time).

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

The defaults in `.env.example` already match `docker-compose.dev.yml`
(`postgresql://meridian:change-me-in-production@localhost:5432/meridian`,
`redis://localhost:6379`), so for pure local development you typically only
need to touch:

- `FIELD_ENCRYPTION_KEY` / `APP_SECRET` — any value that meets the minimum
  length is fine for local dev (the app refuses to boot with an invalid or,
  in production, insecure config — see `src/lib/env.ts`). Generate real ones
  with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` / `ENTRA_CLIENT_SECRET` — only
  required to have *some* non-empty value; they don't need to be real unless
  you're actually testing the Microsoft SSO button (see
  `docs/sso-setup.md`). Local (non-SSO) login works independently of these.
- `BOOTSTRAP_ADMIN_EMAIL` — set to your own email if you want your first SSO
  login to be promoted to `ADMIN` automatically.

`npm run db:migrate`, `npm run db:seed`, and `npm run verify:audit` all load
`.env.local` the same way `next dev` does (via `@next/env`), so you don't
need to `export` `DATABASE_URL` manually.

## 4. Run migrations and seed data

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` creates a demo org (departments, employees, goals, a review
template and cycle) **and** six disposable local (non-SSO) accounts covering
every role and a full manager → IC hierarchy, so role-based flows can be
exercised without an Entra ID tenant — see
[Testing local (non-SSO) login](#testing-local-non-sso-login) below. Seeding
is idempotent — every seeded row has a fixed identifier or an existence
check — so re-running it is safe and will not duplicate goals, competencies or
template rows.

To start over from a clean schema:

```bash
npm run db:reset   # migrate --reset + seed
```

## 5. Run the app

```bash
npm run dev
```

Open http://localhost:3000. You'll land on `/login` with two options:

- **Continue with Microsoft** — only works if you've configured a real Entra
  ID app registration (`docs/sso-setup.md`). Without one, this button will
  fail at the callback step — that's expected in a bare local setup.
- **Email/password form** — works out of the box once you've seeded data;
  see below.

## Testing local (non-SSO) login

Meridian supports two kinds of account: **SSO** (Azure Entra ID) and
**local** (email + password). Local accounts do not need Entra ID at all, so
they are the quickest way to exercise the app — and they are a supported
production path for people who can't use SSO (see
[Local (non-SSO) accounts](sso-setup.md#local-non-sso-accounts)).

After `npm run db:seed`, sign in at http://localhost:3000/login with the
password form. Every seeded account uses the password `Meridian#2026!`:

| Email | Name | Role | Reports to | Good for |
|---|---|---|---|---|
| `local.admin@metricstream.com` | Local Admin | Administrator | — | Admin screens, creating people, audit |
| `local.hr@metricstream.com` | Local HR | HR business partner | — | Cycles, templates, calibration |
| `local.exec@metricstream.com` | Local Executive | Executive (read-only) | — | Org-wide read-only analytics |
| `local.manager@metricstream.com` | Local Manager | Employee (manager) | Local Executive | Team view, manager reviews, 1:1s |
| `local.ic1@metricstream.com` | Local IC One | Employee | Local Manager | Self-reviews, goals, feedback |
| `local.ic2@metricstream.com` | Local IC Two | Employee | Local Manager | Peer feedback, goals |

The manager → IC hierarchy exists entirely among these accounts, so
role-based flows (team view, reviews, peer feedback, 1:1s) can be exercised
end-to-end without touching the SSO demo users. `local.manager`, `local.ic1`
and `local.ic2` are also seeded with goals so there is something on the
dashboard at first login.

For a full acceptance walkthrough — 20 numbered suites with expected results
and a sign-off table — see `docs/manual-test-plan.md`.

These accounts are for **development and testing only** — they're seeded
purely so you (and reviewers) can exercise the local-login code path without
an Entra ID tenant. Delete them before anything resembling a shared/prod
environment (see [Deleting the seeded test accounts](#deleting-the-seeded-test-accounts)
below), and don't rely on `db:seed` running against a real deployment
(`SEED_DEMO_DATA` is intentionally forced off in `docker-compose.yml`'s `app`
service).

### Creating a local (non-SSO) user yourself

The same flow works in development and production, once you have an
`ADMIN` account:

1. Sign in as `local.admin@metricstream.com` (or any `ADMIN` account).
2. Go to **Admin → People** and click **Add person**.
3. Enter the person's name and work email.
4. Set **Sign-in method** to **Local email & password** and enter an initial
   password (≥ 12 characters).
5. Optionally set job title, department, manager, system role, employment
   status, location and employee code.
6. Click **Add person**. The account can sign in immediately.

There is no email delivery in Meridian, so hand the initial password over a
secure channel (password manager, in person) — never chat, email or a ticket.

Choose **Microsoft Entra ID (SSO)** instead if you only want to pre-create the
directory row ahead of the person's first Microsoft login. Their profile
fields are refreshed from Entra ID on each sign-in.

### Managing local access

- **Rotate a password** — Admin → People → **Edit** → **Local (non-SSO)
  access** → enter a new password → **Rotate password**. This also signs the
  person out everywhere.
- **Self-service change** — **Preferences → Security → Change local
  password**. The current session stays valid; every other session is
  revoked. Pure-SSO users don't see this panel.
- **Remove local access** — Admin → People → **Edit** → **Disable local**.
  Any Entra ID sign-in keeps working; the local password is deleted and all
  sessions are revoked.
- **Mixing both** — if a local user later signs in with Microsoft, their
  `auth_provider` becomes `BOTH`: the password keeps working and Entra ID is
  also accepted. Nothing needs to be reconfigured.

Local login behaviour worth knowing while testing:

- Rate-limited per email (10 attempts/minute) and locks the account for 15
  minutes after 5 consecutive failed attempts.
- A user with no password set (pure SSO) gets a clear error telling them to
  use the SSO button instead of a generic "invalid credentials".
- Sessions record how they were created (`auth_method` is `local` or
  `entra-oidc`), which makes local sign-ins easy to isolate in the audit
  trail and `sessions` table.
- Every local sign-in, password change and password reset is written to the
  audit trail (`auth.local.login`, `auth.local.password.changed`,
  `admin.user.password.set`, `admin.user.password.disabled`,
  `admin.person.created`).

### Deleting the seeded test accounts

```sql
delete from users where email in (
  'local.admin@metricstream.com',
  'local.hr@metricstream.com',
  'local.exec@metricstream.com',
  'local.manager@metricstream.com',
  'local.ic1@metricstream.com',
  'local.ic2@metricstream.com'
);
```

Run via `npm run db:studio` (Drizzle Studio) or `psql`. If any of them own
goals/reviews/etc. created during testing, delete or reassign those first —
`users` doesn't cascade-delete content by design (audit/history integrity).

## Troubleshooting

- **`password authentication failed for user "meridian"`** — your
  `DATABASE_URL` password doesn't match `POSTGRES_PASSWORD` in
  `docker-compose.dev.yml`. They default to the same value
  (`change-me-in-production`); if you changed one, change the other too.
- **`ECONNREFUSED ...:6432` when signing in or loading data** — the app's
  runtime pool (`src/lib/db/index.ts`) connects via `DATABASE_POOL_URL`,
  which in `.env.example`/production points at PgBouncer on port 6432.
  `docker-compose.dev.yml` doesn't run PgBouncer — only Postgres + Redis — so
  for local dev, point `DATABASE_POOL_URL` at the same Postgres instance as
  `DATABASE_URL` (port 5432), or remove the line entirely to fall back to
  `DATABASE_URL` automatically.
- **Scripts can't reach the DB / `ECONNREFUSED`** — `docker compose -f
  docker-compose.dev.yml ps` to confirm containers are up and healthy; give
  Postgres a few seconds after `up -d` before running migrations.
- **Login works but the session doesn't persist** — if you're accessing the
  app via something other than `localhost` (e.g. a LAN IP or a custom host
  entry), browsers won't treat it as a secure context and `Secure` cookies
  will be rejected on plain HTTP. Set `COOKIE_SECURE=false` in `.env.local`
  (this is already the `.env.example` default) when not using HTTPS, or
  stick to `http://localhost:3000`.
- **Port 3000 already in use** — Next.js will auto-pick another port, or
  stop the stale process: on Windows, `taskkill /PID <pid> /F`; on
  macOS/Linux, `kill <pid>`.
- **Typecheck/build suddenly show stale/missing errors** — delete
  `tsconfig.tsbuildinfo` to force a full, non-incremental `tsc` run.

## Everyday scripts

See the README's [Scripts](../README.md#scripts) table for the full list
(`npm run dev`, `db:migrate`, `db:seed`, `db:studio`, `verify:audit`, etc.).
