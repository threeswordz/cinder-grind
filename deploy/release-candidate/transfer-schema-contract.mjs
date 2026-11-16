import {createHash} from 'node:crypto';
const models={
  "TransferProjectPolicy": "433af913cb1a3a62914b901245d28e12c31001e6aaeec602a2e3d0e9a56bc6b8",
  "TransferCustody": "bdc5e79e78992c6477e000e3594246bfa1a418f44a55302657da84c9be91def7",
  "TransferDispatch": "2c56657b1214b7acb7eb93f9f9b1149b4ba8b247ae72ca8ff10c816c03409b66",
  "TransferReceiverAssignment": "5a2bc50d24120cbda2d80aae017f9af391b7433f76dc28a0e0b21684e0dce091",
  "TransferReceipt": "f0d036311225cb3813c48ee3d7308081e99788922a0208ce4de273e417a869d1",
  "TransferReceiptLine": "4b55177be745a76543f657e3eb7e4f6751ada78d131c6ae9aeb31194161cc279",
  "TransferCustodyEvent": "ef348c7c470277b6578cff1369a9117c2d03fe429f8c2ae1bfe65f6218018ab5",
  "TransferOperation": "aa4986a96ea6fc35820071bdf645ab5adf908633f4a78c791c4aa43e0b5fdd43"
};
export const transferTables=["transfer_project_policies", "transfer_custodies", "transfer_dispatches", "transfer_receiver_assignments", "transfer_receipts", "transfer_receipt_lines", "transfer_custody_events", "transfer_operations"];
const fields=['transferReceiptLineId String? @map("transfer_receipt_line_id") @db.Uuid','transferReceiptLine TransferReceiptLine? @relation(fields: [transferReceiptLineId], references: [id], onDelete: Restrict, onUpdate: Restrict)'];
export function stripTransferSchema(schema){
 const found=new Set(),removed=new Set();
 let text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
  if(Object.hasOwn(models,name)){
   if(found.has(name)||createHash('sha256').update(block.replace(/\s+/g,' ')).digest('hex')!==models[name])throw Error('Transfer schema differs from exact DEC-046 contract');
   found.add(name);return '';
  }
  if(name!=='StockTransaction')return block;
  return block.split('\n').filter(line=>{const value=line.trim().replace(/\s+/g,' ');if(!fields.includes(value))return true;if(removed.has(value))throw Error('Duplicate transfer provenance');removed.add(value);return false;}).join('\n');
 });
 if(found.size){
  if(found.size!==8||removed.size!==2)throw Error('Partial transfer schema prohibited');
  const index='@@index([stockTransferItemId, movementType])';
  if(text.split(index).length!==2||text.includes('@@unique([stockTransferItemId, movementType])'))throw Error('Exact transfer receipt uniqueness contract required');
  text=text.replace(index,'@@unique([stockTransferItemId, movementType])').replace('  // Transfer movement uniqueness is enforced by partial SQL indexes.\n','').replace('// DEC-046: additive custody facts; historical StockTransfer rows are not backfilled.','');
 }else if(removed.size)throw Error('Transfer fields without transfer models');
 return {text,present:found.size===8};
}
export function transferMode(mode){const present=typeof mode==='string'&&mode.startsWith('migration-aware-transfer-');return {present,prior:!present?mode:mode==='migration-aware-transfer-schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice('migration-aware-transfer-'.length)};}
