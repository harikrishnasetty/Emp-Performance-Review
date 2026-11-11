# 🚀 Meridian Local Development — Quick Start Steps

This file provides the **essential minimal steps** to get Meridian running locally for testing. 
For production deployment steps, see `docs/deployment.md`.

---

## ✅ Prerequisites (Install These First)

### 1. Node.js ≥ 22
```bash
# Check version
node -v

# If needed, install Node 22 from https://nodejs.org/en/download/
# Windows users: Use the MSI installer
# macOS users: `brew install node@22`
# Linux users: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`
```

### 2. Docker Desktop
Download and install from: https://www.docker.com/products/docker-desktop/
- Available for Windows 10/11 and macOS
- Requires virtualization enabled in BIOS (VT-x/AMD-V)
- After installation, restart your computer
- Verify: `docker --version` and `docker compose version`

### 3. npm (bundled with Node)
```bash
npm -v
# Should show v10.8.0 or higher (comes with Node 22)
```

---

## 📦 Step 1: Clone the Repository

```bash
# Using GitHub CLI
gh repo clone harikrishnasetty/Emp-Performance-Review

# Or using git
git clone https://github.com/harikrishnasetty/Emp-Performance-Review.git

cd Emp-Performance-Review
```

---

## 🐋 Step 2: Start Docker Infrastructure (Postgres + Redis)

```bash
# Start the dev-only containers (Postgres on port 5432, Redis on port 6379)
docker compose -f docker-compose.dev.yml up -d

# Wait for containers to be healthy (takes ~10-15 seconds)
# Check status:
docker compose -f docker-compose.dev.yml ps

# Expected output:
# NAME               COMMAND                  STATE             PORTS
# meridian-dev-postgres-1   "docker-entrypoint.sh postgres"   healthy   0.0.0.5432->5432/tcp
# meridian-dev-redis-1      "redis-server"              healthy   0.0.0.6379->6379/tcp
```

### To stop later:
```bash
# Stop but keep data
docker compose -f docker-compose.dev.yml down

# Stop and wipe data (start fresh next time)
docker compose -f docker-compose.dev.yml down -v
```

---

## 🌿 Step 3: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env.local
```

### Edit `.env.local` (only these fields need changing for local dev):

| Variable | Default | Action Needed |
|----------|---------|---------------|
| `NODE_ENV` | `development` | Usually leave as-is |
| `APP_URL` | `http://localhost:3000` | Leave as-is for local dev |
| `APP_NAME` | `Meridian` | Leave as-is |
| `DATABASE_URL` | `postgresql://meridian:change-me-in-production@localhost:5432/meridian` | **Ensure this matches** `POSTGRES_PASSWORD` in docker-compose.dev.yml (both default to `change-me-in-production`) |
| `DATABASE_POOL_URL` | Same as DATABASE_URL | Leave as-is (points to same Postgres instance) |
| `FIELD_ENCRYPTION_KEY` | `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=` | **Generate new:** `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `APP_SECRET` | `replace-with-64-hex-chars` | **Generate new:** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENTRA_TENANT_ID` | `00000000-0000-0000-0000-000000000000` | **Set any non-empty value** if testing SSO, or leave as-is for local login only |
| `ENTRA_CLIENT_ID` | `00000000-0000-0000-0000-000000000000` | Same as above |
| `ENTRA_CLIENT_SECRET` | `replace-with-client-secret` | Same as above |
| `ALLOWED_EMAIL_DOMAINS` | `metricstream.com` | Change to your domain, or remove restrictions for testing |
| `ENTRA_STRICT_TENANT` | `true` | Set to `false` for testing without real Entra ID |
| `SESSION_ABSOLUTE_HOURS` | `12` | Leave as-is |
| `SESSION_IDLE_MINUTES` | `45` | Leave as-is |
| `COOKIE_SECURE` | `false` | **Important for local HTTP:** Leave as `false` (HTTPS not required locally) |
| `TRUST_PROXY` | `true` | Leave as-is |
| `RATE_LIMIT_AUTH_PER_MIN` | `20` | Leave as-is |
| `RATE_LIMIT_API_PER_MIN` | `300` | Leave as-is |
| `BOOTSTRAP_ADMIN_EMAIL` | `hari.setty@metricstream.com` | **Change to your email** if you want first SSO login to be promoted to ADMIN |
| `SEED_DEMO_DATA` | `true` | Leave as `true` for local dev (creates test accounts) |
| `LOG_LEVEL` | `info` | Leave as-is |
| `LOG_PRETTY` | `true` | Leave as-is |

