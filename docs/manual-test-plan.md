# Meridian — Manual Test Plan

**Audience:** whoever is accepting the build (product owner, QA, or a developer
from another team).
**Scope:** local (non-SSO) sign-in, the review cycle end to end, admin,
preferences, and platform checks. SSO is out of scope — it needs a real Entra ID
tenant (`docs/sso-setup.md`).
**Time:** ~45–60 minutes for the full plan, ~15 minutes for the smoke subset.

Record the ID of anything that fails (for example `MT-06 fail`) so the tracker in
`TRACKER.md` can be updated precisely.

---

## 0. Before you start

### 0.1 Run the app

The production build is normally already running:

| Mode | URL | Command |
|---|---|---|
| Production (standalone) | <http://localhost:3001> | `npm run build` then `$env:PORT=3001; npm start` |
| Development | <http://localhost:3000> | `npm run dev` |

Check it is alive: <http://localhost:3001/api/health> should return
`{"status":"ok",...}`.

Use a desktop browser with DevTools open (Console tab) — one of the checks is
"zero console errors".

> Cookies are shared across `localhost` ports. If you sign in on 3001 and then
> open 3000, you are still signed in. Sign out first if you want a clean start.

### 0.2 Get to a known database state

The seeded demo database drifts as people click around. For a reproducible run:

```powershell
npm run db:reset      # DROP schema + migrate + seed. Destroys all data.
```

If you want to keep the current demo data instead, skip the reset and read
§2.3 — `local.ic2` is intentionally left untouched so the full review flow can
still be exercised.

Re-seeding alone is safe and idempotent (it will not duplicate goals):

```powershell
npm run db:seed
```

> **Important:** a reset leaves the review cycle empty — status **Draft**, zero
> participants, zero reviews. Enrolment is a separate admin step. Run **MT-00**
> before the review suites, or the Reviews pages will legitimately look empty.

### 0.3 What "local" means here

The login page has two ways in:

1. **Continue with Microsoft** — SSO. With the placeholder Entra credentials in
   `.env.local` this fails and shows *"We couldn't reach the identity provider.
   Try again in a moment, or contact IT."* That is the expected, correct
   behaviour. Do not treat it as a defect.
2. **Email/password form** — the local path. Every account below uses it.

---

## 1. Test accounts

All local accounts use the password **`Meridian#2026!`** (14 characters, above
the 12-character minimum).

| Email | Name | Role | Reports to | Use it for |
|---|---|---|---|---|
| `local.admin@metricstream.com` | Local Admin | Administrator | — | Admin screens, creating people, local access, audit |
| `local.hr@metricstream.com` | Local HR | HR business partner | — | Cycles, templates, calibration, org analytics |
| `local.exec@metricstream.com` | Local Executive | Executive (read-only) | — | Org analytics, managerless-completion check |
| `local.manager@metricstream.com` | Local Manager | Employee (manager) | Local Executive | My team, writing manager reviews, 1:1s |
| `local.ic1@metricstream.com` | Local IC One | Employee | Local Manager | Self assessment, goals, feedback, acknowledgement |
| `local.ic2@metricstream.com` | Local IC Two | Employee | Local Manager | Full self → manager → acknowledge flow (clean) |

Hierarchy: `local.exec` ← `local.manager` ← `local.ic1`, `local.ic2`.

Notes:

- These accounts are for development and testing only. `db:reset` recreates
  them; delete them before anything resembling a shared environment.
- The other seeded users (`hari.setty@…`, `alex.manager@…`, …) are **SSO-only**
  and have no password. They cannot be used until a real Entra tenant is wired
  up. They do appear in directories and cycles, so counts include them.
- **Do not** run the wrong-password test on a real account: five failures lock
  it for **15 minutes**. Use a throwaway person created in MT-12 instead.

---

## 2. Baseline data

### 2.1 After `npm run db:reset` (before enrolment)

| Thing | Expected |
|---|---|
| Users | 16 (10 SSO demo + 6 local) |
| Goals | 11 across `local.manager`, `local.ic1`, `local.ic2` and demo users — all `APPROVED`, so check-ins work immediately |
| Competencies | 12 in the default review template |
| Cycle | “FY26 Annual Performance Review”, status **Draft** |
| Participants | 0 — nobody is enrolled by the seed |
| Reviews | 0 |

