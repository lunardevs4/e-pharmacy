ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailVerificationTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);
CREATE INDEX "User_emailVerificationTokenHash_idx" ON "User"("emailVerificationTokenHash");
