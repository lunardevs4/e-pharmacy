-- Composite indexes for the hot authorization, expiry, inbox, and webhook queries.
CREATE INDEX "Reservation_pharmacyId_createdAt_idx"
ON "Reservation"("pharmacyId", "createdAt");

CREATE INDEX "Reservation_patientId_createdAt_idx"
ON "Reservation"("patientId", "createdAt");

CREATE INDEX "Reservation_pharmacyId_status_expiresAt_idx"
ON "Reservation"("pharmacyId", "status", "expiresAt");

CREATE INDEX "ReminderLog_patientId_status_createdAt_idx"
ON "ReminderLog"("patientId", "status", "createdAt");

CREATE INDEX "Notification_userId_isRead_createdAt_idx"
ON "Notification"("userId", "isRead", "createdAt");
