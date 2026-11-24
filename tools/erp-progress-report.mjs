#!/usr/bin/env node
/**
 * Generate / validate Construction ERP remaining-hours progress.
 * Usage: node tools/erp-progress-report.mjs [--write]
 * --write updates docs/ERP-ACTIVE-PROGRESS.md in the checked-out branch.
 * No network, CI, Production, role grants, or release side effects.
 */
import {readFileSync,writeFileSync} from 'node:fs';
const d=JSON.parse(readFileSync('docs/ERP-ACTIVE-REMAINING-HOURS.json','utf8'));
const must=(v,msg)=>{if(!v)throw new Error(msg)};
must(d.schema==='construction-erp-evidence-backed-remaining-work-v1','Wrong schema');
must(d.packages.length===60,'60 packages required');
const records=new Map();
for(const p of d.packages){
  must(!records.has(p.id),'Duplicate '+p.id);
  must(Number.isInteger(p.baselineRemainingHours)&&p.baselineRemainingHours>=0,'Invalid start '+p.id);
  records.set(p.id,{...p,remaining:p.baselineRemainingHours});
}
const initial=[...records.values()].reduce((a,p)=>a+p.baselineRemainingHours,0);
must(initial===d.currentRemainingWorkBaselineHours,'Initial 1847h does not reconcile');
must([...records.values()].reduce((a,p)=>a+p.optimizationTargetHours,0)===d.fullScopeOptimizationTargetHours,'Optimization 1500h does not reconcile');
const ids=new Set();
for(const e of d.events){
  must(e.id&&!ids.has(e.id),'Duplicate event');
  ids.add(e.id);
  must(Array.isArray(e.evidence)&&e.evidence.length>0&&e.evidence.every(u=>typeof u==='string'&&u.startsWith('https://github.com/')),'Event needs GitHub evidence: '+e.id);
  if(e.packageId===null){
    must(e.beforeHours===null&&e.afterHours===null&&e.reductionHours===0,'Unpriced event cannot retire hours');
    continue;
  }
  const p=records.get(e.packageId);
  must(p,'Unknown package: '+e.packageId);
  must(Number.isInteger(e.beforeHours)&&Number.isInteger(e.afterHours)&&e.afterHours>=0,'Invalid event hours '+e.id);
  must(p.remaining===e.beforeHours,'Stale event before-hours '+e.id);
  must(e.reductionHours===e.beforeHours-e.afterHours,'Incorrect subtraction '+e.id);
  if(e.afterHours===0)must(e.formalAcceptance===true&&typeof e.formalAcceptanceUrl==='string'&&e.formalAcceptanceUrl.startsWith('https://github.com/'),'No 0h before actual acceptance '+e.id);
  p.remaining=e.afterHours;
}
const all=[...records.values()];
const remaining=all.reduce((a,p)=>a+p.remaining,0);
const reduction=initial-remaining;
const additional=d.unestimatedWork.reduce((a,x)=>{
  must(x.hours===null||(Number.isInteger(x.hours)&&x.hours>=0),'Invalid discovered-scope work hours');
  if(x.hours===0)must(x.formalAcceptance===true&&typeof x.formalAcceptanceUrl==='string',
    'Discovered scope cannot reach 0h before formal acceptance: '+x.id);
  return a+(x.hours??0);
},0);
const forecast=remaining+additional;
if(forecast===0){
 must(d.counts.officialPrototypeCompleted===d.counts.officialPrototypeTotal&&
 d.counts.officialGoLiveCompleted===d.counts.officialGoLiveTotal &&
 d.unestimatedWork.every(x=>x.hours!==null) &&
 all.every(p=>p.remaining===0),
 'FULL_ERP_FINAL_GATE_NOT_ACCEPTED: 0h requires all package, prototype, GL and gap gates');
}
const stages=d.stageOrder.map(id=>{
 const items=all.filter(p=>p.stage===id);
 must(items.length>0,'Empty stage '+id);
 return {id,items,start:items.reduce((a,p)=>a+p.baselineRemainingHours,0),left:items.reduce((a,p)=>a+p.remaining,0),accepted:items.filter(p=>p.remaining===0).length};
});
must(stages.reduce((a,s)=>a+s.left,0)===remaining,'Stage arithmetic mismatch');
must(stages.reduce((a,s)=>a+s.items.length,0)===60,'Stage census mismatch');
const fmt=x=>Number(x).toLocaleString('en-US');
const pct=(x,y)=>(x*100/y).toFixed(2)+'%';
let out='# Construction ERP — evidence-backed remaining-hours dashboard\n\n';
out+='**Deadline:** 31 Dec 2026, ALL 112 requirements / 8 real roles / Production. **Risk RED.** This is estimated future work, not observed worker time, and does not waive review or Owner acceptance.\n\n';
out+='## Full ERP countdown: **'+fmt(forecast)+'h → 0h**\n\n';
out+='| Measure | Amount |\n|---|---:|\n';
out+='| Starting provisional remaining estimate (23 Nov) | '+fmt(initial)+'h |\n';
out+='| Subsequent forecast work reduction | '+fmt(reduction)+'h ('+pct(reduction,initial)+') |\n';
out+='| Newly priced mandatory work not in original 60 rows | +'+fmt(additional)+'h |\n';
out+='| **Latest remaining forecast** | **'+fmt(forecast)+'h** |\n';
out+='| Historical original forecast | '+fmt(d.historicalRemainingBaselineHours)+'h |\n';
out+='| Proposed, NOT accepted optimization target | '+fmt(d.fullScopeOptimizationTargetHours)+'h |\n';
out+='| Formally accepted whole packages | '+all.filter(p=>p.remaining===0).length+'/60 |\n';
out+='| Prototype milestones | '+d.counts.officialPrototypeCompleted+'/8 |\n';
out+='| GL release gates | '+d.counts.officialGoLiveCompleted+'/10 |\n';
out+='| Last published M4 technical checklist | '+d.counts.m4TechnicalCheckpointsCompleted+'/32 |\n';
out+='| Actual productive hours logged | UNKNOWN |\n';
out+='| Still unpriced source gaps | '+d.unestimatedWork.filter(x=>x.hours===null).length+' |\n\n';
out+='## Every milestone — rolling hours\n\n';
out+='| Stage | 23 Nov baseline | Earlier reduction | New priced scope | Current remaining | Accepted baseline packages |\n|---|---:|---:|---:|---:|---:|\n';
for(const s of stages){
 const extra=d.unestimatedWork.filter(x=>x.stage===s.id).reduce((a,x)=>a+(x.hours??0),0);
 out+='| '+s.id+' | '+s.start+'h | '+(s.start-s.left)+'h | +'+extra+'h | **'+(s.left+extra)+'h** | '+s.accepted+'/'+s.items.length+' |\n';
}
out+='| **All stages** | **'+fmt(initial)+'h** | **'+fmt(reduction)+'h** | **+'+fmt(additional)+'h** | **'+fmt(forecast)+'h** | **'+all.filter(p=>p.remaining===0).length+'/60** |\n\n';
out+='## Every work package — rolling hours\n\n';
out+='| Package | Stage | Work item | Start | Credited forecast reduction | Remaining | Unapproved optimized target |\n|---|---|---|---:|---:|---:|---:|\n';
for(const p of all)out+='| '+p.id+' | '+p.stage+' | '+p.title.replaceAll('|','/')+' | '+p.baselineRemainingHours+'h | '+(p.baselineRemainingHours-p.remaining)+'h | **'+p.remaining+'h** | '+p.optimizationTargetHours+'h |\n';
out+='\n## Evidence-backed updates (latest first)\n\n';
for(const e of [...d.events].reverse()){
 out+='- **'+e.date+' · '+(e.packageId??e.kind)+'**: '+(e.packageId?e.beforeHours+'h → '+e.afterHours+'h':'Progress recorded; hours unpriced')+'. '+e.basis+' ';
 out+=e.evidence.map((u,i)=>'[Evidence '+(i+1)+']('+u+')').join(' ')+'\n';
}
out+='\n## Outstanding unpriced gaps\n\n';
for(const x of d.unestimatedWork){
 out+='- **'+x.id+'** ('+x.stage+'): '+(x.hours===null?'TBD':x.hours+'h remaining')+'; '+x.remaining+'. [Source]('+x.evidence+')\n';
}
out+='\n**Credit rule:** Each Chat development session publishes source SHA, explicit deliverable, reused/new verification and the estimated remaining hours for the affected package, with evidence. Commits and CI passes alone do not automatically remove hours. New defects or omitted scope may INCREASE the forecast. Package 0h requires recorded formal acceptance; full ERP 0h requires all 60 exits and all 10 GL gates. Never self-approve. Canonical issue: [#414](https://github.com/threeswordz/cinder-grind/issues/414).\n';
if(process.argv.includes('--write')){
 writeFileSync('docs/ERP-ACTIVE-PROGRESS.md',out);
 console.log('Dashboard written: '+fmt(forecast)+'h remaining including newly priced work, '+d.events.length+' events');
}else process.stdout.write(out);
