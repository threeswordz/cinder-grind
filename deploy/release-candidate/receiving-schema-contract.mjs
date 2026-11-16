import {createHash} from 'node:crypto';
const models={
  "ReceivingProjectPolicy": "5d8aefffcb8850d6a8f6d1222dc2ae35943cc5065e85bcb50f6fdb9a0942606d",
  "ReceivingDelivery": "42ae364db271723453f7537cd141445bd553f8e59431635514858f1048e29c04",
  "ReceivingDeliveryLine": "e9fbe1d93ec6da3ccd8ef97f148e425ac627d54d795a64beef9c10ffab850b1e",
  "ReceivingDeliveryEvidence": "32aca1450252a02eae941151d7408051154c5882229994c24936fac8d9f58b64",
  "ReceivingDeliveryEvent": "67d4f2c4f3cdec7cfa1a1301192987d56f0fe8475e29b6a1ad0ce89882364c18",
  "ReceivingOperation": "3f878b9451ed33c882a9c923cba9ef6e018b8cd9660a36d1851e7401c700a5f8"
};
const relations={
  "Supplier": [
    "receivingDeliveries ReceivingDelivery[]"
  ],
  "UnitOfMeasure": [
    "receivingDeliveryLines ReceivingDeliveryLine[]"
  ],
  "Material": [
    "receivingDeliveryLines ReceivingDeliveryLine[]"
  ],
  "User": [
    "receivingPolicies ReceivingProjectPolicy[] @relation(\"ReceivingPolicyActor\")",
    "capturedDeliveries ReceivingDelivery[] @relation(\"ReceivingDeliveryCreator\")",
    "checkedDeliveries ReceivingDelivery[] @relation(\"ReceivingDeliveryChecker\")",
    "receivingEvents ReceivingDeliveryEvent[]",
    "receivingOperations ReceivingOperation[]",
    "receivingEvidence ReceivingDeliveryEvidence[]"
  ],
  "Project": [
    "receivingPolicy ReceivingProjectPolicy?",
    "receivingDeliveries ReceivingDelivery[]",
    "receivingOperations ReceivingOperation[]"
  ],
  "Document": [
    "receivingEvidence ReceivingDeliveryEvidence[]"
  ],
  "Warehouse": [
    "receivingDeliveries ReceivingDelivery[]"
  ],
  "GoodsReceipt": [
    "deliveryId String? @unique @map(\"delivery_id\") @db.Uuid",
    "delivery ReceivingDelivery? @relation(fields: [deliveryId], references: [id], onDelete: Restrict, onUpdate: Restrict)"
  ],
  "PurchaseOrder": [
    "receivingDeliveries ReceivingDelivery[]"
  ],
  "PurchaseOrderLine": [
    "receivingDeliveryLines ReceivingDeliveryLine[]"
  ]
};
export const receivingTables=['receiving_project_policies','receiving_deliveries','receiving_delivery_lines','receiving_delivery_evidence','receiving_delivery_events','receiving_operations'];
export function stripReceivingSchema(schema){
 const found=new Set(),removed=new Set();
 const text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
  if(Object.hasOwn(models,name)){
   if(found.has(name)||createHash('sha256').update(block.replace(/\s+/g,' ')).digest('hex')!==models[name])throw Error('Receiving schema differs from exact receiving contract');
   found.add(name);return '';
  }
  return block.split('\n').filter(line=>{
   const normalized=line.trim().replace(/\s+/g,' ');if(!(relations[name]??[]).includes(normalized))return true;
   const key=name+':'+normalized;if(removed.has(key))throw Error('Duplicate receiving relation');removed.add(key);return false;
  }).join('\n');
 });
 const expected=Object.values(relations).reduce((n,ls)=>n+ls.length,0);
 if((found.size&&found.size!==6)||(removed.size&&removed.size!==expected)||Boolean(found.size)!==Boolean(removed.size))throw Error('Partial receiving schema prohibited');
 return {text,present:found.size===6};
}
export function receivingMode(mode){
 const present=typeof mode==='string'&&mode.startsWith('migration-aware-receiving-');
 return {present,prior:!present?mode:mode==='migration-aware-receiving-schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice('migration-aware-receiving-'.length)};
}