### 🔑 Generate Secure Keys (run once):

```bash
# FIELD_ENCRYPTION_KEY - 32 random bytes for AES-256-GCM
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# APP_SECRET - 64 random hex characters for CSRF protection
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example `.env.local` contents:**
```
NODE_ENV=development
APP_URL=http://localhost:3000
APP_NAME=Meridian
DATABASE_URL=postgresql://meridian:change-me-in-production@localhost:5432/meridian
DATABASE_POOL_URL=postgresql://meridian:change-me-in-production@localhost:5432/meridian
DATABASE_POOL_MAX=20
DATABASE_SSL=false
RLS_ENFORCE=false
REDIS_URL=redis://localhost:6379
REDIS_REQUIRED=false
ENTRA_TENANT_ID=00000000-0000-0000-0000-000000000000
ENTRA_CLIENT_ID=00000000-0000-0000-0000-000000000000
ENTRA_CLIENT_SECRET=replace-with-client-secret
ALLOWED_EMAIL_DOMAINS=metricstream.com
ENTRA_STRICT_TENANT=false
FIELD_ENCRYPTION_KEY=AAAABBBBCCCCDDDDEEEEFFFGGGHHHHIII=
APP_SECRET=A1B2C3D4E5F60718293A4B5C6D7E8F9A0B1C2D3E4F50718293A4B5C6D7E8F9A
SESSION_ABSOLUTE_HOURS=12
SESSION_IDLE_MINUTES=45
COOKIE_SECURE=false
TRUST_PROXY=true
RATE_LIMIT_AUTH_PER_MIN=20
RATE_LIMIT_API_PER_MIN=300
BOOTSTRAP_ADMIN_EMAIL=your.name@yourcompany.com
SEED_DEMO_DATA=true
LOG_LEVEL=info
LOG_PRETTY=true
```

---

## 🗄️ Step 3: Run Migrations and Seed Data

```bash
# Run pending migrations
npm run db:migrate

# Seed the demo organization, competencies, templates, cycle, and test accounts
npm run db:seed
```

### What `db:seed` creates:
- ✅ Demo org: 5 departments, 7 employees
- ✅ Review cycle: "Annual 2026" with template
- ✅ Competencies: Core functional leadership values
- ✅ 6 local (non-SSO) test accounts with password `Meridian#2026!`
- ✅ Goals assigned to manager → IC hierarchy accounts
- ✅ Review templates and rating scales

### Test Accounts (all use same password):

| Email | Role | Good For |
|-------|------|----------|
| `local.admin@metricstream.com` | Administrator | Admin screens, creating people, audit |
| `local.hr@metricstream.com` | HR business partner | Cycles, templates, calibration |
| `local.exec@metricstream.com` | Executive (read-only) | Org-wide read-only analytics |
| `local.manager@metricstream.com` | Employee (manager) | Team view, manager reviews, 1:1s |
| `local.ic1@metricstream.com` | Employee | Self-reviews, goals, feedback |
| `local.ic2@metricstream.com` | Employee | Peer feedback, goals |

### To start over from clean schema:
```bash
npm run db:reset   # migrates --reset + seeds
```

---

## 🚀 Step 4: Run the Application

```bash
npm run dev
```

### What this does:
- Starts Next.js 16 with Turbopack on `http://localhost:3000`
- Hot module replacement (HMR) enabled
- Reads `.env.local` for configuration
- App connects to Docker containers (Postgres on 5432, Redis on 6379)

### Expected output:
```
> emp-performance-review@1.0.0
> next dev --turbo

 ✓ Latest compilation completed
 ✓ Performing type-check via tsc
  △ Modules loaded: 124
  △ Modules cached: 124

  ✓ trichotomy
  ✓ version

  64.8 kB ► /   0.0s

  � event        0 took 12ms
  ✓ &#123;Vuetify&#125;  •  523 B ─  1.2kB (️gzip)
```
  
---

## 🔑 Step 5: Log In and Test

Open http://localhost:3000 in your browser.

### Login Page Options:

```
┌─────────────────────────────────────────────┐
│                Sign In                      │
├─────────────────────────────────────────────┤
│  Continue with Microsoft  (will fail without Entra ID)    │
│                                                 │
│  Email                                                │
│  [                                                      ]│
│  Password                                             │
│  [                                                      ]│
│  • Forgot password?                                   │
│                                                 │
│  [ Sign In button ]                                │
├─────────────────────────────────────────────┘
```

### Use **Email/Password** (works immediately):

