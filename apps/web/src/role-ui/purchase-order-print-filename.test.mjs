import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('approved PO printing derives a bounded filename and preserves immutable document content', async () => {
  const vite = await createServer({root:process.cwd(),server:{middlewareMode:true},appType:'custom'});
  try {
    const {approvedPoPrintFilename,printApprovedPurchaseOrderHtml} = await vite.ssrLoadModule('/src/procurement/purchase-order-print.ts');
    const order = {
      lifecycleState:'APPROVED',cancelledAt:null,poNumber:'PO2611-001',revisionNo:2,currencyCode:'THB',
      approvalInstance:{approvalState:'APPROVED',completedAt:'2026-11-26T00:00:00Z'},
      project:{projectCode:'P1',projectName:'Site'},
      lines:[{lineNo:1,description:'Material 𠮷',quantity:'1',unitPrice:'1',amount:'1',uomCodeSnapshot:'EA',quotationAward:{supplierNameSnapshot:'Supplier 𠮷'}}],
      discountAmount:'0',freightAmount:'0',additionalChargeAmount:'0',vatRatePercent:'0',
      deliveryLocation:null,deliveryContact:null,deliveryTerms:null,paymentTerms:null,creditTerms:null,
    };
    for (const name of ['A&B', 'ท'.repeat(100), '𠮷'.repeat(100), '<img src=x>', '../A\\B', 'A\u202eB']) {
      const displayNumber = 'K-PO2611-001 ' + name;
      const original = JSON.stringify({...order,displayNumber});
      const input = {...order,displayNumber};
      const result = printApprovedPurchaseOrderHtml(input);
      assert.ok(new TextEncoder().encode(result.suggestedFileName).length <= 210);
      assert.ok(result.suggestedFileName.endsWith('-rev02.pdf'));
      assert.match(result.suggestedFileName,/^[\p{L}\p{M}\p{N} .()_-]+$/u);
      assert.ok(!result.suggestedFileName.includes('�'));
      assert.ok(result.html.includes('Supplier 𠮷'));
      assert.ok(result.html.includes(name.replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))));
      assert.equal(JSON.stringify(input),original);
    }
    assert.equal(approvedPoPrintFilename('PO2611-001','K-PO2611-001 A&B',0),'K-PO2611-001 A_B.pdf');
    assert.equal(approvedPoPrintFilename('PO2611-001',null,0),'PO2611-001.pdf');
    assert.throws(()=>approvedPoPrintFilename('PO2611-001','../outside',0));
    assert.throws(()=>approvedPoPrintFilename('PO2611-001',null,-1));
  } finally { await vite.close(); }
});
