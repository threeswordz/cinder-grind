import { PrismaClient } from '@prisma/client';

function fail(message) {
  process.stderr.write(`Restored runtime smoke failed: ${message}\n`);
  process.exit(1);
}

const baseUrl =
  process.env.RESTORED_API_BASE_URL ??
  `http://127.0.0.1:${process.env.API_PORT ?? '3002'}/api/v1`;
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  fail('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
}

const prisma = new PrismaClient();

try {
  const health = await fetch(baseUrl + '/health', {
    headers: { Accept: 'application/json' },
  });
  if (health.status !== 200) {
    fail(`restored health endpoint returned HTTP ${health.status}`);
  }

  const login = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  if (login.status !== 200 && login.status !== 201) {
    fail(`restored administrator login returned HTTP ${login.status}`);
  }

  const setCookie = login.headers.get('set-cookie');
  if (!setCookie) fail('restored login did not return a session cookie');
  const cookie = setCookie.split(';', 1)[0];

  const me = await fetch(baseUrl + '/auth/me', {
    headers: { Accept: 'application/json', Cookie: cookie },
  });
  if (me.status !== 200) {
    fail(`restored authenticated identity check returned HTTP ${me.status}`);
  }

  const meBody = await me.json();
  if (meBody?.data?.email !== adminEmail.toLowerCase()) {
    fail('restored authenticated identity does not match the bootstrap administrator');
  }

  const restoredDocuments = await prisma.document.count({
    where: { storageProvider: 'LOCAL' },
  });
  if (restoredDocuments < 1) {
    fail('restored database contains no LOCAL document metadata');
  }

  process.stdout.write(
    `Restored runtime smoke PASSED: authenticated administrator and found ${restoredDocuments} restored LOCAL document record(s).\n`,
  );
} finally {
  await prisma.$disconnect();
}
