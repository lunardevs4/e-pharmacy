-- CreateTable
CREATE TABLE "PharmacyOwner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyOwner_pkey" PRIMARY KEY ("id")
);

-- Backfill owners from the existing user-to-pharmacy links before dropping the old columns.
INSERT INTO "PharmacyOwner" ("id", "userId", "pharmacyId", "createdAt", "updatedAt")
SELECT
    CONCAT('owner_', "id"),
    "id",
    "pharmacyId",
    COALESCE("createdAt", CURRENT_TIMESTAMP),
    COALESCE("updatedAt", CURRENT_TIMESTAMP)
FROM "User"
WHERE "pharmacyId" IS NOT NULL
  AND "role" IN ('PHARMACY', 'PHARMACY_OWNER')
ON CONFLICT ("userId") DO NOTHING;

-- Preserve existing pharmacist-to-pharmacy membership data.
INSERT INTO "PharmacyEmployee" ("id", "pharmacyId", "userId", "role", "createdAt", "updatedAt")
SELECT
    CONCAT('employee_', "id"),
    "pharmacyId",
    "id",
    "role",
    COALESCE("createdAt", CURRENT_TIMESTAMP),
    COALESCE("updatedAt", CURRENT_TIMESTAMP)
FROM "User"
WHERE "pharmacyId" IS NOT NULL
  AND "role" = 'PHARMACIST'
ON CONFLICT ("pharmacyId", "userId") DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyOwner_userId_key" ON "PharmacyOwner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyOwner_pharmacyId_key" ON "PharmacyOwner"("pharmacyId");

-- AddForeignKey
ALTER TABLE "PharmacyOwner" ADD CONSTRAINT "PharmacyOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyOwner" ADD CONSTRAINT "PharmacyOwner_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_pharmacyId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "User_pharmacyId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "pharmacyId",
DROP COLUMN IF EXISTS "organizationId";
