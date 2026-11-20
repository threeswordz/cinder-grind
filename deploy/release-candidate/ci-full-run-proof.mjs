// Actual full execution only. Use every declared step from the trusted frozen
// workflow, not a second inventory that could omit a predecessor/browser gate.
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../../.github/workflows/validate.yml',import.meta.url),'utf8');
const body=workflow.slice(workflow.indexOf('\n  validate:\n'));
export const FULL_STEPS=Object.freeze([...body.matchAll(/^      - name: (.+)$/gm)].map(m=>m[1]));
if(FULL_STEPS.length<30||new Set(FULL_STEPS).size!==FULL_STEPS.length||
  FULL_STEPS.at(-1)!=='Confirm current candidate after all full evidence')throw Error('FULL_WORKFLOW_INVENTORY_INVALID');

export function fullJobSucceeded(job, runId) {
  return job?.name === 'validate' && job.run_id === runId && job.status === 'completed' &&
    job.conclusion === 'success' && Array.isArray(job.steps) && job.steps.length >= FULL_STEPS.length &&
    job.steps.every(s => s.status === 'completed' && s.conclusion === 'success') &&
    FULL_STEPS.every((name,index) => {
      const at=job.steps.findIndex(s=>s.name===name&&s.conclusion==='success');
      return at>=0&&(index===0||at>job.steps.findIndex(s=>s.name===FULL_STEPS[index-1]));
    });
}
