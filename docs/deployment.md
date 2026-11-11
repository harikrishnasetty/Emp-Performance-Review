# 🚀 Production Deployment Guide

This guide covers deploying Meridian to a **production Linux VM** with Docker Compose.
For local development steps, see `docs/setup.md`.

---

## 📋 Prerequisites (Must Have Before Starting)

### 1. Linux VM
- Any cloud provider (AWS EC2, GCP VM, Azure VM, DigitalOcean, etc.)
- Minimum: 2 vCPUs, 2GB RAM (4 vCPUs, 4GB recommended for production)
- OS: Ubuntu 22.04, Debian 12, or CentOS 9
- Sudo/root access

### 2. Docker and Docker Compose
```bash
# Install Docker on Ubuntu/Debian:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group (logout/in required):
sudo usermod -aG docker $USER

# Verify installation:
docker --version
docker compose version

# Install Docker Compose plugin (if not included):
sudo apt-get install docker-compose-plugin
```

### 3. PostgreSQL 16 Database
- Docker Compose includes Postgres (no separate install needed)
- Or external RDS/Azure PostgreSQL if preferred

### 4. Redis 7
- Docker Compose includes Redis (no separate install needed)
- Or external Redis cluster

### 5. TLS Certificates for Your Domain
- **Required** for HTTPS and secure cookies
- Obtain from Let's Encrypt (`certbot`) or purchase from CA
- Place in `certs/` directory on the VM:
  - `certs/fullchain.pem` (full chain certificate)
  - `certs/privkey.pem` (private key)

### 6. Azure Entra ID App Registration **(Required for SSO)**
This is the sign-in method for all regular users.

#### Step-by-step: Create Entra ID App Registration

1. **Go to Azure Portal**: https://portal.azure.com

2. **Navigate to App Registrations**:
   - Left menu → **Microsoft Entra ID** → **App registrations** → **New registration**

3. **Register the application**:
   - **Name**: `Meridian Performance`
   - **Supported account types**: *Select based on your organization*:
     - **Accounts in this organizational directory only** (single tenant) — for in-house deployments
     - **Accounts in any organizational directory** (default directory only — multi-tenant)
     - **Accounts in any organizational directory (any Azure AD directory — multi-tenant)**
   - **Redirect URI**: `https://your.domain/api/auth/callback/entra`
     - Replace `your.domain` with your actual production domain
     - Must match exactly what you put in `APP_URL`

4. **Application (client) ID**: Copy this value → `ENTRA_CLIENT_ID`

5. **Directory (tenant) ID**: Copy this value → `ENTRA_TENANT_ID`

6. **Certificates & secrets**:
   - Left menu for the app → **Certificates & secrets** → **New client secret**
   - **Description**: `Meridian Production`
   - **Expires**: Choose (e.g., 1 year, then rotate)
   - **Value**: Copy the generated secret → `ENTRA_CLIENT_SECRET`
   - **Important**: Store this securely — you won't be able to retrieve it again

7. **API permissions**:
   - Left menu → **API permissions** → **Add a permission**
   - **Microsoft Graph** → **Application permissions**:
     - `User.Read.All`
     - `Directory.Read.All`
     - `Directory.ReadWrite.All`
   - **Microsoft Graph** → **Delegated permissions** (also add):
     - `User.Read`
     - `User.ReadBasic.All`
     - `Directory.Read.All`
   - **Click **Grant admin consent for **{your organization}******

8. **Configure manifest (optional but recommended)**:
   - Left menu → **Manifest** → Set `groupMembershipClaims` to `All`
   - This allows the app to see group membership for role-based access

9. **Configure URL settings**:
   - Left menu → **Authentication** → **Advanced settings**
   - **Access tokens and ID tokens**: `SAML 2.0` (or keep default)
   - **Redirect URIs**: Add `https://your.domain/api/auth/callback/entra`
   - **Logout URL**: `https://your.domain/signout` (optional)

