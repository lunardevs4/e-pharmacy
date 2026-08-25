import { PrismaClient, UserRole, PharmacyStatus, ReservationStatus, PrescriptionStatus, ReminderStatus, NotificationType } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('Starting Rwanda E-Pharmacy Database Seed...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ── 1. USERS ─────────────────────────────────────────────────────────────
  console.log('Creating system users...');

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'admin@epharmacy.test',
      phone: '+250788000001',
      password: passwordHash,
      firstName: 'Jean-Luc',
      lastName: 'Habimana',
      role: UserRole.ADMIN,
      position: 'Chief Systems Administrator',
      permissions: ['MANAGE_USERS', 'MANAGE_PHARMACIES', 'MANAGE_SYSTEM', 'VIEW_AUDIT_LOGS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  // Government Official
  const govUser = await prisma.user.upsert({
    where: { email: 'gov@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'gov@epharmacy.test',
      phone: '+250788000002',
      password: passwordHash,
      firstName: 'Dr. Alice',
      lastName: 'Nirere',
      role: UserRole.GOVERNMENT,
      position: 'Director of Pharmaceutical Services (MoH)',
      permissions: ['VIEW_DASHBOARD', 'VIEW_REPORTS', 'VIEW_AUDIT_LOGS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  // Insurance Users
  const rssbUser = await prisma.user.upsert({
    where: { email: 'rssb@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'rssb@epharmacy.test',
      phone: '+250788000003',
      password: passwordHash,
      firstName: 'Emmanuel',
      lastName: 'Karekezi',
      role: UserRole.INSURANCE,
      position: 'Chief Medical Claims Auditor',
      permissions: ['VIEW_CLAIMS', 'MANAGE_CLAIMS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  const mmiUser = await prisma.user.upsert({
    where: { email: 'mmi@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'mmi@epharmacy.test',
      phone: '+250788000004',
      password: passwordHash,
      firstName: 'Major Patrick',
      lastName: 'Gakuba',
      role: UserRole.INSURANCE,
      position: 'MMI Health Claims Lead',
      permissions: ['VIEW_CLAIMS', 'MANAGE_CLAIMS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  // Pharmacy Owners
  const kigaliOwnerUser = await prisma.user.upsert({
    where: { email: 'kigali.owner@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'kigali.owner@epharmacy.test',
      phone: '+250788100001',
      password: passwordHash,
      firstName: 'Dr. Theogene',
      lastName: 'Bizimana',
      role: UserRole.PHARMACY_OWNER,
      position: 'Pharmacy Proprietor',
      permissions: ['MANAGE_STAFF', 'MANAGE_INVENTORY', 'MANAGE_PRESCRIPTIONS', 'VIEW_REPORTS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  const butareOwnerUser = await prisma.user.upsert({
    where: { email: 'butare.owner@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'butare.owner@epharmacy.test',
      phone: '+250788100002',
      password: passwordHash,
      firstName: 'Chantal',
      lastName: 'Umutoni',
      role: UserRole.PHARMACY_OWNER,
      position: 'Managing Partner',
      permissions: ['MANAGE_STAFF', 'MANAGE_INVENTORY', 'MANAGE_PRESCRIPTIONS', 'VIEW_REPORTS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  const musanzeOwnerUser = await prisma.user.upsert({
    where: { email: 'musanze.owner@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'musanze.owner@epharmacy.test',
      phone: '+250788100003',
      password: passwordHash,
      firstName: 'Jean-Baptiste',
      lastName: 'Ndayisaba',
      role: UserRole.PHARMACY_OWNER,
      position: 'Pharmacy Owner',
      permissions: ['MANAGE_STAFF', 'MANAGE_INVENTORY', 'MANAGE_PRESCRIPTIONS', 'VIEW_REPORTS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  // Pharmacists
  const kigaliPharmacistUser = await prisma.user.upsert({
    where: { email: 'pharmacist.kigali@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'pharmacist.kigali@epharmacy.test',
      phone: '+250788200001',
      password: passwordHash,
      firstName: 'Diane',
      lastName: 'Ingabire',
      role: UserRole.PHARMACIST,
      position: 'Chief Pharmacist',
      permissions: ['MANAGE_PRESCRIPTIONS', 'VIEW_INVENTORY', 'VIEW_REPORTS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  const butarePharmacistUser = await prisma.user.upsert({
    where: { email: 'pharmacist.butare@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'pharmacist.butare@epharmacy.test',
      phone: '+250788200002',
      password: passwordHash,
      firstName: 'Eric',
      lastName: 'Mugabo',
      role: UserRole.PHARMACIST,
      position: 'Dispensing Pharmacist',
      permissions: ['MANAGE_PRESCRIPTIONS', 'VIEW_INVENTORY', 'VIEW_REPORTS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  // Patients
  const patientJeanUser = await prisma.user.upsert({
    where: { email: 'patient.jean@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'patient.jean@epharmacy.test',
      phone: '+250788300001',
      password: passwordHash,
      firstName: 'Jean-Paul',
      lastName: 'Mugisha',
      role: UserRole.PATIENT,
      position: 'Citizen Patient',
      permissions: ['VIEW_PROFILE', 'MANAGE_RESERVATIONS', 'MANAGE_PRESCRIPTIONS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  const patientMarieUser = await prisma.user.upsert({
    where: { email: 'patient.marie@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'patient.marie@epharmacy.test',
      phone: '+250788300002',
      password: passwordHash,
      firstName: 'Marie-Claire',
      lastName: 'Uwase',
      role: UserRole.PATIENT,
      position: 'Citizen Patient',
      permissions: ['VIEW_PROFILE', 'MANAGE_RESERVATIONS', 'MANAGE_PRESCRIPTIONS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  const patientClaudineUser = await prisma.user.upsert({
    where: { email: 'patient.claudine@epharmacy.test' },
    update: { password: passwordHash, isActive: true, emailVerified: true },
    create: {
      email: 'patient.claudine@epharmacy.test',
      phone: '+250788300003',
      password: passwordHash,
      firstName: 'Claudine',
      lastName: 'Mukamana',
      role: UserRole.PATIENT,
      position: 'Citizen Patient',
      permissions: ['VIEW_PROFILE', 'MANAGE_RESERVATIONS', 'MANAGE_PRESCRIPTIONS'],
      firstLogin: false,
      isActive: true,
      emailVerified: true,
    },
  });

  // ── 2. INSURANCE PROVIDERS ───────────────────────────────────────────────
  console.log('Creating insurance providers...');

  const rssbProvider = await prisma.insuranceProvider.upsert({
    where: { code: 'RSSB' },
    update: { userId: rssbUser.id, isActive: true, status: 'ACTIVE' },
    create: {
      name: 'Rwanda Social Security Board (RAMA/RSSB)',
      code: 'RSSB',
      userId: rssbUser.id,
      email: 'claims@rssb.rw',
      phone: '+250252598400',
      address: 'Kn 3 Rd, Kiyovu, Nyarugenge, Kigali',
      defaultCoveragePercentage: 85.0,
      defaultCopayPercentage: 15.0,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const mmiProvider = await prisma.insuranceProvider.upsert({
    where: { code: 'MMI' },
    update: { userId: mmiUser.id, isActive: true, status: 'ACTIVE' },
    create: {
      name: 'Military Medical Insurance (MMI)',
      code: 'MMI',
      userId: mmiUser.id,
      email: 'info@mmi.gov.rw',
      phone: '+250252570020',
      address: 'Ministry of Defence Complex, Kimihurura, Gasabo, Kigali',
      defaultCoveragePercentage: 90.0,
      defaultCopayPercentage: 10.0,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const radiantProvider = await prisma.insuranceProvider.upsert({
    where: { code: 'RAD' },
    update: { isActive: true, status: 'ACTIVE' },
    create: {
      name: 'Radiant Insurance Company',
      code: 'RAD',
      email: 'health@radiant.rw',
      phone: '+250252576100',
      address: 'KN 4 Ave, Grand Pension Plaza, Kigali',
      defaultCoveragePercentage: 80.0,
      defaultCopayPercentage: 20.0,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const sanlamProvider = await prisma.insuranceProvider.upsert({
    where: { code: 'SAN' },
    update: { isActive: true, status: 'ACTIVE' },
    create: {
      name: 'Sanlam Vie Plc Rwanda',
      code: 'SAN',
      email: 'info.rwanda@sanlam.com',
      phone: '+250252575456',
      address: 'M. Peace Plaza, KN 4 Ave, Kigali',
      defaultCoveragePercentage: 75.0,
      defaultCopayPercentage: 25.0,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const rwamacProvider = await prisma.insuranceProvider.upsert({
    where: { code: 'RWM' },
    update: { isActive: true, status: 'ACTIVE' },
    create: {
      name: 'Rwamac Insurance',
      code: 'RWM',
      email: 'contact@rwamac.rw',
      phone: '+250252555555',
      address: 'KG 5 Ave, Kigali',
      defaultCoveragePercentage: 80.0,
      defaultCopayPercentage: 20.0,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  const aarProvider = await prisma.insuranceProvider.upsert({
    where: { code: 'AAR' },
    update: { isActive: true, status: 'ACTIVE' },
    create: {
      name: 'AAR Health',
      code: 'AAR',
      email: 'contact@aarhealth.rw',
      phone: '+250252555556',
      address: 'Nyarutarama, Kigali',
      defaultCoveragePercentage: 70.0,
      defaultCopayPercentage: 30.0,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  // ── 3. PATIENTS & INSURED POLICIES ───────────────────────────────────────
  console.log('Creating patient profiles and insurance policies...');

  const patientJean = await prisma.patient.upsert({
    where: { userId: patientJeanUser.id },
    update: {},
    create: {
      userId: patientJeanUser.id,
      address: 'KG 123 St, Kimironko, Gasabo, Kigali City',
      dateOfBirth: new Date('1988-05-14'),
      gender: 'MALE',
      medicalProfile: 'Hypertension, Penicillin sensitive',
    },
  });

  const patientMarie = await prisma.patient.upsert({
    where: { userId: patientMarieUser.id },
    update: {},
    create: {
      userId: patientMarieUser.id,
      address: 'RN1, Huye, Southern Province',
      dateOfBirth: new Date('1994-11-20'),
      gender: 'FEMALE',
      medicalProfile: 'No known chronic allergies',
    },
  });

  const patientClaudine = await prisma.patient.upsert({
    where: { userId: patientClaudineUser.id },
    update: {},
    create: {
      userId: patientClaudineUser.id,
      address: 'Musanze Downtown, Northern Province',
      dateOfBirth: new Date('1990-03-08'),
      gender: 'FEMALE',
      medicalProfile: 'Type 2 Diabetes Mellitus',
    },
  });

  await prisma.insuredPatient.upsert({
    where: { policyNumber: 'RSSB-2026-98124' },
    update: { patientId: patientJean.id },
    create: {
      insuranceId: rssbProvider.id,
      patientId: patientJean.id,
      policyNumber: 'RSSB-2026-98124',
      nationalId: '1198880029384910',
      fullName: 'Jean-Paul Mugisha',
      dateOfBirth: new Date('1988-05-14'),
      gender: 'MALE',
      phone: '+250788300001',
      coveragePercentage: 85.0,
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
    },
  });

  await prisma.insuredPatient.upsert({
    where: { policyNumber: 'MMI-2026-44019' },
    update: { patientId: patientMarie.id },
    create: {
      insuranceId: mmiProvider.id,
      patientId: patientMarie.id,
      policyNumber: 'MMI-2026-44019',
      nationalId: '1199470038491029',
      fullName: 'Marie-Claire Uwase',
      dateOfBirth: new Date('1994-11-20'),
      gender: 'FEMALE',
      phone: '+250788300002',
      coveragePercentage: 90.0,
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
    },
  });

  await prisma.insuredPatient.upsert({
    where: { policyNumber: 'RAD-2026-11883' },
    update: { patientId: patientClaudine.id },
    create: {
      insuranceId: radiantProvider.id,
      patientId: patientClaudine.id,
      policyNumber: 'RAD-2026-11883',
      nationalId: '1199070018392019',
      fullName: 'Claudine Mukamana',
      dateOfBirth: new Date('1990-03-08'),
      gender: 'FEMALE',
      phone: '+250788300003',
      coveragePercentage: 80.0,
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
    },
  });

  // ── 4. CATEGORIES & MANUFACTURERS ─────────────────────────────────────────
  console.log('Creating categories and manufacturers...');

  const catNames = [
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

  const categories: Record<string, any> = {};
  for (const name of catNames) {
    categories[name] = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const mfrNames = [
    'Rwanda Pharma Lab (Kigali)',
    'GlaxoSmithKline (GSK)',
    'Sanofi-Aventis',
    'Cipla Ltd',
    'Novartis Pharma',
    'Aspen Pharmacare',
    'Pfizer International',
    'Shalina Healthcare',
    'Laboratory & Allied Ltd',
  ];

  const manufacturers: Record<string, any> = {};
  for (const name of mfrNames) {
    manufacturers[name] = await prisma.manufacturer.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ── 5. MEDICINES ─────────────────────────────────────────────────────────
  console.log('Creating medicine catalog...');

  const medicineDefs = [
    {
      tradeName: 'Amoxicillin 500mg Capsules',
      genericName: 'Amoxicillin',
      category: 'Antibiotics',
      manufacturer: 'Rwanda Pharma Lab (Kigali)',
    },
    {
      tradeName: 'Coartem 20/120mg Tablets',
      genericName: 'Artemether + Lumefantrine',
      category: 'Antimalarials',
      manufacturer: 'Novartis Pharma',
    },
    {
      tradeName: 'Panadol Extra 500mg Tablets',
      genericName: 'Paracetamol + Caffeine',
      category: 'Analgesics & Antipyretics',
      manufacturer: 'GlaxoSmithKline (GSK)',
    },
    {
      tradeName: 'Brufen 400mg Film-coated Tablets',
      genericName: 'Ibuprofen',
      category: 'Analgesics & Antipyretics',
      manufacturer: 'Sanofi-Aventis',
    },
    {
      tradeName: 'Glucophage 500mg Tablets',
      genericName: 'Metformin Hydrochloride',
      category: 'Antidiabetics',
      manufacturer: 'Sanofi-Aventis',
    },
    {
      tradeName: 'Norvasc 5mg Tablets',
      genericName: 'Amlodipine Besylate',
      category: 'Cardiovascular & Antihypertensives',
      manufacturer: 'Pfizer International',
    },
    {
      tradeName: 'Zithromax 500mg Tablets',
      genericName: 'Azithromycin',
      category: 'Antibiotics',
      manufacturer: 'Pfizer International',
    },
    {
      tradeName: 'Losec 20mg Capsules',
      genericName: 'Omeprazole',
      category: 'Gastrointestinal',
      manufacturer: 'Cipla Ltd',
    },
    {
      tradeName: 'Ventolin Inhaler 100mcg',
      genericName: 'Salbutamol Sulfate',
      category: 'Respiratory & Antiasthmatics',
      manufacturer: 'GlaxoSmithKline (GSK)',
    },
    {
      tradeName: 'Ciprobay 500mg Tablets',
      genericName: 'Ciprofloxacin',
      category: 'Antibiotics',
      manufacturer: 'Cipla Ltd',
    },
    {
      tradeName: 'Zyrtec 10mg Tablets',
      genericName: 'Cetirizine Hydrochloride',
      category: 'Antihistamines',
      manufacturer: 'GlaxoSmithKline (GSK)',
    },
    {
      tradeName: 'Pharmavit Multivitamins Syrup',
      genericName: 'Multivitamin Complex + Zinc',
      category: 'Vitamins & Essential Minerals',
      manufacturer: 'Laboratory & Allied Ltd',
    },
  ];

  const medicines: Record<string, any> = {};
  for (const def of medicineDefs) {
    const category = categories[def.category] || Object.values(categories)[0];
    const manufacturer = manufacturers[def.manufacturer] || Object.values(manufacturers)[0];

    const existingMed = await prisma.medicine.findFirst({
      where: { tradeName: def.tradeName },
    });

    if (existingMed) {
      medicines[def.tradeName] = existingMed;
    } else {
      medicines[def.tradeName] = await prisma.medicine.create({
        data: {
          tradeName: def.tradeName,
          genericName: def.genericName,
          categoryId: category.id,
          manufacturerId: manufacturer.id,
        },
      });
    }
  }

  // ── 6. PHARMACIES ─────────────────────────────────────────────────────────
  console.log('Creating pharmacies across provinces...');

  // Kigali Pharmacy
  let kigaliPharmacy = await prisma.pharmacy.findFirst({
    where: { ownerId: kigaliOwnerUser.id },
  });
  if (!kigaliPharmacy) {
    kigaliPharmacy = await prisma.pharmacy.create({
      data: {
        ownerId: kigaliOwnerUser.id,
        name: 'Kigali National Pharmacy',
        address: 'KG 15 Ave, Nyarugenge District, Kigali City',
        latitude: -1.9441,
        longitude: 30.0619,
        phone: '+250788100001',
        licenseNumber: 'FDA/PHARM/KGL/001',
        district: 'Nyarugenge',
        province: 'Kigali City',
        managerName: 'Dr. Theogene Bizimana',
        status: PharmacyStatus.APPROVED,
        isActive: true,
        category: 'Retail',
        ownershipType: 'Private Corporation',
      },
    });
  } else {
    kigaliPharmacy = await prisma.pharmacy.update({
      where: { id: kigaliPharmacy.id },
      data: {
        name: 'Kigali National Pharmacy',
        address: 'KG 15 Ave, Nyarugenge District, Kigali City',
        latitude: -1.9441,
        longitude: 30.0619,
        licenseNumber: 'FDA/PHARM/KGL/001',
        district: 'Nyarugenge',
        province: 'Kigali City',
        status: PharmacyStatus.APPROVED,
        isActive: true,
      },
    });
  }

  await prisma.pharmacyOwner.upsert({
    where: { userId: kigaliOwnerUser.id },
    update: { pharmacyId: kigaliPharmacy.id },
    create: { userId: kigaliOwnerUser.id, pharmacyId: kigaliPharmacy.id },
  });

  await prisma.pharmacyEmployee.upsert({
    where: { pharmacyId_userId: { pharmacyId: kigaliPharmacy.id, userId: kigaliPharmacistUser.id } },
    update: { role: UserRole.PHARMACIST },
    create: {
      pharmacyId: kigaliPharmacy.id,
      userId: kigaliPharmacistUser.id,
      role: UserRole.PHARMACIST,
    },
  });

  // Southern Province Pharmacy (Huye / Butare)
  let butarePharmacy = await prisma.pharmacy.findFirst({
    where: { ownerId: butareOwnerUser.id },
  });
  if (!butarePharmacy) {
    butarePharmacy = await prisma.pharmacy.create({
      data: {
        ownerId: butareOwnerUser.id,
        name: 'Butare Central Pharmacy',
        address: 'RN1 Highway, Huye District, Southern Province',
        latitude: -2.5967,
        longitude: 29.7394,
        phone: '+250788100002',
        licenseNumber: 'FDA/PHARM/STH/042',
        district: 'Huye',
        province: 'Southern Province',
        managerName: 'Chantal Umutoni',
        status: PharmacyStatus.APPROVED,
        isActive: true,
        category: 'Retail & Community',
        ownershipType: 'Sole Proprietorship',
      },
    });
  } else {
    butarePharmacy = await prisma.pharmacy.update({
      where: { id: butarePharmacy.id },
      data: {
        name: 'Butare Central Pharmacy',
        address: 'RN1 Highway, Huye District, Southern Province',
        latitude: -2.5967,
        longitude: 29.7394,
        district: 'Huye',
        province: 'Southern Province',
        status: PharmacyStatus.APPROVED,
        isActive: true,
      },
    });
  }

  await prisma.pharmacyOwner.upsert({
    where: { userId: butareOwnerUser.id },
    update: { pharmacyId: butarePharmacy.id },
    create: { userId: butareOwnerUser.id, pharmacyId: butarePharmacy.id },
  });

  await prisma.pharmacyEmployee.upsert({
    where: { pharmacyId_userId: { pharmacyId: butarePharmacy.id, userId: butarePharmacistUser.id } },
    update: { role: UserRole.PHARMACIST },
    create: {
      pharmacyId: butarePharmacy.id,
      userId: butarePharmacistUser.id,
      role: UserRole.PHARMACIST,
    },
  });

  // Northern Province Pharmacy (Musanze)
  let musanzePharmacy = await prisma.pharmacy.findFirst({
    where: { ownerId: musanzeOwnerUser.id },
  });
  if (!musanzePharmacy) {
    musanzePharmacy = await prisma.pharmacy.create({
      data: {
        ownerId: musanzeOwnerUser.id,
        name: 'Musanze Healthcare Pharmacy',
        address: 'Downtown Musanze, Northern Province',
        latitude: -1.4998,
        longitude: 29.635,
        phone: '+250788100003',
        licenseNumber: 'FDA/PHARM/NTH/018',
        district: 'Musanze',
        province: 'Northern Province',
        managerName: 'Jean-Baptiste Ndayisaba',
        status: PharmacyStatus.APPROVED,
        isActive: true,
        category: 'Retail',
        ownershipType: 'Partnership',
      },
    });
  } else {
    musanzePharmacy = await prisma.pharmacy.update({
      where: { id: musanzePharmacy.id },
      data: {
        name: 'Musanze Healthcare Pharmacy',
        address: 'Downtown Musanze, Northern Province',
        latitude: -1.4998,
        longitude: 29.635,
        district: 'Musanze',
        province: 'Northern Province',
        status: PharmacyStatus.APPROVED,
        isActive: true,
      },
    });
  }

  await prisma.pharmacyOwner.upsert({
    where: { userId: musanzeOwnerUser.id },
    update: { pharmacyId: musanzePharmacy.id },
    create: { userId: musanzeOwnerUser.id, pharmacyId: musanzePharmacy.id },
  });

  // ── 7. INVENTORY & BATCHES ───────────────────────────────────────────────
  console.log('Stocking pharmacy inventories with batches...');

  const inventoryStockData = [
    // Kigali Pharmacy
    { pharmacy: kigaliPharmacy, medName: 'Amoxicillin 500mg Capsules', qty: 150, price: 3500, batch: 'AMX-24-001', exp: '2027-08-30' },
    { pharmacy: kigaliPharmacy, medName: 'Coartem 20/120mg Tablets', qty: 80, price: 4200, batch: 'CRT-24-102', exp: '2026-12-31' },
    { pharmacy: kigaliPharmacy, medName: 'Panadol Extra 500mg Tablets', qty: 300, price: 1200, batch: 'PND-25-010', exp: '2028-03-15' },
    { pharmacy: kigaliPharmacy, medName: 'Brufen 400mg Film-coated Tablets', qty: 120, price: 2500, batch: 'BRF-24-044', exp: '2027-05-20' },
    { pharmacy: kigaliPharmacy, medName: 'Glucophage 500mg Tablets', qty: 95, price: 6500, batch: 'GLC-24-088', exp: '2026-10-15' },
    { pharmacy: kigaliPharmacy, medName: 'Norvasc 5mg Tablets', qty: 60, price: 8000, batch: 'NRV-25-003', exp: '2027-11-30' },
    { pharmacy: kigaliPharmacy, medName: 'Zithromax 500mg Tablets', qty: 40, price: 9500, batch: 'ZTH-24-019', exp: '2026-09-28' },
    { pharmacy: kigaliPharmacy, medName: 'Losec 20mg Capsules', qty: 75, price: 7000, batch: 'LSC-24-101', exp: '2027-04-12' },
    { pharmacy: kigaliPharmacy, medName: 'Ventolin Inhaler 100mcg', qty: 4, price: 11000, batch: 'VNT-24-005', exp: '2026-07-01' }, // Low stock test

    // Butare Pharmacy
    { pharmacy: butarePharmacy, medName: 'Amoxicillin 500mg Capsules', qty: 100, price: 3400, batch: 'AMX-24-002', exp: '2027-08-30' },
    { pharmacy: butarePharmacy, medName: 'Coartem 20/120mg Tablets', qty: 110, price: 4000, batch: 'CRT-24-103', exp: '2026-12-31' },
    { pharmacy: butarePharmacy, medName: 'Panadol Extra 500mg Tablets', qty: 250, price: 1100, batch: 'PND-25-011', exp: '2028-03-15' },
    { pharmacy: butarePharmacy, medName: 'Brufen 400mg Film-coated Tablets', qty: 85, price: 2400, batch: 'BRF-24-045', exp: '2027-05-20' },
    { pharmacy: butarePharmacy, medName: 'Glucophage 500mg Tablets', qty: 5, price: 6200, batch: 'GLC-24-089', exp: '2026-10-15' }, // Low stock test
    { pharmacy: butarePharmacy, medName: 'Losec 20mg Capsules', qty: 50, price: 6800, batch: 'LSC-24-102', exp: '2027-04-12' },

    // Musanze Pharmacy
    { pharmacy: musanzePharmacy, medName: 'Amoxicillin 500mg Capsules', qty: 90, price: 3600, batch: 'AMX-24-003', exp: '2027-08-30' },
    { pharmacy: musanzePharmacy, medName: 'Coartem 20/120mg Tablets', qty: 70, price: 4300, batch: 'CRT-24-104', exp: '2026-12-31' },
    { pharmacy: musanzePharmacy, medName: 'Panadol Extra 500mg Tablets', qty: 200, price: 1300, batch: 'PND-25-012', exp: '2028-03-15' },
    { pharmacy: musanzePharmacy, medName: 'Ciprobay 500mg Tablets', qty: 65, price: 5500, batch: 'CPR-24-001', exp: '2027-01-20' },
    { pharmacy: musanzePharmacy, medName: 'Zyrtec 10mg Tablets', qty: 110, price: 3000, batch: 'ZYR-24-015', exp: '2027-09-10' },
    { pharmacy: musanzePharmacy, medName: 'Pharmavit Multivitamins Syrup', qty: 45, price: 4500, batch: 'PHV-24-099', exp: '2026-11-25' },
  ];

  for (const item of inventoryStockData) {
    const med = medicines[item.medName];
    if (!med) continue;

    const expiryDate = new Date(item.exp);

    // Upsert batch
    await prisma.medicineBatch.upsert({
      where: { medicineId_batchNumber: { medicineId: med.id, batchNumber: item.batch } },
      update: { currentStock: item.qty, unitSellingPrice: item.price },
      create: {
        medicineId: med.id,
        batchNumber: item.batch,
        lotNumber: `LOT-${item.batch}`,
        expiryDate,
        unitCost: item.price * 0.7,
        unitSellingPrice: item.price,
        initialStock: item.qty,
        currentStock: item.qty,
        storageConditions: 'Store below 25°C in a dry place',
      },
    });

    // Upsert inventory
    await prisma.inventory.upsert({
      where: { pharmacyId_medicineId: { pharmacyId: item.pharmacy.id, medicineId: med.id } },
      update: { quantity: item.qty, price: item.price, expiryDate, batchNumber: item.batch },
      create: {
        pharmacyId: item.pharmacy.id,
        medicineId: med.id,
        quantity: item.qty,
        price: item.price,
        expiryDate,
        batchNumber: item.batch,
      },
    });
  }

  // ── 8. PHARMACY INSURANCE AGREEMENTS & TARIFFS ────────────────────────────
  console.log('Creating insurance agreements and medicine tariffs...');

  const agreements = [
    { insurance: rssbProvider, pharmacy: kigaliPharmacy, discount: 5.0, contract: 'RSSB/KGL/AGR-001' },
    { insurance: rssbProvider, pharmacy: butarePharmacy, discount: 5.0, contract: 'RSSB/STH/AGR-012' },
    { insurance: rssbProvider, pharmacy: musanzePharmacy, discount: 5.0, contract: 'RSSB/NTH/AGR-007' },
    { insurance: mmiProvider, pharmacy: kigaliPharmacy, discount: 7.0, contract: 'MMI/KGL/AGR-001' },
    { insurance: mmiProvider, pharmacy: butarePharmacy, discount: 7.0, contract: 'MMI/STH/AGR-003' },
    { insurance: radiantProvider, pharmacy: kigaliPharmacy, discount: 4.0, contract: 'RAD/KGL/AGR-009' },
    { insurance: sanlamProvider, pharmacy: kigaliPharmacy, discount: 5.0, contract: 'SAN/KGL/AGR-002' },
  ];

  for (const agr of agreements) {
    await prisma.pharmacyInsuranceAgreement.upsert({
      where: { insuranceId_pharmacyId: { insuranceId: agr.insurance.id, pharmacyId: agr.pharmacy.id } },
      update: { status: 'ACTIVE', discountRate: agr.discount },
      create: {
        insuranceId: agr.insurance.id,
        pharmacyId: agr.pharmacy.id,
        contractNumber: agr.contract,
        status: 'ACTIVE',
        discountRate: agr.discount,
        startDate: new Date('2024-01-01'),
      },
    });
  }

  // Tariffs for RSSB and MMI
  const tariffMedicines = [
    { name: 'Amoxicillin 500mg Capsules', price: 3500, coverage: 85, copay: 15 },
    { name: 'Coartem 20/120mg Tablets', price: 4200, coverage: 85, copay: 15 },
    { name: 'Panadol Extra 500mg Tablets', price: 1200, coverage: 85, copay: 15 },
    { name: 'Brufen 400mg Film-coated Tablets', price: 2500, coverage: 85, copay: 15 },
    { name: 'Glucophage 500mg Tablets', price: 6500, coverage: 85, copay: 15 },
    { name: 'Norvasc 5mg Tablets', price: 8000, coverage: 85, copay: 15 },
    { name: 'Losec 20mg Capsules', price: 7000, coverage: 85, copay: 15 },
  ];

  for (const t of tariffMedicines) {
    const med = medicines[t.name];
    if (!med) continue;

    // RSSB Tariff
    await prisma.insuranceMedicineTariff.upsert({
      where: { insuranceId_medicineId: { insuranceId: rssbProvider.id, medicineId: med.id } },
      update: { coveredPrice: t.price, coveragePercentage: t.coverage, copayPercentage: t.copay, isCovered: true },
      create: {
        insuranceId: rssbProvider.id,
        medicineId: med.id,
        coveredPrice: t.price,
        coveragePercentage: t.coverage,
        copayPercentage: t.copay,
        isCovered: true,
        status: 'ACTIVE',
      },
    });

    // MMI Tariff (90% coverage)
    await prisma.insuranceMedicineTariff.upsert({
      where: { insuranceId_medicineId: { insuranceId: mmiProvider.id, medicineId: med.id } },
      update: { coveredPrice: t.price, coveragePercentage: 90.0, copayPercentage: 10.0, isCovered: true },
      create: {
        insuranceId: mmiProvider.id,
        medicineId: med.id,
        coveredPrice: t.price,
        coveragePercentage: 90.0,
        copayPercentage: 10.0,
        isCovered: true,
        status: 'ACTIVE',
      },
    });
  }

  // ── 9. SAMPLE CLAIMS, RESERVATIONS & PRESCRIPTIONS ───────────────────────
  console.log('Creating insurance claims, reservations, and reminders...');

  const amoxMed = medicines['Amoxicillin 500mg Capsules'];
  const coartemMed = medicines['Coartem 20/120mg Tablets'];
  const glucophageMed = medicines['Glucophage 500mg Tablets'];

  // Sample Claims
  await prisma.insuranceClaim.upsert({
    where: { claimNumber: 'CLM-2026-00001' },
    update: {},
    create: {
      claimNumber: 'CLM-2026-00001',
      insuranceId: rssbProvider.id,
      pharmacyId: kigaliPharmacy.id,
      patientId: patientJean.id,
      medicineId: amoxMed?.id,
      quantity: 2,
      unitPrice: 3500,
      totalAmount: 7000,
      insuranceAmount: 5950,
      patientAmount: 1050,
      status: 'APPROVED',
      notes: 'Standard acute respiratory infection antibiotic dispense.',
      claimedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      processedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.insuranceClaim.upsert({
    where: { claimNumber: 'CLM-2026-00002' },
    update: {},
    create: {
      claimNumber: 'CLM-2026-00002',
      insuranceId: rssbProvider.id,
      pharmacyId: kigaliPharmacy.id,
      patientId: patientJean.id,
      medicineId: glucophageMed?.id,
      quantity: 1,
      unitPrice: 6500,
      totalAmount: 6500,
      insuranceAmount: 5525,
      patientAmount: 975,
      status: 'PENDING',
      notes: 'Monthly chronic maintenance refill.',
      claimedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.insuranceClaim.upsert({
    where: { claimNumber: 'CLM-2026-00003' },
    update: {},
    create: {
      claimNumber: 'CLM-2026-00003',
      insuranceId: mmiProvider.id,
      pharmacyId: butarePharmacy.id,
      patientId: patientMarie.id,
      medicineId: coartemMed?.id,
      quantity: 1,
      unitPrice: 4000,
      totalAmount: 4000,
      insuranceAmount: 3600,
      patientAmount: 400,
      status: 'PAID',
      notes: 'Uncomplicated malaria treatment.',
      claimedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      processedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  // Sample Prescriptions
  const existingPrescription = await prisma.prescription.findFirst({
    where: { patientId: patientJean.id, pharmacyId: kigaliPharmacy.id },
  });
  const prescriptionJean =
    existingPrescription ||
    (await prisma.prescription.create({
      data: {
        patientId: patientJean.id,
        pharmacyId: kigaliPharmacy.id,
        pharmacistId: kigaliPharmacistUser.id,
        status: PrescriptionStatus.APPROVED,
        notes: 'Take Amoxicillin 500mg three times daily after meals for 7 days.',
        medicines: {
          create: [
            {
              medicineId: amoxMed.id,
              dosage: '500mg',
              frequency: '3 times daily',
              duration: '7 days',
              quantity: 21,
            },
          ],
        },
      },
    }));

  // Sample Medication Reminder Schedule for Jean
  const existingSchedule = await prisma.reminderSchedule.findFirst({
    where: { patientId: patientJean.id, prescriptionId: prescriptionJean.id },
  });
  const scheduleJean =
    existingSchedule ||
    (await prisma.reminderSchedule.create({
      data: {
        patientId: patientJean.id,
        prescriptionId: prescriptionJean.id,
        medicineId: amoxMed.id,
        dosage: '1 Capsule (500mg)',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        timeOfDay: ['08:00', '14:00', '20:00'],
        intervalHours: 6,
      },
    }));

  // Sample Reminder Logs (only once)
  const existingLogs = await prisma.reminderLog.count({ where: { scheduleId: scheduleJean.id } });
  if (existingLogs === 0) {
    await prisma.reminderLog.create({
      data: {
        scheduleId: scheduleJean.id,
        patientId: patientJean.id,
        type: NotificationType.IN_APP,
        status: ReminderStatus.COMPLETED,
        sentAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      },
    });

    await prisma.reminderLog.create({
      data: {
        scheduleId: scheduleJean.id,
        patientId: patientJean.id,
        type: NotificationType.IN_APP,
        status: ReminderStatus.SENT,
        sentAt: new Date(),
      },
    });
  }

  // Sample Patient Reservation
  const existingReservation = await prisma.reservation.findFirst({
    where: { patientId: patientJean.id, pharmacyId: kigaliPharmacy.id, medicineId: amoxMed.id },
  });
  if (!existingReservation) {
    await prisma.reservation.create({
      data: {
        patientId: patientJean.id,
        pharmacyId: kigaliPharmacy.id,
        medicineId: amoxMed.id,
        quantity: 1,
        status: ReservationStatus.CONFIRMED,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
  }

  // Sample Notifications (idempotent-ish: only when none exist for these users)
  const jeanNotifs = await prisma.notification.count({ where: { userId: patientJeanUser.id } });
  if (jeanNotifs === 0) {
    await prisma.notification.create({
      data: {
        userId: patientJeanUser.id,
        type: NotificationType.IN_APP,
        title: 'Prescription Ready for Pickup',
        message: 'Your prescription for Amoxicillin 500mg is confirmed at Kigali National Pharmacy.',
        isRead: false,
      },
    });
  }

  const ownerNotifs = await prisma.notification.count({ where: { userId: kigaliOwnerUser.id } });
  if (ownerNotifs === 0) {
    await prisma.notification.create({
      data: {
        userId: kigaliOwnerUser.id,
        type: NotificationType.IN_APP,
        title: 'New Reservation Received',
        message: 'Patient Jean-Paul Mugisha has placed a reservation for Amoxicillin 500mg.',
        isRead: false,
      },
    });
  }

  // Sample Audit Log
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SYSTEM_BOOTSTRAP_SEED',
      entityType: 'System',
      entityId: 'SEED_INITIAL',
      changes: { status: 'COMPLETE', environment: 'DEVELOPMENT' },
    },
  });

  console.log('Rwanda E-Pharmacy Database Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
