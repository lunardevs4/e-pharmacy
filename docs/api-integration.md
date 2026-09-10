# Rwanda E-Pharmacy — API Integration & Operations Guide

## Base URL

```
Production:  https://e-pharmacy-5o3f.onrender.com/api/v1
Development: http://localhost:3000/api/v1
Swagger UI:  https://e-pharmacy-5o3f.onrender.com/api/docs
```

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

### Login Flow

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "PATIENT",
      "firstName": "Alice",
      "firstLogin": false
    }
  }
}
```

### Token Refresh

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJhbGci..." }
```

The old refresh token is **invalidated immediately** — store the new one.

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>

{ "refreshToken": "eyJhbGci..." }
```

---

## Registration Flows

### Patient Registration

```http
POST /api/v1/auth/register
{
  "email": "patient@example.com",
  "phone": "0781234567",
  "password": "SecurePass1!",
  "firstName": "Alice",
  "lastName": "Mukamana",
  "role": "PATIENT"
}
```

After registration, a verification email is sent. Patient must click the verification link before they can log in.

### Pharmacy Owner Registration

```http
POST /api/v1/auth/register-pharmacy
{
  "fullname": "Jean Damascene",
  "email": "owner@pharmacy.rw",
  "phone": "+250788000001",
  "passwordHash": "SecurePass1!"
}
```

After registration, the account is `PENDING` until approved by a Government official.

---

## Public Endpoints (No Auth Required)

| Endpoint | Description |
|---|---|
| `GET /api/v1/public/stats` | Platform statistics (pharmacies, patients, coverage %) |
| `GET /api/v1/pharmacies` | List all pharmacies (filterable by status) |
| `GET /api/v1/pharmacies/:id` | Get pharmacy details |
| `GET /api/v1/medicines/:id/availability` | Medicine availability across pharmacies with GPS distance |
| `GET /api/v1/search/medicines` | Full-text + GPS medicine search |
| `GET /api/v1/insurance/providers` | List insurance providers with coverage rates |
| `POST /api/v1/insurance/calculate` | Calculate copay splits for medicines |
| `POST /api/v1/insurance/validate-patient` | Validate patient insurance coverage |

---

## Patient API Flows

### 1. Search for a Medicine

```http
GET /api/v1/search/medicines?query=paracetamol&latitude=-1.944&longitude=30.061&radius=5000
Authorization: Bearer <token>
```

Returns pharmacies with stock, distance, prices, and insurance co-pay breakdowns.

### 2. Check Availability for a Specific Medicine

```http
GET /api/v1/medicines/{medicineId}/availability?latitude=-1.944&longitude=30.061&insuranceId={insuranceProviderId}
```

Returns stock levels, prices, and insurance splits for the medicine at nearby pharmacies.

### 3. Create a Reservation

```http
POST /api/v1/reservations
Authorization: Bearer <patient-token>

{
  "pharmacyId": "uuid",
  "medicineId": "uuid",
  "quantity": 2,
  "expiresAt": "2026-09-15T18:00:00.000Z"
}
```

### 4. Cancel a Reservation

```http
PATCH /api/v1/reservations/{id}/cancel
Authorization: Bearer <patient-token>
```

### 5. Upload a Prescription

```http
POST /api/v1/upload/prescription
Authorization: Bearer <patient-token>
Content-Type: multipart/form-data

file: <PDF/JPEG/PNG, max 10MB>
```

Returns `{ fileUrl: "/uploads/prescriptions/..." }`. Use the `fileUrl` when creating a prescription.

### 6. Create a Prescription

```http
POST /api/v1/prescriptions
Authorization: Bearer <patient-token>

{
  "documentUrl": "/uploads/prescriptions/rx-001.pdf",
  "pharmacyId": "uuid",
  "notes": "Please process urgently.",
  "medicines": [
    { "medicineId": "uuid", "dosage": "500mg", "frequency": "3x daily", "duration": "7 days", "quantity": 21 }
  ]
}
```

### 7. Set a Medication Reminder

```http
POST /api/v1/reminders/schedules
Authorization: Bearer <patient-token>

{
  "medicineId": "uuid",
  "dosage": "500mg",
  "startDate": "2026-09-10",
  "endDate": "2026-09-17",
  "timeOfDay": ["08:00", "14:00", "20:00"]
}
```

---

## Pharmacy API Flows

### 1. Add Medicine to Inventory

```http
POST /api/v1/pharmacies/{pharmacyId}/inventory
Authorization: Bearer <pharmacy-token>

{
  "medicineId": "uuid",
  "quantity": 100,
  "price": 1500,
  "expiryDate": "2028-06-30",
  "batchNumber": "BATCH-001"
}
```

### 2. Import Inventory from CSV/Excel

```http
POST /api/v1/pharmacies/{pharmacyId}/inventory/import
Authorization: Bearer <pharmacy-token>
Content-Type: multipart/form-data

