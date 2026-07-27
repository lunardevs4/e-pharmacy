# Rwanda E-Pharmacy - Backend MVP

A production-ready, secure, scalable **National Digital Health Platform** backend that enables:

- 🧑‍⚕️ **Patients** to locate medicines in real-time, reserve stock, manage prescriptions & medication reminders
- 💊 **Pharmacies** to digitize inventory management, track stock, and serve customers
- 🏛️ **Ministry of Health** to monitor national medicine availability, shortages, and public health trends

---

## 🛠️ Technology Stack

| Layer          | Technology                                                        |
| -------------- | ----------------------------------------------------------------- |
| Framework      | **NestJS 11** (TypeScript)                                        |
| ORM            | **Prisma 7** (with Driver Adapter for PostgreSQL)                 |
| Database       | **PostgreSQL** (optimized for Neon/Render)                        |
| Auth           | **JWT** + **Refresh Token Rotation**, **Passport.js**, **bcrypt** |
| Validation     | **class-validator**, **class-transformer**                        |
| Documentation  | **Swagger/OpenAPI** (`@nestjs/swagger`)                           |
| File Uploads   | **Multer** (with type/size validation)                            |
| Scheduled Jobs | **@nestjs/schedule**                                              |
| Security       | **Helmet**, **CORS**, **Rate Limiting** (@nestjs/throttler)       |
| Logging        | Request, Error, Auth, and Audit Logs                              |
| Deployment     | **Render** compatible                                             |

---

## 🏛️ System Architecture

**Modular Monolith** — every feature is isolated in its own NestJS module (Controller → Service → DTO → Entity), so any module can later be extracted into a microservice without breaking changes.

### 📦 Implemented Feature Modules

| Module           | Description                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `auth/`          | Register, Login, Logout, JWT/Refresh Token Rotation, Password Hashing, RBAC Guards        |
| `users/`         | Profile CRUD, Soft Delete, Admin user listing                                             |
| `patients/`      | Patient medical profile, contact info, DOB                                                |
| `pharmacies/`    | Registration, Admin Approval workflow, Employee mgmt, License upload                      |
| `medicines/`     | Medicine catalog CRUD                                                                     |
| `categories/`    | Nested medicine categories                                                                |
| `manufacturers/` | Manufacturer management                                                                   |
| `inventory/`     | Stock add/update/delete, Auto **Inventory History** + **Stock Movements** logs            |
| `search/`        | Medicine search + **GPS-based distance calculation** (Haversine formula), Category filter |
| `reservations/`  | Patient reservation flow, Pharmacy confirm/collect/cancel                                 |
| `prescriptions/` | Prescription upload, medicine mapping, Pharmacist approval/rejection                      |
| `reminders/`     | Medication reminder schedules, completion tracking, logs                                  |
| `notifications/` | In-app notifications, read/unread status, mark-all-read                                   |
| `government/`    | National aggregate analytics, availability, low-stock, reservation stats                  |
| `reports/`       | Pharmacy / Medicine / Government exportable reports                                       |
| `audit-logs/`    | Immutable audit trail of user actions                                                     |
| `file-uploads/`  | Prescription + Pharmacy license upload (validation for type/size)                         |
| `common/`        | Prisma Service, Exception Filters, Transform Interceptor, Roles/Guards, DTO utilities     |

---

## 👥 User Roles & RBAC

| Role             | Permissions                                                                           |
| ---------------- | ------------------------------------------------------------------------------------- |
| `PATIENT`        | Register, Reserve Medicines, Manage Prescriptions, View Reminders                     |
| `PHARMACY_OWNER` | Register Pharmacy, Manage Inventory & Employees, Process Reservations & Prescriptions |
| `PHARMACIST`     | (Staff Role) Process Reservations, Approve Prescriptions, Create Medication Reminders |
| `GOVERNMENT`     | National Dashboard, Reports, Aggregated Public Health Data, Audit Logs                |
| `ADMIN`          | Full Access, Approve Pharmacies, Manage Catalog, System Settings                      |

Every endpoint is protected with:

- `JwtAuthGuard` (validates JWT from `Authorization: Bearer`)
- `RolesGuard` (role-based authorization via `@Roles()` decorator)
- Ownership guards at service level (e.g. pharmacy owner only)

---

## 🔐 Authentication Workflow

1. **Register** → `POST /api/v1/auth/register` → creates user + patient/pharmacy-ready profile
2. **Login** → `POST /api/v1/auth/login` → returns `accessToken` (short-lived, 1h) + `refreshToken` (7d)
3. **Refresh** → `POST /api/v1/auth/refresh` → token rotation (old refresh token invalidated)
4. **Logout** → `POST /api/v1/auth/logout` → deletes the refresh token server-side

Passwords are hashed with **bcrypt (10 rounds)** before storage.

---

## 🗄️ Database Design (Prisma Schema)

**Normalized PostgreSQL design** with:

- ✅ UUID primary keys on every table
- ✅ Foreign key relationships + indexes (on search fields, foreign keys, timestamps)
- ✅ Enums for statuses/roles
- ✅ Soft deletes (via `deletedAt` timestamp) where appropriate
- ✅ Audit fields (`createdAt`, `updatedAt`)

