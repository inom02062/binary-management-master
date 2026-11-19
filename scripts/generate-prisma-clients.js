import { execFileSync } from 'child_process';
import path from 'path';

const prismaCli = path.resolve('node_modules/prisma/build/index.js');

execFileSync(process.execPath, [prismaCli, 'generate'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'file:./prisma-generate.db' },
});
execFileSync(process.execPath, [prismaCli, 'generate', '--schema', 'prisma/postgres/schema.prisma'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: 'postgresql://localhost:5432/binary_management' },
});