file: <CSV or XLSX>
```

Required columns: `tradeName`, `quantity`, `price`
Optional: `genericName`, `category`, `manufacturer`, `batchNumber`, `expiryDate`, `unitCost`

### 3. View Pharmacy Reservations

```http
GET /api/v1/pharmacies/{pharmacyId}/reservations
Authorization: Bearer <pharmacy-token>
```

### 4. Confirm Reservation Collected

```http
PATCH /api/v1/pharmacies/{pharmacyId}/reservations/{reservationId}
Authorization: Bearer <pharmacy-token>

{ "status": "COLLECTED" }
```

Valid status transitions: `PENDING → CONFIRMED → COLLECTED` or any → `CANCELLED`

### 5. Approve/Reject Prescription

```http
PATCH /api/v1/pharmacies/{pharmacyId}/prescriptions/{prescriptionId}
Authorization: Bearer <pharmacist-token>

{ "status": "APPROVED" }
```

---

## Government API Flows

### 1. Approve a Pharmacy

```http
PATCH /api/v1/pharmacies/{pharmacyId}/approve
Authorization: Bearer <government-token>

{ "status": "APPROVED" }
```

Valid: `APPROVED`, `REJECTED`, `PENDING`

### 2. Get National Dashboard

```http
GET /api/v1/government/summary
Authorization: Bearer <government-token>
```

Returns: total pharmacies, approved count, total medicines, total patients, total/pending reservations.

### 3. Get Low Stock Alert

```http
GET /api/v1/government/low-stock?threshold=10
Authorization: Bearer <government-token>
```

Returns all inventory items with stock ≤ threshold across all pharmacies.

### 4. Get District Coverage

```http
GET /api/v1/government/district-coverage
Authorization: Bearer <government-token>
```

Returns pharmacy count and reservation activity grouped by district.

---

## Admin API Flows

### 1. List All Users

```http
GET /api/v1/users?page=1&limit=20
Authorization: Bearer <admin-token>
```

### 2. Suspend a User

```http
PATCH /api/v1/users/{userId}/status
Authorization: Bearer <admin-token>

{ "isActive": false }
```

### 3. View Audit Logs

```http
GET /api/v1/audit-logs?page=1&limit=50&entityType=Reservation&action=CREATE
Authorization: Bearer <admin-token>
```

### 4. Get Platform Report

```http
GET /api/v1/reports/platform?startDate=2026-01-01&endDate=2026-09-10
Authorization: Bearer <admin-token>
```

---

## Insurance API Flows

### 1. Get Claims

```http
GET /api/v1/insurance/claims?status=PENDING&page=1&limit=20
Authorization: Bearer <insurance-token>
```

### 2. Approve a Claim

```http
PATCH /api/v1/insurance/claims/{claimId}/status
Authorization: Bearer <insurance-token>

{ "status": "APPROVED" }
```

### 3. Batch Pay Claims

```http
POST /api/v1/insurance/claims/batch-pay
Authorization: Bearer <insurance-token>

{ "claimIds": ["uuid1", "uuid2", "uuid3"] }
```

### 4. Set Medicine Tariff

```http
POST /api/v1/insurance/tariffs
Authorization: Bearer <insurance-token>

{
  "insuranceId": "uuid",
  "medicineId": "uuid",
  "coveredPrice": 5000,
  "coveragePercentage": 80,
  "copayPercentage": 20
}
```

---

## Error Codes Reference

| HTTP Status | Meaning | Common Cause |
|---|---|---|
| 400 | Bad Request | Validation failed — check request body |
| 401 | Unauthorized | Missing or expired JWT |
| 403 | Forbidden | Wrong role for this endpoint |
| 404 | Not Found | Resource UUID doesn't exist |
| 409 | Conflict | Duplicate unique field (email, phone, etc.) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Check Render logs |

---

## Rate Limits

| Endpoint group | Limit | Window |
|---|---|---|
| All API endpoints (`/api/`) | 1000 requests | 15 minutes |
| Auth endpoints (`/api/v1/auth/`) | 20 requests | 15 minutes |
| NestJS throttler (global) | 1000 requests | 60 seconds |

After being rate-limited, the response is:
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Too many requests from this IP, please try again later."
}
```

---

## Pagination

All list endpoints support:
- `page` (default: 1) — page number
- `limit` (default: 10) — items per page

Response includes a `data` array. Some endpoints wrap with `meta: { total, page, limit }`.

---

## Production Smoke Test Checklist

Run these after every production deployment to verify the API is healthy:

```bash
BASE=https://e-pharmacy-5o3f.onrender.com/api/v1

# 1. Health check
curl $BASE/../

# 2. Public stats
curl "$BASE/public/stats"

# 3. Search (no auth)
curl "$BASE/search/medicines?query=paracetamol"

# 4. Insurance providers (no auth)
curl "$BASE/insurance/providers"

# 5. Login (replace with real credentials)
curl -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@epharmacy.test","password":"Admin123!"}'

# 6. Government summary (paste token from step 5)
curl "$BASE/government/summary" \
  -H "Authorization: Bearer <token>"

# 7. Pharmacy list
curl "$BASE/pharmacies?status=APPROVED&limit=5"

# 8. Swagger UI accessible
curl -I https://e-pharmacy-5o3f.onrender.com/api/docs
```

All requests should return HTTP 200 with `"success": true`.
