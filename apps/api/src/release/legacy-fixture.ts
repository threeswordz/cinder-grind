import { readFileSync } from 'node:fs';

export function legacyFixture(): { companyId: string; customerId: string; supplierId: string; userId: string; projectId: string; boqId: string; unknownPoId: string; unknownBudgetId: string; knownPoId: string; knownBudgetId: string; checkerId: string; costCodeId: string; directCostId: string; projectVariationId: string; directCostRole: string; projectVariationRole: string; directCostWorkflow: string; projectVariationWorkflow: string; } {
  const path = process.env.ERP_LEGACY_FIXTURE;
  if (!path) throw new Error('Historical currency tests require the genuine previous-release fixture from validate-isolated.mjs. Never create foreign fixtures by bypassing policy guards.');
  return JSON.parse(readFileSync(path, 'utf8')) as { companyId: string; customerId: string; supplierId: string; userId: string; projectId: string; boqId: string; unknownPoId: string; unknownBudgetId: string; knownPoId: string; knownBudgetId: string; checkerId: string; costCodeId: string; directCostId: string; projectVariationId: string; directCostRole: string; projectVariationRole: string; directCostWorkflow: string; projectVariationWorkflow: string; };
}