### 2.2 After MT-00 (enrolment)

| Thing | Expected |
|---|---|
| Participants | 14 — everyone in the Engineering department (the cycle's scope); the two People & Culture users are out of scope |
| Reviews | 24 rows: 10 people × self + manager, plus 4 managerless people with self only |
| Managerless participants | `local.admin`, `local.exec`, `hari.setty`, `vp.engineering` — they complete on self-assessment submit (MT-08) |
| Cycle status | **Scheduled** (enrolment moves a draft forward), then **Self review** if you follow the step in MT-00 |
| Scores | Empty until you press **Recalculate** — enrolment does not compute them |

### 2.3 Current demo data without a reset

The running demo already has the cycle enrolled and in **Self review**, with
`local.ic1`'s manager review **Acknowledged** and `local.exec` **Complete**. Use
`local.ic2` for MT-03 → MT-06: nothing has been done for them yet. Scores for
Local IC Two currently read 35.00 goals / 35.00 overall. All 11 seeded goals are
**Approved**, and the goal-approval queue is empty, so MT-21 starts from a clean slate.

---

## 3. Test suites

Tick **P** (pass) or **F** (fail). Write the ID on anything that fails.

### MT-00 — Prepare the cycle (only after a reset)

Skip this if you kept the existing demo data — it is already enrolled.

| # | Step | Expected |
|---|---|---|
| 1 | Sign in as `local.admin`, open **Administration → Review cycles** | “FY26 Annual Performance Review” is in **Draft** with 0 participants |
| 2 | Click **Enrol** on the cycle | Dialog explains that nobody is enrolled yet |
| 3 | Leave the department boxes **unticked** (empty means *use the cycle's scope*) and submit **Enrol participants** | “Participants enrolled”; 14 participants appear; the cycle moves to **Scheduled** |
| 4 | Open the phase menu and choose **Self review** | Status changes to Self review; the audit trail records `admin.cycle.status` |
| 5 | Click **Recalculate** on the cycle | Scores populate for participants whose goals are linked to the cycle (Local IC Two → 35.00 goals / 35.00 overall) |
| 6 | Sign in as `local.ic2` and open **Reviews** | One self assessment in the queue; the cycle progress panel is visible |
| 7 | Check a participant with no line manager (e.g. `local.exec`) | Self review only — no manager review row |

> Re-running enrolment is safe and idempotent: it fills in anyone new and any
> missing review task, without duplicating participants or reviews.

**P/F:** ______

### MT-01 — Sign in, session, sign out

| # | Step | Expected |
|---|---|---|
| 1 | Open `/dashboard` while signed out | Redirect to `/login?next=%2Fdashboard` |
| 2 | Sign in as `local.ic1@metricstream.com` with `Meridian#2026!` | Lands on `/dashboard` (the `next` target), local login succeeds |
| 3 | Reload `/login` while signed in | Redirected back into the app — no loop, no blank page |
| 4 | Open the avatar menu → **Sign out** | Returns to `/login`; pressing Back may show a cached page, but refreshing or navigating lands on `/login` — the session is revoked server-side |
| 5 | Sign in with the wrong password | Inline error *“Invalid email or password.”* — no hint about which field is wrong |
| 6 | Sign in as `local.admin`, `local.hr`, `local.exec`, `local.manager`, `local.ic2` in turn | Each reaches `/dashboard`; the account menu shows the right name and role |

**P/F:** ______

### MT-02 — Navigation and access control

| # | Step | Expected |
|---|---|---|
| 1 | As `local.ic1` | Sidebar: Dashboard, Goals, Reviews, Feedback, 1:1s, People, Preferences. **No** Leadership or Administration group |
| 2 | As `local.ic1`, open `/admin/cycles` directly | `/forbidden` page, not the admin screen |
| 3 | As `local.manager` | **Leadership** group appears: My team, Analytics |
| 4 | As `local.admin` | **Administration** group appears with all five items; My team and Analytics also visible |
| 5 | As `local.hr` | Administration group visible; **Audit trail** opens fine |
| 6 | As `local.hr`, click **Directory admin** | Expected today: `/forbidden`. *(Tracked as UI-1 — nav shows a link HR cannot open. Report it, don't be surprised by it.)* |
| 7 | As any user, open `/people` and click a person | Profile page loads with role, manager, department |

**P/F:** ______

### MT-03 — Self assessment (`local.ic2`)

| # | Step | Expected |
|---|---|---|
| 1 | Sign in as `local.ic2`; open **Reviews → My queue** | One open item: the self assessment. Cycle progress panel shows the cycle badge |
| 2 | Open the self assessment, add narrative text (and rate any competencies shown) | Save draft succeeds, toast confirms |
| 3 | Reload the page | Draft content is still there (drafts are persisted, not just client state) |
| 4 | Open **About me** | Empty — your own self assessment must never appear here |
| 5 | Return to the draft and **Submit review** | Review shows as submitted; item moves out of the open queue |
| 6 | Go to **About me** | Still empty; acknowledgement count still 0 |
| 7 | Check the review detail page as `local.ic2` | No **Acknowledge review** control on your own self assessment, and no “Your response” card for it |

**P/F:** ______

### MT-04 — Draft manager ratings do not affect scores

Run this *before* submitting the manager review in MT-05.

| # | Step | Expected |
|---|---|---|
| 1 | As `local.manager`, open the manager review for **Local IC Two** | Form with goals + competency ratings |
| 2 | Enter competency ratings (e.g. 4 for each) and **Save draft** | Saved |
| 3 | As `local.admin`, open **Calibration** and find Local IC Two | Scores are unchanged from what MT-00's recalculation produced (35.00 goals / 35.00 overall on a fresh seed). Drafts are invisible to scoring — write the numbers down for comparison |
| 4 | Note the baseline numbers | Used again in MT-05 |

**P/F:** ______

### MT-05 — Manager review and scoring (`local.manager`)

| # | Step | Expected |
|---|---|---|
| 1 | As `local.manager`, open **Reviews → My queue** | Manager reviews for Local IC One and Local IC Two; IC One may already be done |
| 2 | Open the review for **Local IC Two** and look for the **Employee self assessment** card | The card is present. If IC Two has submitted (MT-03), it offers **Read self assessment**; otherwise it says *Not submitted yet* |
| 3 | Click **Read self assessment** | The review opens read-only with IC Two's summary, competencies and goal evidence — no rating controls |
| 4 | Back on the manager review, rate competencies, add a comment and **Submit review** | Submit succeeds; the item leaves the queue |
| 5 | As `local.admin`, open **Calibration** | Local IC Two now has a competencies score and an overall score. Check the arithmetic: `overall = 50% × goals% + 50% × (average rating ÷ 5 × 100)` |
| 6 | In Calibration, look at the competency column | Rendered as a percentage (e.g. `80%`), **not** `4%` |
| 7 | As `local.ic2`, open **Reviews → About me** | The manager review appears, count badge shows 1, status reads as submitted/awaiting acknowledgement |
| 8 | As `local.manager`, check the notification bell | No error; any acknowledgement notification from earlier work is listed |

**P/F:** ______

### MT-06 — Acknowledgement (`local.ic2`)

| # | Step | Expected |
|---|---|---|
| 1 | As `local.ic2`, open the manager review from **About me** | “This review is ready for you.” with an optional comment box and **Acknowledge review** |
| 2 | Leave the comment empty and click **Acknowledge review** | Succeeds — a comment is optional |
| 3 | Reload the review | Status **Acknowledged**, with the timestamp shown in the Details panel; the acknowledgement card is replaced by the acknowledged state |
| 4 | Check **About me** | The awaiting-acknowledgement count drops to 0 for this review |
| 5 | As `local.ic2`, open **Reviews** queue | Cycle progress “Complete” counter increments |
| 6 | As `local.manager`, check the bell | Notification *“Review acknowledged”* |
| 7 | As `local.admin`, open **Audit trail** | A `review.acknowledged` event for Local IC Two |

**P/F:** ______

### MT-07 — Send a review back for revision (optional, needs a fresh submitted review)

Skip if you reset only once and already acknowledged everything; use another
participant (e.g. `local.ic1` after a reset) or reset the database.

| # | Step | Expected |
|---|---|---|
| 1 | As the employee, open a **submitted** manager review | **Something to change?** is available |
| 2 | Click it, leave the reason blank and press **Send back for revision** | Blocked with a validation message (minimum 5 characters) |
| 3 | Enter a reason (≥ 5 chars) and send it back | Review becomes returned; the manager gets a notification |
| 4 | As the manager, reopen the review | It is editable again and can be resubmitted |

**P/F:** ______

### MT-08 — Managerless completion (`local.exec`)

Run this after a reset; in the current demo data `local.exec` has already
completed, so the self review will show as submitted.

| # | Step | Expected |
|---|---|---|
| 1 | Sign in as `local.exec` | Has a self review and **no** manager review in the queue |
| 2 | Submit the self assessment | Participant completes immediately (`COMPLETE`, `completed_at` set) |
| 3 | As `local.admin`, open **Reviews** and read the cycle panel | Managerless people are not counted as outstanding manager reviews |

**P/F:** ______

### MT-09 — Goals and tasks

The seeded goals are already **Approved**, so check-ins work straight away. For the
full draft → submit → approve → check-in loop, run **MT-21**.

| # | Step | Expected |
|---|---|---|
| 1 | As `local.ic1`, open **Goals** | Seeded goals with progress; no error. Each shows an **Approved** badge |
| 2 | Open a goal, **Log check-in** with a new progress value, save | Progress persists after reload; ring/label shows a rounded percentage (no long decimals) |
| 3 | Add a task, then cycle its status (TODO → In progress → Done) | Status changes and survives reload |
| 4 | Create a new goal as `local.ic1` | Created as a draft and visible in your goals list with the visibility you chose — see MT-21 for the approval loop |

**P/F:** ______

### MT-10 — Feedback

| # | Step | Expected |
|---|---|---|
| 1 | As `local.ic1`, give feedback to `local.ic2` | Saved and visible in the feedback list |
| 2 | Give feedback with **anonymous** enabled | The recipient sees “Anonymous” as the giver; you still see it as yours |
| 3 | As `local.ic2`, open **Feedback** | Received feedback is visible; anonymous author is not revealed |

**P/F:** ______

### MT-11 — 1:1s

| # | Step | Expected |
|---|---|---|
| 1 | As `local.manager`, open **1:1s** | Existing or empty state, no error |
| 2 | Create a 1:1 with `local.ic1`, add an agenda item, mark it done | Item state persists after reload |
| 3 | As `local.ic1`, open **1:1s** | The shared 1:1 is visible from the employee side |

**P/F:** ______

### MT-12 — Admin: people and local access (destructive-safe)

Do this as `local.admin`. Use a throwaway person; do not lock a seeded account.

| # | Step | Expected |
|---|---|---|
| 1 | **Administration → Directory admin → Add person** | Dialog opens |
| 2 | Create `qa.temp1@metricstream.com` with sign-in method **Local email & password** and password `TempPass#2026!` | Person created, appears in the directory |
| 3 | Sign out, sign in as `qa.temp1@metricstream.com` | Local login works for an admin-created account |
| 4 | As `local.admin`, edit the person, enter `Rotated#2026!` and click **Rotate password** | Saved; the old password stops working, the new one works |
| 5 | As `qa.temp1`, open **Preferences → Security** and change the password to `SelfChanged#2026!` | Saved; the session stays valid. Sign out and back in with the new password to confirm |
| 6 | Sign out, then enter a wrong password 5 times for `qa.temp1` | After the 5th, the message says the account is locked and shows a retry time (15-minute lock). Only do this on the throwaway account |
| 7 | As `local.admin`, edit the person and deactivate them (for a LOCAL-only account **Disable local** is not offered — that is correct) | The account can no longer sign in; its live sessions are revoked |
| 8 | As `local.admin`, open **Audit trail** | Rows for the create/update/password events, with the actor shown |

**P/F:** ______

### MT-13 — Admin: cycles and enrolment (read-only unless you reset)

| # | Step | Expected |
|---|---|---|
| 1 | **Administration → Review cycles** | “FY26 Annual Performance Review” listed with its phase and participant count |
| 2 | Open the phase menu on the cycle | Current phase shown; other phases selectable. This is manual by design — nothing advances on a timer |
| 3 | As an admin, leave the cycle in **Self review** but open a manager review yourself (if you are also a manager) | Editable — phases like Self/Manager review/Calibration are **advisory** today; only Closed and Archived block writes (tracked as FEAT-4). Report if you consider this wrong |
| 4 | Open **Enrol participants** | Dialog lists eligible people; cancel to avoid changing data |
| 5 | If you are willing to mutate data: enrol a fresh cycle, then check **Reviews** as an enrolled employee | Self + manager reviews are generated. Peer reviews are **not** generated (tracked as FEAT-1) |
| 6 | Optional, last: move the cycle to **Closed**, then try to edit a review | Editing is blocked. Note whether `closed_at` is set and reviews become `LOCKED` — closing via the phase menu currently only changes the status (tracked as PLT-12). Move the cycle back to Self review afterwards |

**P/F:** ______

### MT-14 — Admin: templates

| # | Step | Expected |
|---|---|---|
| 1 | **Administration → Templates** | Page loads (this used to 500) and lists the default template with its competencies |
| 2 | Open a template | Competencies, weights and rating scale visible |

**P/F:** ______

### MT-15 — Admin: calibration

| # | Step | Expected |
|---|---|---|
| 1 | **Administration → Calibration** | Table of participants with goals/competencies/overall/proposed rating |
| 2 | Change a final rating and nine-box values for one participant | Saved; survives reload |
| 3 | Use **Recalculate scores** (cycle menu) | Scores recompute from the current submitted reviews; drafts are still excluded |
| 4 | As `local.hr` | Same calibration screen is available |

**P/F:** ______

### MT-16 — Audit trail integrity

| # | Step | Expected |
|---|---|---|
| 1 | **Administration → Audit trail** | Recent events listed, newest first; chain head shown |
| 2 | In a terminal: `npm run verify:audit` | Prints the event count and reports the chain intact |
| 3 | Filter by an action you just performed (e.g. `review.acknowledged`) | The row is present with actor, entity and target |

**P/F:** ______

### MT-17 — Preferences

| # | Step | Expected |
|---|---|---|
| 1 | Open **Preferences → Profile** and change display name or job title | Saved, and the header updates after refresh |
| 2 | **Preferences → Security** | “Change local password” is visible and works for local accounts (it is hidden for accounts without a password — SSO-only users, once Entra is configured) |
| 3 | Try a new password shorter than 12 characters | Blocked |
| 4 | Mismatch the confirmation field | “The two new passwords don't match.” |
| 5 | Change the password successfully, then change it back | Both succeed; the session stays valid |
| 6 | **Preferences → Notifications** | Toggles save and persist |

> If you change a seeded account's password, change it back to `Meridian#2026!`
> so the next tester is not locked out.

**P/F:** ______

### MT-18 — Analytics and directory

| # | Step | Expected |
|---|---|---|
| 1 | As `local.exec`, open **Analytics** | Org-wide charts render (department performance used to error) |
| 2 | As `local.manager`, open **My team** | Direct reports only, with review status |
| 3 | As `local.ic1`, open `/analytics` directly | Redirected to **My team** (a user has team analytics but not org analytics) — no error page |
| 4 | As any user, open **People** and search | Search filters the directory |

**P/F:** ______

### MT-19 — Platform checks

| # | Step | Expected |
|---|---|---|
| 1 | Open `/api/health` | `{"status":"ok",...}` including a DB latency figure |
| 2 | Toggle dark/light in the header; reload | Theme persists, **no flash** of the wrong theme, no React hydration warning |
| 3 | Shrink the window to ~375 px wide | Sidebar collapses to a menu button; pages remain usable |
| 4 | Keep DevTools Console open through MT-03 → MT-06 | **Zero errors, zero warnings** (a 401 on an unauthenticated fetch is not expected) |
| 5 | Check the Network tab for fonts | Fonts load from `/fonts/*.woff2` — no requests to Google Fonts or other third parties |

**P/F:** ______

### MT-20 — Security negatives

| # | Step | Expected |
|---|---|---|
| 1 | Signed out, open `/reviews` | Redirect to `/login?next=%2Freviews` |
| 2 | Open `/login?next=https://example.com` and sign in | You land inside Meridian, **not** on example.com (no open redirect) |
| 3 | Open `/login?next=/\evil.example` and sign in | Same — rejected, lands on `/dashboard` |
| 4 | As `local.ic1`, find your own self review URL and try to acknowledge it | No acknowledge control; the server rejects the action if forced |
| 5 | As `local.ic1`, POST/visit an admin-only URL | `/forbidden` |
| 6 | Check response headers on any page | `Content-Security-Policy`, `X-Frame-Options`/frame-ancestors, `Referrer-Policy` present |

**P/F:** ______

### MT-21 — Goal approval loop (`local.ic2` → `local.manager`)

Run this before MT-09 if you want the check-in gating to make sense: a new goal is
not checkable until a manager approves it. `local.ic2` is a clean path — they
report to `local.manager` and their seeded goal is already approved.

| # | Step | Expected |
|---|---|---|
| 1 | As `local.ic2`, open **Goals → New goal** and create a goal with a title, a target and a due date | Goal is created as **Not sent** / **Draft**. A banner reads *“1 goal not yet approved”* with a **Send 1 goal for approval** button |
| 2 | Open the new goal | Approval badge reads **Not sent for approval**; **Log check-in** is **not** offered (check-ins open on approval); **Edit goal** and **Send for approval** are available |
| 3 | Go back to **Goals** and click **Send 1 goal for approval** | Toast *“1 goal sent to your manager.”* Badge changes to **Awaiting approval**; the banner disappears |
| 4 | As `local.manager`, open **Goals** | **Goals awaiting your approval** queue shows the goal with the owner, cycle, weight and how long ago it was sent |
| 5 | Click **Send back**, leave the reason blank and confirm | Blocked with a validation message — a reason is required (minimum length) |
| 6 | Enter a reason (e.g. *“Add a measurable target.”*) and **Send back** | The goal leaves the queue; the owner gets a notification *“Goals sent back for revision”* |
| 7 | As `local.ic2`, reopen the goal | Badge **Sent back**, with the manager's reason in a callout and *“Update the goal, then resubmit it for approval.”* **Log check-in** is still unavailable |
| 8 | Click **Edit goal**, change the title/target and save, then **Resubmit for approval** | Toast *“Goal updated”*, then *“1 goal sent to your manager.”* Badge returns to **Awaiting approval**; the returned reason is no longer shown as an outstanding action |
| 9 | Try to check in while the goal is awaiting approval | Not possible — no **Log check-in** control |
| 10 | As `local.manager`, open **Goals** and click **Approve** | The queue empties; the owner gets *“Goal approved”*; the goal detail page shows an **Approved** date row in *At a glance* |
| 11 | As `local.ic2`, reopen the goal and log a check-in (e.g. 30%) | **Log check-in** is now available and the check-in saves; badge is **Approved** |
| 12 | As `local.admin`, open **Audit trail** | `goal.submitted` (twice), `goal.returned`, `goal.approved` and `goal.updated` rows against the goal, with the actor |

Optional: repeat step 1 as `local.exec` (no manager) — such goals are
auto-approved on creation, so no approval queue item ever appears.

**Clean-up:** archive or delete the throwaway goal so the demo data stays tidy.
The other seeded goals are already `APPROVED`, so a fresh seed has nothing
waiting in the queue.

**P/F:** ______

---

## 4. Sign-off

| ID | Suite | Result | Notes |
|---|---|---|---|
| MT-00 | Prepare the cycle (after reset) | | |
| MT-01 | Sign in / session | | |
| MT-02 | Navigation / RBAC | | |
| MT-03 | Self assessment | | |
| MT-04 | Drafts excluded from scores | | |
| MT-05 | Manager review / scoring | | |
| MT-06 | Acknowledgement | | |
| MT-07 | Return for revision | | |
| MT-08 | Managerless completion | | |
| MT-09 | Goals / tasks | | |
| MT-10 | Feedback | | |
| MT-11 | 1:1s | | |
| MT-12 | Admin: people / local access | | |
| MT-13 | Admin: cycles / enrolment | | |
| MT-14 | Admin: templates | | |
| MT-15 | Admin: calibration | | |
| MT-16 | Audit trail | | |
| MT-17 | Preferences | | |
| MT-18 | Analytics / directory | | |
| MT-19 | Platform | | |
| MT-20 | Security negatives | | |
| MT-21 | Goal approval loop | | |

Tester: ____________________  Date: ____________  Build/commit: ____________

---

## 5. Appendix — verifying state directly

Read-only checks, if you want to confirm the UI is telling the truth.

```powershell
# Review statuses per person
docker exec meridian-dev-postgres-1 psql -U meridian -d meridian -c "
select u.email, r.reviewer_type, r.status,
       (r.acknowledged_at is not null) as acknowledged,
       cp.status as participant
from reviews r
join cycle_participants cp on cp.id = r.participant_id
join users u on u.id = cp.employee_id
order by u.email, r.reviewer_type;"

# Participant scores
docker exec meridian-dev-postgres-1 psql -U meridian -d meridian -c "
select u.display_name, cp.status, cp.goals_score, cp.competencies_score,
       cp.overall_score, cp.proposed_rating, cp.final_rating
from cycle_participants cp
join users u on u.id = cp.employee_id
order by u.display_name;"

# Cycle progress counters
docker exec meridian-dev-postgres-1 psql -U meridian -d meridian -c "
select count(*) filter (where r.reviewer_type = 'SELF' and r.status in ('SUBMITTED','ACKNOWLEDGED','LOCKED')) as self_done,
       count(*) filter (where r.reviewer_type = 'MANAGER' and r.status in ('SUBMITTED','ACKNOWLEDGED','LOCKED')) as manager_done,
       count(*) filter (where cp.status = 'COMPLETE') as complete,
       count(*) as participants
from cycle_participants cp
left join reviews r on r.participant_id = cp.id;"

# Goal approval state and who decided
docker exec meridian-dev-postgres-1 psql -U meridian -d meridian -c "
select g.title, g.approval_status, u.email as decided_by,
       g.approval_decided_at, g.approval_comment
from goals g
left join users u on u.id = g.approved_by
order by g.created_at desc;"
```

If the database container has a different name, substitute it from
`docker ps` (the dev compose file names it `meridian-dev-postgres-1`).

---

## 6. Known expected behaviour (not defects)

| Observation | Why |
|---|---|
| Microsoft sign-in fails with “couldn't reach the identity provider” | Entra credentials are placeholders until a real app registration exists (OPS-1) |
| No welcome / review-due / password-reset emails | Notifications are in-app only today (FEAT-2) |
| Peer reviews are never generated | Cycle config stores the toggle, but enrolment only creates self + manager reviews (FEAT-1) |
| Manager cannot read the employee's submitted self assessment — **fixed** | Since PROC-2 the participant's manager can open any published (`SUBMITTED`/`ACKNOWLEDGED`/`LOCKED`) self assessment. A draft stays private to its author |
| Goals now need manager approval before check-ins — **new** | Since PROC-1 a goal is `DRAFT` until sent for approval; check-ins and scoring evidence only open once it is `APPROVED`. People with no manager are auto-approved |
| Cycle phase does not advance on its own | Deliberate: HR moves it manually (OPS-4) |
| A review can be written while the cycle is in another phase | Phase transitions are advisory: only `CLOSED`/`ARCHIVED` block writes (FEAT-4) |
| Closing via the phase menu does not stamp `closed_at` or mark reviews `LOCKED` | The `lockCycle()` implementation exists but the menu does not call it (PLT-12); edits are still blocked by the status check |
| `local.hr` can see a **Directory admin** link that ends at `/forbidden` | Navigation does not yet filter that tab by capability (UI-1) |
| Old sessions, login attempts or notifications are never deleted | No retention job yet (OPS-3); correctness is unaffected |
