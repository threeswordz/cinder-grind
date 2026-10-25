import { createRequire } from 'node:module';
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { PrismaService } = require('./dist/prisma/prisma.service.js');
const { verifyThbUpgrade } = require('./dist/release/thb-upgrade-verification.js');
const prisma = new PrismaService();
try { await verifyThbUpgrade(prisma, true); } finally { await prisma.$disconnect(); }
