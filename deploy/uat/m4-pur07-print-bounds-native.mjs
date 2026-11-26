// Disposable CI proof of the production browser-print HTML, using synthetic data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFile,spawnSync} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.equal(process.platform,'linux');
const root=fileURLToPath(new URL('../../',import.meta.url));
const requireWeb=createRequire(join(root,'apps/web/package.json'));
const {createServer}=await import(requireWeb.resolve('vite'));
const execute=promisify(execFile);
const chrome=['google-chrome','chromium','chromium-browser'].find(binary=>spawnSync(binary,['--version'],{stdio:'ignore'}).status===0);
assert.ok(chrome,'Real Chromium is required');
const directory=await mkdtemp(join(tmpdir(),'pur07-browser-print-bounds-'));
const vite=await createServer({root:join(root,'apps/web'),server:{middlewareMode:true},appType:'custom'});
try {
  const {printApprovedPurchaseOrderHtml}=await vite.ssrLoadModule('/src/procurement/purchase-order-print.ts');
  const order={
    lifecycleState:'APPROVED',cancelledAt:null,poNumber:'PO2611-001',displayNumber:'K-PO2611-001 '+'N'.repeat(100),revisionNo:0,currencyCode:'THB',
    approvalInstance:{approvalState:'APPROVED',completedAt:'2026-11-26T00:00:00Z'},
    project:{projectCode:'P1',projectName:'Site'},
    lines:[{lineNo:1,description:'W'.repeat(490)+'MATERIAL',quantity:'1',unitPrice:'1',amount:'1',uomCodeSnapshot:'EA',quotationAward:{supplierNameSnapshot:'S'.repeat(200)}}],
    discountAmount:'0',freightAmount:'0',additionalChargeAmount:'0',vatRatePercent:'0',
    deliveryLocation:'L'.repeat(490)+'LOCATION',deliveryContact:'C'.repeat(190)+'CONTACT',deliveryTerms:null,paymentTerms:null,creditTerms:null,
  };
  const original=JSON.stringify(order);
  const {html}=printApprovedPurchaseOrderHtml(order);
  const file=join(directory,'document.html'),pdf=join(directory,'document.pdf');
  await writeFile(file,html);
  await execute(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-pdf-header-footer',
    '--no-first-run','--no-default-browser-check','--disable-background-networking','--user-data-dir='+join(directory,'profile'),
    '--print-to-pdf='+pdf,'file://'+file],{timeout:45000,maxBuffer:1048576});
  const {stdout}=await execute('pdftotext',['-bbox',pdf,'-'],{timeout:15000,maxBuffer:1048576});
  const words=[...stdout.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/gu)];
  assert.ok(words.length>0);
  for(const word of words){
    assert.ok(Number(word[1])>=39&&Number(word[3])<=556,'Browser print must fit horizontal A4 margins');
    assert.ok(Number(word[2])>=0&&Number(word[4])<=803,'Browser print must retain fields on the page');
  }
  const text=words.map(word=>word[5]).join('');
  for(const marker of ['LOCATION','CONTACT','MATERIAL'])assert.ok(text.includes(marker));
  assert.equal(JSON.stringify(order),original);
  console.log('M4_PUR07_BROWSER_PRINT_REAL_PDF_BOUNDS_PASS');
} finally {
  await vite.close();
  await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
