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
    console.log('\n⚠️  Change these passwords immediately after first login!');
    console.log(`   Admin:      ${adminEmail}  /  ${adminRawPassword}`);
    console.log('   Government: gov@ministry.gov  /  Gov@123456');
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
