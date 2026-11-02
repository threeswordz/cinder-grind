import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MaterialRequestsPanel } from '/src/inventory/MaterialRequestsPanel.tsx';
import { MonetaryLocaleContext } from '/src/role-ui/monetary-presentation.tsx';
import { materialRequestsApi as api } from '/src/api/material-requests.ts';
import { documentsApi } from '/src/api/documents.ts';
import { inventoryApi } from '/src/api/inventory.ts';
const permissions = ['view', 'create', 'edit', 'link', 'acknowledge'].map(p => 'inventory.material_request.' + p).concat('inventory.issue.view', 'documents.document.view', 'documents.document.upload', 'documents.document.link');
const p = 'browser-project-a', rid = 'browser-request-a', lineId = 'browser-line-a', issuedId = 'browser-issue-a', linkId = 'browser-link-a';
let current: any = null, locale: any = 'en', deny = false, lost = false, captures = 0, commands = 0;
const saved = new Map<string, unknown>();
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
const check = (x: unknown, message: string) => { if (!x)
    throw Error(message); };
const clone = (x: any) => structuredClone(x);
const empty = () => ({ id: rid, companyId: 'browser-company', projectId: p, warehouseId: 'wh-a', requesterEmployeeId: 'employee-a', requestDate: '2026-11-02', version: 1, remarks: 'Browser request', requester: { employeeName: 'Synthetic Foreman' }, warehouse: { warehouseName: 'Site warehouse' }, lines: [{ id: lineId, lineNo: 1, materialId: 'mat-a', uomId: 'uom-a', material: { materialCode: 'MAT-A', materialName: 'Synthetic steel' }, uom: { uomCode: 'EA' }, requestedQuantity: '10.0000', issuedQuantity: '0.0000', acknowledgedQuantity: '0.0000', fulfillment: 'NOT_ISSUED', remarks: null, wbsId: null, costCodeId: null, activityId: null, issueLinks: [] }], revisions: [] });
api.projects = async () => { if (deny)
    throw Error('403'); return { data: [{ id: p, projectCode: 'P-A', projectName: 'Browser project' }] }; };
api.list = async () => { if (deny)
    throw Error('403'); return { data: { items: current ? [{ id: rid, requestDate: current.requestDate, version: current.version, requester: current.requester, warehouse: current.warehouse, _count: { lines: 1 } }] : [], nextCursor: null } }; };
api.choices = async (_project, kind) => ({ data: { items: kind === 'warehouses' ? [{ id: 'wh-a', warehouseName: 'Site warehouse' }] : kind === 'employees' ? [{ id: 'employee-a', employeeName: 'Synthetic Foreman' }, { id: 'issuer-a', employeeName: 'Synthetic Store' }] : kind === 'materials' ? [{ id: 'mat-a', materialName: 'Synthetic steel', defaultUom: { id: 'uom-a', uomCode: 'EA' } }] : [], nextCursor: null } });
api.get = async () => { if (deny)
    throw Error('403'); return { data: clone(current) }; };
