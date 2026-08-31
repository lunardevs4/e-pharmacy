import { PrismaClient } from './src/generated/prisma';
const prisma = new PrismaClient({});

async function check() {
  const users = await prisma.user.findMany({ select: { email: true, role: true, firstName: true } });
  console.log(users);
}
check().catch(console.error).finally(() => prisma.$disconnect());
