import {createHash} from 'node:crypto';
const models={
  "SiteIssueRouting": "7f34f46d8174c6736cbd0af8cb291dc598508746a12685873d8332f445e391af",
  "SiteIssue": "bbe64f5a8a5e5d7641749f498ab4cdf22bcb521b245eb339287bb1c1374a4176",
  "SiteIssueEvent": "2444577cf3a66298c4fb0170b64d9bf46a3a47363620705b5820964cacc77115"
};
const relations={
  "User": [
    "siteIssueRoutingOwner SiteIssueRouting[] @relation(\"SiteIssueRoutingOwner\")",
    "siteIssueRoutingEscalation SiteIssueRouting[] @relation(\"SiteIssueRoutingEscalation\")",
    "siteIssueRoutingChanges SiteIssueRouting[] @relation(\"SiteIssueRoutingActor\")",
    "reportedSiteIssues SiteIssue[] @relation(\"SiteIssueReporter\")",
    "ownedSiteIssues SiteIssue[] @relation(\"SiteIssueOwner\")",
    "escalatedSiteIssues SiteIssue[] @relation(\"SiteIssueEscalation\")",
    "siteIssueEvents SiteIssueEvent[]"
  ],
  "Project": [
    "siteIssueRouting SiteIssueRouting?",
    "siteIssues SiteIssue[]"
  ],
  "Activity": [
    "siteIssues SiteIssue[]",
    "@@unique([companyId, projectId, id])"
  ],
  "DailySiteReport": [
    "siteIssues SiteIssue[]",
    "@@unique([companyId, projectId, id])"
  ]
};
export const siteIssueTables=['site_issue_routings','site_issues','site_issue_events'];
export function stripSiteIssueSchema(schema){
 const found=new Set(),removed=new Set();
 const text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
  if(Object.hasOwn(models,name)){
   if(found.has(name)||createHash('sha256').update(block.replace(/\s+/g,' ')).digest('hex')!==models[name])throw Error('Site issue schema differs from exact FM03 contract');
   found.add(name);return '';
  }
  return block.split('\n').filter(line=>{
   const normalized=line.trim().replace(/\s+/g,' ');if(!(relations[name]??[]).includes(normalized))return true;
   const key=name+':'+normalized;if(removed.has(key))throw Error('Duplicate site issue relation');removed.add(key);return false;
  }).join('\n');
 });
 const expected=Object.values(relations).reduce((n,ls)=>n+ls.length,0);
 if((found.size&&found.size!==3)||(removed.size&&removed.size!==expected)||Boolean(found.size)!==Boolean(removed.size))throw Error('Partial site issue schema prohibited');
 return {text,present:found.size===3};
}
export function siteIssueMode(mode){
 const present=typeof mode==='string'&&mode.startsWith('migration-aware-site-issue-');
 return {present,prior:!present?mode:mode==='migration-aware-site-issue-schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice('migration-aware-site-issue-'.length)};
}