10. **Configure domain**:
    - If you want `api.yourdomain.com` vs `yourdomain.com`, configure in Azure
    - Ensure the redirect URI matches exactly

---

## 📦 Step 1: Clone the Repository onto the VM

```bash
# Using git directly
git clone https://github.com/harikrishnasetty/Emp-Performance-Review.git

cd Emp-Performance-Review

# Or using GitHub CLI
gh repo clone harikrishnasetty/Emp-Performance-Review
```

---

## 🌿 Step 2: Create `.env` and Fill Production Values

```bash
cp .env.example .env
```

### Edit `.env` with Production Values:

| Variable | Required Value | Description |
|----------|---------------|-------------|
| `NODE_ENV` | `production` | Framework mode |
| `APP_URL` | `https://your.domain` | **Must use `https://`** — matches Entra ID redirect URI exactly |
| `APP_NAME` | `Meridian` | Short product name |
| `DATABASE_URL` | `postgresql://meridian:${POSTGRES_PASSWORD}@postgres:5432/meridian` | Matches docker-compose.yml Postgres service |
| `DATABASE_POOL_URL` | `postgresql://meridian:${POSTGRES_PASSWORD}@pgbouncer:6432/meridian` | Points at PgBouncer inside Docker |
| `DATABASE_POOL_MAX` | `20` | Connection pool size |
| `DATABASE_SSL` | `false` | Set `true` only if using external SSL Postgres |
| `RLS_ENFORCE` | `false` | Row-Level Security enforcement |
| `REDIS_URL` | `redis://redis:6379` | Inside Docker network |
| `REDIS_REQUIRED` | `false` | Falls back to in-process limiter |
| `ENTRA_TENANT_ID` | `<from Azure Portal>` | Tenant ID from app registration |
| `ENTRA_CLIENT_ID` | `<from Azure Portal>` | Application (client) ID |
| `ENTRA_CLIENT_SECRET` | `<from Azure Portal>` | Client secret (keep secret!) |
| `ALLOWED_EMAIL_DOMAINS` | `yourdomain.com` | Comma-separated list (e.g. `mycompany.com,partner.com`) |
| `ENTRA_STRICT_TENANT` | `true` | Restrict to configured tenant only |
| `FIELD_ENCRYPTION_KEY` | `<32 random bytes base64>` | **Generate**: `openssl rand -base64 32` |
| `APP_SECRET` | `<64 random hex chars>` | **Generate**: `openssl rand -hex 32` |
| `SESSION_ABSOLUTE_HOURS` | `12` | Max session lifetime |
| `SESSION_IDLE_MINUTES` | `45` | Idle timeout before logout |
| `COOKIE_SECURE` | `true` | **Critical for HTTPS** — ensures cookies only sent over HTTPS |
| `TRUST_PROXY` | `true` | App trusts upstream proxy (nginx) for IP detection |
| `RATE_LIMIT_AUTH_PER_MIN` | `20` | Auth attempt rate limit |
| `RATE_LIMIT_API_PER_MIN` | `300` | API rate limit |
| `BOOTSTRAP_ADMIN_EMAIL` | `admin@yourdomain.com` | **First admin's email** — promoted to ADMIN on first SSO login |
| `SEED_DEMO_DATA` | `false` | **Force off in production** — no demo data seeding |
| `LOG_LEVEL` | `info` | Log verbosity |
| `LOG_PRETTY` | `false` | Production: `false` for compact logs |

### 🔑 Generate Production Keys:

```bash
# FIELD_ENCRYPTION_KEY - 32 random bytes, base64 encoded
openssl rand -base64 32
# Example: ZcH7mAppL3s0pL1fE7rT6vY9wL4uK2jK9mN5oP6qR7sT8uV

# APP_SECRET - 64 random hex characters for CSRF protection
openssl rand -hex 32
# Example: a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f50718293a4b5c6d7e8f9a
```

### Example Complete `.env`:

