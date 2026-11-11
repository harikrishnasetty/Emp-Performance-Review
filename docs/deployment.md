# Deployment

This covers production. For local development, see `docs/setup.md` — it uses
a different, dev-only compose file (`docker-compose.dev.yml`) and is not a
scaled-down version of these steps.

## Prerequisites

- A Linux VM with Docker and Docker Compose.
- A PostgreSQL 16 database (`docker-compose.yml` provides one).
- Redis 7 (provided).
- TLS certificates for your domain.
- An Azure Entra ID app registration (see `docs/sso-setup.md`) — this is the
  sign-in method for all regular users.

## Steps

1. Clone the repository onto the VM.
2. Create `.env` from `.env.example` and fill in production values.
   - `APP_URL=https://your.domain`
   - `COOKIE_SECURE=true`
   - Strong, unique `APP_SECRET` (≥32 chars) and `FIELD_ENCRYPTION_KEY`
     (`env.ts` refuses to boot in `NODE_ENV=production` if these are too
     short, `COOKIE_SECURE` is off, or `APP_URL` isn't `https://`).
   - Leave `SEED_DEMO_DATA` unset/`false` — `docker-compose.yml`'s `app`
     service already forces this off regardless, so demo data is never
     seeded automatically in production.
3. Place certificates:
   ```
   certs/fullchain.pem
   certs/privkey.pem
   ```
4. Launch:
   ```
   docker compose up -d --build
   ```
   Migrations run automatically on container start (`scripts/migrate.mjs`,
   via the Dockerfile's `CMD`) — there is no separate migrate step to run by
   hand, and no demo seeding happens.
5. Sign in as the bootstrap administrator (see below) and provision any
   additional administrators or local (non-SSO) accounts from **Admin →
   People**.

## Adding people and local (non-SSO) accounts

Meridian supports two account types:

- **SSO** — Azure Entra ID, provisioned automatically on first sign-in.
  This is the right default for employees.
- **Local** — email + password, no Entra ID required. Use it for break-glass
  administrators and for people who genuinely aren't in the Entra directory
  (contractors, vendors, partner staff).

### First administrator

A fresh deployment has no users. There are two ways to create the first
`ADMIN`:

1. **Via SSO (recommended)** — set `BOOTSTRAP_ADMIN_EMAIL` to the intended
   administrator's email before the first launch. On their first successful
   SSO login the account is created and promoted to `ADMIN`
   (`docs/sso-setup.md#first-administrator`). Remove or change the value
   afterwards.
2. **Via a one-off insert** — for a shared break-glass identity that has no
   Entra ID account (e.g. `breakglass@yourdomain.com`):

   ```sql
   insert into users (
     email, display_name, system_role, status,
     auth_provider, password_hash, password_changed_at
   )
   values (
     'breakglass@yourdomain.com', 'Break-glass Admin', 'ADMIN', 'ACTIVE',
     'LOCAL', '<scrypt hash>', now()
   );
   ```

   Generate the scrypt hash with `hashPassword` from `src/lib/password.ts`
   (e.g. via a one-off `tsx` script) — never store a plaintext password in a
   migration or shell history.

Once you have an `ADMIN` session, everything else is done in the UI:

### Add a local (non-SSO) person

1. **Admin → People → Add person**.
2. Name + work email.
3. Sign-in method: **Local email & password**; set an initial password
   (≥ 12 characters).
4. Set role, department, manager, status, location and employee code.
5. **Add person** — the account can sign in immediately.

Hand the initial password over a secure channel (password manager or in
person). Meridian does not send invite emails.

### Add an SSO person ahead of their first login

Same dialog, choose **Microsoft Entra ID (SSO)**. The row exists immediately
(reporting line, role, department); profile fields refresh from Entra ID on
each login. You can also leave provisioning to JIT — they'll get a `USER`
row on first sign-in.

### Manage local credentials

- Set/rotate a password: **Admin → People → Edit → Local (non-SSO) access**.
  On an SSO account this produces `auth_provider = 'BOTH'`, keeping both
  methods.
- Self-service change: **Preferences → Security → Change local password**
  (other sessions are revoked).
- Remove local access: **Admin → People → Edit → Disable local**. SSO keeps
  working; all sessions are revoked.

### Production guidance

- Keep one or two break-glass administrators; store their credentials in your
  secrets manager.
- Local accounts are fine for genuine non-Entra users; prefer SSO for regular
  employees so joiner/mover/leaver stays centralised.
- Review local accounts periodically:

  ```sql
  select email, system_role, auth_provider, last_login_at
  from users
  where auth_provider in ('LOCAL', 'BOTH')
  order by email;
  ```

- Every creation, password reset and local-access removal is audited.

## Scaling

```
docker compose up -d --scale app=4
```

nginx uses least-connections across replicas. PgBouncer keeps Postgres
connections bounded regardless of replica count.

## Backups

Back up the `pgdata` volume and the `FIELD_ENCRYPTION_KEY` / `APP_SECRET` —
losing the encryption key makes encrypted fields unrecoverable.

## Monitoring

- `/api/health` returns liveness.
- Logs are structured JSON (pino); set `LOG_LEVEL` and `LOG_PRETTY`.
- Audit integrity: schedule `npm run verify:audit` nightly.
