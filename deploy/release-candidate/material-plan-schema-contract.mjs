import {planIssueMode} from './material-plan-issue-schema-contract.mjs';
import {createHash} from 'node:crypto';
const models={
  "MaterialUsagePlan": "e5f76ba5b234c6ef2f607748fa162715645f77d30d3301a95cc412f6fd7f3028",
  "MaterialUsagePlanRevision": "5f9a9635ff7f23976dbee55ba799a35c9f0754ddbb669eada2baf50889b80e1a",
  "MaterialUsagePlanLine": "702f55335b8a7be5510779b43e44d61e15c3e27591eccd55a4b3975941c52f39",
  "MaterialUsagePlanOperation": "396be44d09ddd541f8a01385ced022bbdafe7463523129748878c50e65ba4514"
};
const relations={
  "Company": [
    "materialUsagePlans MaterialUsagePlan[]",
    "materialUsagePlanOperations MaterialUsagePlanOperation[]"
  ],
  "UnitOfMeasure": [
    "materialUsagePlanLines MaterialUsagePlanLine[]"
  ],
  "Material": [
    "materialUsagePlanLines MaterialUsagePlanLine[]"
  ],
  "User": [
    "createdMaterialUsagePlans MaterialUsagePlan[] @relation(\"MaterialUsagePlanCreator\")",
    "createdMaterialUsagePlanRevisions MaterialUsagePlanRevision[] @relation(\"MaterialUsagePlanRevisionCreator\")",
    "submittedMaterialUsagePlanRevisions MaterialUsagePlanRevision[] @relation(\"MaterialUsagePlanSubmitter\")",
    "decidedMaterialUsagePlanRevisions MaterialUsagePlanRevision[] @relation(\"MaterialUsagePlanDecider\")",
    "materialUsagePlanOperations MaterialUsagePlanOperation[]"
  ],
  "Project": [
    "materialUsagePlans MaterialUsagePlan[]"
  ],
  "Warehouse": [
    "materialUsagePlans MaterialUsagePlan[]"
  ],
  "BudgetRevision": [
    "materialUsagePlans MaterialUsagePlan[]"
  ],
  "BudgetRevisionLine": [
    "materialUsagePlanLines MaterialUsagePlanLine[]"
  ]
};

export const materialPlanTables=['material_usage_plans','material_usage_plan_revisions','material_usage_plan_lines','material_usage_plan_operations'];
export function stripMaterialPlanSchema(schema){
 const found=new Set(),removed=new Set();
 const text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
  if(Object.hasOwn(models,name)){
   if(found.has(name)||createHash('sha256').update(block.replace(/\s+/g,' ')).digest('hex')!==models[name])throw Error('Material plan schema differs from exact DEC-044 foundation');
   found.add(name);return '';
  }
  return block.split('\n').filter(line=>{
   const normalized=line.trim().replace(/\s+/g,' ');if(!(relations[name]??[]).includes(normalized))return true;
   const key=name+':'+normalized;if(removed.has(key))throw Error('Duplicate material plan relation');removed.add(key);return false;
  }).join('\n');
 });
 const expected=Object.values(relations).reduce((n,ls)=>n+ls.length,0);
 if((found.size&&found.size!==4)||(removed.size&&removed.size!==expected)||Boolean(found.size)!==Boolean(removed.size))throw Error('Partial material plan schema prohibited');
 return {text,present:found.size===4};
}
export function materialPlanMode(mode){
 mode=planIssueMode(mode).prior;
 const present=typeof mode==='string'&&mode.startsWith('migration-aware-material-plan-');
 return {present,prior:!present?mode:mode==='migration-aware-material-plan-schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice('migration-aware-material-plan-'.length)};
}