```
NODE_ENV=production
APP_URL=https://performance.mycompany.com
APP_NAME=Meridian
DATABASE_URL=postgresql://meridian:chang3-me-in-prod@postgres:5432/meridian
DATABASE_POOL_URL=postgresql://meridian:chang3-me-in-prod@pgbouncer:6432/meridian
DATABASE_POOL_MAX=20
DATABASE_SSL=false
RLS_ENFORCE=false
REDIS_URL=redis://redis:6379
REDIS_REQUIRED=false
ENTRA_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENTRA_CLIENT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
ENTRA_CLIENT_SECRET=zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz
ALLOWED_EMAIL_DOMAINS=mycompany.com
ENTRA_STRICT_TENANT=true
FIELD_ENCRYPTION_KEY=ZcH7mAppL3s0pL1fE7rT6vY9wL4uK2jK9mN5oP6qR7sT8uV
APP_SECRET=a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f50718293a4b5c6d7e8f9a
SESSION_ABSOLUTE_HOURS=12
SESSION_IDLE_MINUTES=45
COOKIE_SECURE=true
TRUST_PROXY=true
RATE_LIMIT_AUTH_PER_MIN=20
RATE_LIMIT_API_PER_MIN=300
BOOTSTRAP_ADMIN_EMAIL=admin@mycompany.com
SEED_DEMO_DATA=false
LOG_LEVEL=info
LOG_PRETTY=false
```

---

## 📦 Step 3: Place TLS Certificates

```bash
# Create certs directory
mkdir -p certs

# Place your certificates:
# - fullchain.pem: Your domain's full certificate chain (includes intermediate CAs)
# - privkey.pem: Your domain's private key

# Ensure correct permissions (nginx reads these)
chmod 644 certs/fullchain.pem
chmod 600 certs/privkey.pem

# Example using Let's Encrypt (certbot):
# sudo certbot certonly --standalone -d your.domain
# sudo cp /etc/letsencrypt/live/your.domain/fullchain.pem certs/
# sudo cp /etc/letsencrypt/live/your.domain/privkey.pem certs/
```

---

## 🐋 Step 4: Launch the Application

```bash
# Build and start all services (Postgres, PgBouncer, Redis, App, Nginx)
docker compose up -d --build
```

### What starts:
- `postgres`: PostgreSQL 16 database
- `pgbouncer`: Connection pooler (transaction mode, port 6432)
- `redis`: Redis 7 with persistence
- `app`: Next.js application (builds from Dockerfile)
- `nginx`: Reverse proxy on ports 80 & 443

### Expected output:
```bash
[+] Running 5/5 containers
  ✓ postgres    ... done
  ✓ pgbouncer   ... done
  ✓ redis       ... done
  ✓ app         ... built in 12.3s, started
  ✓ nginx       ... done in 0.8s
```

### Check status:
```bash
docker compose ps
```

### View logs:
```bash
# App logs (most useful for debugging)
docker compose logs -f app

# Nginx logs
docker compose logs -f nginx

# All services
docker compose logs -f
```

### To stop later:
```bash
docker compose down
# To keep data volumes, just stop containers:
docker compose stop
```

---

## 👤 Step 5: First Administrator Setup

### Method 1: SSO Bootstrap **(Recommended)**

1. **Before first launch**, set `BOOTSTRAP_ADMIN_EMAIL` in `.env` to the intended admin's email
2. **Launch**: `docker compose up -d --build`
3. **Wait** for containers to be healthy (~30-60 seconds first time)
4. **Open**: `https://your.domain` in a browser
5. **Click**: "Continue with Microsoft"
6. **Sign in** with the administrator's Azure Entra ID account
7. **On first login**: The account is automatically created and promoted to `ADMIN`
8. **Remove or change** `BOOTSTRAP_ADMIN_EMAIL` value afterwards

### Method 2: One-Time Database Insert **(Break-glass)**

If you don't have Entra ID configured immediately:

```sql
# Run via psql or Drizzle Studio
psql -h localhost -U meridian -d meridian

# Or using docker exec:
docker compose exec postgres psql -U meridian -d meridian

# Insert break-glass admin:
INSERT INTO users (
  email, display_name, system_role, status,
  auth_provider, password_hash, password_changed_at
)
VALUES (
  'breakglass@yourdomain.com', 'Break-glass Admin', 'ADMIN', 'ACTIVE',
  'LOCAL', '<scrypt hash>', now()
);

# Generate scrypt hash (one-time):
# node -e "const { hashPassword } = await import('./src/lib/password.ts'); console.log(hashPassword('YourSecurePass123'))"
```

**Never store plaintext passwords in history or migrations.**

---

## 👥 Step 6: Adding People and Accounts

### SSO Accounts **(Regular Employees)**

- **First sign-in**: Auto-provisioned — user row created, profile refreshed from Entra ID on each login
- **No admin overhead**: Joiner/mover/leaver stays centralized in Entra ID
- **Access**: `https://your.domain` → "Continue with Microsoft"

### Local (non-SSO) Accounts **(Break-glass, Contractors, Vendors)**

Use the UI: **Admin → People → Add person**

1. **Name** + **work email**
2. **Sign-in method**: Local email & password
3. **Set initial password**: ≥12 characters (e.g., `TempPass#2026!`)
4. **Optional**: Job title, department, manager, status, location, employee code
5. **Add person** — account can sign in immediately

### Hand initial password over secure channel:
- Password manager
- In person (not email, not ticket)
- Meridian does not send invite emails

### Manage Local Credentials (after account created):

| Action | UI Path |
|--------|---------|
| **Set/rotate password** | Admin → People → Edit → Local (non-SSO) access |
| **Self-service change** | Preferences → Security → Change local password |
| **Remove local access** | Admin → People → Edit → Disable local (SSO keeps working) |

### Production Guidance:

- ✅ Keep one or two break-glass administrators; store credentials in your secrets manager
- ✅ Prefer SSO for regular employees so joiner/mover/leaver stays centralized
- ⚠️ Review local accounts periodically:

```sql
select email, system_role, auth_provider, last_login_at
from users
where auth_provider in ('LOCAL', 'BOTH')
order by email;
```

- ✅ Every creation, password reset and local-access removal is audited

---

## 📈 Step 7: Scaling

### Horizontal Scale:

```bash
docker compose up -d --scale app=4
```

### nginx Uses:
- Least-connections across replicas

### PgBouncer Keeps:
- Postgres connections bounded regardless of replica count

### Recommended Production Config:

| Setting | Value |
|---------|-------|
| Replicas | 2-4 |
| PgBouncer pool_mode | transaction |
| Max clients | 2000 |
| Default pool size | 25 |

---

## 💾 Step 8: Backups

### What to Back Up:

1. **Postgres data volume**: `pgdata`
   ```bash
   docker compose exec postgres pg_dump -U meridian meridian > backup_$(date +%Y%m%d).sql
   ```
   
2. **Encryption keys** (critical!):
   - `FIELD_ENCRYPTION_KEY`
   - `APP_SECRET`
   - Store in your secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
   
   **Losing the encryption key makes encrypted fields unrecoverable!**

3. **Nginx configuration**: `./nginx/nginx.conf`
4. **Docker volumes**: `redisdata`

### Recommended Backup Strategy:

- **Daily**: Automated pg_dump of Postgres
- **Weekly**: Full volume snapshot (cloud provider snapshot)
- **On key rotation**: Back up new `FIELD_ENCRYPTION_KEY` / `APP_SECRET`
- **Retention**: 30 days minimum, 90 days recommended

---

## 📊 Step 9: Monitoring and Health

### Health Check:

```bash
# App health endpoint
curl https://your.domain/api/health
# Expected: {"status":"healthy","database":"connected","redis":"connected"}
```

### Logs:

```bash
# Structured JSON logs (pino)
docker compose logs -f app

# View last 50 lines
docker compose logs --tail=50 app
```

