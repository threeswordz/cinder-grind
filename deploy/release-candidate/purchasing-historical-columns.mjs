// Historical purchasing layers. Only exclude columns after native catalog,
 // migration checksum and NULL validation. Existing predecessor columns stay
 // in the digest; callers must establish whether each layer was newly added.
import {stripPur04Schema,pur04Columns} from './pur04-schema-preparation.mjs';
import {stripPur01Schema,pur01Column} from './pur01-schema-preparation.mjs';
import {verifiedPur04HistoricalColumns} from './pur04-historical-columns.mjs';
import {verifiedPur01HistoricalColumns} from './pur01-historical-columns.mjs';
export function stripPurchasingSchema(schema){
 const one=stripPur01Schema(schema),four=stripPur04Schema(one.text);
 if(one.present&&!four.present)throw Error('PUR01 requires complete PUR04 schema');
 return {text:four.text,pur01:one.present,pur04:four.present};
}
export function purchasingUpgradeFlags(env=process.env){
 return {pur04:env.PUR04_SCHEMA_UPGRADE==='YES',pur01:env.PUR01_SCHEMA_UPGRADE==='YES'};
}
export function purchasingHistoricalNames(flags){
 return [...(flags.pur04?pur04Columns:[]),...(flags.pur01?[pur01Column]:[])];
}
export async function verifiedPurchasingHistoricalColumns(db,flags){
 return [...(flags.pur04?await verifiedPur04HistoricalColumns(db):[]),...(flags.pur01?await verifiedPur01HistoricalColumns(db):[])];
}
