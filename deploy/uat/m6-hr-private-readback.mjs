// M6 HR proof helper: no storage, network initiation, grants or logging.
const need = (ok, code) => { if (!ok) throw Object.assign(new Error(code), {safeCode:code}); };
const uuid4 = s => typeof s === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
export function verifyM6HrHistory(history, expectedVersion, afterVersion = 0) {
  need(Number.isSafeInteger(expectedVersion) && Number.isSafeInteger(afterVersion) && afterVersion >= 0 && expectedVersion >= afterVersion && expectedVersion - afterVersion < 100 && history?.nextCursor === null && Array.isArray(history.items) && history.items.length === expectedVersion - afterVersion, 'M6_HR_HISTORY_INCOMPLETE');
  const ids = new Set();
  for (const [index, item] of history.items.entries()) {
    need(uuid4(item?.id) && !ids.has(item.id) && item.version === afterVersion + index + 1 && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) && Object.keys(item).length === 3 && Object.keys(item).every(k => ['id','version','createdAt'].includes(k)), 'M6_HR_HISTORY_NOT_MASKED_OR_CONTIGUOUS');
    ids.add(item.id);
  }
  return true;
}
export async function verifyM6HrDownload(response, expectedBytes) {
  need(Buffer.isBuffer(expectedBytes) && expectedBytes.length > 0 && expectedBytes.length <= 1048576, 'M6_HR_EXPECTED_BYTES_INVALID');
  const cache = (response.headers.get('cache-control') ?? '').toLowerCase().split(',').map(v => v.trim());
  const privateResponse = response.status === 200 && cache.includes('private') && cache.includes('no-store') && !cache.includes('public') && response.headers.get('x-content-type-options')?.trim().toLowerCase() === 'nosniff' && response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'text/plain';
  if (!privateResponse) { try { await response.body?.cancel(); } catch {} need(false,'M6_HR_DOWNLOAD_PRIVACY_HEADERS_INVALID'); }
  const length = response.headers.get('content-length');
  if (length !== null && length !== String(expectedBytes.length)) { try { await response.body?.cancel(); } catch {} need(false,'M6_HR_DOWNLOAD_LENGTH_MISMATCH'); }
  need(response.body, 'M6_HR_DOWNLOAD_BODY_MISSING');
  const reader = response.body.getReader();
  let offset = 0, completed = false;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) { completed = true; break; }
      try {
        need(value instanceof Uint8Array && offset + value.length <= expectedBytes.length, 'M6_HR_DOWNLOAD_LENGTH_MISMATCH');
        need(expectedBytes.subarray(offset,offset + value.length).equals(value), 'M6_HR_AUTHORIZED_BYTES_MISMATCH');
        offset += value.length;
      } finally { if (value instanceof Uint8Array) value.fill(0); }
    }
    need(offset === expectedBytes.length, 'M6_HR_DOWNLOAD_LENGTH_MISMATCH');
  } finally {
    if (!completed) { try { await reader.cancel(); } catch {} }
    reader.releaseLock();
  }
  return {privateNoStoreVerified:true,exactBytesVerified:true};
}
