/**
 * FM02: deterministic technical preview of a Ben-confirmed Project work-plan
 * weight roll-up. This is a pure calculation, NOT an authorization or source-
 * authentication service. The future API must load the plan, Ben confirmation,
 * current Project/Company-scoped Activity progress and approved BOQ quantities
 * from canonical tables; callers must never trust browser-supplied source IDs.
 *
 * No changes to ActivityProgress, BudgetRevision, Cost/Client BOQ or financial
 * amounts. Missing source evidence blocks a total instead of assuming 0/100%.
 */
export type QuantityProgressSource = {
  kind: 'QUANTITY';
  sourceRecordId: string;
  approvedBudgetRevisionLineId: string;
  uomId: string;
  plannedQuantity: string;
  completedQuantity: string;
};
export type MilestoneProgressSource = {
  kind: 'MILESTONE';
  sourceRecordId: string;
  percentComplete: string;
  assessmentReason: string;
};
export type ProgressEvidence = QuantityProgressSource | MilestoneProgressSource;
export type WeightedPlanLine = {
  activityId: string;
  weightPercent: string;
  source: ProgressEvidence | null;
};
export type ConfirmedWorkPlanSnapshot = {
  planId: string;
  versionNo: number;
  /** Only a trusted database confirmation/role/scope check may set this. */
  confirmationVerified: boolean;
  lines: readonly WeightedPlanLine[];
};
export type WeightedProgressResult = {
  planId: string;
  versionNo: number;
  status: 'CALCULATED_TECHNICAL_ONLY' | 'BLOCKED_PLAN_UNCONFIRMED' | 'BLOCKED_MISSING_SOURCE';
  percentComplete: string | null;
  missingActivityIds: string[];
  lines: { activityId: string; weightPercent: string; sourceKind: ProgressEvidence['kind'] | null; percentComplete: string | null }[];
};

