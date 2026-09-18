CREATE TABLE "PharmacySettings" (
    "id" TEXT NOT NULL,
    "pharmacyId" TEXT NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "expiryWarningDays" INTEGER NOT NULL DEFAULT 30,
    "reservationDurationHours" INTEGER NOT NULL DEFAULT 24,
    "autoExpireReservations" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'English',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacySettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PharmacySettings_pharmacyId_key" ON "PharmacySettings"("pharmacyId");
CREATE INDEX "PharmacySettings_pharmacyId_idx" ON "PharmacySettings"("pharmacyId");

ALTER TABLE "PharmacySettings"
ADD CONSTRAINT "PharmacySettings_pharmacyId_fkey"
FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
