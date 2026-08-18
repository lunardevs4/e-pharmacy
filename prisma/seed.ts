import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { PrismaClient, UserRole } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // ── ADMIN ────────────────────────────────────────────────────────────────
    const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@epharmacy.com';
    const adminRawPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Admin@123456';
    const adminPassword = await bcrypt.hash(adminRawPassword, 10);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            phone: '+10000000001',
            password: adminPassword,
            firstName: 'System',
            lastName: 'Admin',
            role: UserRole.ADMIN,
            permissions: ['MANAGE_USERS', 'MANAGE_PHARMACIES', 'MANAGE_SYSTEM', 'VIEW_AUDIT_LOGS'],
            firstLogin: false,
            isActive: true,
        },
    });

    console.log(`✅ Admin created/found: ${admin.email} (id: ${admin.id})`);

    // ── GOVERNMENT ───────────────────────────────────────────────────────────
    const govEmail = 'gov@ministry.gov';
    const govPassword = await bcrypt.hash('Gov@123456', 10);

    const gov = await prisma.user.upsert({
        where: { email: govEmail },
        update: {},
        create: {
            email: govEmail,
            phone: '+10000000002',
            password: govPassword,
            firstName: 'Government',
            lastName: 'Inspector',
            role: UserRole.GOVERNMENT,
            position: 'Senior Inspector',
            permissions: ['VIEW_DASHBOARD', 'VIEW_REPORTS', 'VIEW_AUDIT_LOGS'],
            firstLogin: true,
            isActive: true,
        },
    });

    console.log(`✅ Government user created/found: ${gov.email} (id: ${gov.id})`);

    // ── INSURANCE USERS ─────────────────────────────────────────────────────────
    const rssbUser = await prisma.user.upsert({
        where: { email: 'insurance@rssb.rw' },
        update: {},
        create: {
            email: 'insurance@rssb.rw',
            phone: '+250788001234',
            password: await bcrypt.hash('RSSB@123456', 10),
            firstName: 'RSSB',
            lastName: 'Administrator',
            role: UserRole.INSURANCE,
            permissions: ['VIEW_DASHBOARD', 'MANAGE_CLAIMS', 'MANAGE_TARIFFS', 'MANAGE_AGREEMENTS'],
            firstLogin: true,
            isActive: true,
        },
    });

    const mmiUser = await prisma.user.upsert({
        where: { email: 'insurance@mmi.rw' },
        update: {},
        create: {
            email: 'insurance@mmi.rw',
            phone: '+250788005678',
            password: await bcrypt.hash('MMI@123456', 10),
            firstName: 'MMI',
            lastName: 'Administrator',
            role: UserRole.INSURANCE,
            permissions: ['VIEW_DASHBOARD', 'MANAGE_CLAIMS', 'MANAGE_TARIFFS', 'MANAGE_AGREEMENTS'],
            firstLogin: true,
            isActive: true,
        },
    });

    const ramaUser = await prisma.user.upsert({
        where: { email: 'insurance@rama.rw' },
        update: {},
        create: {
            email: 'insurance@rama.rw',
            phone: '+250788009012',
            password: await bcrypt.hash('RAMA@123456', 10),
            firstName: 'RAMA',
            lastName: 'Administrator',
            role: UserRole.INSURANCE,
            permissions: ['VIEW_DASHBOARD', 'MANAGE_CLAIMS', 'MANAGE_TARIFFS', 'MANAGE_AGREEMENTS'],
            firstLogin: true,
            isActive: true,
        },
    });

    console.log(`✅ Insurance users created: RSSB, MMI, RAMA`);
    console.log('\n⚠️  Change these passwords immediately after first login!');
    console.log(`   Admin:      ${adminEmail}  /  ${adminRawPassword}`);
    console.log('   Government: gov@ministry.gov  /  Gov@123456');
    console.log('   RSSB:       insurance@rssb.rw  /  RSSB@123456');
    console.log('   MMI:        insurance@mmi.rw   /  MMI@123456');
    console.log('   RAMA:       insurance@rama.rw  /  RAMA@123456');

    // ── INSURANCE PROVIDERS ─────────────────────────────────────────────────────
    const rssbInsurance = await prisma.insuranceProvider.upsert({
        where: { code: 'RSSB' },
        update: {},
        create: {
            name: 'RSSB Rwanda',
            code: 'RSSB',
            email: 'insurance@rssb.rw',
            phone: '+250788001234',
            address: 'Kigali, Rwanda',
            defaultCoveragePercentage: 85.00,
            defaultCopayPercentage: 15.00,
            status: 'ACTIVE',
            isActive: true,
        },
    });

    const mmiInsurance = await prisma.insuranceProvider.upsert({
        where: { code: 'MMI' },
        update: {},
        create: {
            name: 'MMI Insurance',
            code: 'MMI',
            email: 'claims@mmi.rw',
            phone: '+250788005678',
            address: 'Kigali, Rwanda',
            defaultCoveragePercentage: 80.00,
            defaultCopayPercentage: 20.00,
            status: 'ACTIVE',
            isActive: true,
        },
    });

    const ramaInsurance = await prisma.insuranceProvider.upsert({
        where: { code: 'RAMA' },
        update: {},
        create: {
            name: 'RAMA Insurance',
            code: 'RAMA',
            email: 'info@rama.rw',
            phone: '+250788009012',
            address: 'Kigali, Rwanda',
            defaultCoveragePercentage: 90.00,
            defaultCopayPercentage: 10.00,
            status: 'ACTIVE',
            isActive: true,
        },
    });

    console.log(`✅ Insurance providers created: RSSB, MMI, RAMA`);

    // ── SAMPLE PHARMACY ─────────────────────────────────────────────────────────
    const bralirwaPharmacy = await prisma.pharmacy.upsert({
        where: { id: 'bralirwa-pharmacy-id' },
        update: {},
        create: {
            id: 'bralirwa-pharmacy-id',
            ownerId: admin.id,
            name: 'Bralirwa Pharmacy',
            address: 'KN 5 Rd, Kigali',
            phone: '+250788111222',
            licenseNumber: 'PH-2024-001',
            district: 'Kigali',
            province: 'Kigali',
            managerName: 'John Mugabo',
            status: 'APPROVED',
            isActive: true,
        },
    });

    console.log(`✅ Sample pharmacy created: ${bralirwaPharmacy.name}`);

    // ── PHARMACY INSURANCE AGREEMENTS ─────────────────────────────────────────────
    await prisma.pharmacyInsuranceAgreement.upsert({
        where: {
            insuranceId_pharmacyId: {
                insuranceId: rssbInsurance.id,
                pharmacyId: bralirwaPharmacy.id,
            },
        },
        update: {},
        create: {
            insuranceId: rssbInsurance.id,
            pharmacyId: bralirwaPharmacy.id,
            contractNumber: 'AGR-RSSB-2024-001',
            discountRate: 5.00,
            customCoverageRate: 85.00,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2025-12-31'),
            status: 'ACTIVE',
        },
    });

    await prisma.pharmacyInsuranceAgreement.upsert({
        where: {
            insuranceId_pharmacyId: {
                insuranceId: mmiInsurance.id,
                pharmacyId: bralirwaPharmacy.id,
            },
        },
        update: {},
        create: {
            insuranceId: mmiInsurance.id,
            pharmacyId: bralirwaPharmacy.id,
            contractNumber: 'AGR-MMI-2024-001',
            discountRate: 3.00,
            customCoverageRate: 80.00,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2025-12-31'),
            status: 'ACTIVE',
        },
    });

    console.log(`✅ Pharmacy insurance agreements created`);

    // ── SAMPLE CATEGORY AND MANUFACTURER ───────────────────────────────────────────
    const sampleCategory = await prisma.category.upsert({
        where: { id: 'sample-category-id' },
        update: {},
        create: {
            id: 'sample-category-id',
            name: 'Antimalarials',
        },
    });

    const sampleManufacturer = await prisma.manufacturer.upsert({
        where: { id: 'sample-manufacturer-id' },
        update: {},
        create: {
            id: 'sample-manufacturer-id',
            name: 'Novartis',
        },
    });

    console.log(`✅ Sample category and manufacturer created`);

    // ── SAMPLE MEDICINE ───────────────────────────────────────────────────────────
    const artemetherMedicine = await prisma.medicine.upsert({
        where: { id: 'artemether-medicine-id' },
        update: {},
        create: {
            id: 'artemether-medicine-id',
            tradeName: 'Coartem',
            genericName: 'Artemether + Lumefantrine',
            categoryId: sampleCategory.id,
            manufacturerId: sampleManufacturer.id,
        },
    });

    const paracetamolMedicine = await prisma.medicine.upsert({
        where: { id: 'paracetamol-medicine-id' },
        update: {},
        create: {
            id: 'paracetamol-medicine-id',
            tradeName: 'Panadol',
            genericName: 'Paracetamol',
            categoryId: sampleCategory.id,
            manufacturerId: sampleManufacturer.id,
        },
    });

    console.log(`✅ Sample medicines created`);

    // ── MEDICINE TARIFFS ─────────────────────────────────────────────────────────
    await prisma.insuranceMedicineTariff.upsert({
        where: {
            insuranceId_medicineId: {
                insuranceId: rssbInsurance.id,
                medicineId: artemetherMedicine.id,
            },
        },
        update: {},
        create: {
            insuranceId: rssbInsurance.id,
            medicineId: artemetherMedicine.id,
            coveredPrice: 5000.00,
            coveragePercentage: 85.00,
            copayPercentage: 15.00,
            isCovered: true,
            requiresPreAuth: false,
            status: 'ACTIVE',
            effectiveDate: new Date('2024-01-01'),
        },
    });

    await prisma.insuranceMedicineTariff.upsert({
        where: {
            insuranceId_medicineId: {
                insuranceId: rssbInsurance.id,
                medicineId: paracetamolMedicine.id,
            },
        },
        update: {},
        create: {
            insuranceId: rssbInsurance.id,
            medicineId: paracetamolMedicine.id,
            coveredPrice: 500.00,
            coveragePercentage: 85.00,
            copayPercentage: 15.00,
            isCovered: true,
            requiresPreAuth: false,
            status: 'ACTIVE',
            effectiveDate: new Date('2024-01-01'),
        },
    });

    console.log(`✅ Medicine tariffs created`);

    // ── INSURED PATIENTS ───────────────────────────────────────────────────────────
    const mariePatient = await prisma.insuredPatient.upsert({
        where: { policyNumber: 'POL-RSSB-2024-001234' },
        update: {},
        create: {
            insuranceId: rssbInsurance.id,
            policyNumber: 'POL-RSSB-2024-001234',
            nationalId: '1199880076543210',
            fullName: 'Marie Uwimana',
            dateOfBirth: new Date('1985-05-15'),
            gender: 'Female',
            phone: '+250788333444',
            coveragePercentage: 85.00,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2025-12-31'),
            status: 'ACTIVE',
        },
    });

    const jeanPatient = await prisma.insuredPatient.upsert({
        where: { policyNumber: 'POL-RSSB-2024-001235' },
        update: {},
        create: {
            insuranceId: rssbInsurance.id,
            policyNumber: 'POL-RSSB-2024-001235',
            nationalId: '1199880076543211',
            fullName: 'Jean Mugabo',
            dateOfBirth: new Date('1990-08-20'),
            gender: 'Male',
            phone: '+250788555666',
            coveragePercentage: 85.00,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2025-12-31'),
            status: 'ACTIVE',
        },
    });

    console.log(`✅ Insured patients created`);

    // ── SAMPLE CLAIMS ─────────────────────────────────────────────────────────────
    const claim1 = await prisma.insuranceClaim.upsert({
        where: { claimNumber: 'RSSB-2024-000001' },
        update: {},
        create: {
            claimNumber: 'RSSB-2024-000001',
            insuranceId: rssbInsurance.id,
            pharmacyId: bralirwaPharmacy.id,
            insuredPatientId: mariePatient.id,
            medicineId: artemetherMedicine.id,
            quantity: 2,
            unitPrice: 5000.00,
            totalAmount: 10000.00,
            insuranceAmount: 8500.00,
            patientAmount: 1500.00,
            status: 'APPROVED',
            claimedAt: new Date('2024-08-01'),
            processedAt: new Date('2024-08-02'),
        },
    });

    const claim2 = await prisma.insuranceClaim.upsert({
        where: { claimNumber: 'RSSB-2024-000002' },
        update: {},
        create: {
            claimNumber: 'RSSB-2024-000002',
            insuranceId: rssbInsurance.id,
            pharmacyId: bralirwaPharmacy.id,
            insuredPatientId: jeanPatient.id,
            medicineId: paracetamolMedicine.id,
            quantity: 5,
            unitPrice: 500.00,
            totalAmount: 2500.00,
            insuranceAmount: 2125.00,
            patientAmount: 375.00,
            status: 'PENDING',
            claimedAt: new Date('2024-08-10'),
        },
    });

    const claim3 = await prisma.insuranceClaim.upsert({
        where: { claimNumber: 'RSSB-2024-000003' },
        update: {},
        create: {
            claimNumber: 'RSSB-2024-000003',
            insuranceId: rssbInsurance.id,
            pharmacyId: bralirwaPharmacy.id,
            insuredPatientId: mariePatient.id,
            medicineId: paracetamolMedicine.id,
            quantity: 3,
            unitPrice: 500.00,
            totalAmount: 1500.00,
            insuranceAmount: 1275.00,
            patientAmount: 225.00,
            status: 'PAID',
            claimedAt: new Date('2024-07-20'),
            processedAt: new Date('2024-07-21'),
            paidAt: new Date('2024-07-25'),
        },
    });

    const claim4 = await prisma.insuranceClaim.upsert({
        where: { claimNumber: 'RSSB-2024-000004' },
        update: {},
        create: {
            claimNumber: 'RSSB-2024-000004',
            insuranceId: rssbInsurance.id,
            pharmacyId: bralirwaPharmacy.id,
            insuredPatientId: jeanPatient.id,
            medicineId: artemetherMedicine.id,
            quantity: 1,
            unitPrice: 5000.00,
            totalAmount: 5000.00,
            insuranceAmount: 4250.00,
            patientAmount: 750.00,
            status: 'REJECTED',
            rejectionReason: 'Missing prescription documentation',
            claimedAt: new Date('2024-08-05'),
            processedAt: new Date('2024-08-06'),
        },
    });

    console.log(`✅ Sample claims created (APPROVED, PENDING, PAID, REJECTED)`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
