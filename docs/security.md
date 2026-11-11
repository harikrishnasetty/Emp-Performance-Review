# Security

## Authentication

- Azure Entra ID via OIDC Authorization Code + PKCE (S256) — primary path for
  all employees.
- Tenant pinning (`ENTRA_STRICT_TENANT`) and email-domain allow-list
  (`ALLOWED_EMAIL_DOMAINS`).
- Local (non-SSO) email/password login is a first-class secondary path:
  - Accounts are created explicitly by an administrator
    (`Admin → People → Add person`) or by giving an existing SSO user a
    password. There is no public sign-up.
  - `users.auth_provider` records the enabled methods: `SSO`, `LOCAL` or
    `BOTH`. A local account's first successful Entra ID login upgrades it to
    `BOTH`; the password keeps working.
  - Used for break-glass administrators and for people outside the Entra ID
    directory (contractors, vendors). Prefer SSO for regular employees.
- Local passwords are hashed with scrypt (`N=16384, r=8, p=1`, random 16-byte
  salt) — see `src/lib/password.ts`. Plaintext passwords are never stored or
  logged, and are never emailed by the application.
- Password lifecycle:
  - Users can change their own password from **Preferences → Security**; the
    current session survives and every other session is revoked.
  - Administrators can reset a password or remove local access entirely
    (**Disable local**). Both actions revoke all of the target's sessions.
    An administrator cannot remove their own last sign-in method.
- Local login is rate-limited per email (10 attempts/minute) and locks the
  account for 15 minutes after 5 consecutive failed attempts
  (`src/app/actions/auth.ts`). All outcomes are audited
  (`auth.local.login`, `auth.local.password.changed`,
  `admin.user.password.set`, `admin.user.password.disabled`,
  `admin.person.created`).
- Deactivation (`status = INACTIVE`) also sets `deactivated_at`, blocks both
  sign-in paths, and revokes live sessions.

## Sessions

- Server-side sessions; only an opaque token (SHA-256 hashed) is stored.
- Cookie is `HttpOnly`, `Secure` (in production), `SameSite=Lax`.
- Idle timeout + absolute lifetime enforced server-side.
- CSRF double-submit tokens, rotated on session renewal.
- Role change or deactivation revokes all active sessions for that user.

## Authorisation

- Capabilities derived from system role (ADMIN / HR / EXEC / USER) plus
  explicit grants.
- Relationship checks per record (manager of, reporting subtree, assigned
  reviewer). Default deny.

## Data protection

- Sensitive free text encrypted at rest with AES-256-GCM.
- Parameterised queries via Drizzle — no string interpolation of user input.
- Soft deletes preserve history; deactivation removes from directories.

## Audit trail

- Append-only `audit_events` table, hash-chained (SHA-256).
- Inserts serialised with a Postgres advisory lock to prevent chain forks.
- Verify with `npm run verify:audit` or `scripts/verify-audit-chain.ts`.

## Transport & headers

- TLS terminated at nginx; HSTS, CSP, X-Frame-Options, nosniff, Permissions-Policy.
- Host-header validation against the configured origin.
- Rate limiting at nginx and application layers.

## Operational

- Run as non-root in the container.
- Secrets come from environment variables; never commit `.env`.
- `COOKIE_SECURE=true` and HTTPS `APP_URL` are enforced in production mode.
