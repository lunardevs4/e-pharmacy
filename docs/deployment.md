# Rwanda E-Pharmacy — Deployment Documentation

## Infrastructure Overview

| Service | Provider | URL |
|---|---|---|
| Backend API | Render (Web Service) | `https://e-pharmacy-5o3f.onrender.com` |
| Database | Neon PostgreSQL (serverless) | Pooled connection via `DATABASE_URL` |
| Frontend | Vercel | `https://e-pharmacy-phi-dun.vercel.app` |

---

## Environment Variables

All variables must be set in the Render dashboard under **Environment → Environment Variables**.

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Neon PostgreSQL pooler connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | ✅ | ≥ 64 character random hex string | `0e11cf2b...` |
| `JWT_EXPIRES_IN` | ✅ | Access token TTL | `1h` |
| `REFRESH_TOKEN_EXPIRES_IN` | ✅ | Refresh token TTL | `7d` |
| `GMAIL_USER` | ✅ | Gmail address for transactional email | `noreply@yourdomain.com` |
| `GMAIL_APP_PASSWORD` | ✅ | Gmail App Password (not account password) | `xxxx xxxx xxxx xxxx` |
| `PORT` | ✅ | Server listen port | `3000` |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins | `https://e-pharmacy-phi-dun.vercel.app` |
| `RATE_LIMIT_WINDOW_MS` | optional | Rate limit window in ms | `900000` (15min) |
| `RATE_LIMIT_MAX` | optional | Max requests per window for `/api/` | `1000` |
| `AUTH_RATE_LIMIT_MAX` | optional | Max auth attempts per 15min | `20` |
| `BOOTSTRAP_ADMIN_EMAIL` | optional | Email for bootstrap admin account | `admin@epharmacy.rw` |
| `BOOTSTRAP_ADMIN_PASSWORD` | optional | Password for bootstrap admin | `ChangeMe123!` |

---

## Render Deployment Steps

### Initial Setup

1. Connect your GitHub repository to Render
2. Create a new **Web Service**
3. Set **Runtime:** Node
4. Configure:
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && npm run start:prod`
5. Set all environment variables listed above
6. Deploy

### Subsequent Deploys

Push to `main` branch — Render auto-deploys. Migrations run automatically at startup via `npx prisma migrate deploy`.

### Render Health Check

Render pings `GET /` for health. The app returns a welcome JSON response on that route.

---

## Neon PostgreSQL Setup

1. Create a new Neon project at [neon.tech](https://neon.tech)
2. Copy the **pooled connection string** (not the direct connection string — use pooled for production)
3. Set it as `DATABASE_URL` in Render's environment variables
4. Migrations run on every deploy automatically

---

## Vercel Frontend Deployment

1. Connect the `e-pharmacy-frontend` repo to Vercel
2. Set environment variable: `VITE_API_URL=https://e-pharmacy-5o3f.onrender.com`
3. Build command: `npm run build` (auto-detected)
4. Output directory: `dist` (auto-detected)

---

## File Storage — Production Note

The current implementation saves uploaded files to the local `uploads/` directory on the Render instance. **This is ephemeral on Render** — files are lost on redeploys and unavailable across instances.

To fix this for production, swap the `FileUploadsService` to write to an object store:

```bash
# Option A: AWS S3
npm install @aws-sdk/client-s3

# Option B: Cloudflare R2 (S3-compatible)
npm install @aws-sdk/client-s3

# Option C: Cloudinary
npm install cloudinary
```

Only `src/file-uploads/file-uploads.service.ts` needs to change — the controller and routes stay identical.

---

## Bootstrap Admin Account

On first startup, if `BOOTSTRAP_ADMIN_EMAIL` (default: `admin@epharmacy.test`) does not exist in the database, the system creates it automatically with the following data:

```
email:     admin@epharmacy.test  (or BOOTSTRAP_ADMIN_EMAIL)
password:  Admin123!             (or BOOTSTRAP_ADMIN_PASSWORD)
role:      ADMIN
firstName: System
lastName:  Administrator
phone:     +250700000000
```

**Change the password immediately after first login.**

---

## Swagger / OpenAPI

Live at: `https://e-pharmacy-5o3f.onrender.com/api/docs`

To authenticate in Swagger UI:
1. Call `POST /api/v1/auth/login` with your credentials
2. Copy the `accessToken` from the response
3. Click **Authorize** at the top of the Swagger UI
4. Paste the token (without "Bearer") into the field
5. All authenticated endpoints will now work

---

## Monitoring & Logs

- **Render logs:** Available in the Render dashboard → Your Service → Logs
- **Application audit logs:** `GET /api/v1/audit-logs` (ADMIN/GOVERNMENT role) — every user action is recorded
- **Error format:** All errors return the standard `HttpExceptionFilter` format with `statusCode`, `path`, and `timestamp`

---

## Rolling Back a Deployment

In the Render dashboard → Your Service → Deploys → click any previous deploy → **Rollback to this deploy**.

To roll back database migrations manually:
```bash
# Connect to Neon via psql and manually revert the migration
# OR restore from a Neon point-in-time backup
```

---

## Local Development

```bash
# Clone and install
git clone <repo-url>
cd e-pharmacy
npm install

# Set up .env (see Environment Variables above)
cp .env.example .env

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# Start development server (hot-reload)
npm run start:dev

# Swagger available at:
# http://localhost:3000/api/docs
```
