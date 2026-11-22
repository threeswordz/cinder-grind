// Bind the combined Finance + DEC-054 BOQ configuration to the preserved prototype;
// no CLI side effects, no new grants until a separately attested Mac operator
// supplies the *current* private snapshot and completion receipt.
import {SOURCE,ROLES} from './prototype-actors.mjs';
import {FM03_GRANTS} from './prototype-fm03-state.mjs';
import {RECEIVING_GRANTS} from './prototype-receiving-state.mjs';
import {TRANSFER_GRANTS} from './prototype-transfer-state.mjs';
import {SUBCONTRACT_GRANTS} from './prototype-subcontract-state.mjs';
import {UOM_GRANTS,uomSnapshot,digest} from './prototype-uom-state.mjs';
import {configureM6FinanceCore} from './prototype-m6-finance-core.mjs';

const keys=['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN','KOH'];
const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const need=(yes,code)=>{if(!yes)fail(code);};

export function validCompletedUomReceipt(receipt){
  return receipt?.status==='UOM_POPULATED_MAC_UPGRADE_AND_CONVERTED_RECEIVING_VERIFIED'&&
    receipt.applicationSha==='9fa0506e9a50fd556f1c4404e4db2e3d88093b85'&&
    receipt.operatorMainSha==='9fa0506e9a50fd556f1c4404e4db2e3d88093b85'&&
    receipt.forwardOnlyMigration===true&&receipt.sourceHistoryPreserved===true&&
    receipt.documentsUploadsKeysAndPriorReceiptsPreserved===true&&
    receipt.preUpgradeSeparatePopulatedRestoreAndJourneyVerified===true&&
    receipt.newConvertedStockJourneyVerified===true&&
    receipt.humanUatCompleted===false&&receipt.productionAuthorized===false;
}

// Reuse the eight-actor expected grants from the exact completed actor,
// material, FM03, receiving, transfer, subcontract and UOM progression.
// Never derive an allowlist from live current grants: those are checked *against*
// this source baseline inside the locked snapshot transaction.
export function sourceM6PreBusinessGrants(binding){
  need(binding?.sourceSha===SOURCE,'M6_SOURCE_IDENTITY_INVALID');
  const extra=binding.configuration?.changes;
  need(Array.isArray(extra)&&extra.every(row=>typeof row.roleCode==='string'&&
    keys.some(key=>row.roleCode==='PROTO_'+key)&&
    Array.isArray(row.addedCapabilities)&&
    row.addedCapabilities.every(code=>typeof code==='string'&&code.length>0))&&
    new Set(extra.map(row=>row.roleCode)).size===extra.length,
    'M6_MATERIAL_GRANT_DELTA_INVALID');
  return Object.fromEntries(keys.map(key=>{
    const material=extra.find(row=>row.roleCode==='PROTO_'+key)?.addedCapabilities??[];
    const grants=[...ROLES[key].permissions,...material,...(FM03_GRANTS[key]??[]),
      ...(RECEIVING_GRANTS[key]??[]),...(TRANSFER_GRANTS[key]??[]),
      ...(SUBCONTRACT_GRANTS[key]??[]),...(UOM_GRANTS[key]??[])];
    return [key,[...new Set(grants)]];
  }));
}

// Only the preservation-aware Mac operator may call this after it has read
// the private ready.json with ownership/mode checks and measured the *same*
// full prewrite DB snapshot that produced expectedSnapshotDigest.
export async function configureVerifiedM6Business(db,binding,expectedSnapshotDigest,verifiedPrivateUomReceipt){
  need(validCompletedUomReceipt(verifiedPrivateUomReceipt),'M6_UOM_COMPLETION_RECEIPT_REQUIRED');
  return configureM6FinanceCore(db,{binding,baselineGrants:sourceM6PreBusinessGrants(binding),
    expectedSnapshotDigest,snapshot:uomSnapshot,digest,verifiedUomReceipt:true});
}
