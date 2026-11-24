import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {openCloseoutEditor,syncCloseoutEditor,closeoutEditorDirty,closeoutEditorMatches,canSignDisplayedCloseout} from '../projects/closeout-editor.ts';
const empty={checklist:[],outstandingItems:[],overallNote:'',revisionReason:''};
const source=(version=1,projectId='P')=>({project:{id:projectId,isActive:true},canPrepare:true,canSignBen:true,canSignNancy:false,
 current:{version,fingerprint:'fingerprint-'+version,signatures:{},preparation:{
  checklist:[{category:'AP_AR_PAYMENTS',state:'WARNING',evidenceReference:'invoice',evidenceNote:'Checked'}],
  outstandingItems:[{category:'AP_AR_PAYMENTS',description:'Unpaid invoice',reason:'Due next month',ownerUserId:'N',dueDate:'2026-12-05',
    remainingAmount:'100',remainingQuantity:null,quantityUom:null,notQuantifiableReason:null}],
  overallNote:'Saved summary',revisionReason:'Prior revision reason'}}});
const edit=(e,patch)=>({...e,draft:{...e.draft,...patch}});
test('same-version background refetch, transient absent data, and signature-only refetch preserve unsaved inputs',()=>{
 const saved=source(),dirty=edit(openCloseoutEditor(saved,empty),{overallNote:'Unsaved local summary'});
 assert.equal(syncCloseoutEditor(dirty,null,empty),dirty);
 assert.equal(syncCloseoutEditor(dirty,structuredClone(saved),empty),dirty);
 const signed=structuredClone(saved);signed.current.signatures.BEN={userId:'B'};
 assert.equal(syncCloseoutEditor(dirty,signed,empty),dirty);
 assert.equal(dirty.draft.overallNote,'Unsaved local summary');
});
test('newer source preserves dirty editor and blocks saving/signing until explicit discard',()=>{
 const dirty=edit(openCloseoutEditor(source(),empty),{revisionReason:'Local pending reason'});
 const newer=source(2);assert.equal(syncCloseoutEditor(dirty,newer,empty),dirty);
 assert.equal(closeoutEditorMatches(dirty,newer),false);
 assert.equal(canSignDisplayedCloseout(dirty,newer,true),false);
 const discard=openCloseoutEditor(newer,empty);assert.equal(closeoutEditorDirty(discard),false);
 assert.equal(canSignDisplayedCloseout(discard,newer,true),true);
});
test('clean editor follows new version but never rolls back to an older response; Project switch isolates inputs',()=>{
 const initial=openCloseoutEditor(source(),empty),newer=syncCloseoutEditor(initial,source(2),empty);
 assert.equal(newer.version,2);assert.equal(syncCloseoutEditor(newer,source(),empty),newer);
 const dirty=edit(newer,{overallNote:'P private draft'});
 const other=syncCloseoutEditor(dirty,source(1,'Q'),empty);
 assert.equal(other.projectId,'Q');assert.equal(other.draft.overallNote,'Saved summary');
});
test('dual-role signing requires exact displayed saved content, fresh data, and available reviewer role',()=>{
 const saved=source(),clean=openCloseoutEditor(saved,empty);
 assert.equal(canSignDisplayedCloseout(clean,saved,true),true);
 for(const patch of [
   {overallNote:'changed'}, {revisionReason:'pending reason'},
   {checklist:[{...clean.draft.checklist[0],evidenceNote:'different'}]},
   {checklist:[{...clean.draft.checklist[0],evidenceReference:'different'}]},
   {checklist:[{...clean.draft.checklist[0],state:'CLEAR'}]},
   {outstandingItems:[{...clean.draft.outstandingItems[0],remainingAmount:'900'}]},
   {outstandingItems:[{...clean.draft.outstandingItems[0],dueDate:'2026-12-06'}]},
   {outstandingItems:[]},
 ])assert.equal(canSignDisplayedCloseout(edit(clean,patch),saved,true),false);
 assert.equal(canSignDisplayedCloseout(clean,saved,false),false);
 assert.equal(canSignDisplayedCloseout(clean,{...saved,canSignBen:false},true),false);
 assert.equal(canSignDisplayedCloseout(clean,source(2),true),false);
 assert.equal(canSignDisplayedCloseout(clean,source(1,'Q'),true),false);
 const signed=structuredClone(saved);signed.current.signatures.BEN={userId:'B'};
 assert.equal(canSignDisplayedCloseout(clean,signed,true),false);
});
test('first preparation, canonical field order, and explicit discard are safe',()=>{
 const blank={...source(),current:null},initial=openCloseoutEditor(blank,empty);
 assert.equal(canSignDisplayedCloseout(initial,blank,true),false);
 const dirty=edit(initial,{overallNote:'first local preparation'});
 assert.equal(syncCloseoutEditor(dirty,source(),empty),dirty);
 const saved=source(),clean=openCloseoutEditor(saved,empty);
 const row=clean.draft.checklist[0],reordered=edit(clean,{checklist:[{evidenceReference:row.evidenceReference,evidenceNote:row.evidenceNote,state:row.state,category:row.category}]});
 assert.equal(closeoutEditorDirty(reordered),false);
});
test('panel uses same pure guard at button and mutation and preserves exact submitted predecessor',()=>{
 const ui=readFileSync(new URL('../projects/ProjectCloseoutPanel.tsx',import.meta.url),'utf8');
 assert.match(ui,/syncCloseoutEditor\(previous,result,emptyDraft\(\)\)/);
 assert.match(ui,/if\(!canSignDisplayedCloseout\(editor,result,fresh\)/);
 assert.match(ui,/disabled=\{!canSign\|\|/);
 assert.match(ui,/expectedFingerprint:submitted\.fingerprint/);
 assert.match(ui,/previous===submitted/);
 assert.match(ui,/result\.current\.preparation\.overallNote/);
});
