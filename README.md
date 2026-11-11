# Meridian — Performance Intelligence Platform

Meridian is a performance intelligence platform for goal management, continuous feedback, structured review cycles and calibrated talent decisions. It delivers goal management, task assignment, progress tracking, performance reviews, role-based access and review cycles — with Azure Entra ID SSO (or admin-issued local credentials), a tamper-evident audit trail and security designed for team adoption.

> Meridian is an original platform. It is not derived from any third-party performance review system.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, standalone output) + React 19 + TypeScript 5.9 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (Drizzle ORM) |
| Pooling | PgBouncer (transaction mode) |
| Cache / rate limit | Redis 7 (in-process fallback) |
| Auth | Azure Entra ID via OIDC (Authorization Code + PKCE) |
| Edge | nginx (TLS, rate limiting, reverse proxy) |
| Runtime | Node 22, Docker Compose on a Linux VM |

## Quick start (development)

```bash
# 1. Install
npm install

# 2. Start local Postgres + Redis (dev-only compose file)
docker compose -f docker-compose.dev.yml up -d

# 3. Configure
cp .env.example .env.local
# defaults already match docker-compose.dev.yml; see docs/setup.md for what
# else to fill in (FIELD_ENCRYPTION_KEY, APP_SECRET, Entra values)

# 4. Database
npm run db:migrate
npm run db:seed

# 5. Run
npm run dev
```

Open http://localhost:3000. Sign in with your Entra ID account (the first
user whose email matches `BOOTSTRAP_ADMIN_EMAIL` is promoted to
administrator), **or** use the email/password form with one of the six
disposable local accounts `db:seed` just created — one for each role, plus a
manager → IC hierarchy (`admin@example.com` / `Meridian#2026!` and
friends; see `docs/setup.md#testing-local-non-sso-login`) if you don't have an
Entra ID app registration handy.

Full walkthrough, troubleshooting, and how to exercise the local-login code
path: **`docs/setup.md`**.

Acceptance testing (all accounts, expected results, sign-off table):
**`docs/manual-test-plan.md`**.

## Production deployment

See `docs/deployment.md` for the full guide, including how to bootstrap the
first administrator and how to add people with SSO or local (non-SSO)
credentials. In short:

```bash
# 1. Fill in a real .env (or export the variables)
cp .env.example .env
# edit .env — production values, COOKIE_SECURE=true, APP_URL=https://...

# 2. Place TLS certificates
mkdir -p certs
cp /path/to/fullchain.pem certs/fullchain.pem
cp /path/to/privkey.pem   certs/privkey.pem

# 3. Build and launch — migrations run automatically on container start
docker compose up -d --build
```

There is no demo-data seeding step in production: `docker-compose.yml`
forces `SEED_DEMO_DATA=false` for the `app` service regardless of `.env`.

Scale the application tier horizontally:

```bash
docker compose up -d --scale app=4
```

nginx load-balances across replicas via least-connections.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed demo organisation, competencies, templates, cycle — dev only; also creates 6 disposable local-login test accounts (every role + manager → IC hierarchy) |
| `npm run db:reset` | Drop schema, migrate and seed |
| `npm run db:studio` | Drizzle Studio |
| `npm run verify:audit` | Verify the audit chain integrity |

## Security

- Primary authentication is delegated to Azure Entra ID (OIDC, PKCE S256,
  tenant pinning, email-domain allow-list). Administrators can also create
  local (non-SSO) email/password accounts for people outside the Entra
  directory and for break-glass access — see `docs/sso-setup.md`.
- Local passwords are hashed with scrypt, never stored or logged in plaintext;
  users can rotate their own password from Preferences, and admins can reset
  it or remove local access entirely.
- Sessions are server-side, cookie-bound, idle + absolute expiry, CSRF
  double-submit with rotation, and record the sign-in method.
- Sensitive free text is encrypted at rest (AES-256-GCM).
- RBAC: ADMIN / HR / EXEC / USER plus relationship checks (reporting subtree).
- Every privileged action is written to an append-only, SHA-256 hash-chained
  audit trail. Verify with `npm run verify:audit`.
- Strict CSP, HSTS, host-header validation, rate limiting at nginx and app.

See `docs/security.md`.

## Documentation

| Doc | Covers |
|---|---|
| `docs/setup.md` | Local development setup, running the app, testing local (non-SSO) login |
| `docs/usage-guide.md` | Roles, navigation, and day-to-day workflows (reviews, goals, feedback, 1:1s, admin) |
| `docs/deployment.md` | Production deployment, scaling, backups, bootstrapping the first admin, adding people and local (non-SSO) accounts |
| `docs/sso-setup.md` | Azure Entra ID app registration and local (non-SSO) account lifecycle |
| `docs/security.md` | Full security model |
| `docs/architecture.md` | System architecture and data model |
| `docs/manual-test-plan.md` | Acceptance test plan — local test accounts, 21 manual suites, sign-off table |
| `TRACKER.md` | Delivery tracker — what is done and verified, what is still open, known limitations |

## License

MIT. Free for personal, evaluation, and internal business use. Not for
redistribution as a service offering without modification.

---

**Meridian** — Performance intelligence for teams and organizations.