import { PrismaClient } from '@prisma/client';

const mode = process.env.DEPLOYMENT_MODE;
if (mode !== 'fresh' && mode !== 'upgrade') {
  process.stderr.write('Production target verification failed: DEPLOYMENT_MODE must be fresh or upgrade.\n');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const tables = rows.map((row) => String(row.table_name));

  if (mode === 'fresh' && tables.length > 0) {
    const sample = tables.slice(0, 10).join(', ');
    const suffix = tables.length > 10 ? ` (+${tables.length - 10} more)` : '';
    throw new Error(
      `DEPLOYMENT_MODE=fresh requires an empty target schema; found existing tables: ${sample}${suffix}. Use upgrade safeguards for an existing Production database.`,
    );
  }

  process.stdout.write(
    mode === 'fresh'
      ? 'Production target database is empty and eligible for fresh deployment.\n'
      : 'Production target database will be handled as an upgrade.\n',
  );
} catch (error) {
  process.stderr.write(
    `Production target verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
