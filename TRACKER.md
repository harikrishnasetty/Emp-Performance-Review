# Meridian — Delivery Tracker

**Last updated:** 4 Nov 2026 (goal approval + manager read of self assessment delivered)
**Build state:** `npm run typecheck` clean · `npm run build` green · standalone production
server validated on `http://localhost:3001` against local Postgres 16 + Redis.

This is the living status document for the Meridian app. Update the tables below
whenever work lands or a new gap is found — do not let it drift from reality.

**Legend:** ✅ done and verified · 🟡 open / partial · 🔵 limitation by design

---

## 0. Resume here

**Where we stopped:** local (non-SSO) authentication is delivered and verified end
to end, and the two P1 process gaps — **PROC-1** (goal submit/approve) and
**PROC-2** (manager can read the employee's submitted self assessment) — are now
implemented and verified through the browser on the production build. Nothing is
half-edited; the tree is consistent.

**Current runtime:**

- Production standalone server: <http://localhost:3001> (`/api/health` → ok).
- `next dev` on port 3000 is stopped. Start it with `npm run dev` if you want
  hot reload; production and dev share `.next`, so stop one before rebuilding.

**Your next step:** run the manual plan — `docs/manual-test-plan.md`. It has the
six local test accounts and their password, 22 numbered suites (MT-00 … MT-21),
the expected result for each step, and a sign-off table. MT-21 is the goal
approval loop; MT-05 covers the manager's read-only self-assessment panel. Report
failures by ID.

**Then pick one open item:**

1. **QA-1** — Vitest for scoring/cycle-progress/goal maths + Playwright smoke,
   wired to CI. Doable here without external accounts; locks in the fixes.
2. **PROC-3** — make mid-year a real stage rather than a `cycleType` badge.
3. **FEAT-1** — decide peer reviews: implement `PEER` reviewer assignment, or
   remove the toggle and fix the copy. Currently config-only.
4. **OPS-2** — `docker compose up -d --build` and verify TLS/health/scaling.
5. **OPS-1** — SSO walkthrough; needs real Entra tenant credentials from you.

**If the demo data looks odd:** `npm run db:reset` returns it to the pristine
seed (16 users, 11 goals, all goals `APPROVED`). Important: the seed does **not**
enrol the cycle, so after a reset it is a draft with no participants and no
reviews — enrol it as described in `docs/manual-test-plan.md` MT-00. Re-seeding
alone is safe: `npm run db:seed`.

---

## Status at a glance

| Area | State | Notes |
|---|---|---|
| Local (non-SSO) email + password auth | ✅ | First-class path, not break-glass-only |
| Azure Entra ID SSO | 🟡 | Code complete; never exercised against a real tenant |
| Review cycle end-to-end | ✅ | Enrol → self → manager → scores → calibration → acknowledge. Phase labels are advisory (FEAT-4) |
| 10-step enterprise review process | 🟡 | Steps 1–2 (goal approval), 5–6 (self/manager, manager reads the self assessment), 9–10 (acknowledge/complete) work. Mid-year, HR review and performance-communication steps remain — see PROC-3 … PROC-6 |
| Goals, feedback, 1:1s | ✅ | Smoke-tested as every role |
| Admin (directory, cycles, templates, calibration, audit) | ✅ | |
| Analytics / leadership views | ✅ | |
| Production runtime (standalone Node) | ✅ | `npm start`, port 3001 |
| Manual acceptance test plan | ✅ | `docs/manual-test-plan.md` — accounts, 22 suites (MT-00 … MT-21), sign-off |
| Docker Compose + nginx deployment | 🟡 | Config reviewed, stack never booted here |
| Automated tests / CI | 🟡 | None exist |
| Peer reviews | 🟡 | Cycle config only — no reviewer assignment |
| Email notifications | 🟡 | In-app notifications only |

---

## 1. Completed and verified

### 1.1 Authentication and accounts

| ID | Item | Evidence |
|---|---|---|
| AUTH-1 | Six seeded local accounts (`local.admin`, `local.hr`, `local.exec`, `local.manager`, `local.ic1`, `local.ic2`, password `Meridian#2026!`) covering every role plus a manager → IC hierarchy | `scripts/seed.ts`; login verified for each role |
| AUTH-2 | `users.auth_provider` supports `SSO` / `LOCAL` / `BOTH`; a LOCAL user's first successful SSO login upgrades them to `BOTH` without losing the password | `src/lib/auth/oidc.ts` |
| AUTH-3 | Admin can create a person with a password, rotate a password, disable local access, and deactivate — each revokes live sessions | Admin → People; audit rows `admin.*` |
| AUTH-4 | Self-service password change from Preferences; current session survives, other sessions revoked | Settings → Security |
| AUTH-5 | Sessions record the sign-in method; sign-out revokes server-side | `auth.local.login` / `auth.logout` audit rows |
| AUTH-6 | Login page validates the session against the DB before redirecting, so no redirect loop for cookie holders | `src/app/login/page.tsx` |
| AUTH-7 | Internal redirects use relative `Location` headers (`redirectTo()`), so an `APP_URL`/origin mismatch cannot bounce users to another host; `APP_URL` remains authoritative only for the OIDC `redirect_uri` | `src/lib/http.ts` |
| AUTH-8 | `?next=` validated — no open redirect | manual test |
| AUTH-9 | Local login rate-limited per email and locked after 5 failed attempts; every outcome audited | `src/app/actions/auth.ts` |

### 1.2 Reviews

| ID | Item | Evidence |
|---|---|---|
| REV-1 | Self assessment and manager review submission, draft saving, return-for-revision, resubmission | UI walkthrough as `local.ic1` / `local.manager` |
| REV-2 | Scoring: goals 65% / competencies 4.00 / overall 72.50% / proposed 3.60 for `local.ic1` | DB `cycle_participants` |
| REV-3 | Calibration table normalises competency score to a percentage (was rendering `4%` for `4/5`) | Admin → Calibration |
| REV-4 | A self assessment is never listed in **About me**, never counted as awaiting acknowledgement, and cannot be acknowledged or returned (server-side guard) | `getReviewsAboutMe`, `acknowledgeReview`, `returnReview` |
| REV-5 | Acknowledgement renders even without a comment, and the timestamp appears in Details | review detail page |
| REV-6 | Draft manager ratings no longer influence competencies/overall scores — only `SUBMITTED`/`ACKNOWLEDGED`/`LOCKED` count | `computeParticipantScores` |
| REV-7 | People with no line manager complete when they submit their self assessment (previously stuck at `SELF_COMPLETE`, so cycle progress could never reach 100%) | `submitReview`; verified with `local.exec` → `COMPLETE` + `completed_at` |
| REV-8 | `cycleProgress` derives counters from review rows: `self 2/14`, `manager 5/14`, `complete 2/14` — managerless participants no longer counted as outstanding | DB + UI |

### 1.3 Platform, data and UI

| ID | Item | Evidence |
|---|---|---|
| PLT-1 | `npm run db:seed` is genuinely idempotent: fixed goal IDs, guarded template-competency insert (re-running previously duplicated goals 11 → 22 and template competencies 12 → 24) | scratch DB seeded twice → 16 users / 11 goals / 12 competencies / 12 template rows |
| PLT-2 | `db:reset` drops both `public` and `drizzle` schemas, so a reset really starts clean | `scripts/migrate.ts` |
| PLT-3 | Expired-session cleanup not required for correctness (expiry enforced on read) but no purge job exists — see OPS-3 | |
| PLT-4 | Production `npm start` runs the standalone server via `scripts/start.mjs` (copies `public` + `.next/static`) | port 3001 verified |
| PLT-5 | Self-hosted fonts (`public/fonts/*.woff2`) — no external font fetch, CSP-safe | network log, `font/woff2` 200 |
| PLT-6 | Theme bootstrap uses `next/script` `beforeInteractive` (no inline-script React warning); light/dark verified | browser console clean |
| PLT-7 | Analytics `departmentPerformance()` SQL fixed (missing `FROM`-clause alias) | `/analytics` 200 |
| PLT-8 | Admin templates page 500 fixed — status metadata moved into `src/lib/utils.ts` (server components were receiving client-reference stubs) | `/admin/templates` 200 |
| PLT-9 | `ProgressRing` rounds its label (was `7.142857142857142%`) | `/reviews` |
| PLT-10 | Audit trail hash chain intact after all of the above | `npm run verify:audit` → 50 events |
| PLT-11 | Full production sweep: 15 pages, 0 console errors and 0 warnings, as both `USER` and `ADMIN` | see §4 |
| PLT-13 | Federated search and the team activity feed no longer crash on array params — `= any($1)` bound a scalar and raised `22P02 malformed array literal`. Replaced with `inArray()` / `sql.join` bound values; search also filters `DRAFT`/`ARCHIVED` cycles instead of the tautological `status = status` | `/api/search?q=ship` → 200; `/team` activity feed 200 |

### 1.4 Documentation

| ID | Item |
|---|---|
| DOC-1 | `README.md`, `docs/setup.md`, `docs/sso-setup.md`, `docs/deployment.md`, `docs/security.md`, `docs/usage-guide.md`, `docs/architecture.md` all describe the local (non-SSO) path |
| DOC-2 | `docs/setup.md` — accurate seed-idempotency statement |
| DOC-3 | `docs/usage-guide.md` — acknowledgement step, self-assessment rule, managerless completion |
| DOC-4 | `docs/manual-test-plan.md` — acceptance test plan: six local accounts with password, 22 numbered suites (MT-00 … MT-21) with expected results, sign-off table, SQL verification snippets and a "known expected behaviour" list |
| DOC-5 | `docs/usage-guide.md` — goal approval loop (send → approve/return → edit → resubmit) and the manager's self-assessment panel documented as part of the cycle |

### 1.5 Review process — goal approval and the manager hand-off

| ID | Item | Evidence |
|---|---|---|
| PROC-1 | Goals now run a real approval workflow on a dedicated `approval_status` enum (`DRAFT → SUBMITTED → APPROVED / RETURNED`), separate from progress `status`. Submitting notifies the manager; approve/return records `approved_by`, `approval_decided_at`, `approval_comment` and audits `goal.submitted` / `goal.approved` / `goal.returned`. Check-ins require `APPROVED`; owner edits are locked after submit. People without a manager are auto-approved instead of stranded | `src/lib/db/schema.ts`, `drizzle/0002_nappy_albert_cleary.sql`, `src/app/actions/goals.ts`, `src/components/goals/goal-approval.tsx`, `src/components/goals/edit-goal-dialog.tsx` |
| PROC-1a | `/goals` shows a "not yet approved" banner with a bulk submit button, plus a **Goals awaiting your approval** queue for direct reports (approve / send back with a reason). `/goals/[id]` shows the approval badge, the returned reason, submit/approve/return controls and `Approval` / `Approved` rows | browser run: create → submit → return → edit → resubmit → approve |
| PROC-1b | Migration backfilled the 11 pre-existing goals to `APPROVED` so a cycle in flight is not reset to drafts; the seed inserts approved goals with decision timestamps | `drizzle/0002_nappy_albert_cleary.sql`; `select approval_status, count(*) from goals` → `APPROVED 11` |
| PROC-2 | The participant's manager can open a published (`SUBMITTED`/`ACKNOWLEDGED`/`LOCKED`) `SELF` review without a `review:read:all` grant; drafts stay private to their author. Submitting a self assessment notifies the manager with a direct link, and the manager review page shows an **Employee self assessment** card that links across | `/reviews/cee138f2…` as `local.manager` → 200; same URL as `local.ic2` → 404 |

---

## 2. Open items

| ID | Item | Priority | Why it matters | Next step |
|---|---|---|---|---|
| OPS-1 | SSO never exercised end-to-end | **P1** | Only local auth has real login evidence. Tenant pinning, PKCE callback, `BOTH` upgrade and bootstrap-admin promotion are code-reviewed but unproven. | Register a real Entra app, fill `ENTRA_*`, run the full sign-in + callback + `BOTH` upgrade against a test tenant. |
| OPS-2 | Docker Compose production stack not booted | **P1** | `Dockerfile`, `docker-compose.yml` and `nginx/nginx.conf` are statically reviewed only. The app has only been proven via `npm start` on the host. | `docker compose up -d --build` on a Linux host, verify TLS, `/api/health`, migrations on container start, and `--scale app=2`. |
| QA-1 | No automated tests and no CI | **P1** | Every regression fixed in this engagement was caught by manual testing. Auth, scoring and acknowledgement logic are high-value, pure-function targets. | Add Vitest for services (`computeParticipantScores`, `cycleProgress`, `summariseGoals`) + Playwright smoke for login/review flow; wire to CI with `typecheck` and `build`. |
| FEAT-1 | Peer reviews are configuration only | **P2** | `peerReviewEnabled` / `peerReviewCount` are editable and stored, but enrolment creates only `SELF` + `MANAGER` reviews. Two places over-promise it: `docs/usage-guide.md` says users "submit self/manager/peer reviews", and the `/login` marketing panel says "Self, manager, peer and skip-level reviews run on one timeline". | Decide: (a) implement peer reviewer selection + `PEER` review generation, or (b) hide the toggle and correct both copies. Do not leave the mismatch. |
| FEAT-2 | Notifications are in-app only | **P2** | `notify()` writes DB rows for the bell; nothing is emailed. Consequence: no invite email, no password-reset email, no review-due reminders. | Add an SMTP/Graph mail adapter behind a feature flag, starting with `review.ready` and `review.returned`. |
| OPS-3 | No retention/cleanup job | P3 | `sessions`, `auth_states`, `login_attempts`, `notifications` and `audit_events` grow forever. Read paths are correct; this is a storage/ops concern. | Add a scheduled job (or `pg_cron`) to purge expired sessions/states/attempts and archive old notifications; define an audit retention policy first. |
| OPS-4 | Cycle phase transitions are manual | P3 | HR advances `DRAFT → SCHEDULED → … → CLOSED` by hand. This is a deliberate product choice, but it should be stated. | Document it in `docs/usage-guide.md`; optionally add due-date-driven reminders (not auto-advance). |
| QA-2 | Lighthouse accessibility/performance audit not run | P3 | The UI is keyboard- and screen-reader-conscious but not audited on the final build. | Run Lighthouse on `/login`, `/dashboard`, `/reviews`; fix any contrast/label findings. |
| FEAT-3 | No bulk export | P3 | Analytics/calibration/reviews are view-only; extracting data needs DB access. Not promised in the docs. | If needed, add CSV export for calibration + analytics with the same RBAC checks. |
| UI-1 | HR sees an admin link it cannot open | P3 | `src/components/admin/admin-tabs.tsx` renders all five tabs to anyone who can enter `/admin`, and the sidebar shows the whole Administration group when `can(user, "cycle:manage")`. HR has `cycle:manage` but not `user:manage`, so **Directory admin** redirects to `/forbidden`. Confusing, though access control is correct. | Filter tabs and nav items by the capability each page requires (`user:manage` for Directory admin) instead of showing them to every admin-ish role. |
| FEAT-4 | Cycle phase is advisory, not enforced | P2 | `saveReview`/`submitReview` only reject `CLOSED` and `ARCHIVED`, so self, manager and calibration work can all be done outside those phases. The phase badge therefore does not express what is actually allowed. Found while writing the manual test plan. | Decide the policy, then enforce it in `loadReviewForActor` (e.g. self only in `SELF_REVIEW`, manager only in `MANAGER_REVIEW`+), or document the phases as labels only. |
| PLT-12 | `lockCycle()` / `publishCycle()` are dead code | P3 | Both are exported server actions that nothing calls. Closing via the phase menu sets `status = CLOSED` (which blocks edits) but does not set `closed_at` or mark reviews `LOCKED`, so the UI and the data disagree. | Wire the **Close** action to `lockCycle()` (and **Publish** to `publishCycle()`), or delete the dead actions and stamp `closed_at` in `updateCycleStatus`. |
| PROC-3 | Mid-year is a label, not a stage | **P2** | Steps 3–4: `cycleTypeEnum.MID_YEAR` only changes a badge. There is no linked mid-year/annual pair, no automatic mid-year phase, and mid-year comments are not carried into the annual review. | Decide whether mid-year is a separate cycle linked to the annual one, or a phase inside a single cycle; then model and schedule it. |
| PROC-4 | No HR review record | **P2** | Step 7: calibration sets a final rating and nine-box values, but there is no HR review task, meeting date, decision note or `HR` reviewer row. HR review exists only implicitly inside calibration. | Add an HR review step (task for the HR partner, notes, confirmed rating) before acknowledgement — or state explicitly that calibration *is* the HR review. |
| PROC-5 | No performance-communication step | **P2** | Step 8: nothing records that manager and employee met to discuss the outcome, and the employee can acknowledge without it. | Add a manager “discussion completed” action (date + note) that unlocks the employee signature, or fold it into the acknowledgement copy if it is not required. |
| PROC-6 | “Signature” is acknowledgement only | P3 | Step 9: `acknowledged_at` plus an optional comment is the only evidence. There is no typed signature, generated PDF or third-party e-signature. | Confirm whether acknowledgement is sufficient. If not, add typed-name confirmation (captured in the audit trail) or an e-sign integration. |
| ENV-1 | Demo database is mutated by manual testing | Housekeeping | `local.ic1`'s manager review is `ACKNOWLEDGED`, `local.exec` is `COMPLETE`, cycle progress is 2/14. Fine for a demo of the flow; not a pristine seed. | `npm run db:reset` when a clean dataset is wanted, then enrol the cycle (manual test plan MT-00). |
| ENV-2 | Dev server stopped, production server running | Housekeeping | `.next` was rebuilt for production; `next dev` on 3000 was stopped to avoid cache contention. | `npm run dev` for port 3000; production is on 3001. |

### 2.1 Process map — the 10-step employee review

The target process has ten steps with a strict hand-off order. This is where the
app stands today.

| Step | Target process | Current behaviour | State |
|---|---|---|---|
| 1 | Employee finalises goals, sends them to the manager | Goals are created as `DRAFT`. “Send for approval” moves them to `SUBMITTED` (bulk on `/goals`, single on the detail page), notifies the manager and audits the submission. People without a manager are auto-approved | ✅ |
| 2 | Manager reviews and approves goals | `/goals` carries a **Goals awaiting your approval** queue limited to direct reports; the manager approves or sends back with a reason (`RETURNED`), which notifies and audits. The owner can edit and resubmit; check-ins require `APPROVED` and edits lock after submit | ✅ |
| 3 | Mid-year self assessment | A self review can be created in any cycle, but a cycle's `type` (`MID_YEAR`, `ANNUAL`, …) is a display label. There is no mid-year/annual pairing or scheduled mid-year phase | 🟡 **PROC-3** |
| 4 | Mid-year manager assessment | Same — possible only if an admin creates a separate mid-year cycle by hand | 🟡 **PROC-3** |
| 5 | Annual self assessment | Exists: `SELF` review, draft → submit, with audit and timestamps | ✅ |
| 6 | Annual manager assessment | Exists as a `MANAGER` review and is now informed by the employee's self assessment: those reviews are readable by the participant's manager once published, the manager is notified on self-submit, and the manager review page links straight to it. Drafts stay private | ✅ |
| 7 | HR review, alignment meeting, final rating | Calibration lets HR/admin set a final rating and nine-box values, with an audit trail. There is no HR review task, meeting record or decision note; the `HR` reviewer type is never generated | 🟡 **PROC-4** |
| 8 | Manager ↔ employee performance communication | Not modelled in the cycle. A 1:1 can be created manually, but it is not linked to the review and nothing records that the conversation happened | ❌ **PROC-5** |
| 9 | Employee signature / acknowledgement | Acknowledgement exists (optional comment + `acknowledged_at`), which is the functional equivalent. There is no typed name, PDF or e-signature evidence | 🟡 **PROC-6** |
| 10 | Completed | Participant becomes `COMPLETE` with `completed_at`; cycle progress and calibration reflect it | ✅ |

Two process-wide gaps cut across all ten steps:

- **Order is not enforced.** `saveReview`/`submitReview` only block `CLOSED` and
  `ARCHIVED` cycles (FEAT-4), so step 6 can be done before step 5 and step 7
  before either. The ten-step flow needs phase/state gating to be real.
- **“Every employee” is not automatic.** Enrolment is an admin action scoped to
  departments (the seeded cycle covers Engineering only). There is no
  “enrol all active employees” or auto-enrol-on-hire rule.

---

## 3. Known limitations by design

| ID | Limitation | Rationale |
|---|---|---|
| LIM-1 | No self-service "forgot password" | There is no email channel (FEAT-2). Admins reset passwords, users can change a known password. |
| LIM-2 | No public sign-up | Accounts are created by an admin or by first SSO sign-in. |
| LIM-3 | Anonymous feedback keeps the author on the row | Recipients see "Anonymous"; the identity is retained for audit and abuse handling. |
| LIM-4 | Audit trail is tamper-**evident**, not tamper-**proof** | The SHA-256 chain detects edits, but a database superuser could rebuild the chain. Ship logs off-box if that threat matters. |
| LIM-5 | In-app notifications only | See FEAT-2. |

---

## 4. Verification log — final build (4 Nov 2026)

| Check | Command / method | Result |
|---|---|---|
| Types | `npm run typecheck` | pass |
| Build | `npm run build` | pass, 20 static pages generated |
| Runtime | `$env:PORT=3001; npm start` | ready, `/api/health` → `{"status":"ok"}` |
| Page sweep (USER + ADMIN) | 15 routes in the browser | 0 console errors, 0 warnings |
| Acknowledgement | `local.ic1` acknowledges manager review | `reviews.status = ACKNOWLEDGED`, `acknowledged_at` set, participant `COMPLETE`, `review.acknowledged` audit row, reviewer notified |
| Managerless completion | `local.exec` submits self assessment | participant `COMPLETE` + `completed_at` |
| Cycle counters | `/reviews` progress panel | self 2/14 · manager 5/14 · complete 2/14 |
| Seed idempotency | scratch DB, `db:migrate` + `db:seed` ×2 | 16 users / 11 goals / 12 competencies / 12 template competencies |
| Goal approval loop (PROC-1) | `local.ic2` creates a goal → send for approval → `local.manager` sends it back with a reason → `local.ic2` edits and resubmits → manager approves | `DRAFT → SUBMITTED → RETURNED → SUBMITTED → APPROVED`; `approval_decided_at` cleared on resubmit then stamped; `approved_by = local.manager`; notifications `goal.approval_requested`, `goal.returned`, `goal.approved`; audit `goal.submitted` ×2, `goal.returned`, `goal.approved`, `goal.updated` |
| Check-in gating (PROC-1) | goal detail while `SUBMITTED` vs `APPROVED` | no check-in control and a "waiting for approval" callout while submitted; **Log check-in** appears after approval and records 30% progress |
| Manager reads self assessment (PROC-2) | `/reviews/cee138f2…` as `local.manager` / as `local.ic2` | 200 with the full self assessment / 404 |
| Manager review hand-off (PROC-2) | `/reviews/2c05a815…` as `local.manager` | **Employee self assessment** card with a working *Read self assessment* link |
| Federated search (PLT-13) | `GET /api/search?q=ship\|approval\|local` | 200 with scoped results; no `22P02` in the server log |
| Audit chain | `npm run verify:audit` | 50 events, chain intact |

### Re-run this checklist

```bash
npm run typecheck
npm run build
$env:PORT="3001"; npm start        # PowerShell
# browse the 15 routes with devtools open; expect zero console errors
npm run verify:audit
```

For a clean end-to-end run: `npm run db:reset`, then enrol a cycle as
`local.admin` and drive self → manager → calibrate → acknowledge.

---

## 5. How to update this tracker

1. Move finished work from §2 into §1 with the evidence that proves it.
2. Add newly discovered gaps to §2 with a priority and a concrete next step.
3. Refresh the "Last updated" date and the status table at the top.
4. Keep IDs stable — reference them in commits and conversation
   (e.g. "closes REV-6").