export class WeightedProgressContractError extends Error {
  constructor(public readonly code: string) { super(code); }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reject = (code: string): never => { throw new WeightedProgressContractError(code); };
function requiredId(value: string, code: string) {
  if (typeof value !== 'string' || !uuid.test(value)) reject(code);
}
function fixed(value: string, scale: number, maxWholeDigits: number, code: string): bigint {
  if (typeof value !== 'string' ||
      !new RegExp('^(?:0|[1-9][0-9]{0,' + (maxWholeDigits - 1) + '})(?:\\.[0-9]{1,' + scale + '})?$').test(value)) reject(code);
  const [whole, fractional = ''] = value.split('.');
  return BigInt(whole) * (10n ** BigInt(scale)) + BigInt(fractional.padEnd(scale, '0'));
}
function greatestCommonDivisor(first: bigint, second: bigint): bigint {
  let a = first, b = second;
  while (b !== 0n) { const r = a % b; a = b; b = r; }
  return a;
}
function sumRational(a: readonly [bigint, bigint], b: readonly [bigint, bigint]): [bigint, bigint] {
  const top = a[0] * b[1] + b[0] * a[1];
  const bottom = a[1] * b[1];
  const divisor = greatestCommonDivisor(top, bottom);
  return [top / divisor, bottom / divisor];
}
function roundHalfUp(value: readonly [bigint, bigint]): bigint {
  return (2n * value[0] + value[1]) / (2n * value[1]);
}
function percentFromBasisPoints(value: bigint): string {
  const whole = value / 100n, fraction = value % 100n;
  return whole.toString() + '.' + fraction.toString().padStart(2, '0');
}
function sourceRatio(source: ProgressEvidence): [bigint, bigint] {
  requiredId(source.sourceRecordId, 'FM02_SOURCE_RECORD_REQUIRED');
  if (source.kind === 'MILESTONE') {
    if (typeof source.assessmentReason !== 'string' ||
        source.assessmentReason.trim().length < 1 || source.assessmentReason.length > 10000) {
      reject('FM02_MILESTONE_ASSESSMENT_REASON_REQUIRED');
    }
    const progress = fixed(source.percentComplete, 2, 3, 'FM02_MILESTONE_PERCENT_INVALID');
    if (progress > 10000n) reject('FM02_MILESTONE_PERCENT_INVALID');
    return [progress, 10000n];
  }
  if (source.kind !== 'QUANTITY') reject('FM02_SOURCE_KIND_INVALID');
  requiredId(source.approvedBudgetRevisionLineId, 'FM02_APPROVED_BOQ_SOURCE_REQUIRED');
  requiredId(source.uomId, 'FM02_QUANTITY_UOM_REQUIRED');
  const planned = fixed(source.plannedQuantity, 4, 14, 'FM02_PLAN_QUANTITY_INVALID');
  const done = fixed(source.completedQuantity, 4, 14, 'FM02_COMPLETED_QUANTITY_INVALID');
  if (planned <= 0n || done > planned) reject('FM02_QUANTITY_OUTSIDE_APPROVED_SOURCE');
  return [done, planned];
}

/** Computes a read-only percentage. This does not approve a work plan. */
export function calculateConfirmedProjectProgress(plan: ConfirmedWorkPlanSnapshot): WeightedProgressResult {
  requiredId(plan.planId, 'FM02_PLAN_ID_INVALID');
  if (!Number.isSafeInteger(plan.versionNo) || plan.versionNo < 1) reject('FM02_PLAN_VERSION_INVALID');
  if (!Array.isArray(plan.lines) || plan.lines.length < 1 || plan.lines.length > 100) reject('FM02_PLAN_LINE_COUNT_INVALID');
  const ids = new Set<string>(), records = new Set<string>();
  const items: WeightedProgressResult['lines'] = [];
  const missing: string[] = [];
  let weightSum = 0n, sum: [bigint, bigint] = [0n, 1n];
  for (const line of plan.lines) {
    requiredId(line.activityId, 'FM02_ACTIVITY_ID_INVALID');
    if (ids.has(line.activityId)) reject('FM02_DUPLICATE_ACTIVITY_CONTRIBUTION');
    ids.add(line.activityId);
    const weight = fixed(line.weightPercent, 2, 3, 'FM02_WEIGHT_INVALID');
    if (weight <= 0n || weight > 10000n) reject('FM02_WEIGHT_INVALID');
    weightSum += weight;
    if (!line.source) {
      missing.push(line.activityId);
      items.push({activityId: line.activityId, weightPercent: percentFromBasisPoints(weight),
        sourceKind: null, percentComplete: null});
      continue;
    }
    if (records.has(line.source.sourceRecordId)) reject('FM02_DUPLICATE_SOURCE_CONTRIBUTION');
    records.add(line.source.sourceRecordId);
    const ratio = sourceRatio(line.source);
    sum = sumRational(sum, [weight * ratio[0], ratio[1]]);
    const bp = roundHalfUp([10000n * ratio[0], ratio[1]]);
    items.push({activityId: line.activityId, weightPercent: percentFromBasisPoints(weight),
      sourceKind: line.source.kind, percentComplete: percentFromBasisPoints(bp)});
  }
  if (weightSum !== 10000n) reject('FM02_WEIGHTS_MUST_TOTAL_100');
  const base = {planId: plan.planId, versionNo: plan.versionNo, lines: items, missingActivityIds: missing};
  if (!plan.confirmationVerified) return {...base, status: 'BLOCKED_PLAN_UNCONFIRMED', percentComplete: null};
  if (missing.length) return {...base, status: 'BLOCKED_MISSING_SOURCE', percentComplete: null};
  const bp = roundHalfUp(sum);
  if (bp < 0n || bp > 10000n) reject('FM02_ROLLUP_OUT_OF_RANGE');
  return {...base, status: 'CALCULATED_TECHNICAL_ONLY', percentComplete: percentFromBasisPoints(bp)};
}
