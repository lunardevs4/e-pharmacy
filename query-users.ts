import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      phoneNumber: true,
    },
    take: 15,
  });
  console.log(JSON.stringify(users, null, 2));

  // Also get some medicines
  const medicines = await prisma.medicine.findMany({
    select: { id: true, name: true, dosageForm: true },
    take: 5,
  });
  console.log('\n--- Medicines ---');
  console.log(JSON.stringify(medicines, null, 2));

  await prisma.$disconnect();
}

main();
