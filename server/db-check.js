import { PrismaClient } from './prisma-client.js';
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const blocks = await prisma.block.findMany({ include: { apartments: { include: { payments: true } } } });
  console.log('Blocks:', blocks.length);
  for (const b of blocks) {
    console.log('-', b.name, 'apartments:', b.apartments.length);
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });