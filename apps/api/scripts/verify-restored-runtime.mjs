import { createHash } from 'node:crypto';
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

  const restoredAdmin = await prisma.user.findFirst({
    where: { email: adminEmail.toLowerCase(), isActive: true },
    select: { companyId: true },
  });
  if (!restoredAdmin) {
    fail('restored bootstrap administrator was not found in the restored database');
  }

  const restoredDocuments = await prisma.document.count({
    where: { companyId: restoredAdmin.companyId, storageProvider: 'LOCAL' },
  });
  if (restoredDocuments < 1) {
    fail('restored database contains no LOCAL document metadata for the bootstrap administrator company');
  }

  const downloadCandidate = await prisma.document.findFirst({
    where: {
      companyId: restoredAdmin.companyId,
      storageProvider: 'LOCAL',
      checksum: { not: null },
      links: { some: { entityType: 'PROJECT' } },
    },
    select: {
      id: true,
      checksum: true,
      fileSizeBytes: true,
      links: {
        where: { entityType: 'PROJECT' },
        select: { entityId: true },
        take: 1,
      },
    },
    orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
  });
  if (!downloadCandidate?.checksum || downloadCandidate.links.length < 1) {
    fail('restored database contains no checksum-backed LOCAL document linked to a Project');
  }

  const projectId = downloadCandidate.links[0].entityId;
  const download = await fetch(
    baseUrl +
      `/documents/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(downloadCandidate.id)}/download`,
    {
      headers: {
        Accept: '*/*',
        Cookie: cookie,
      },
    },
  );
  if (download.status !== 200) {
    fail(`restored document download returned HTTP ${download.status}`);
  }

  if (!download.body) {
    fail('restored document download did not return a readable response body');
  }

  const downloadedHash = createHash('sha256');
  let downloadedByteCount = 0;
  const reader = download.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    downloadedByteCount += value.byteLength;
    if (downloadedByteCount > downloadCandidate.fileSizeBytes) {
      fail(
        `restored document download exceeded expected size: expected ${downloadCandidate.fileSizeBytes}, received more than ${downloadCandidate.fileSizeBytes}`,
      );
    }
    downloadedHash.update(value);
  }

  if (downloadedByteCount !== downloadCandidate.fileSizeBytes) {
    fail(
      `restored document download size mismatch: expected ${downloadCandidate.fileSizeBytes}, received ${downloadedByteCount}`,
    );
  }

  const downloadedChecksum = downloadedHash.digest('hex');
  if (downloadedChecksum !== downloadCandidate.checksum) {
    fail('restored document download checksum does not match restored metadata');
  }

  process.stdout.write(
    `Restored runtime smoke PASSED: authenticated administrator, found ${restoredDocuments} restored LOCAL document record(s), and downloaded/verified document ${downloadCandidate.id}.\n`,
  );
} finally {
  await prisma.$disconnect();
}
