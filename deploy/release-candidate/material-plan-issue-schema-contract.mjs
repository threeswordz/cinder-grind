import {createHash} from 'node:crypto';
const models={
  "MaterialPlanProjectPolicy": "c9aaa2071b329764947616ead6902d89c13e5464b369e9669c95861d4e1a5263",
  "MaterialPlanIssueBinding": "21659e48661d646e7d892e4948a70258113f05e4a9bd0e66b31e31048f6513b3",
  "MaterialPlanIssueAuthorization": "99f205bfd8105bf5a217d2d522b56ebaed87fdf8c8efddaba44a81a8117c6523",
  "MaterialPlanIssueAllocation": "a0f9c9d0a36765b568f86630bc4b25329e5cb664885fad0df35a097d5b3add32",
  "MaterialPlanIssueOperation": "f39f15da9518595e0a2d8f3d6f524fa0ebc5de9e349f1a88d2e1dc8cff70ee9e"
};
const relations={
  "Company": [
    "materialPlanPolicies MaterialPlanProjectPolicy[]",
    "materialPlanIssueOperations MaterialPlanIssueOperation[]"
  ],
  "Project": [
    "materialPlanPolicy MaterialPlanProjectPolicy?"
  ],
  "User": [
    "enabledMaterialPlanPolicies MaterialPlanProjectPolicy[] @relation(\"MaterialPlanPolicyEnabler\")",
    "createdMaterialPlanIssueAuthorizations MaterialPlanIssueAuthorization[] @relation(\"MaterialPlanIssueAuthor\")",
    "materialPlanIssueOperations MaterialPlanIssueOperation[]"
  ],
  "ApprovalWorkflow": [
    "materialPlanPolicies MaterialPlanProjectPolicy[]"
  ],
  "ApprovalInstance": [
    "materialPlanIssueAuthorization MaterialPlanIssueAuthorization?"
  ],
  "MaterialIssue": [
    "materialPlanBinding MaterialPlanIssueBinding?"
  ],
  "MaterialIssueItem": [
    "materialPlanAllocations MaterialPlanIssueAllocation[]"
  ],
  "MaterialUsagePlan": [
    "issueAllocations MaterialPlanIssueAllocation[]"
  ],
  "MaterialUsagePlanLine": [
    "issueAllocations MaterialPlanIssueAllocation[]"
  ]
};
export const planIssueTables=['material_plan_project_policies','material_plan_issue_bindings','material_plan_issue_authorizations','material_plan_issue_allocations','material_plan_issue_operations'];
export function stripPlanIssueSchema(schema){
 const found=new Set(),removed=new Set();
 const text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
  if(Object.hasOwn(models,name)){
   if(found.has(name)||createHash('sha256').update(block.replace(/\s+/g,' ')).digest('hex')!==models[name])throw Error('Material plan issue schema differs from exact bounded contract');
   found.add(name);return '';
  }
  return block.split('\n').filter(line=>{
   const normalized=line.trim().replace(/\s+/g,' ');if(!(relations[name]??[]).includes(normalized))return true;
   const key=name+':'+normalized;if(removed.has(key))throw Error('Duplicate material plan issue relation');removed.add(key);return false;
  }).join('\n');
 });
 const expected=Object.values(relations).reduce((n,ls)=>n+ls.length,0);
 if((found.size&&found.size!==5)||(removed.size&&removed.size!==expected)||Boolean(found.size)!==Boolean(removed.size))throw Error('Partial material plan issue schema prohibited');
 return {text,present:found.size===5};
}
export function planIssueMode(mode){
 const present=typeof mode==='string'&&mode.startsWith('migration-aware-plan-issue-');
 return {present,prior:!present?mode:mode==='migration-aware-plan-issue-schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice('migration-aware-plan-issue-'.length)};
}
