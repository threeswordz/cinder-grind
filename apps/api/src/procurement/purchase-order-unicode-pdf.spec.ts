import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { Prisma } from '@prisma/client';

import type { AuthenticatedUserContext } from '../auth/auth.types';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProjectAccessService } from '../projects/project-access.service';
import type { PurchaseOrderService } from './purchase-order.service';
import type { ApprovedPoPdfText } from './purchase-order-pdf';
import { approvedPoUnicodeHtml, renderApprovedPoUnicodePdf } from './purchase-order-unicode-pdf';
import { PurchaseOrderPur07Service } from './purchase-order-pur07.service';

// Distinct NEW PUR07 Unicode server renderer proof. NOT previous standalone
// browser HTML print #45162334613 or original native dispatch #45155841629.
const sample: ApprovedPoPdfText = {
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

test('PUR07 Unicode HTML: preserve Thai legal name and escape untrusted markup', () => {
  const html = approvedPoUnicodeHtml({
    ...sample, supplierLegalName: '<img src=x onerror=alert(1)> บริษัท ทดสอบ',
  });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('บริษัท ทดสอบ'));
  assert.ok(html.includes("default-src 'none'"));
  assert.throws(() => approvedPoUnicodeHtml({
    ...sample,supplierLegalName:'บริษัท\u202EEXE',
  }),/PO_PDF_UNICODE_TEXT_INVALID/);
  assert.throws(() => approvedPoUnicodeHtml({
    ...sample,lines:[],
  }),/PO_PDF_UNICODE_LINE_LIMIT/);
});

test('PUR07 new server Chromium: searchable Thai real PDF and actual approvedPdf service fallback', async () => {
  assert.equal(process.env.GITHUB_ACTIONS,'true','Disposable CI proof only');
  assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
  const tmp=await mkdtemp(join(tmpdir(),'pur07-unicode-auth-server-'));
  try {
    const direct=await renderApprovedPoUnicodePdf(sample);
    assert.equal(direct.subarray(0,5).toString('ascii'),'%PDF-');
    assert.ok(direct.length>2500&&direct.length<1024*1024);
    const f=join(tmp,'actual-unicode-server.pdf');
    await writeFile(f,direct);
    const extracted=spawnSync('pdftotext',['-layout',f,'-'],{
      encoding:'utf8',timeout:15000,
    });
    assert.equal(extracted.status,0,'Rendered PDF must be text searchable');
    for(const needle of ['เซมิคอนกรีต','บริการคอนกรีต','2000.00','2107.90','เครดิต 30 วัน'])
      assert.ok(extracted.stdout.includes(needle),
        'Generated Unicode PDF missing '+needle+' in '+extracted.stdout.slice(0,330));
    const info=spawnSync('pdfinfo',[f],{encoding:'utf8',timeout:15000});
    assert.equal(info.status,0);
    assert.match(info.stdout,/Pages:\s+1\b/);
    console.log('PUR07_NEW_SERVER_CHROMIUM_ACTUAL_THAI_SEARCHABLE_A4_PASS '+
      JSON.stringify({bytes:direct.length,pages:1}));

    // Direct service contract, no mock PDF bytes. Existing real PostgreSQL
    // approve/authorization and dispatch guards already independently passed
    // #45155841629, so don't replay that suite just to test new PDF engine.
    const orderId=randomUUID();
    const approvedOrder = {
      id:orderId,poNumber:'PO2611-002',
      displayNumber:'T-PO2611-002 SEMICON',revisionNo:0,
      lifecycleState:'APPROVED',cancelledAt:null,currencyCode:'THB',
      companyId:randomUUID(),
      project:{projectCode:'TCJ-SITE',projectName:'ไซต์ก่อสร้าง'},
      approvalInstance:{approvalState:'APPROVED',completedAt:new Date('2026-11-23T14:20:00.000Z')},
      lines:[{
        lineNo:1,description:'บริการคอนกรีตสำหรับไซต์',
        quantity:new Prisma.Decimal('1'),uomCodeSnapshot:'EA',
        unitPrice:new Prisma.Decimal('2000.00'),amount:new Prisma.Decimal('2000.00'),
        quotationAward:{supplierNameSnapshot:'บริษัท เซมิคอนกรีต จำกัด'},
      }],
      deliveryLocation:'โกดังไซต์งาน',deliveryTerms:'ส่งตามนัด',
      paymentTerms:'เครดิต 30 วัน',creditTerms:null,
      discountAmount:new Prisma.Decimal('100.00'),
      freightAmount:new Prisma.Decimal('50.00'),
      additionalChargeAmount:new Prisma.Decimal('20.00'),
      vatRatePercent:new Prisma.Decimal('7.00'),
    };
    const orders={
      getOrder:async (_auth:unknown,id:string)=>{
        assert.equal(id,orderId);
        return approvedOrder;
      },
    } as unknown as PurchaseOrderService;
    const service=new PurchaseOrderPur07Service(
      {} as PrismaService,{} as ProjectAccessService,
      {} as AuditService,orders,
    );
    const actual=await service.approvedPdf({} as AuthenticatedUserContext,orderId);
    assert.equal(actual.fileName,'T-PO2611-002 SEMICON.pdf');
    assert.ok(actual.bytes.subarray(0,5).equals(Buffer.from('%PDF-')));
    assert.match(actual.sha256,/^[a-f0-9]{64}$/u);
    const f2=join(tmp,'actual-backend-contract-thai.pdf');
    await writeFile(f2,actual.bytes);
    const value=spawnSync('pdftotext',['-layout',f2,'-'],{
      encoding:'utf8',timeout:15000,
    });
    assert.equal(value.status,0);
    assert.ok(value.stdout.includes('เซมิคอนกรีต'));
    assert.ok(value.stdout.includes('2107.90'));
    console.log('PUR07_NEW_APPROVED_PDF_SERVICE_THAI_FALLBACK_REAL_BYTES_SHA_FILENAME_PASS');
  } finally {
    await rm(tmp,{recursive:true,force:true});
  }
});