### 📊 Key Entities

`User → RefreshToken → Patient → Pharmacy → PharmacyEmployee → Category → Manufacturer → Medicine → Inventory → InventoryHistory → StockMovement → Reservation → Prescription → PrescriptionMedicine → ReminderSchedule → ReminderLog → Notification → AuditLog → SystemSetting`

---

## 📚 API Design

### Base Route

```
/api/v1
```

### Pagination / Filtering / Sorting

All list endpoints support:

- `page` (default 1), `limit` (default 10)
- Optional entity-specific filters

### ✅ Consistent Response Format

**Success:**

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-07-24T12:00:00.000Z"
}
```

**Error:**

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation error message",
  "error": "Bad Request",
  "path": "/api/v1/auth/register",
  "timestamp": "2026-07-24T12:00:00.000Z"
}
```

### 🧪 Validation Rules

Every request is validated via `class-validator` + Global ValidationPipe.
The global pipe:

- Rejects unknown properties (`forbidNonWhitelisted: true`)
- Strips non-whitelisted ones (`whitelist: true`)
- Transforms input to DTO type (`transform: true`)

Validated: UUIDs, Emails, Phone numbers, Password strength (min 6 chars), Required fields, File type/size.

---

## 📖 Swagger / OpenAPI Documentation

**Fully documented.** Swagger UI is available at:

```
http://localhost:3000/api/docs
```

Includes:

- Every endpoint with `@ApiOperation()` + summary
- Full Request/Response schemas
- `Bearer Auth` enabled globally (click "Authorize" to paste JWT)
- Examples + Validation rules

---

## 🛡️ Security

| Feature                | Implementation                                               |
| ---------------------- | ------------------------------------------------------------ |
| JWT Auth               | `@nestjs/jwt` + `passport-jwt` strategy                      |
| Refresh Token Rotation | Old refresh tokens are deleted on refresh                    |
| Password Hashing       | bcrypt (10 salt rounds)                                      |
| RBAC                   | Custom `@Roles()` decorator + `RolesGuard`                   |
| CORS                   | Enabled for all origins (adjust in `main.ts` for production) |
| Helmet                 | Enabled (HTTP security headers)                              |
| Rate Limiting          | 10 requests / minute globally (ThrottlerModule)              |
| Input Sanitization     | Class-validator whitelist, forbidNonWhitelisted              |
| Exception Handling     | Global `HttpExceptionFilter` for consistent errors           |

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites

- **Node.js ≥ 18**
- **PostgreSQL** (or a Neon/Render database URL)

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create/edit `.env`:

```dotenv
# PostgreSQL (Neon/Render)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# JWT
JWT_SECRET="your-super-secure-32-char-secret-change-in-prod"
JWT_EXPIRES_IN="1h"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Server
PORT=3000
```

### 4. Setup Database Schema

```bash
# Generate Prisma Client (auto-runs on install hook)
npx prisma generate

# Create & run migration (creates all tables)
npx prisma migrate dev --name init
```

### 5. Run the Server

```bash
# Development mode (watch)
npm run start:dev

# Production build & run
npm run build
npm run start:prod
```

### 6. Verify → Visit Swagger

Open: http://localhost:3000/api/docs

---

## 🌍 Deployment (Render + Neon PostgreSQL)

This project is **fully optimized for Render + Neon**:

1. **Database (Neon):**
   - Create a Neon PostgreSQL project, copy the connection string.
2. **Backend (Render Web Service):**
   - Connect this repo to Render → Build & deploy from `main`
   - Set **Environment Variables** (same as `.env` above)
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npx prisma migrate deploy && npm run start:prod`
   - Uploaded files (prescriptions, licenses) are stored in local `uploads/` by default.
     → For production on Render, swap `FileUploadsService` to save to **S3 / Cloudinary / R2** (update only 1 service file).

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 🔧 Code Quality

- ✅ Strict **TypeScript** typing throughout
- ✅ NestJS dependency injection (no globals)
- ✅ Strongly-typed Prisma Client (Prisma 7)
- ✅ ESLint + Prettier configured
- ✅ Modular, single-responsibility services
- ✅ REST API conventions (GET/POST/PATCH/DELETE + nouns)
- ✅ Clean code: DTOs for input/output, Prisma for data layer, Controllers for HTTP layer only

---

## ❌ MVP Scope — Not Implemented (Future Releases)

Per the MVP specification, the following are **intentionally excluded** from this MVP:

- ❌ Online medicine ordering / payment integration
- ❌ Barcode scanning / QR code verification
- ❌ AI medicine recommendations / disease prediction
- ❌ ML demand forecasting / outbreak prediction
- ❌ Real-time pharmacy chat
- ❌ Push notifications (native mobile)
- ❌ Native mobile applications
- ❌ Multi-language (English / Kinyarwanda / French)
- ❌ National EHR integration

These features are reserved for future releases.

---

## 📝 License

UNLICENSED — Internal project for Rwanda E-Pharmacy MVP.

---

<p align="center">
  Built with ❤️ for Rwanda's National Digital Health Infrastructure.
</p>
