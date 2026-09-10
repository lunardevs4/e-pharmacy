# Rwanda E-Pharmacy — Database Documentation

## Engine & Connection

- **Engine:** PostgreSQL (hosted on Neon serverless)
- **ORM:** Prisma 7 with `@prisma/adapter-pg` driver adapter (pooled connections)
- **Connection string env var:** `DATABASE_URL`
- **Schema file:** `prisma/schema.prisma`

---

## Conventions

- All primary keys are **UUID v4** (`@id @default(uuid())`)
- All tables have `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
- Soft deletes use `deletedAt DateTime?` (User, Pharmacy, Inventory)
- Enums are used for all statuses and roles
- All foreign-key columns and common query fields have `@@index`

---

## Enums

| Enum | Values |
|---|---|
| `UserRole` | PATIENT, PHARMACY, PHARMACY_OWNER, PHARMACIST, INSURANCE, GOVERNMENT, ADMIN |
| `ReservationStatus` | PENDING, CONFIRMED, COLLECTED, CANCELLED |
| `PrescriptionStatus` | PENDING, APPROVED, REJECTED |
| `ReminderStatus` | PENDING, SENT, FAILED, COMPLETED, MISSED |
| `NotificationType` | IN_APP, SMS, VOICE |
| `PharmacyStatus` | PENDING, APPROVED, REJECTED |

---

## Entity Relationship Summary

```
User ──────────────────────────────────────────────────────────────────┐
 │                                                                      │
 ├── RefreshToken (1:N)                                                 │
 ├── Patient (1:1)                                                      │
 │    ├── Reservation (1:N)                                             │
 │    ├── Prescription (1:N)                                            │
 │    ├── InsuredPatient (1:N)                                          │
 │    ├── InsuranceClaim (1:N)                                          │
 │    ├── ReminderSchedule (1:N)                                        │
 │    └── ReminderLog (1:N)                                             │
 ├── Pharmacy (1:N, via ownerId)                                        │
 │    ├── Inventory (1:N)                                               │
 │    │    ├── InventoryHistory (1:N)                                   │
 │    │    └── StockMovement (1:N)                                      │
 │    ├── Reservation (1:N)                                             │
 │    ├── Prescription (1:N)                                            │
 │    ├── PharmacyInsuranceAgreement (1:N)                              │
 │    ├── InsuranceClaim (1:N)                                          │
 │    └── AuditLog (1:N)                                                │
 ├── PharmacyOwner (1:1)                                                │
 ├── PharmacyEmployee (1:N)                                             │
 ├── InsuranceProvider (1:1, INSURANCE role users only)                 │
 │    ├── InsuredPatient (1:N)                                          │
 │    ├── PharmacyInsuranceAgreement (1:N)                              │
 │    ├── InsuranceMedicineTariff (1:N)                                 │
 │    └── InsuranceClaim (1:N)                                          │
 ├── AuditLog (1:N)                                                     │
 └── Notification (1:N)                                                 │
                                                                        │
Medicine ──── Category (N:1)                                            │
         └── Manufacturer (N:1)                                         │
         └── MedicineBatch (1:N)                                        │
         └── Inventory (1:N) ──── Pharmacy ─────────────────────────────┘
         └── Reservation (1:N)
         └── PrescriptionMedicine (1:N)
         └── ReminderSchedule (1:N)
         └── InsuranceMedicineTariff (1:N)
         └── InsuranceClaim (1:N)