### Audit Integrity:

```bash
# Run nightly
npm run verify:audit

# Checks:
# - Append-only audit trail integrity
# - SHA-256 hash chain validity
# - No missing or tampered events
```

### Key Metrics to Watch:

| Metric | Tool | Alert if |
|--------|------|----------|
| Container restarts | Docker UI/CLI | >0 unexpected restarts |
| Database connections | PgBouncer stats | >80% of pool size |
| Redis memory usage | Redis MONITOR | >80% of 256MB limit |
| Rate limit hits | App logs | Sudden spike |
| Failed logins | App logs | Unusual pattern |

---

## 🛠️ Step 9: Common Production Operations

### Rotate Entra ID Client Secret:

1. Azure Portal → App Registration → Certificates & secrets → New client secret
2. Update `ENTRA_CLIENT_SECRET` in `.env`
3. **Rotate** gradually: keep old secret working for a period, then remove
4. **Restart app**: `docker compose restart app`

### Rotate Encryption Keys (FIELD_ENCRYPTION_KEY / APP_SECRET):

1. **Generate new keys** (see Step 2)
2. **Update `.env`** with new values
3. **Re-encrypt existing data** (run once via tsx script):
   ```bash
   npm run db:reset   # This regenerates from seed — only if acceptable
   # Or run a migration that re-encrypts all *_enc columns
   ```
4. **Restart app**: `docker compose restart app`
5. **Old keys** should remain functional for decrypting historical data until all data re-encrypted

### Add/Remove Replicas:

```bash
# Add replicas
docker compose up -d --scale app=5

# Remove replicas (keep at least 1)
docker compose up -d --scale app=2
```

### Update TLS Certificates:

1. Obtain new certs from Let's Encrypt or CA
2. Replace `certs/fullchain.pem` and `certs/privkey.pem` on the VM
3. `chmod 644 certs/fullchain.pem; chmod 600 certs/privkey.pem`
4. `docker compose restart nginx`
5. Verify: `curl -I https://your.domain` shows valid cert

---

## 🚪 Step 10: Graceful Shutdown

```bash
# Stop all services (preserves data volumes)
docker compose down

# Or just stop containers (data persists)
docker compose stop

# To completely remove everything including data:
docker compose down -v
```

---

## ✅ Production Checklist

Before going live, verify:

- [ ] Docker Desktop/Engine installed on VM
- [ ] TLS certificates placed in `certs/` with correct permissions
- [ ] `.env` filled with production values (especially `APP_URL` starts with `https://`)
- [ ] `COOKIE_SECURE=true` in `.env`
- [ ] `ENTRA_CLIENT_SECRET` stored securely (not in repo!)
- [ ] `BOOTSTRAP_ADMIN_EMAIL` set to first admin's email
- [ ] `SEED_DEMO_DATA=false` (force off)
- [ ] Azure Entra ID app registered with correct redirect URI
- [ ] `ALLOWED_EMAIL_DOMAINS` configured (or `ENTRA_STRICT_TENANT=false` for testing)
- [ ] Nginx port 80/443 reachable from internet
- [ ] DNS A record points VM's IP
- [ ] Firewall allows ports 80, 443, 22 (SSH)
- [ ] Backups configured (pgdata + encryption keys)
- [ ] `npm run verify:audit` runs successfully
- [ ] Test SSO login with one user account
- [ ] Test local account creation via Admin → People

---

## 📞 Production Support

- **Health endpoint**: `GET /api/health` → `{"status":"healthy","database":"connected","redis":"connected"}`
- **Audit verification**: `npm run verify:audit` — run nightly
- **Logs**: Structured JSON (pino), view via `docker compose logs -f app`
- **Emergency**: `docker compose down -v` → fresh deployment from backed-up data

---

**🎉 You're ready for production deployment!** Follow the steps above and your Meridian instance will be secure, scalable, and fully functional with Azure Entra ID SSO.