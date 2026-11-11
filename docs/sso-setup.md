# SSO setup (Azure Entra ID)

## App registration

1. In the Azure portal, create a new **App registration** ("Meridian Performance").
2. Supported account types: **Accounts in this organizational directory only**
   (single tenant).
3. Redirect URI (Web): `https://your.domain/api/auth/callback/entra`.
4. Under **Certificates & secrets**, create a new client secret. Copy the value
   into `ENTRA_CLIENT_SECRET`.
5. Under **API permissions**, no Graph permissions are required — Meridian only
   reads the ID token claims (`oid`, `preferred_username`, `name`, `email`).

## Configuration

Set in `.env`:

```
ENTRA_TENANT_ID=<tenant (directory) id>
ENTRA_CLIENT_ID=<application (client) id>
ENTRA_CLIENT_SECRET=<client secret value>
ALLOWED_EMAIL_DOMAINS=metricstream.com
ENTRA_STRICT_TENANT=true
APP_URL=https://your.domain
```

## First administrator

Set `BOOTSTRAP_ADMIN_EMAIL` to the email of the first user who should be
promoted to administrator. On their first successful SSO login, Meridian assigns
the `ADMIN` system role. Remove or change the value afterwards; it is only
consulted on first login.

## Notes

- The redirect URI must match `APP_URL` exactly, including scheme and host.
- `COOKIE_SECURE=true` is required when serving over HTTPS.
- If you rotate the client secret, update `ENTRA_CLIENT_SECRET` and restart.

## Local (non-SSO) accounts

Entra ID SSO is the primary sign-in path, but Meridian also supports **local**
accounts that sign in with an email and password and never touch Entra ID.
This covers two production cases:

1. **Break-glass administrators** — at least one `ADMIN` that can sign in if
   Entra ID is misconfigured or unreachable.
2. **People outside the Entra ID directory** — contractors, vendors or
   partner staff who still need to use Meridian.

The email/password form on `/login` is available to any account with a
password; it is not restricted to administrators. Access is controlled by
provisioning, not by a role check.

### Provisioning

**Add a new local person (recommended)** — as an `ADMIN`:

1. **Admin → People → Add person**.
2. Enter name and work email.
3. Choose **Local email & password** as the sign-in method and set an initial
   password (≥ 12 characters).
4. Fill in role, department, manager and status as needed, then **Add person**.
   The account can sign in immediately.

**Give an existing SSO user a password** — **Admin → People → Edit** → **Local
(non-SSO) access** → enter a password → **Set password**. If the row already
has an Entra ID identity, `auth_provider` becomes `BOTH` and both sign-in
methods work.

There is no email-invite delivery in Meridian, so hand the initial password
over a secure channel (password manager or in person). Never put it in chat,
email or a ticket.

### Password lifecycle

- **Self-service change** — **Preferences → Security → Change local
  password**. Requires the current password; the active session is kept and
  every other session is revoked.
- **Administrator reset** — Admin → People → Edit → **Rotate password**. All
  of that person's sessions are revoked.
- **Remove local access** — Admin → People → Edit → **Disable local**. Deletes
  the password, keeps any SSO identity, and revokes all sessions. A local-only
  administrator cannot disable their own access (that would lock them out).
- Passwords are hashed with scrypt (`N=16384, r=8, p=1`, random 16-byte salt)
  — see `src/lib/password.ts`. Plaintext passwords are never stored or logged.
- Local login is rate-limited per email (10 attempts/minute) and locks the
  account for 15 minutes after 5 consecutive failures
  (`src/app/actions/auth.ts`).

### `auth_provider` values

| Value | Meaning |
|---|---|
| `SSO` | Entra ID only; no password hash. |
| `LOCAL` | Email + password only; no Entra ID identity yet. |
| `BOTH` | Both are enabled. A local account automatically becomes `BOTH` on its first successful Entra ID login, and setting a password on an SSO account does the same. |

Audit events to look for: `admin.person.created`, `admin.user.password.set`,
`admin.user.password.disabled`, `auth.local.login`,
`auth.local.password.changed`.

### Production guidance

- Provision one or two break-glass administrators and keep their credentials
  in your secrets manager.
- Local accounts are appropriate for people who genuinely cannot use Entra ID.
  Prefer SSO for everyone else — it centralises joiner/mover/leaver control.
- Review local accounts periodically:
  ```sql
  select email, system_role, auth_provider, last_login_at
  from users
  where auth_provider in ('LOCAL', 'BOTH')
  order by email;
  ```
- Disable local access immediately when someone leaves or changes role; the
  admin UI action is audited.

### Development and testing

`scripts/seed.ts` creates six disposable local accounts covering every role
(admin, HR, exec, manager and two ICs), all with password `Meridian#2026!`.
The full table, hierarchy and cleanup SQL are in
[`docs/setup.md#testing-local-non-sso-login`](setup.md#testing-local-non-sso-login).
Delete them before any production-like deployment.
