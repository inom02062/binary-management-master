const usePostgres = process.env.DB_PROVIDER === 'postgresql'
  || /^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '');

const clientModule = usePostgres
  ? await import('../generated/postgres/index.js')
  : await import('@prisma/client');

export const { PrismaClient } = clientModule;
