// PUR07 NEW isolated Chrome -> actual PDF check. Does NOT load API, auth,
// retained data or historic browser suites; uses synthetic approved PO only.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

assert.equal(process.env.PUR07_DISPOSABLE_BROWSER_ONLY, 'YES');
const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const chrome = ['google-chrome', 'chromium', 'chromium-browser'].find(
  bin => spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0,
);
assert.ok(chrome, 'Real headless Chrome/Chromium required; never substitute SSR for actual PDF');
assert.equal(spawnSync('pdftotext', ['-v'], { stdio: 'ignore' }).status, 0,
  'PDF text extraction command required for actual printed Thai glyph proof');
assert.equal(spawnSync('pdfinfo', ['-v'], { stdio: 'ignore' }).status, 0,
  'PDF metadata inspection command required');

const source = {
  id: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  supplierId: '44444444-4444-4444-8444-444444444444',
  poNumber: 'PO2611-001',
  displayNumber: 'T-PO2611-001 บ.เซมิคอนกรีต',
  supplierShortNameSnapshot: 'บ.เซมิคอนกรีต',
  revisionNo: 0,
  lifecycleState: 'APPROVED',
  cancelledAt: null,
  currencyCode: 'THB',
  project: { projectCode: 'P-TH-001', projectName: 'อาคารคลังสินค้า & Site A' },
  approvalInstance: {
    approvalState: 'APPROVED', completedAt: '2026-11-23T09:00:00.000Z',
  },
  lines: [{
    lineNo: 1,
    description: 'คอนกรีต <script>alert(1)</script> ตรวจสอบ',
    quantity: '2.00', uomCodeSnapshot: 'M3',
    unitPrice: '1000.00', amount: '2000.00',
    quotationAward: { supplierNameSnapshot: 'บริษัท เซมิคอนกรีต จำกัด' },
  }],
  discountAmount: '100.00',
  freightAmount: '50.00',
  additionalChargeAmount: '20.00',
  vatRatePercent: '7.00',
  deliveryLocation: 'ไซต์งาน กรุงเทพฯ',
  deliveryContact: 'คุณจัย',
  deliveryTerms: 'ส่งสินค้าภายใน 7 วัน',
  paymentTerms: '30 วัน',
  creditTerms: 'เครดิต',
};

const dir = await mkdtemp(path.join(os.tmpdir(), 'erp-pur07-real-chrome-print-'));
let vite;
try {
  vite = await createServer({
    root, configFile: false,
    server: { host: '127.0.0.1', port: 0, hmr: false },
    plugins: [{
      name: 'pur07-print-disposable-only',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url !== '/__pur07-private-print') return next();
          res.setHeader('Content-Type', 'text/html; charset=UTF-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(html);
        });
      },
    }],
  });
  const { printApprovedPurchaseOrderHtml } = await vite.ssrLoadModule(
    '/src/procurement/purchase-order-print.ts',
  );
  const { html, suggestedFileName } = printApprovedPurchaseOrderHtml(source);
  assert.equal(suggestedFileName, 'T-PO2611-001 บ.เซมิคอนกรีต.pdf');
  assert.match(html, /บริษัท เซมิคอนกรีต จำกัด/u);
  assert.match(html, /คอนกรีต &lt;script&gt;alert\(1\)&lt;\/script&gt;/u);
  assert.doesNotMatch(html, /<script>/u);
  assert.match(html, /Grand total \(including VAT\):<\/strong> 2107\.90/u);
  assert.match(html, /VAT amount:<\/strong> 137\.90/u);
  assert.match(html, /Subtotal:<\/strong> 2000\.00/u);
  assert.throws(() => printApprovedPurchaseOrderHtml({
    ...source, approvalInstance: { ...source.approvalInstance, approvalState: 'SUBMITTED' },
  }), /PO_PRINT_INDEPENDENT_APPROVAL_EVIDENCE_MISSING/u);
  assert.throws(() => printApprovedPurchaseOrderHtml({
    ...source, lifecycleState: 'CANCELLED', cancelledAt: '2026-11-23T10:00:00Z',
  }), /Only the exact approved/u);
  assert.throws(() => printApprovedPurchaseOrderHtml({
    ...source, displayNumber: 'T-PO2611-001 ../evil',
  }), /not safe as a filename/u);
  const missingInput = printApprovedPurchaseOrderHtml({
    ...source, discountAmount: null,
  });
  assert.match(missingInput.html, /NOT CALCULATED — missing inputs/u);
  assert.doesNotMatch(missingInput.html, /Grand total \(including VAT\):<\/strong> 2107\.90/u);

  await vite.listen();
  const address = vite.httpServer.address();
  assert.ok(address && typeof address === 'object');
  const url = 'http://127.0.0.1:' + address.port + '/__pur07-private-print';
  const pdfPath = path.join(dir, 'actual-chrome-thai-po.pdf');
  const profile = path.join(dir, 'chrome-profile');
  const flags = [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--disable-dev-shm-usage', '--disable-extensions',
    '--disable-background-networking', '--no-proxy-server',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
    '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + profile,
    '--no-pdf-header-footer',
    '--print-to-pdf=' + pdfPath,
    url,
  ];
  // The Vite server shares this event loop. A synchronous Chrome subprocess
  // would deadlock it while Chrome requests localhost, so spawn asynchronously.
  const run = await new Promise((resolve, reject) => {
    const child = spawn(chrome, flags, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('PUR07 Chrome PDF test timed out after 90s'));
    }, 90000);
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stderr });
    });
  });
  assert.equal(run.code, 0, run.stderr.slice(-1800));
  const file = await readFile(pdfPath);
  const size = await stat(pdfPath);
  assert.ok(file.subarray(0, 8).toString('ascii').startsWith('%PDF-'));
  assert.ok(size.size > 2500 && size.size < 2 * 1024 * 1024, 'Unexpected PDF size');
  const decoded = spawnSync('pdftotext', ['-layout', pdfPath, '-'], {
    encoding: 'utf8', timeout: 15000,
  });
  assert.equal(decoded.status, 0, decoded.stderr);
  const text = decoded.stdout;
  assert.ok(text.includes('เซมิคอนกรีต'), 'Thai supplier glyphs not searchable in real Chrome PDF: ' + text.slice(0, 500));
  assert.ok(text.includes('2107.90'), 'Actual PDF grand total absent');
  assert.ok(text.includes('137.90'), 'Actual PDF VAT absent');
  assert.ok(text.includes('2000.00'), 'Actual PDF subtotal absent');
  assert.ok(!text.includes('NOT CALCULATED'), 'Should calculate every provided commercial input');
  const info = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8', timeout: 15000 });
  assert.equal(info.status, 0, info.stderr);
  assert.match(info.stdout, /Page size:.*\(A4\)/u);
  console.log('PUR07_CHROME_THAI_ACTUAL_PDF_PASS ' + JSON.stringify({
    fileBytes: file.length, pages: info.stdout.match(/Pages:\s+(\d+)/u)?.[1],
    thaiSupplierSearchable: true, subtotal: '2000.00',
    vat: '137.90', grandTotal: '2107.90',
    filename: suggestedFileName, actualChrome: chrome,
    testScope: 'synthetic approved source only; no API/real dispatch/retained actor',
  }));
} finally {
  if (vite) await vite.close();
  await rm(dir, { recursive: true, force: true });
}
