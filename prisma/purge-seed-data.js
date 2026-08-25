/**
 * Purges ALL seed/demo data created by prisma/seed.ts plus integration-test
 * artifacts. Real user accounts (gmail addresses) are preserved.
 *
 * Order matters: children first / via FK cascades.
 *   - AuditLogs of target users (SetNull would orphan them)
 *   - Insurance providers RSSB/MMI/RAD/SAN  → cascades agreements, tariffs,
 *     insured patients, claims
 *   - Seed/test users (@epharmacy.test, @test.rw) → cascades patients,
 *     pharmacies (owned), inventory, reservations, employees, tokens,
 *     notifications
 *   - Seed medicines (+ test medicines) → cascades batches, inventory rows,
 *     tariffs (already gone)
 *   - Orphaned categories/manufacturers from the seed lists only when unused
 */
const { Pool } = require('pg');
require('dotenv').config();

const SEED_PROVIDER_CODES = ['RSSB', 'MMI', 'RAD', 'SAN'];

const SEED_USER_EMAIL_PATTERNS = ['%@epharmacy.test', '%@test.rw'];

const SEED_MEDICINE_NAMES = [
  'Amoxicillin 500mg Capsules',
  'Coartem 20/120mg Tablets',
  'Panadol Extra 500mg Tablets',
  'Brufen 400mg Film-coated Tablets',
  'Glucophage 500mg Tablets',
  'Norvasc 5mg Tablets',
  'Zithromax 500mg Tablets',
  'Losec 20mg Capsules',
  'Ventolin Inhaler 100mcg',
  'Ciprobay 500mg Tablets',
  'Zyrtec 10mg Tablets',
  'Pharmavit Multivitamins Syrup',
  // Integration-test artifacts
  'Test Paracetamol 500mg',
  'Journey2 Amox 250mg',
  'Final Journey Test 100mg',
];

const SEED_CATEGORY_NAMES = [
  'Antibiotics',
  'Analgesics & Antipyretics',
  'Antimalarials',
  'Cardiovascular & Antihypertensives',
  'Antidiabetics',
  'Respiratory & Antiasthmatics',
  'Gastrointestinal',
  'Dermatologicals',
  'Vitamins & Essential Minerals',
  'Antihistamines',
];

const SEED_MANUFACTURER_NAMES = [
  'Rwanda Pharma Lab (Kigali)',
  'GlaxoSmithKline (GSK)',
  'Sanofi-Aventis',
  'Cipla Ltd',
  'Novartis Pharma',
  'Aspen Pharmacare',
  'Pfizer International',
  'Shalina Healthcare',
  'Laboratory & Allied Ltd',
  'Test Mfr Ltd',
  'Journey Mfr',
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = (text, params) => pool.query(text, params);

  try {
    // 1. Audit logs for seed users + bootstrap markers
    const del1 = await q(
      `DELETE FROM "AuditLog"
       WHERE action = 'SYSTEM_BOOTSTRAP_SEED'
          OR "userId" IN (SELECT id FROM "User" WHERE email LIKE ANY($1))`,
      [SEED_USER_EMAIL_PATTERNS],
    );
    console.log(`audit logs deleted: ${del1.rowCount}`);

    // 2. Insurance providers (cascades agreements/tariffs/insured patients/claims)
    const del2 = await q(
      `DELETE FROM "InsuranceProvider" WHERE code = ANY($1) RETURNING name`,
      [SEED_PROVIDER_CODES],
    );
    console.log(`insurance providers deleted: ${del2.rowCount} (${del2.rows.map((r) => r.name).join(', ')})`);

    // 3. Seed/test users (cascades patient profiles, owned pharmacies +
    //    inventory/reservations/claims/employees, refresh tokens, notifications)
    const del3 = await q(
      `DELETE FROM "User" WHERE email LIKE ANY($1) RETURNING email`,
      [SEED_USER_EMAIL_PATTERNS],
    );
    console.log(`seed/test users deleted: ${del3.rowCount}`);

    // 4. Seed medicines (cascades batches, inventory, remaining references)
    const del4 = await q(
      `DELETE FROM "Medicine" WHERE "tradeName" = ANY($1) RETURNING "tradeName"`,
      [SEED_MEDICINE_NAMES],
    );
    console.log(`medicines deleted: ${del4.rowCount}`);

    // 5. Orphaned seed categories/manufacturers — only if nothing else uses them
    const del5 = await q(
      `DELETE FROM "Category"
       WHERE name = ANY($1)
         AND NOT EXISTS (SELECT 1 FROM "Medicine" m WHERE m."categoryId" = "Category".id)`,
      [SEED_CATEGORY_NAMES],
    );
    console.log(`orphaned categories deleted: ${del5.rowCount}`);

    const del6 = await q(
      `DELETE FROM "Manufacturer"
       WHERE name = ANY($1)
         AND NOT EXISTS (SELECT 1 FROM "Medicine" m WHERE m."manufacturerId" = "Manufacturer".id)`,
      [SEED_MANUFACTURER_NAMES],
    );
    console.log(`orphaned manufacturers deleted: ${del6.rowCount}`);

    // 6. Residual sanity sweep: reservations/prescriptions referencing deleted
    //    patients are gone via cascade; report what remains for visibility.
    const leftovers = await q(
      `SELECT
         (SELECT COUNT(*) FROM "Pharmacy") AS pharmacies,
         (SELECT COUNT(*) FROM "Medicine") AS medicines,
         (SELECT COUNT(*) FROM "Inventory") AS inventory_rows,
         (SELECT COUNT(*) FROM "Reservation") AS reservations,
         (SELECT COUNT(*) FROM "InsuranceClaim") AS claims,
         (SELECT COUNT(*) FROM "User") AS users`,
    );
    console.log('remaining row counts:', JSON.stringify(leftovers.rows[0]));
    console.log('PURGE COMPLETE');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Purge failed:', e.message);
  process.exit(1);
});
