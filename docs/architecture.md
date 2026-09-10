# Rwanda E-Pharmacy — Architecture Documentation

## Overview

Rwanda E-Pharmacy is a **national digital health platform** built as a secure, modular NestJS monolith. It connects patients, pharmacies, insurance providers, and the Ministry of Health on a single API platform backed by Neon PostgreSQL.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | NestJS 11 (TypeScript) |
| ORM | Prisma 7 with `@prisma/adapter-pg` (pooled) |
| Database | PostgreSQL on Neon (serverless) |
| Auth | JWT (1h) + Refresh Token rotation (7d), bcrypt 10 rounds |
| Validation | class-validator + class-transformer |
| API Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| File Storage | Local `uploads/` (swap to S3/R2 for multi-instance) |
| Scheduled Jobs | `@nestjs/schedule` |
| Security | Helmet, express-rate-limit, hpp, NoSQL-sanitize, XSS-sanitize |
| Deployment | Render (backend) + Neon (database) + Vercel (frontend) |

---

## Architectural Pattern — Modular Monolith

Every feature is isolated in its own module: `Controller → Service → DTO → Prisma`. This means any module can be extracted into a microservice without code changes to other modules.

```
Request → Guards → Interceptors → Controller → Service → Prisma → PostgreSQL
                                      ↑
                               ValidationPipe
```

### Global Middleware Stack (in order)

1. `helmet` — HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
2. `express-rate-limit` — 1000 req/15min on `/api/`, 20 req/15min on `/api/v1/auth/`
3. `hpp` — HTTP Parameter Pollution protection
4. `noSqlSanitize` — replaces NoSQL injection characters

### Global NestJS Pipeline (in order)

1. `ThrottlerGuard` — 1000 req/60s (NestJS level)
2. `JwtAuthGuard` — validates `Authorization: Bearer <token>`
3. `RolesGuard` — checks `@Roles()` decorator
4. `PermissionsGuard` — checks `@Permissions()` decorator (pharmacy staff)
5. `FirstLoginGuard` — forces password change on first login
6. `XssSanitizationPipe` — sanitizes all string inputs
7. `ValidationPipe` — whitelist, forbidNonWhitelisted, transform

### Global Response Format

All responses are wrapped by `TransformInterceptor`:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-09-10T00:00:00.000Z"
}
```

Errors via `HttpExceptionFilter`:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "path": "/api/v1/auth/login",
  "timestamp": "2026-09-10T00:00:00.000Z"
}
```

---

## Module Map

| Module | Controller prefix | Description |
|---|---|---|
| `auth` | `/api/v1/auth` | Register, login, refresh, logout, RBAC, staff management |
| `users` | `/api/v1/users` | Profile CRUD, admin user management |
| `patients` | `/api/v1/patients` | Patient medical profile |
| `pharmacies` | `/api/v1/pharmacies` | Registration, approval, employees, insurance agreements |
| `medicines` | `/api/v1/medicines` | Medicine catalog CRUD + availability |
| `categories` | `/api/v1/categories` | Medicine category management |
| `manufacturers` | `/api/v1/manufacturers` | Manufacturer management |
| `inventory` | `/api/v1/pharmacies/:id/inventory` | Stock management, CSV/Excel import |
| `search` | `/api/v1/search` | GPS-based medicine search (public) |
| `reservations` | `/api/v1/reservations` | Patient reservations + pharmacy fulfillment |
| `prescriptions` | `/api/v1/prescriptions` | Prescription upload + pharmacist review |
| `reminders` | `/api/v1/reminders` | Medication reminder schedules + intake logs |
| `notifications` | `/api/v1/notifications` | In-app notifications, email preferences |
| `government` | `/api/v1/government` | National dashboard analytics |
| `insurance` | `/api/v1/insurance` | Claims, tariffs, agreements, insured patients |
| `reports` | `/api/v1/reports` | Pharmacy / patient / government / platform reports |
| `audit-logs` | `/api/v1/audit-logs` | Immutable audit trail |
| `file-uploads` | `/api/v1/upload` | Prescription + license file upload |
| `public` | `/api/v1/public` | Public stats (landing page) |

---

## RBAC — Role-Based Access Control

| Role | Key Permissions |
|---|---|
| `PATIENT` | Reserve medicines, manage prescriptions, set reminders, view own reports |
| `PHARMACY_OWNER` | Register pharmacy, manage inventory, manage staff, view pharmacy reports |
| `PHARMACIST` | Process reservations, approve/reject prescriptions, create reminders |
| `INSURANCE` | Manage claims, tariffs, pharmacy agreements, insured patients |
| `GOVERNMENT` | Approve/reject pharmacies, national analytics, audit logs |
| `ADMIN` | Full platform access — all of the above + user management |

Roles are enforced at three levels:
1. `JwtAuthGuard` — must have valid JWT
2. `RolesGuard` — must have matching `UserRole` enum value
3. Service-level ownership checks (e.g. pharmacy owner can only manage their own pharmacy)

---

## Authentication Flow

```
POST /auth/register → hash password → create User + Patient record → send verification email
POST /auth/login    → verify password → issue accessToken (1h) + refreshToken (7d)
POST /auth/refresh  → validate refreshToken → rotate: delete old, issue new pair
POST /auth/logout   → delete refreshToken from DB
```

All endpoints use `Authorization: Bearer <accessToken>` header. On expiry, the frontend calls `/auth/refresh` transparently.

---

## File Storage

Files are saved to the local filesystem under `dist/../uploads/`:
- Prescriptions: `uploads/prescriptions/`
- Licenses: `uploads/licenses/`

Served via static assets at `/uploads/*`.

**Production note:** For Render deployments, the filesystem is ephemeral. Swap `FileUploadsService` to write to AWS S3, Cloudflare R2, or Cloudinary — only one service file needs changing.

---

## Service Dependencies Diagram

```
Frontend (Vercel)
    │
    │ HTTPS → CORS validated
    ▼
Backend API (Render)
    │
    ├── Neon PostgreSQL (pooled connection via @prisma/adapter-pg)
    ├── Gmail SMTP (email verification + reminders)
    └── Local filesystem (uploads — replace with object storage in production)
```
