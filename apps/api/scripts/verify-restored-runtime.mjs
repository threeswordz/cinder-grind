import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

function fail(message) {
  process.stderr.write(`Restored runtime smoke failed: ${message}\n`);
  process.exit(1);
}

const baseUrl =
  process.env.RESTORED_API_BASE_URL ??
  `http://127.0.0.1:${process.env.API_PORT ?? '3002'}/api/v1`;

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      email: {
        startsWith: 'uat-pm-',
        endsWith: '@example.com',
      },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true },
  });

  if (!user) fail('restored Project Manager UAT user was not found');

  const match = /^uat-pm-([a-z0-9]+)@example\.com$/.exec(user.email);
  if (!match) fail('restored Project Manager UAT email is not in the expected deterministic format');

  const suffix = match[1].toUpperCase();
  const password = `Uat-PM-${suffix}-Strong-2026!`;

  const link = await prisma.documentLink.findFirst({
    where: {
      linkedByUserId: user.id,
      entityType: 'PROJECT',
    },
    orderBy: { linkedAt: 'desc' },
    select: {
      entityId: true,
      documentId: true,
    },
  });

  if (!link) fail('restored Project Manager has no Project-linked document evidence');

  const document = await prisma.document.findUnique({
    where: { id: link.documentId },
    select: {
      id: true,
      fileSizeBytes: true,
      checksum: true,
      storageProvider: true,
      isActive: true,
    },
  });

  if (!document || document.storageProvider !== 'LOCAL' || !document.isActive) {
    fail('restored Project-linked document is not an active LOCAL document');
  }

  const login = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: user.email, password }),
  });

  if (login.status !== 200 && login.status !== 201) {
    fail(`restored Project Manager login returned HTTP ${login.status}`);
  }

  const setCookie = login.headers.get('set-cookie');
  if (!setCookie) fail('restored login did not return a session cookie');
  const cookie = setCookie.split(';', 1)[0];

  const me = await fetch(baseUrl + '/auth/me', {
    headers: { Accept: 'application/json', Cookie: cookie },
  });
  if (me.status !== 200) fail(`restored authenticated identity check returned HTTP ${me.status}`);

  const meBody = await me.json();
  if (meBody?.data?.email !== user.email) {
    fail('restored authenticated identity does not match the selected Project Manager');
  }

  const list = await fetch(baseUrl + `/documents/projects/${link.entityId}`, {
    headers: { Accept: 'application/json', Cookie: cookie },
  });
  if (list.status !== 200) fail(`restored Project document list returned HTTP ${list.status}`);

  const listBody = await list.json();
  if (!Array.isArray(listBody?.data) || !listBody.data.some((item) => item.id === document.id)) {
    fail('restored Project document list does not contain the selected recovery document');
  }
  if (JSON.stringify(listBody).includes('storageKey')) {
    fail('restored Project document API exposed storageKey');
  }

  const download = await fetch(
    baseUrl + `/documents/projects/${link.entityId}/${document.id}/download`,
    { headers: { Accept: '*/*', Cookie: cookie } },
  );
  if (download.status !== 200) {
    fail(`restored Project document download returned HTTP ${download.status}`);
  }

  const bytes = new Uint8Array(await download.arrayBuffer());
  if (bytes.byteLength !== document.fileSizeBytes) {
    fail('restored Project document download size does not match database metadata');
  }

  if (document.checksum) {
    const checksum = createHash('sha256').update(bytes).digest('hex');
    if (checksum !== document.checksum) {
      fail('restored Project document download checksum does not match database metadata');
    }
  }

  process.stdout.write(
    `Restored runtime smoke PASSED: authenticated ${user.email} and verified Project document ${document.id}.\n`,
  );
} finally {
  await prisma.$disconnect();
}
