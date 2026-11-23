import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable, Writable } from 'node:stream';

import type { ApprovedPoPdfText } from './purchase-order-pdf';

// PUR07: free Chromium renders Thai/Unicode legal names into an embedded-font
// PDF. No remote HTTP/HTML/fonts, no supplier-side scripts, no npm PDF engine,
// and no --no-sandbox in live deployments. Chrome + Noto Sans Thai availability
// must be verified on the target host BEFORE governed release approval.
const MAX_LINES = 500;
const MAX_HTML_BYTES = 512_000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_PIPE_BYTES = 24 * 1024 * 1024;
const MAX_ACTIVE = 2;
let active = 0;

function error(code: string) {
  return new Error('PO_PDF_' + code);
}

function clean(value: string | null | undefined): string {
  const text = (value ?? 'NOT SPECIFIED').normalize('NFC');
  if (text.length > 20000 ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u.test(text)) {
    throw error('UNICODE_TEXT_INVALID');
  }
  return text;
}

function escapeHtml(value: string | null | undefined): string {
  return clean(value).replace(/[&<>"']/gu, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function approvedPoUnicodeHtml(input: ApprovedPoPdfText): string {
  if (!input.lines.length || input.lines.length > MAX_LINES) {
    throw error('UNICODE_LINE_LIMIT');
  }
  // Never include arbitrary HTML, network references, active content, or
  // untrusted PDF operators. All supplier/project/line values are escaped.
  const rows = input.lines.map(line => '<tr>' +
    '<td>' + escapeHtml(String(line.number)) + '</td>' +
    '<td>' + escapeHtml(line.description) + '</td>' +
    '<td>' + escapeHtml(line.quantity) + ' ' + escapeHtml(line.uom) + '</td>' +
    '<td class="money">' + escapeHtml(line.unitPrice) + '</td>' +
    '<td class="money">' + escapeHtml(line.amount) + '</td></tr>'
  ).join('\n');
  const text = (label: string, value: string | null) =>
    '<div><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value) + '</div>';
  const html = '<!doctype html><html lang="th"><head><meta charset="UTF-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src \'none\'; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">' +
    '<title>' + escapeHtml(input.number) + '</title>' +
    '<style>' +
    '@page{size:A4;margin:14mm}' +
    'html,body{padding:0;margin:0;color:#16212a}' +
    'body{font:10.5pt/1.5 "Noto Sans Thai",Tahoma,Arial,sans-serif}' +
    'h1{font-size:18pt;margin:0 0 12px}' +
    '.head{border-bottom:2px solid #283647;padding:0 0 12px;margin-bottom:12px}' +
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}' +
    'h2{font-size:12pt;margin:16px 0 6px}' +
    'table{border-collapse:collapse;width:100%;font-size:9pt}' +
    'thead{display:table-header-group}' +
    'th,td{padding:5px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}' +
    'th{background:#f2f4f7}.money{text-align:right;white-space:nowrap}' +
    'tr{break-inside:avoid}' +
    '.foot{border-top:1px solid #ddd;margin-top:15px;padding-top:9px;font-size:9pt}' +
    '</style></head><body>' +
    '<section class="head"><h1>Purchase Order / ใบสั่งซื้อ</h1>' +
    text('PO', input.number) + text('Revision', String(input.revision)) +
    text('Approval', 'APPROVED ' + input.approvedAt) + '</section>' +
    '<div class="meta">' +
    text('Company', input.company) + text('Project', input.project) +
    text('Supplier legal name', input.supplierLegalName) +
    text('Currency', input.currency) +
    text('Delivery location', input.deliveryLocation) +
    text('Delivery terms', input.deliveryTerms) + '</div>' +
    '<h2>Approved PO lines / รายการสั่งซื้อ</h2><table>' +
    '<thead><tr><th>#</th><th>Description / รายละเอียด</th><th>Quantity / Unit</th><th>Unit price</th><th>Amount</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '<h2>Commercial summary (THB)</h2><div class="meta">' +
    text('Subtotal', input.subtotal) + text('Discount', input.discount) +
    text('Freight', input.freight) + text('Additional charges', input.charges) +
    text('VAT rate (%)', input.vatPercent) +
    text('Total incl VAT', input.total ?? 'NOT CALCULATED (missing commercial inputs)') +
    '</div><h2>Supplier delivery and payment</h2><div class="meta">' +
    text('Payment terms', input.paymentTerms) +
    text('Credit terms', input.creditTerms) +
    '</div><div class="foot">Approved, source-backed PO revision. ' +
    'External email/LINE dispatch and acknowledgments are recorded manually; this document is not proof of delivery.</div>' +
    '</body></html>';
  if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
    throw error('UNICODE_HTML_LIMIT');
  }
  return html;
}

type Reply = { id?: number; result?: Record<string, any>; error?: unknown };
type Pending = {
  resolve: (value: Record<string, any>) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

class ChromiumPipe {
  private next = 0;
  private buf = Buffer.alloc(0);
  private readonly pending = new Map<number, Pending>();
  private closed = false;

  constructor(private readonly read: Readable, private readonly write: Writable) {
    read.on('data', (data: Buffer) => this.receive(data));
    read.on('end', () => this.close());
    read.on('error', () => this.close());
    write.on('error', () => this.close());
  }

  private receive(data: Buffer) {
    this.buf = Buffer.concat([this.buf, data]);
    if (this.buf.length > MAX_PIPE_BYTES) {
      this.close();
      return;
    }
    let end: number;
    while ((end = this.buf.indexOf(0)) >= 0) {
      const packet = this.buf.subarray(0, end);
      this.buf = this.buf.subarray(end + 1);
      let msg: Reply;
      try {
        msg = JSON.parse(packet.toString('utf8')) as Reply;
      } catch {
        this.close();
        return;
      }
      if (typeof msg.id !== 'number') continue;
      const request = this.pending.get(msg.id);
      if (!request) continue;
      this.pending.delete(msg.id);
      clearTimeout(request.timer);
      if (msg.error) request.reject(error('UNICODE_CHROMIUM_COMMAND_FAILED'));
      else request.resolve(msg.result ?? {});
    }
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    if (this.closed) return Promise.reject(error('UNICODE_CHROMIUM_PIPE_CLOSED'));
    return new Promise<Record<string, any>>((resolve, reject) => {
      const id = ++this.next;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(error('UNICODE_CHROMIUM_COMMAND_TIMEOUT'));
      }, 18000);
      this.pending.set(id, { resolve, reject, timer });
      this.write.write(JSON.stringify({
        id, method, params,
        ...(sessionId ? { sessionId } : {}),
      }) + '\0');
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error('UNICODE_CHROMIUM_PIPE_CLOSED'));
    }
    this.pending.clear();
  }
}

