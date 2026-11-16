import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

function fail(message) {
  throw Object.assign(new Error(message), { restoredSmokeMessage: message });
}

const baseUrl =
  process.env.RESTORED_API_BASE_URL ??
  `http://127.0.0.1:${process.env.API_PORT ?? '3002'}/api/v1`;
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  fail('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required');
}

const readerEmail = process.env.RESTORED_READER_EMAIL ?? adminEmail;
const readerPassword = process.env.RESTORED_READER_PASSWORD ?? adminPassword;
if (Boolean(process.env.RESTORED_READER_EMAIL) !== Boolean(process.env.RESTORED_READER_PASSWORD)) {
  fail('RESTORED_READER_EMAIL and RESTORED_READER_PASSWORD must be supplied together');
}
const prisma = new PrismaClient();
const sessions = [];
let successMessage;

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
  const adminLoginBody = await login.json();
  const adminCsrf = adminLoginBody?.data?.csrfToken;
  if (typeof adminCsrf !== 'string' || !adminCsrf) fail('restored administrator CSRF token missing');
  sessions.push({ cookie, csrfToken: adminCsrf });

  const me = await fetch(baseUrl + '/auth/me', {
    headers: { Accept: 'application/json', Cookie: cookie },
  });
  if (me.status !== 200) {
    fail(`restored authenticated identity check returned HTTP ${me.status}`);
  }

  const meBody = await me.json();
  if (meBody?.data?.email !== adminEmail.toLowerCase() ||
      typeof meBody.data.id !== 'string' || typeof meBody.data.companyId !== 'string') {
    fail('restored authenticated identity does not match the bootstrap administrator');
  }

  const restoredAdmin = await prisma.user.findFirst({
    where: { id: meBody.data.id, companyId: meBody.data.companyId, email: adminEmail.toLowerCase(), isActive: true },
    select: { companyId: true, employee: { select: { companyId: true, isActive: true } } },
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

  // An unlinked technical administrator authenticates but has no Project
  // visibility. Prove that denial before using the explicitly scoped reader.
  if (!restoredAdmin.employee?.isActive || restoredAdmin.employee.companyId !== restoredAdmin.companyId) {
    const denied = await fetch(baseUrl + '/documents/projects', {
      headers: { Accept: 'application/json', Cookie: cookie },
    });
    if (denied.status !== 200) fail('restored technical-admin Document scope could not be checked');
    const body = await denied.json();
    if (!Array.isArray(body.data) || body.data.length !== 0) fail('unlinked technical administrator retained Project Document access');
  }

  const readerUser = await prisma.user.findFirst({
    where: {
      email: readerEmail.toLowerCase(), companyId: restoredAdmin.companyId, isActive: true,
      employee: { is: { companyId: restoredAdmin.companyId, isActive: true } },
    },
    select: { id: true },
  });
  if (!readerUser) fail('an explicitly authorized active Employee-linked document reader is required');
  const readerLogin = await fetch(baseUrl + '/auth/login', {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: readerEmail, password: readerPassword }),
  });
  if (readerLogin.status !== 201) fail('restored document reader login failed');
  const documentCookie = readerLogin.headers.get('set-cookie')?.split(';', 1)[0];
  const readerLoginBody = await readerLogin.json();
  const readerCsrf = readerLoginBody?.data?.csrfToken;
  if (!documentCookie || typeof readerCsrf !== 'string' || !readerCsrf) fail('restored document reader session/CSRF missing');
  sessions.push({ cookie: documentCookie, csrfToken: readerCsrf });
  const readerMe = await fetch(baseUrl + '/auth/me', {
    headers: { Accept: 'application/json', Cookie: documentCookie },
  });
  if (readerMe.status !== 200) fail('restored document reader identity failed');
  const readerBody = await readerMe.json();
  if (readerBody?.data?.id !== readerUser.id || readerBody.data.companyId !== restoredAdmin.companyId) {
    fail('restored document reader Company/identity mismatch');
  }

  // Select authorized Project evidence through the reader's actual APIs; owning
  // source permissions still filter every row. Strict archive checks remain.
  const projectsResponse = await fetch(baseUrl + '/documents/projects', {
    headers: { Accept: 'application/json', Cookie: documentCookie },
  });
  if (projectsResponse.status !== 200) fail('restored authorized document Projects could not be listed');
  const projectsBody = await projectsResponse.json();
  let downloadCandidate;
  let projectId;
  for (const project of projectsBody.data) {
    const list = await fetch(baseUrl + '/documents/projects/' + encodeURIComponent(project.id), {
      headers: { Accept: 'application/json', Cookie: documentCookie },
    });
    if (list.status !== 200) fail('restored authorized Project documents could not be listed');
    const listed = await list.json();
    const visible = listed.data.find((row) => row.storageProvider === 'LOCAL' && row.checksum);
    if (!visible) continue;
    downloadCandidate = await prisma.document.findFirst({
      where: {
        id: visible.id, companyId: restoredAdmin.companyId,
        storageProvider: 'LOCAL', checksum: { not: null },
        links: { some: { entityType: 'PROJECT', entityId: project.id } },
      },
      select: { id: true, checksum: true, fileSizeBytes: true },
    });
    projectId = project.id;
    break;
  }
  if (!downloadCandidate?.checksum || !projectId) {
    fail('restored reader has no authorized checksum-backed LOCAL document for runtime smoke');
  }
  const download = await fetch(
    baseUrl +
      `/documents/projects/${encodeURIComponent(projectId)}/${encodeURIComponent(downloadCandidate.id)}/download`,
    {
      headers: {
        Accept: '*/*',
        Cookie: documentCookie,
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

  successMessage =
    `Restored runtime smoke PASSED: authenticated administrator and Employee-linked document reader, found ${restoredDocuments} restored LOCAL document record(s), and downloaded/verified document ${downloadCandidate.id}.\n`;
} catch (error) {
  process.stderr.write(`Restored runtime smoke failed: ${error?.restoredSmokeMessage ?? 'unexpected setup or verification failure'}\n`);
  process.exitCode = 1;
} finally {
  let revoked = true;
  for (const session of sessions) {
    try {
      const logout = await fetch(baseUrl + '/auth/logout', {
        method: 'POST', headers: { Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken },
      });
      const me = await fetch(baseUrl + '/auth/me', { headers: { Cookie: session.cookie } });
      if (![204, 401].includes(logout.status) || me.status !== 401) revoked = false;
    } catch { revoked = false; }
  }
  await prisma.$disconnect();
  if (!revoked) {
    process.stderr.write('Restored runtime smoke failed: session revocation unconfirmed\n');
    process.exitCode = 1;
  }
}

if (successMessage && process.exitCode !== 1) process.stdout.write(successMessage);
