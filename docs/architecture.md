# Architecture

## Overview

Meridian is a stateless Next.js application behind nginx, backed by PostgreSQL
(via PgBouncer) and Redis. All state lives in Postgres; app replicas are
interchangeable.

```
Browser ──HTTPS──▶ nginx ──▶ Next.js (N replicas) ──▶ PgBouncer ──▶ PostgreSQL
                                   │
                                   └──▶ Redis (rate limiting, cache)
```

## Application layers

- `src/app` — routes, server components, server actions.
- `src/lib/services` — read models and domain logic (server-only).
- `src/lib/actions.ts` — the single server-action envelope: auth, RBAC, Zod
  validation, rate limiting, audit logging.
- `src/lib/auth` — OIDC client, session store, RBAC capabilities. SSO
  (Entra ID) is the primary path; `src/app/actions/auth.ts` (`localLogin`,
  `adminSetPassword`, `adminDisableLocalAccess`) and
  `src/app/actions/admin.ts` (`adminCreatePerson`) make admin-provisioned
  local email/password accounts a first-class alternative for people outside
  the Entra directory and for break-glass administrators. Sessions record
  their `auth_method` (`entra-oidc` or `local`).
- `src/lib/crypto.ts` — field encryption (`server-only`, needs
  `FIELD_ENCRYPTION_KEY`). `src/lib/password.ts` holds scrypt password
  hashing separately, deliberately *without* the `server-only` guard or an
  env dependency, so standalone scripts (`scripts/seed.ts`, run directly
  under `tsx`/Node rather than through the Next.js bundler) can hash
  passwords without tripping the `server-only` import check.
- `src/lib/db` — Drizzle schema and connection.
- `src/components` — UI kit and feature components.

## Data model highlights

- UUID primary keys, `timestamptz` everywhere, soft deletes via `deactivated_at`.
- `users.auth_provider` (`SSO` / `LOCAL` / `BOTH`) and `password_hash` model
  the two sign-in paths on one identity. `deactivated_at` is kept in sync with
  `status = INACTIVE`.
- Sensitive free text in `*_enc` columns (AES-256-GCM).
- Audit trail: append-only `audit_events` with `prev_hash` / `hash`.
- Reporting hierarchy via `users.manager_id`; subtree queries use recursive CTEs.

## Scaling

- App is stateless; add replicas with `docker compose up -d --scale app=N`.
- PgBouncer transaction pooling keeps Postgres connections bounded.
- Rate limiting uses Redis when available, in-process fallback otherwise.
- Org-tree and directory queries are single-query + in-memory assembly to avoid
  N+1 on 5,000-person orgs.

## Multi-tenancy

Meridian is single-tenant (MetricStream). The schema is intentionally not
multi-tenant; a deployment serves one organisation.

## Local development vs. production topology

`docker-compose.yml` is the production topology above (app behind nginx,
PgBouncer, no host-published DB/Redis ports). Local development does **not**
run the app in Docker — `docker-compose.dev.yml` starts only Postgres and
Redis, with ports published to `localhost`, and the app runs on the host via
`npm run dev` for fast rebuilds/hot reload. See `docs/setup.md`.