```

---

## Table Reference

### `User`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | String UNIQUE | Indexed |
| phone | String UNIQUE | Indexed |
| password | String | bcrypt hashed |
| firstName | String | |
| lastName | String | |
| role | UserRole | Indexed |
| position | String? | For staff users |
| permissions | String[] | Permission codes array |
| firstLogin | Boolean | Forces password change |
| isActive | Boolean | Set false to suspend |
| emailVerified | Boolean | |
| emailVerificationTokenHash | String? | Hashed OTP |
| emailVerificationExpiresAt | DateTime? | |
| deletedAt | DateTime? | Soft delete |

### `Patient`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| userId | UUID UNIQUE FK → User | |
| insuranceProvider | String? | Provider code (e.g. "RSSB") |
| medicalProfile | String? | Chronic conditions, allergies |
| address | String? | |
| dateOfBirth | DateTime? | |
| gender | String? | |
| province / district / sector / cell / village | String? | Rwanda admin levels |
| emergencyContact | String? | |
| preferredPharmacy | String? | |
| medicalNotes | String? | Pharmacist-visible notes |
| profilePhoto | String? | URL |

### `Pharmacy`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| ownerId | UUID FK → User | Indexed |
| name | String | |
| address | String | |
| latitude / longitude | Decimal? | For GPS search. Indexed composite |
| phone | String | |
| licenseNumber | String? | |
| district / province | String? | |
| managerName | String? | |
| licenseUrl | String? | Uploaded file path |
| status | PharmacyStatus | Default PENDING. Indexed |
| isActive | Boolean | |
| category | String? | Retail / Hospital / Wholesale |
| ownershipType | String? | |
| deletedAt | DateTime? | Soft delete |

### `Medicine`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| tradeName | String | Indexed |
| genericName | String | Indexed |
| categoryId | UUID FK → Category | Indexed |
| manufacturerId | UUID FK → Manufacturer | Indexed |

### `MedicineBatch`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| medicineId | UUID FK → Medicine (Cascade) | |
| batchNumber | String | Unique per medicine |
| lotNumber | String | Unique per medicine |
| expiryDate | DateTime | Indexed |
| unitCost / unitSellingPrice | Decimal(12,2) | |
| initialStock / currentStock | Int | |
| storageConditions | String? | |
| minTemperature / maxTemperature | Decimal(5,2)? | |

### `Inventory`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| pharmacyId | UUID FK → Pharmacy (Cascade) | |
| medicineId | UUID FK → Medicine (Cascade) | |
| quantity | Int | Current stock level |
| price | Decimal | Selling price |
| expiryDate | DateTime? | Indexed |
| batchNumber | String? | |
| Unique constraint | | (pharmacyId, medicineId) |

### `Reservation`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| patientId | UUID FK → Patient (Cascade) | Indexed |
| pharmacyId | UUID FK → Pharmacy (Cascade) | Indexed |
| medicineId | UUID FK → Medicine (Cascade) | Indexed |
| quantity | Int | |
| status | ReservationStatus | Default PENDING. Indexed |
| expiresAt | DateTime | Pickup deadline. Indexed |

### `Prescription`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| patientId | UUID FK → Patient (Cascade) | Indexed |
| pharmacyId | UUID FK → Pharmacy (SetNull)? | Indexed |
| pharmacistId | UUID FK → User (SetNull)? | |
| documentUrl | String? | File path |
| status | PrescriptionStatus | Default PENDING. Indexed |
| notes | String? | |

### `InsuranceClaim`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| claimNumber | String UNIQUE | |
| insuranceId | UUID FK → InsuranceProvider | Indexed |
| pharmacyId | UUID FK → Pharmacy | Indexed |
| patientId / insuredPatientId | UUID FK? | |
| medicineId / prescriptionId / reservationId | UUID FK? | |
| quantity | Int | |
| unitPrice / totalAmount / insuranceAmount / patientAmount | Decimal(12,2) | |
| status | String | PENDING / APPROVED / REJECTED / PAID. Indexed |
| claimedAt / processedAt / paidAt | DateTime | |

---

## Key Indexes Summary

```sql
-- User lookup
CREATE INDEX ON "User"(email);
CREATE INDEX ON "User"(phone);
CREATE INDEX ON "User"(role);

-- Pharmacy GPS search
CREATE INDEX ON "Pharmacy"(latitude, longitude);
CREATE INDEX ON "Pharmacy"(status);

-- Medicine search
CREATE INDEX ON "Medicine"("tradeName");
CREATE INDEX ON "Medicine"("genericName");

-- Inventory lookups
CREATE UNIQUE INDEX ON "Inventory"("pharmacyId", "medicineId");

-- Reservation status / expiry
CREATE INDEX ON "Reservation"(status);
CREATE INDEX ON "Reservation"("expiresAt");

-- Audit trail
CREATE INDEX ON "AuditLog"("createdAt");
CREATE INDEX ON "AuditLog"("userId");

-- Insurance claims
CREATE INDEX ON "InsuranceClaim"(status);
CREATE INDEX ON "InsuranceClaim"("claimedAt");
```

---

## Migration Commands

```bash
# Create a new migration (development)
npx prisma migrate dev --name <migration-name>

# Apply migrations (production / Render deploy)
npx prisma migrate deploy

# Regenerate Prisma client after schema changes
npx prisma generate

# Open Prisma Studio (visual DB browser)
npx prisma studio
```
