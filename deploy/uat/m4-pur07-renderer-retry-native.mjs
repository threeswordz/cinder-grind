// Distinct PUR07 renderer process-failure injection. Real Chromium on recovery.
// Disposable runner only. No fake PDF, no production code or runtime override.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.equal(process.platform,'linux');
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
const {renderApprovedPoUnicodePdf}=require('./dist/procurement/purchase-order-unicode-pdf.js');
const sample = {
  number: 'T-PO2611-002 SEMICON',
  revision: 0,
  company: 'TCJ synthetic Company',
  project: 'TCJ-SITE — ไซต์ก่อสร้าง',
  supplierLegalName: 'บริษัท เซมิคอนกรีต จำกัด',
  approvedAt: '2026-11-23T14:20:00.000Z',
  currency: 'THB',
  lines: [{
    number: 1,
    description: 'บริการคอนกรีตสำหรับไซต์',
    quantity: '1', uom: 'EA',
    unitPrice: '2000.00', amount: '2000.00',
  }],
  deliveryLocation: 'โกดังไซต์งาน',
  deliveryTerms: 'ส่งตามนัด',
  paymentTerms: 'เครดิต 30 วัน',
  creditTerms: null,
  subtotal: '2000.00',
  discount: '100.00',
  freight: '50.00',
  charges: '20.00',
  vatPercent: '7.00',
  total: '2107.90',
};

const tmp=await mkdtemp(join(tmpdir(),'m4-pur07-fault-'));
const real= ['google-chrome','chromium','chromium-browser'].map(x=>spawnSync('which',[x],{encoding:'utf8'})).find(x=>x.status===0)?.stdout.trim();
assert.ok(real,'Actual Chromium required');
const wrapper=join(tmp,'chrome-wrapper'),counter=join(tmp,'attempts'),profiles=join(tmp,'profiles');
const previous=process.env.PO_PDF_CHROMIUM_PATH;
const q=s=>"'"+s.replaceAll("'","'\\''")+"'";
async function configure(alwaysFail){
 await writeFile(counter,'');
 await writeFile(profiles,'');
 await writeFile(wrapper,'#!/bin/sh\nprintf "attempt\\n" >> '+q(counter)+'\nfor arg in "$@"; do case "$arg" in --user-data-dir=*) printf "%s\\n" "${arg#--user-data-dir=}" >> '+q(profiles)+';; esac; done\n'+(alwaysFail?'exit 17\n':'if [ "$(wc -l < '+q(counter)+')" -eq 1 ]; then exit 17; fi\nexec '+q(real)+' "$@"\n'),{mode:0o700});
 process.env.PO_PDF_CHROMIUM_PATH=wrapper;
}
const attempts=async()=>(await readFile(counter,'utf8')).split('\n').filter(Boolean).length;
async function cleaned(){const values=(await readFile(profiles,'utf8')).split('\n').filter(Boolean);assert.equal(new Set(values).size,values.length,'Each process owns a fresh profile');for(const v of values)await assert.rejects(()=>readdir(v),e=>e.code==='ENOENT');}
try{
 await configure(false);
 const bytes=await renderApprovedPoUnicodePdf(sample);
 assert.equal(await attempts(),2);assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');
 const pdf=join(tmp,'result.pdf');await writeFile(pdf,bytes);
 const extracted=spawnSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8',timeout:15000});
 assert.equal(extracted.status,0);assert.ok(extracted.stdout.includes('เซมิคอนกรีต'));
 await cleaned();
 console.log('M4_PUR07_ACTUAL_PIPE_CLOSE_RETRY_REAL_THAI_PDF_FRESH_PROFILE_CLEANUP_PASS');
 await configure(true);
 await assert.rejects(()=>renderApprovedPoUnicodePdf(sample),/PO_PDF_UNICODE_CHROMIUM_PIPE_CLOSED/);
 assert.equal(await attempts(),2);await cleaned();
 console.log('M4_PUR07_SECOND_TRANSPORT_FAILURE_FAILS_CLOSED_NO_THIRD_ATTEMPT_PASS');
 await configure(false);
 await assert.rejects(()=>renderApprovedPoUnicodePdf({...sample,lines:[]}),/PO_PDF_UNICODE_LINE_LIMIT/);
 assert.equal(await attempts(),0);
 const recovery=await renderApprovedPoUnicodePdf(sample);
 assert.equal(await attempts(),2);assert.equal(recovery.subarray(0,5).toString('ascii'),'%PDF-');await cleaned();
 console.log('M4_PUR07_INVALID_INPUT_NO_SPAWN_AND_RENDERER_SLOT_RECOVERY_PASS');
}finally{if(previous===undefined)delete process.env.PO_PDF_CHROMIUM_PATH;else process.env.PO_PDF_CHROMIUM_PATH=previous;await rm(tmp,{recursive:true,force:true});}
