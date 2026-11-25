// Versioned purchasing outer modes. This parser is not schema admission.
import {pur04Migration} from './pur04-schema-preparation.mjs';
import {pur01Migration} from './pur01-schema-preparation.mjs';
function peel(mode,layer){
 const prefix='migration-aware-'+layer+'-';
 return typeof mode==='string'&&mode.startsWith(prefix)
 ?{present:true,prior:mode===prefix+'schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice(prefix.length)}
 :{present:false,prior:mode};
}
export function purchasingMode(mode){
 const one=peel(mode,'pur01'),four=peel(one.prior,'pur04');
 if(typeof four.prior==='string'&&/^migration-aware-pur(?:01|04)-/.test(four.prior))throw Error('Invalid purchasing mode order');
 return {pur01:one.present,pur04:four.present,prior:four.prior,version:one.present?23:four.present?22:null};
}
export const purchasingEvidenceKeys=Object.freeze(['SchemaUpgrade','SourceContractTests','HistoricalPreservation','PairedRecovery','ExternalHrKeyAndDocumentRecovery']);
export function assertPurchasingEvidence(rehearsal){
 const mode=purchasingMode(rehearsal.releaseMode);
 if(!mode.version)return mode;
 if(rehearsal.version!==mode.version)throw Error('Purchasing evidence version mismatch');
 for(const [layer,migration] of [['pur04',pur04Migration],['pur01',pur01Migration]]){
  if(!mode[layer])continue;
  if(!rehearsal.migrationNames?.includes(migration))throw Error('Exact '+layer+' forward migration missing');
  for(const suffix of purchasingEvidenceKeys)if(rehearsal[layer+suffix]!=='PASS')throw Error('Purchasing evidence missing: '+layer+suffix);
 }
 return mode;
}
