# Usage guide

A tour of Meridian for end users, managers, HR/admins — and how to drive it
through each role. For installing/running the app, see `docs/setup.md`
(local) or `docs/deployment.md` (production).

## Signing in

Go to `/login`. There are two ways in:

1. **Continue with Microsoft** — the primary path for everyone. Single
   sign-on via Azure Entra ID; no separate password. New employees are
   provisioned automatically on first sign-in, with access governed by role
   and reporting line (`docs/sso-setup.md`).
2. **Email/password (local login)** — accounts created by an administrator
   for people who don't use Entra ID (contractors, vendors) or as a
   break-glass path if Entra ID is unreachable. Your administrator issues the
   initial password; you can change it under **Preferences → Security**.
   See `docs/sso-setup.md#local-non-sso-accounts` for provisioning, and
   `docs/setup.md#testing-local-non-sso-login` for the disposable accounts
   seeded in development.

Sessions are server-side and cookie-bound, with an idle timeout and an
absolute lifetime (shown on the sign-in page). Signing out (or an admin
changing your role/deactivating you) revokes all your active sessions
immediately.

## Roles

| Role | Can do |
|---|---|
| **USER** (employee) | Manage their own goals, submit self/manager/peer reviews, give and request feedback, run 1:1s with their manager, see their own analytics. |
| **EXEC** | Everything a `USER` can, plus read-only visibility into reviews, goals and analytics across the org. Cannot edit other people's records. |
| **HR** | Everything an `EXEC` can, plus manage review cycles, templates and calibration, and read the audit trail. Manages *process*, not individual outcomes. |
| **ADMIN** | Everything, plus add people, manage users/roles/departments, org settings, and local (non-SSO) passwords. |

Capabilities are enforced server-side on every action (`src/lib/auth/rbac.ts`,
`src/lib/actions.ts`) — the UI only hides what you can't do, it doesn't rely
on that hiding for security.

In addition to role, most reads/writes about *other people's* records are
gated by a relationship check: you can always see/act on your own data, and a
manager can see their reporting subtree (direct and indirect reports), even
without the broader "read all" capability.

## Navigation

**Workspace** (everyone):
- **Dashboard** — personal overview: open tasks, goal progress, upcoming 1:1s.
- **Goals** — create goals, log check-ins, track progress against a target.
- **Reviews** — self/manager/peer review forms for the active cycle; shows a
  badge with your pending review count.
- **Feedback** — give, request and acknowledge continuous feedback.
- **1:1s** — schedule and run one-on-one meetings with shared notes/agenda.

**Leadership** (visible once you manage a cycle or have reports):
- **My team** — your direct/indirect reports and their status at a glance.
- **Analytics** — nine-box talent mapping, rating distributions, department
  benchmarks.

**Organisation** (everyone):
- **People** — company directory.
- **Preferences** — your own settings, notification prefs, session management
  (`src/components/settings/signout-all-button.tsx` signs you out everywhere)
  and, for local accounts, a self-service password change.

**Administration** (`ADMIN`/`HR`, i.e. anyone who can manage cycles):
- **Review cycles** — create/configure review cycles (self/peer/manager
  toggles, weighting, dates, departments in scope).
- **Templates** — competency templates used by review cycles.
- **Calibration** — cross-manager rating calibration sessions.
- **Directory admin** — add people (SSO or local password), then edit job
  title, department, manager, system role, employment status, the local
  (non-SSO) password and whether local access is enabled (`ADMIN` only, via
  `adminCreatePerson` / `adminSetPassword` / `adminDisableLocalAccess`).
- **Audit trail** — browse the append-only, hash-chained log of privileged
  actions (`ADMIN`/`HR`, via the `audit:read` capability).

## Typical workflows

### Running a review cycle (HR/Admin)

1. **Admin → Templates**: define or reuse a competency template.
2. **Admin → Review cycles**: create a cycle, pick the template and rating
   scale, set self/peer/manager toggles and due dates, scope it to
   department(s), publish it.
3. Employees get self-review tasks and managers get manager-review tasks at
   enrolment. A manager can open a direct report's **submitted** self
   assessment from the *Employee self assessment* card on the manager review
   (drafts stay private to their author), and is notified when one is submitted.
   Progress shows on each person's dashboard and the HR/Admin's cycle view.
4. **Admin → Calibration**: once reviews are in, run calibration to align
   ratings across managers before finalising.
5. Employees open **Reviews → About me** to read their manager's review and
   acknowledge it (which completes their participant record), or send it back
   for revision with a reason. A self assessment is never acknowledged by its
   author — it stays in the author's queue instead. People without a line
   manager have no manager review to acknowledge, so their self assessment is
   the last step and completes their record.

### Setting and tracking goals (everyone)

1. **Goals** → new goal: title, category, metric type, start/target value,
   weight, priority, visibility (who besides your manager can see it). A new
   goal starts as a **draft** — it is not yet approved by your manager.
2. **Send it for approval**: use **Send for approval** on the goal, or the
   *“N goals not yet approved”* banner on **Goals** to send them in bulk. While
   a goal is **Awaiting approval** you can read it but not check it in.
3. **Manager sign-off**: a manager opens **Goals → Goals awaiting your
   approval** and either **Approve**s the goal or **Send back**s it with a
   reason. Sent-back goals show the reason to the owner along with an **Edit
   goal** action; fix the target and **Resubmit for approval**. People with no
   line manager have their goals approved automatically so they are never
   blocked.
4. Once a goal is **Approved**, log progress via check-ins as work happens;
   status (on track / at risk / off track) is derived from progress vs. the
   goal's timeline. Edits lock while a goal is submitted or approved.
5. Goals typically feed into the competencies/goals weighting configured on
   the active review cycle. Every submit, approve and return decision is
   notified in-app and written to the audit trail.

### Giving and requesting feedback (everyone)

- **Feedback → Request feedback**: ask a peer or manager for input on a
  person (or yourself).
- **Feedback → Give feedback**: free-form, acknowledged by the recipient so
  there's a record of it having been seen.

### Running a 1:1 (manager + report)

- **1:1s → Schedule**: pick a date/cadence with a direct report.
- **1:1s → [meeting]**: shared workspace for agenda items and notes during
  the meeting.

### Administering people (Admin)

- **Admin → People → Add person**: create a directory entry immediately.
  Choose **Microsoft Entra ID (SSO)** for employees, or **Local email &
  password** for people who don't use SSO (or for a break-glass account).
  Local accounts can sign in as soon as they're created — there is no invite
  email, so pass the initial password over a secure channel.
- The **Sign-in** column shows `sso`, `local` or `sso + local` per person.
- **Edit** on a row opens job title, department, manager, role, status and the
  local-password panel. From there you can rotate the password or **Disable
  local** access (SSO keeps working).
- Changing someone's role or deactivating them takes effect immediately and
  signs them out of every active session — the UI warns you before you
  confirm.
- Local users can change their own password under **Preferences → Security**.

## Data protection & audit, in brief

- Sensitive free text (review commentary, 1:1 notes, feedback) is encrypted
  at rest.
- Every privileged action (role changes, password sets, cycle/template
  changes, deactivations, etc.) is written to an append-only, hash-chained
  audit trail, visible to `HR`/`ADMIN` under **Admin → Audit trail** and
  verifiable offline with `npm run verify:audit`.

See `docs/security.md` for the full security model.