| Email | Password | Role |
|-------|----------|------|
| `local.admin@metricstream.com` | `Meridian#2026!` | Administrator |
| `local.hr@metricstream.com` | `Meridian#2026!` | HR |
| `local.exec@metricstream.com` | `Meridian#2026!` | Executive |
| `local.manager@metricstream.com` | `Meridian#2026!` | Manager |
| `local.ic1@metricstream.com` | `Meridian#2026!` | IC One |
| `local.ic2@metricstream.com` | `Meridian#2026!` | IC Two |

### 🎯 Quick Test Flow:

1. **Login as `local.admin`** → Go to Admin → People → Add new user
2. **Login as `local.hr`** → Go to Admin → Cycles → Create review cycle
3. **Login as `local.manager`** → Create goals, submit for approval
4. **Login as `local.ic1`** → Fill self-assessment, view dashboard
5. **All roles** → Test 1:1 scheduling, feedback, profile editing

---

## 🛠️ Step 6: Common Operations

### Rotate Test Account Passwords (as Admin):
1. Login as `local.admin`
2. Go to Admin → People → Select user → Edit → Local access → Enter new password → Rotate
3. Or use: `npm run verify:audit` to see audit trail

### Change Your Own Password (as local user):
1. Login → Preferences → Security → Change local password
2. Enter current password `Meridian#2026!` → Enter new password (≥12 chars)

### Delete Test Accounts (before prod deployment):
```bash
# SQL via Drizzle Studio or psql
npm run db:studio

# Or direct SQL
delete from users where email in (
  'local.admin@metricstream.com',
  'local.hr@metricstream.com',
  'local.exec@metricstream.com',
  'local.manager@metricstream.com',
  'local.ic1@metricstream.com',
  'local.ic2@metricstream.com'
);
```

### Stop Containers:
```bash
docker compose -f docker-compose.dev.yml down
# To wipe and start fresh:
docker compose -f docker-compose.dev.yml down -v
```

---

## 🚨 Troubleshooting

| Issue | Fix |
|-------|-----|
| `password authentication failed for user "meridian"` | Match `DATABASE_URL` password with `POSTGRES_PASSWORD` in docker-compose.dev.yml (both default to `change-me-in-production`) |
| `ECONNREFUSED ...:6432` | `docker-compose.dev.yml` doesn't run PgBouncer — ensure `DATABASE_POOL_URL` points at same Postgres as `DATABASE_URL` (port 5432) |
| `Scripts can't reach the DB` | Run `docker compose -f docker-compose.dev.yml ps` → confirm containers are up and healthy; wait ~5s after `up -d` |
| `Login works but session doesn't persist` | Accessing via non-localhost IP? Set `COOKIE_SECURE=false` in `.env.local` (already default) |
| `Port 3000 already in use` | Kill stale process: Windows `taskkill /PID <pid> /F`, macOS/Linux `kill <pid>` |
| `Typecheck/build stale errors` | Delete `tsconfig.tsbuildinfo` to force full `tsc` run |
| `Microsoft SSO button fails at callback` | Expected without Entra ID config — use email/password login instead |
| `Rate limit exceeded` | Default: 10 attempts/minute per email, locks 15min after 5 failures |

---

## 📦 Step 7: When Done - Shut Down

```bash
# Stop containers, keep data
docker compose -f docker-compose.dev.yml down

# Stop containers, wipe data (fresh start next time)
docker compose -f docker-compose.dev.yml down -v

# Stop Next.js dev server
# Ctrl+C in the terminal where `npm run dev` is running
```

---

## 📋 Quick Checklist Before Testing

- [ ] Node.js ≥ 22 installed
- [ ] Docker Desktop running and accessible
- [ ] `docker compose -f docker-compose.dev.yml up -d` containers healthy
- [ ] `.env.local` created with generated `FIELD_ENCRYPTION_KEY` and `APP_SECRET`
- [ ] `npm run db:migrate` completed without errors
- [ ] `npm run db:seed` completed (6 test accounts created)
- [ ] `npm run dev` running at http://localhost:3000
- [ ] Test accounts login with password `Meridian#2026!`
- [ ] `COOKIE_SECURE=false` in `.env.local` (for HTTP localhost)

---

## 🆘 Need Help?

- `docs/setup.md` — Full detailed setup (243 lines)
- `docs/sso-setup.md` — Azure Entra ID configuration
- `docs/deployment.md` — Production deployment guide
- `npm run verify:audit` — Verify audit chain integrity
- Check troubleshooting table above for common issues

---

**🎉 You're ready to test!** Follow the steps above and you'll have Meridian running locally in ~10 minutes.