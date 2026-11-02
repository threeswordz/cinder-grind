import {createHash} from 'node:crypto';
const models={
  "MaterialRequest": "68550a446cff234976543cbd623692cdd6b9319d0d231c68b378cdad1e97958b",
  "MaterialRequestLine": "42bdad07eb87016dc40dfd9d0354fa33d171c9c824b111738e58498b5525c47f",
  "MaterialRequestRevision": "53afe36552f4f6f489b362d01176023bf7946284efe0cf4037dcd4d515c66b97",
  "MaterialRequestIssueLink": "f0ab765b447c0780c7fdd407d7d77013733ce50ba89a9b02256ef80474478a06",
  "MaterialRequestReceipt": "7fffb292e341b3d26e41895d3c1816fd7b7ba3dc755d4bbf7df1a42e712850f6",
  "MaterialRequestOperation": "683a892b1d5fa209c43c560a08e61563f4eceef021905f594f1b8ed047417bb0"
};
const relations={
  "Company": [
    "materialRequests MaterialRequest[]",
    "materialRequestOperations MaterialRequestOperation[]"
  ],
  "Project": [
    "materialRequests MaterialRequest[]"
  ],
  "Warehouse": [
    "materialRequests MaterialRequest[]"
  ],
  "Employee": [
    "requestedMaterialRequests MaterialRequest[] @relation(\"MaterialRequestRequester\")",
    "receivedMaterialRequestReceipts MaterialRequestReceipt[] @relation(\"MaterialRequestRecipient\")",
    "issuedMaterialRequestReceipts MaterialRequestReceipt[] @relation(\"MaterialRequestIssuer\")"
  ],
  "User": [
    "createdMaterialRequests MaterialRequest[] @relation(\"MaterialRequestCreator\")",
    "updatedMaterialRequests MaterialRequest[] @relation(\"MaterialRequestEditor\")",
    "materialRequestRevisions MaterialRequestRevision[]",
    "materialRequestIssueLinks MaterialRequestIssueLink[]",
    "materialRequestReceipts MaterialRequestReceipt[]",
    "materialRequestOperations MaterialRequestOperation[]"
  ],
  "Material": [
    "materialRequestLines MaterialRequestLine[]"
  ],
  "UnitOfMeasure": [
    "materialRequestLines MaterialRequestLine[]"
  ],
  "WbsElement": [
    "materialRequestLines MaterialRequestLine[]"
  ],
  "CostCode": [
    "materialRequestLines MaterialRequestLine[]"
  ],
  "Activity": [
    "materialRequestLines MaterialRequestLine[]"
  ],
  "MaterialIssueItem": [
    "materialRequestLink MaterialRequestIssueLink?"
  ],
  "Document": [
    "materialRequestReceipts MaterialRequestReceipt[]"
  ]
};

const normal=s=>s.replace(/\s+/g,' ').trim();
export const materialRequestTables=['material_requests','material_request_lines','material_request_revisions','material_request_issue_links','material_request_receipts','material_request_operations'];
export function stripMaterialRequestSchema(schema){
 const found=new Set(),removed=new Set();
 const text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
  if(Object.hasOwn(models,name)){
   if(found.has(name)||createHash('sha256').update(block.replace(/\s+/g,' ')).digest('hex')!==models[name])throw Error('Material request schema differs from exact DEC-043 contract');
   found.add(name);return '';
  }
  return block.split('\n').filter(line=>{
   const v=normal(line);if(!(relations[name]??[]).includes(v))return true;
   const key=name+':'+v;if(removed.has(key))throw Error('Duplicate material request relation');removed.add(key);return false;
  }).join('\n');
 });
 const expected=Object.values(relations).reduce((n,rows)=>n+rows.length,0);
 if((found.size&&found.size!==6)||(removed.size&&removed.size!==expected)||Boolean(found.size)!==Boolean(removed.size))throw Error('Partial material request schema is prohibited');
 return {text,present:found.size===6};
}
export function materialRequestMode(mode){
 const present=typeof mode==='string'&&mode.startsWith('migration-aware-material-request-');
 return {present,prior:!present?mode:mode==='migration-aware-material-request-schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice('migration-aware-material-request-'.length)};
}
