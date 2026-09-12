CREATE INDEX "Inventory_pharmacyId_deletedAt_idx"
ON "Inventory"("pharmacyId", "deletedAt");

CREATE INDEX "Inventory_medicineId_deletedAt_idx"
ON "Inventory"("medicineId", "deletedAt");

CREATE INDEX "InsuranceClaim_insuranceId_status_claimedAt_idx"
ON "InsuranceClaim"("insuranceId", "status", "claimedAt");