api.issueChoices = async () => ({ data: { items: [{ id: 'issue-item-a', lineNo: 1, quantity: '6.0000', materialIssue: { id: issuedId, issueNumber: 'MI-BROWSER-6', issuedToEmployeeId: 'employee-a' } }], nextCursor: null } });
api.command = async (suffix, body: any) => {
    commands++;
    if (saved.has(body.requestKey))
        return clone(saved.get(body.requestKey));
    if (!suffix) {
        captures++;
        current = empty();
    }
    else if (suffix.endsWith('/issue-links')) {
        current.version++;
        current.lines[0].issuedQuantity = '6.0000';
        current.lines[0].fulfillment = 'PARTIAL';
        current.lines[0].issueLinks = [{ id: linkId, linkedAt: '2026-11-02T01:00:00.000Z', quantity: '6.0000', currentlyIssued: true, issue: { id: issuedId, issueNumber: 'MI-BROWSER-6', postedAt: '2026-11-02T01:00:00Z', reversedAt: null }, materialIssueItemId: 'issue-item-a', receipts: [] }];
    }
    else if (suffix.endsWith('/receipts')) {
        check(body.signedEvidenceConfirmed === true, 'Receipt lacks explicit signed confirmation');
        current.version++;
        current.lines[0].acknowledgedQuantity = '6.0000';
        current.lines[0].issueLinks[0].receipts = [{ id: 'receipt-a', recipientEmployeeId: 'employee-a', issuerEmployeeId: 'issuer-a', recipient: { employeeName: 'Synthetic Foreman' }, issuer: { employeeName: 'Synthetic Store' }, receivedAt: body.receivedAt, recordedAt: '2026-11-02T02:00:00Z', recordedBy: { displayName: 'Store' }, supersedesReceiptId: null, superseded: false, reason: body.reason, documentId: 'doc-a', evidenceChecksum: 'a'.repeat(64) }];
    }
    const out = { data: { id: rid, version: current.version, revisionId: 'revision-' + current.version } };
    saved.set(body.requestKey, out);
    if (!suffix && !lost) {
        lost = true;
        throw Error('Synthetic committed response loss');
    }
    return clone(out);
};
const evidence = { id: 'doc-a', fileName: 'signed-paper.pdf', isActive: true, mimeType: 'application/pdf', checksum: 'a'.repeat(64) };
documentsApi.typeOptions = async () => ({ data: [{ id: 'type-a', documentTypeCode: 'SIGNED', documentTypeName: 'Signed paper' }] });
documentsApi.targetDocuments = async () => ({ data: [evidence] });
documentsApi.downloadTargetDocument = async () => { };
inventoryApi.materialIssue = async () => ({ data: { id: issuedId, projectId: p, issueNumber: 'MI-BROWSER-6', issueDate: '2026-11-02', postedAt: '2026-11-02T01:00:00Z', reversedAt: null } });
window.fetch = async () => { throw Error('Synthetic browser must never reach real API'); };
const root = createRoot(document.getElementById('root')!);
function render() { root.render(<MonetaryLocaleContext.Provider value={locale}><QueryClientProvider client={client}><MaterialRequestsPanel permissions={permissions}/></QueryClientProvider></MonetaryLocaleContext.Provider>); }
const pause = (ms = 50) => new Promise(r => setTimeout(r, ms));
async function wait(fn: () => unknown, message: string) { for (let i = 0; i < 150; i++) {
    if (fn())
        return;
    await pause();
} throw Error(message); }
const visible = () => document.getElementById('root')!.textContent ?? '';
const button = (text: string) => [...document.querySelectorAll('button')].filter(x => x.textContent?.trim() === text).at(-1) as HTMLButtonElement | undefined;
async function click(text: string) { await wait(() => button(text) && !button(text)!.disabled, 'Button unavailable ' + text); button(text)!.click(); await pause(100); }
function field(label: string) { const l = [...document.querySelectorAll('label')].find(x => x.textContent === label); check(l, 'Missing field ' + label); return document.getElementById(l!.htmlFor)!; }
async function choose(label: string, option: string) { field(label).click(); await wait(() => [...document.querySelectorAll('[role=option]')].some(x => x.textContent === option), 'Option unavailable ' + option); ([...document.querySelectorAll('[role=option]')].find(x => x.textContent === option) as HTMLElement).click(); await pause(100); }
async function input(label: string, value: string) { const el = field(label); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await pause(60); }
async function run() {
    render();
    await wait(() => visible().includes('Material requests'), 'Initial panel absent');
    await choose('Project', 'P-A · Browser project');
    await choose('Warehouse', 'Site warehouse');
    await choose('Requester', 'Synthetic Foreman');
    await choose('Material 1', 'Synthetic steel');
    await input('Requested quantity', '10');
    await click('Record request');
    await wait(() => visible().includes('Recording could not be confirmed'), 'Lost response not surfaced');
    check(captures === 1, 'Capture fixture count wrong');
    await click('Retry recording');
    await wait(() => visible().includes('10.0000'), 'Retry did not recover request');
    check(captures === 1, 'Lost response retry duplicated request');
    await click('Link posted issue');
    await choose('Material', 'Synthetic steel · 1');
    await choose('Posted issue line', 'MI-BROWSER-6 · 1 · 6.0000');
    await input('Reason', 'Actual first issue');
    await click('Link posted issue');
    await wait(() => visible().includes('6.0000') && current.version === 2, 'Partial fulfillment absent');
    check(current.lines[0].acknowledgedQuantity === '0.0000', 'Evidence automatically acknowledged');
    await choose('Actual recipient', 'Synthetic Foreman');
    await choose('Actual issuer', 'Synthetic Store');
    await input('Received at', new Date(Date.now() - 60000).toISOString().slice(0, 16));
    await choose('Signed evidence', 'signed-paper.pdf');
    await input('Reason', 'Actual signed receipt');
    check(button('Record signed receipt')?.disabled, 'Receipt enabled without explicit signature confirmation');
    const checkbox = document.querySelector('input[type=checkbox]') as HTMLInputElement;
    check(checkbox, 'Signed confirmation absent');
    checkbox.click();
    await pause(80);
    await click('Record signed receipt');
    await wait(() => current.lines[0].acknowledgedQuantity === '6.0000', 'Explicit acknowledgment absent');
    await click('Open issue record');
    await wait(() => visible().includes('2026-11-02'), 'Canonical source not opened');
    for (const [language, label] of [['th', 'คำขอวัสดุ'], ['zh-TW', '材料申領'], ['en', 'Material requests']]) {
        locale = language;
        render();
        await pause(180);
        check(visible().includes(label), 'Locale missing ' + language);
    }
    await click('Revise request');
    const oldCommands = commands;
    current.version++;
    await client.invalidateQueries({ queryKey: ['material-requests', 'detail', p, rid] });
    await wait(() => visible().includes('This record changed.'), 'Stale-version warning absent');
    check(button('Save revision')?.disabled, 'Stale revision enabled');
    check(commands === oldCommands, 'Background update submitted a write');
    deny = true;
    await client.invalidateQueries({ queryKey: ['material-requests'] });
    await wait(() => visible().includes('Records are unavailable'), 'Revocation error absent');
    check(!visible().includes('Synthetic Foreman') && !visible().includes('Synthetic steel'), 'Old business records survived denied revalidation');
    document.body.dataset.result = 'PASS';
}
run().catch(e => { document.body.dataset.result = 'FAIL'; document.body.dataset.error = e.message; });
