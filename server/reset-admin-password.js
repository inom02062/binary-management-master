import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { isValidPassword } from './auth.js';
import { getPlatformDatabaseUrl } from './tenants.js';

const prisma = new PrismaClient({ datasources: { db: { url: getPlatformDatabaseUrl() } } });

try {
  const username = process.env.RESET_ADMIN_USERNAME?.trim();
  const password = process.env.RESET_ADMIN_PASSWORD;
  if (!username || !isValidPassword(password)) {
    throw new Error('Set RESET_ADMIN_USERNAME and a RESET_ADMIN_PASSWORD of at least 5 characters and at most 72 UTF-8 bytes in the local environment.');
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.role !== 'SUPERADMIN') throw new Error('The target account must be an existing SUPERADMIN.');

  await prisma.$transaction(async tx => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 12), isActive: true } });
    await tx.authSession.deleteMany({ where: { userId: user.id } });
    await tx.activityLog.create({ data: { id: randomUUID(), username, action: 'admin_password_reset_cli' } });
  });
  console.log(`Password reset completed for ${username}; all existing sessions were revoked.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}