-- Manufacturer information is optional for medicine registration.
ALTER TABLE "Medicine" ALTER COLUMN "manufacturerId" DROP NOT NULL;