function browserBinary(): string {
  const configured = process.env.PO_PDF_CHROMIUM_PATH?.trim();
  const candidates = configured ? [configured] :
    process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
         '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['/usr/bin/chromium', '/usr/bin/google-chrome', 'chromium', 'google-chrome'];
  for (const path of candidates) {
    if (path.includes('/') ? existsSync(path) :
      spawnSync(path, ['--version'], { stdio: 'ignore', timeout: 3000 }).status === 0) {
      return path;
    }
  }
  throw error('UNICODE_CHROMIUM_NOT_INSTALLED');
}

async function chromePdf(html: string, supplierName: string): Promise<Buffer> {
  const testOnlyNoSandbox = process.platform === 'linux' &&
    process.env.GITHUB_ACTIONS === 'true' &&
    process.env.M4_NON_PRODUCTION_CONFIRMED === 'YES';
  if (process.platform === 'linux' && process.getuid?.() === 0 && !testOnlyNoSandbox) {
    throw error('UNICODE_SANDBOX_NONROOT_REQUIRED');
  }
  const profile = await mkdtemp(join(tmpdir(), 'construction-erp-po-pdf-'));
  const args = [
    '--headless=new', '--remote-debugging-pipe', '--no-first-run',
    '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-extensions',
    '--disable-gpu', '--no-proxy-server', '--password-store=basic',
    '--user-data-dir=' + profile,
  ];
  if (testOnlyNoSandbox) args.push('--no-sandbox', '--disable-dev-shm-usage');
  const child = spawn(browserBinary(), args, {
    stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'],
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      LANG: process.env.LANG ?? 'C.UTF-8',
      HOME: profile,
      ...(process.env.FONTCONFIG_PATH ? { FONTCONFIG_PATH: process.env.FONTCONFIG_PATH } : {}),
    },
  });
  const closed = new Promise<void>(resolve => {
    child.once('close', () => resolve());
  });
  const p = new ChromiumPipe(child.stdio[4] as Readable, child.stdio[3] as Writable);
  child.on('error', () => p.close());
  child.on('close', () => p.close());
  const watchdog = setTimeout(() => child.kill('SIGKILL'), 30000);
  try {
    await p.send('Browser.getVersion');
    const { targetId } = await p.send('Target.createTarget', { url: 'about:blank' });
    if (typeof targetId !== 'string') throw error('UNICODE_CHROMIUM_TARGET_FAILED');
    const { sessionId } = await p.send('Target.attachToTarget', {
      targetId, flatten: true,
    });
    if (typeof sessionId !== 'string') throw error('UNICODE_CHROMIUM_SESSION_FAILED');
    await p.send('Page.enable', {}, sessionId);
    await p.send('Runtime.enable', {}, sessionId);
    const frame = await p.send('Page.getFrameTree', {}, sessionId);
    const frameId = frame.frameTree?.frame?.id;
    if (typeof frameId !== 'string') throw error('UNICODE_CHROMIUM_FRAME_FAILED');
    // about:blank + setDocumentContent never follows a network URL and avoids
    // the popup/file:// policy and external-origin risks of CLI page printing.
    await p.send('Page.setDocumentContent', { frameId, html }, sessionId);
    const ready = await p.send('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(()=>document.readyState==="complete"&&' +
        'document.body?.textContent?.includes(' + JSON.stringify(supplierName) + '))',
      awaitPromise: true, returnByValue: true,
    }, sessionId);
    if (ready.result?.value !== true) throw error('UNICODE_DOCUMENT_NOT_READY');
    const printed = await p.send('Page.printToPDF', {
      printBackground: true, preferCSSPageSize: true,
    }, sessionId);
    if (typeof printed.data !== 'string') throw error('UNICODE_PDF_EMPTY');
    const pdf = Buffer.from(printed.data, 'base64');
    if (pdf.length < 2500 || pdf.length > MAX_PDF_BYTES ||
        pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw error('UNICODE_PDF_INVALID');
    }
    return pdf;
  } finally {
    clearTimeout(watchdog);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      const killer = setTimeout(() => child.kill('SIGKILL'), 2500);
      await Promise.race([
        closed,
        new Promise<void>(resolve => setTimeout(resolve, 3500)),
      ]);
      clearTimeout(killer);
    }
    p.close();
    // Exclusive profile owned by this request. No saved supplier document.
    await rm(profile, { recursive: true, force: true });
  }
}

export async function renderApprovedPoUnicodePdf(input: ApprovedPoPdfText): Promise<Buffer> {
  if (active >= MAX_ACTIVE) throw error('UNICODE_RENDERER_BUSY');
  active++;
  try {
    const html = approvedPoUnicodeHtml(input);
    return await chromePdf(html, input.supplierLegalName);
  } finally {
    active--;
  }
}
