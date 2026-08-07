import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../generated/prisma';
import { AUTH_PERMISSIONS } from '../auth/auth.constants';

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const rl = createInterface({ input, output });

const ADMIN_PERMISSIONS = AUTH_PERMISSIONS.admin;

const trimOrEmpty = (value?: string) => value?.trim() ?? '';

async function prompt(label: string, fallback?: string) {
  if (fallback) {
    return trimOrEmpty(fallback);
  }

  const answer = await rl.question(label);
  return trimOrEmpty(answer);
}

async function promptRequired(label: string, fallback?: string) {
  const value = await prompt(label, fallback);
  if (!value) {
    throw new Error(`${label.trim()} is required`);
  }

  return value;
}

async function main() {
  const firstName = await promptRequired('First name: ', process.env.CREATE_ADMIN_FIRST_NAME);
  const lastName = await promptRequired('Last name: ', process.env.CREATE_ADMIN_LAST_NAME);
  const email = await promptRequired('Email: ', process.env.CREATE_ADMIN_EMAIL);
  const phone = await promptRequired('Phone: ', process.env.CREATE_ADMIN_PHONE);
  const password = await promptRequired('Password: ', process.env.CREATE_ADMIN_PASSWORD);

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  console.log('\nCreating admin account...\n');

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  if (existingUser) {
    throw new Error(
      `A user already exists with that email or phone (${existingUser.email}, ${existingUser.phone}, role: ${existingUser.role})`,
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      role: UserRole.ADMIN,
      permissions: ADMIN_PERMISSIONS,
      firstLogin: false,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

    console.log('\nAdmin created successfully!');
    console.log('--------------------------------');
    console.log(`Name:  ${admin.firstName} ${admin.lastName}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Phone: ${admin.phone}`);
    console.log(`Role:  ${admin.role}`);
    console.log(`ID:    ${admin.id}`);
    console.log('--------------------------------\n');
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to create admin: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
    await pool.end();
  });
