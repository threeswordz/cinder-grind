import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { calculateConfirmedProjectProgress as rollup } from './project-progress-weighting';

const ids = () => ({planId: randomUUID(), first: randomUUID(), second: randomUUID(), evidenceA: randomUUID(), evidenceB: randomUUID()});
function example(confirmed = true) {
  const v = ids();
  return {planId: v.planId, versionNo: 1, confirmationVerified: confirmed, lines: [
    {activityId: v.first, weightPercent: '60.00', source: {kind: 'MILESTONE' as const,
      sourceRecordId: v.evidenceA, percentComplete: '50.00', assessmentReason: 'Measured work verified'}},
    {activityId: v.second, weightPercent: '40.00', source: {kind: 'MILESTONE' as const,
      sourceRecordId: v.evidenceB, percentComplete: '25.00', assessmentReason: 'Inspection recorded'}},
  ]};
}
function blocked(code: string, run: () => unknown) {
  assert.throws(run, e => e instanceof Error && e.message === code);
}
test('FM02 exact 60%*50% + 40%*25% = 40.00 without floating point', () => {
  const computed = rollup(example());
  assert.equal(computed.status, 'CALCULATED_TECHNICAL_ONLY');
  assert.equal(computed.percentComplete, '40.00');
  assert.deepEqual(computed.lines.map(l => l.percentComplete), ['50.00', '25.00']);
});
test('unconfirmed plan blocks overall percentage instead of pretending approval', () => {
  const result = rollup(example(false));
  assert.equal(result.status, 'BLOCKED_PLAN_UNCONFIRMED');
  assert.equal(result.percentComplete, null);
});
test('missing canonical Activity evidence blocks roll-up, not implicitly zero/complete', () => {
  const input = example(); input.lines[1]!.source = null as never;
  const result = rollup(input);
  assert.equal(result.status, 'BLOCKED_MISSING_SOURCE');
  assert.equal(result.percentComplete, null);
  assert.deepEqual(result.missingActivityIds, [input.lines[1]!.activityId]);
});
test('quantities use dimensionless individual ratios; m² and kg are never summed together', () => {
  const input = example(), left = input.lines[0]!, right = input.lines[1]!;
  const a = {kind:'QUANTITY' as const,sourceRecordId:left.source!.sourceRecordId,
    approvedBudgetRevisionLineId:randomUUID(),uomId:randomUUID(),
    plannedQuantity:'20.0000',completedQuantity:'10.0000'};
  const b = {kind:'QUANTITY' as const,sourceRecordId:right.source!.sourceRecordId,
    approvedBudgetRevisionLineId:randomUUID(),uomId:randomUUID(),
    plannedQuantity:'8.0000',completedQuantity:'2.0000'};
  const result = rollup({...input,lines:[{...left,source:a},{...right,source:b}]});
  assert.equal(result.percentComplete,'40.00');
});
test('duplicate Activity ID and duplicate evidence are refused', () => {
  const input = example();
  blocked('FM02_DUPLICATE_ACTIVITY_CONTRIBUTION', () =>
    rollup({...input,lines:[input.lines[0]!,{...input.lines[1]!,activityId:input.lines[0]!.activityId}]}));
  blocked('FM02_DUPLICATE_SOURCE_CONTRIBUTION', () =>
    rollup({...input,lines:[input.lines[0]!,{...input.lines[1]!,source:{...input.lines[1]!.source!,sourceRecordId:input.lines[0]!.source!.sourceRecordId}}]}));
});
test('weight total must be precisely 100%; individual weights cannot be zero', () => {
  const input = example();
  blocked('FM02_WEIGHTS_MUST_TOTAL_100', () =>
    rollup({...input,lines:[input.lines[0]!,{...input.lines[1]!,weightPercent:'39.99'}]}));
  blocked('FM02_WEIGHT_INVALID', () =>
    rollup({...input,lines:[{...input.lines[0]!,weightPercent:'0.00'},input.lines[1]!]}));
});
test('malformed measurements, missing reason and over-completion are not accepted', () => {
  const input = example();
  blocked('FM02_MILESTONE_ASSESSMENT_REASON_REQUIRED', () =>
    rollup({...input,lines:[{...input.lines[0]!,source:{...input.lines[0]!.source!,assessmentReason:'  '}},
      input.lines[1]!]}));
  blocked('FM02_MILESTONE_PERCENT_INVALID', () =>
    rollup({...input,lines:[{...input.lines[0]!,source:{...input.lines[0]!.source!,percentComplete:'100.01'}},
      input.lines[1]!]}));
  const first = input.lines[0]!;
  blocked('FM02_QUANTITY_OUTSIDE_APPROVED_SOURCE', () =>
    rollup({...input,lines:[{...first,source:{kind:'QUANTITY',sourceRecordId:first.source!.sourceRecordId,
      approvedBudgetRevisionLineId:randomUUID(),uomId:randomUUID(),plannedQuantity:'2.00',completedQuantity:'3.00'}},
      input.lines[1]!]}));
});
test('one confirmed 100% plan yields 100%, zero milestone progress yields 0%', () => {
  const input=example();
  const first=rollup({...input,lines:[{...input.lines[0]!,weightPercent:'100.00',
    source:{...input.lines[0]!.source!,percentComplete:'100.00'}}]});
  assert.equal(first.percentComplete,'100.00');
  const second=rollup({...input,lines:[{...input.lines[0]!,weightPercent:'100.00',
    source:{...input.lines[0]!.source!,percentComplete:'0.00'}}]});
  assert.equal(second.percentComplete,'0.00');
});

// A source-level guard for the migration's PL/pgSQL delimiters and immutable
// plan custody. The actual PostgreSQL/Prisma deployment remains a separate
// focused native test gate; this check must never be called database proof.
test('FM02 migration PL/pgSQL dollar quotes are balanced and security triggers exist', () => {
  const migration = readFileSync(resolve(__dirname,
    '../../prisma/migrations/20261122140000_fm02_weighted_project_progress/migration.sql'), 'utf8');
  assert.equal((migration.match(/LANGUAGE plpgsql AS \$\$/g) ?? []).length, 4);
  assert.equal((migration.match(/END \$\$;/g) ?? []).length, 4);
  assert.doesNotMatch(migration, /LANGUAGE plpgsql AS \$(?:\r?\n)/);
  assert.doesNotMatch(migration, /END \$;/);
  assert.match(migration, /CREATE TRIGGER fm02_plan_confirm_only/);
  assert.match(migration, /CREATE TRIGGER fm02_plan_create_guard/);
  assert.match(migration, /CREATE TRIGGER fm02_line_create_guard/);
  assert.match(migration, /CREATE TRIGGER fm02_lines_immutable/);
  assert.match(migration, /FROM project_progress_plans WHERE id=NEW.plan_id FOR UPDATE/);
});
